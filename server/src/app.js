import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { ACTIONS } from './activity.js'

const ROLES = ['admin', 'manager', 'member']
const STATUSES = ['pending', 'active', 'disabled']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (res, status, message) => res.status(status).json({ message })

// `requestsPerWindow` is per IP address over 15 minutes; every API call checks a token and may write to the database.
export function createApp({ verifyToken, users, requestsPerWindow = 300 }) {
  const app = express()
  app.disable('x-powered-by')

  // The API only ever returns JSON about people: never cache it, never sniff it, never frame it, never leak the URL.
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    })
    next()
  })
  app.use(express.json({ limit: '100kb' }))
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: requestsPerWindow,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => fail(res, 429, 'Too many requests. Wait a few minutes and try again.'),
    }),
  )

  // A missed visit record shouldn't lock anyone out; access changes are logged transactionally instead.
  async function recordVisit(user, action, details = {}) {
    try {
      await users.logActivity(user.id, action, user.id, details)
    } catch (err) {
      console.error('Could not record visit', err)
    }
  }

  // Signed in with Microsoft, and known to SyncAI. Sets req.user and req.visit, and logs first sign-ins.
  async function authenticate(req, res, next) {
    const token = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return fail(res, 401, 'Sign in to continue.')
    let identity
    try {
      identity = await verifyToken(token)
    } catch {
      return fail(res, 401, 'Your sign-in has expired or is not valid. Sign in again.')
    }
    const { created, firstVisitToday, ...user } = await users.upsertFromToken(identity)
    req.user = user
    req.visit = { created, firstVisitToday }
    if (created) await recordVisit(user, 'signed_up', { role: user.role, status: user.status })
    next()
  }

  // Approved, with one of the given roles. Checked on every request from the database, never from the browser.
  const allow = (...roles) => (req, res, next) => {
    if (req.user.status !== 'active') return fail(res, 403, 'Your account is waiting for approval.')
    if (roles.length && !roles.includes(req.user.role)) return fail(res, 403, 'You do not have access to this.')
    next()
  }

  const api = express.Router()

  api.get('/health', async (_req, res) => {
    try {
      await users.ping()
      res.json({ ok: true, db: 'up' })
    } catch {
      res.status(503).json({ ok: false, db: 'down' })
    }
  })

  // Any signed-in person, including pending ones, so the app can show the right screen. Only their own record.
  // The app calls this when it opens while someone is still signed in: logged at most once a day.
  api.get('/me', authenticate, async (req, res) => {
    if (!req.visit.created && req.visit.firstVisitToday) await recordVisit(req.user, 'opened')
    res.json(req.user)
  })

  // The app calls this instead of /me straight after someone signs in through Microsoft, so every real sign-in
  // is recorded (a first sign-in is already recorded as signed_up). Returns the same record as /me.
  api.post('/signin', authenticate, async (req, res) => {
    if (!req.visit.created) await recordVisit(req.user, 'signed_in')
    res.json(req.user)
  })

  // Called by the app when someone clicks Sign out, while their token is still valid. Only explicit sign-outs
  // reach the server (closing the tab sends nothing), so the log shows these, not every session end.
  api.post('/signout', authenticate, async (req, res) => {
    await users.logActivity(req.user.id, 'signed_out', req.user.id, {})
    res.status(204).end()
  })

  api.get('/users', authenticate, allow('admin'), async (_req, res) => res.json(await users.list()))

  api.patch('/users/:id', authenticate, allow('admin'), async (req, res) => {
    const { role, status } = req.body ?? {}
    if (!UUID.test(req.params.id)) return fail(res, 404, 'User not found.')
    if (role === undefined && status === undefined) return fail(res, 400, 'Nothing to change: send role and/or status.')
    if (role !== undefined && !ROLES.includes(role)) return fail(res, 400, `role must be one of ${ROLES.join(', ')}.`)
    if (status !== undefined && !STATUSES.includes(status)) return fail(res, 400, `status must be one of ${STATUSES.join(', ')}.`)
    if (req.params.id === req.user.id) return fail(res, 400, 'You cannot change your own role or status.')
    const updated = await users.update(req.params.id, { role, status }, req.user.id)
    return updated ? res.json(updated) : fail(res, 404, 'User not found.')
  })

  // The audit trail, newest first. Admins only; read-only by design (there is no route to edit or delete it).
  api.get('/activity', authenticate, allow('admin'), async (req, res) => {
    const { limit = '50', before, person, action } = req.query
    const n = Number(limit)
    if (!Number.isInteger(n) || n < 1 || n > 100) return fail(res, 400, 'limit must be a whole number from 1 to 100.')
    if (before !== undefined && !/^\d{1,18}$/.test(before)) return fail(res, 400, 'before must be an activity id.')
    if (person !== undefined && !UUID.test(person)) return fail(res, 400, 'person must be a user id.')
    if (action !== undefined && !ACTIONS.includes(action)) return fail(res, 400, `action must be one of ${ACTIONS.join(', ')}.`)
    const items = await users.listActivity({ limit: n, before, person, action })
    res.json({ items, nextBefore: items.length === n ? items.at(-1).id : null })
  })

  app.use('/api', api)
  app.use((_req, res) => fail(res, 404, 'Not found.'))
  app.use((err, _req, res, _next) => {
    // Malformed JSON is the client's mistake; everything else stays vague so internals aren't exposed.
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'The request body is not valid JSON.')
    if (err.type === 'entity.too.large') return fail(res, 413, 'The request body is too large.')
    console.error(err)
    fail(res, 500, 'Something went wrong on our side.')
  })
  return app
}

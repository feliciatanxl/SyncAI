import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { ACTIONS } from './activity.js'
import { KINDS, cleanTeamName } from './teams.js'

const ROLES = ['admin', 'manager', 'member']
const STATUSES = ['pending', 'active', 'disabled']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (res, status, message) => res.status(status).json({ message })

// Every route and its methods; anything else on these paths answers 405.
const ALLOWED_METHODS = {
  '/health': ['GET'],
  '/me': ['GET'],
  '/signin': ['POST'],
  '/signout': ['POST'],
  '/users': ['GET'],
  '/users/:id': ['PATCH'],
  '/teams': ['GET', 'POST'],
  '/teams/:id': ['PATCH', 'DELETE'],
  '/teams/:id/members': ['POST'],
  '/teams/:id/members/:userId': ['DELETE'],
  '/my-teams': ['GET'],
  '/activity': ['GET'],
  '/assistant': ['POST'],
}

// `requestsPerWindow` is per IP address over 15 minutes; every API call checks a token and may write to the database.
// `trustProxy` is how many proxies sit in front (Railway: 1), so the rate limit sees each person's real IP.
// `assistant` answers Ask SyncAI questions (see assistant.js); without one the route answers 503.
export function createApp({ verifyToken, users, requestsPerWindow = 300, trustProxy = 0, assistant = null, assistantPerWindow = 30 }) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', trustProxy)

  // The API only ever returns JSON about people: never cache it, never sniff it, never frame it, never leak the URL.
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cross-Origin-Resource-Policy': 'same-origin',
    })
    next()
  })
  // Writes only accept JSON: anything else is 415, not silently read as an empty body.
  app.use((req, res, next) => {
    // req.is() is null without a body and false for a body of another type.
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.is('application/json') === false) {
      return fail(res, 415, 'Send the request body as application/json.')
    }
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
  // Their own record plus the teams they're in (and those teams' managers), nothing about anyone else's work.
  const ownRecord = async (user) => ({ ...user, teams: await users.teamsOf(user.id) })

  api.get('/me', authenticate, async (req, res) => {
    if (!req.visit.created && req.visit.firstVisitToday) await recordVisit(req.user, 'opened')
    res.json(await ownRecord(req.user))
  })

  // The app calls this instead of /me straight after someone signs in through Microsoft, so every real sign-in
  // is recorded (a first sign-in is already recorded as signed_up). Returns the same record as /me.
  api.post('/signin', authenticate, async (req, res) => {
    if (!req.visit.created) await recordVisit(req.user, 'signed_in')
    res.json(await ownRecord(req.user))
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

  // ---- Teams ----
  // Admins arrange teams but see no one's work. Managers only ever get the teams they lead.
  const teamId = (req, res, next) => (UUID.test(req.params.id) ? next() : fail(res, 404, 'Team not found.'))

  api.get('/teams', authenticate, allow('admin'), async (_req, res) => res.json(await users.listTeams()))

  api.post('/teams', authenticate, allow('admin'), async (req, res) => {
    res.status(201).json(await users.createTeam(cleanTeamName(req.body?.name), req.user.id))
  })

  api.patch('/teams/:id', authenticate, allow('admin'), teamId, async (req, res) => {
    res.json(await users.renameTeam(req.params.id, cleanTeamName(req.body?.name), req.user.id))
  })

  api.delete('/teams/:id', authenticate, allow('admin'), teamId, async (req, res) => {
    await users.deleteTeam(req.params.id, req.user.id)
    res.status(204).end()
  })

  api.post('/teams/:id/members', authenticate, allow('admin'), teamId, async (req, res) => {
    const { userId, kind } = req.body ?? {}
    if (!UUID.test(userId ?? '')) return fail(res, 400, 'userId must be a user id.')
    if (!KINDS.includes(kind)) return fail(res, 400, 'kind must be manager or member.')
    await users.addToTeam(req.params.id, userId, kind, req.user.id)
    res.status(204).end()
  })

  api.delete('/teams/:id/members/:userId', authenticate, allow('admin'), teamId, async (req, res) => {
    if (!UUID.test(req.params.userId)) return fail(res, 404, 'They’re not in this team.')
    await users.removeFromTeam(req.params.id, req.params.userId, req.user.id)
    res.status(204).end()
  })

  api.get('/my-teams', authenticate, allow('manager'), async (req, res) => res.json(await users.teamsManagedBy(req.user.id)))

  // The audit trail, newest first. Admins only; read-only by design (there is no route to edit or delete it).
  api.get('/activity', authenticate, allow('admin'), async (req, res) => {
    const { limit = '50', before, person, action, date } = req.query
    const n = Number(limit)
    if (!Number.isInteger(n) || n < 1 || n > 100) return fail(res, 400, 'limit must be a whole number from 1 to 100.')
    if (before !== undefined && !/^\d{1,18}$/.test(before)) return fail(res, 400, 'before must be an activity id.')
    if (person !== undefined && !UUID.test(person)) return fail(res, 400, 'person must be a user id.')
    if (action !== undefined && !ACTIONS.includes(action)) return fail(res, 400, `action must be one of ${ACTIONS.join(', ')}.`) 
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 400, 'date must be in YYYY-MM-DD format.')
    const items = await users.listActivity({ limit: n, before, person, action, date })
    res.json({ items, nextBefore: items.length === n ? items.at(-1).id : null })
  })

  // Ask SyncAI. Any signed-in person who isn't disabled (pending people can ask how SyncAI works).
  // Its own, tighter limit per person: every question is a paid call to the AI service.
  const assistantLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: assistantPerWindow,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    handler: (_req, res) => fail(res, 429, 'You have asked a lot of questions. Wait a few minutes and try again.'),
  })
  api.post('/assistant', authenticate, async (req, res, next) => {
    if (req.user.status === 'disabled') return fail(res, 403, 'Your access to SyncAI is turned off.')
    next()
  }, assistantLimit, async (req, res) => {
    if (!assistant?.configured) return res.status(503).json({ message: 'Ask SyncAI is not connected to its AI service yet.', code: 'assistant_off' })
    const language = ['en', 'zh', 'ms', 'ta'].includes(req.body?.language) ? req.body.language : 'en'
    const reply = await assistant.ask(req.body?.messages, { language, role: req.user.status === 'active' ? req.user.role : 'pending user' })
    res.json({ reply })
  })

  // A known path with the wrong method is 405 with an Allow header, not 404. Registered after every route.
  for (const [path, methods] of Object.entries(ALLOWED_METHODS)) {
    api.all(path, (_req, res) => {
      res.set('Allow', methods.join(', '))
      fail(res, 405, 'Method not allowed.')
    })
  }

  app.use('/api', api)
  app.use((_req, res) => fail(res, 404, 'Not found.'))
  app.use((err, _req, res, _next) => {
    // Broken team rules carry a code the app translates into the person's language.
    if (err.expose && err.code) return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra })
    // Malformed JSON is the client's mistake; everything else stays vague so internals aren't exposed.
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'The request body is not valid JSON.')
    if (err.type === 'entity.too.large') return fail(res, 413, 'The request body is too large.')
    console.error(err)
    fail(res, 500, 'Something went wrong on our side.')
  })
  return app
}

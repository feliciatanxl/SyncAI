import express from 'express'

const ROLES = ['admin', 'manager', 'member']
const STATUSES = ['pending', 'active', 'disabled']

const fail = (res, status, message) => res.status(status).json({ message })

export function createApp({ verifyToken, users }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  // Signed in with Microsoft, and known to SyncAI. Sets req.user.
  async function authenticate(req, res, next) {
    const token = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return fail(res, 401, 'Sign in to continue.')
    let identity
    try {
      identity = await verifyToken(token)
    } catch {
      return fail(res, 401, 'Your sign-in has expired or is not valid. Sign in again.')
    }
    req.user = await users.upsertFromToken(identity)
    next()
  }

  // Approved, with one of the given roles.
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

  // Any signed-in person, including pending ones, so the app can show the right screen.
  api.get('/me', authenticate, (req, res) => res.json(req.user))

  api.get('/users', authenticate, allow('admin'), async (_req, res) => res.json(await users.list()))

  api.patch('/users/:id', authenticate, allow('admin'), async (req, res) => {
    const { role, status } = req.body ?? {}
    if (role !== undefined && !ROLES.includes(role)) return fail(res, 400, `role must be one of ${ROLES.join(', ')}.`)
    if (status !== undefined && !STATUSES.includes(status)) return fail(res, 400, `status must be one of ${STATUSES.join(', ')}.`)
    if (req.params.id === req.user.id) return fail(res, 400, 'You cannot change your own role or status.')
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return fail(res, 404, 'User not found.')
    const updated = await users.update(req.params.id, { role, status })
    return updated ? res.json(updated) : fail(res, 404, 'User not found.')
  })

  app.use('/api', api)
  app.use((_req, res) => fail(res, 404, 'Not found.'))
  app.use((err, _req, res, _next) => {
    console.error(err)
    fail(res, 500, 'Something went wrong on our side.')
  })
  return app
}

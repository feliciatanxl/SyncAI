import { afterEach, describe, expect, it, vi } from 'vitest'
import { caseDataMode, createApiCaseService, createDemoCaseService } from './caseService.js'

const member = { id: 'u1', status: 'active', role: 'member', displayName: 'Officer One' }
const manager = { id: 'm1', status: 'active', role: 'manager', displayName: 'Manager' }

describe('caseDataMode', () => {
  it('uses the API unless demo data is explicitly configured, in development too', () => {
    expect(caseDataMode({ DEV: false })).toBe('api')
    expect(caseDataMode({ DEV: true })).toBe('api')
    expect(caseDataMode({ DEV: true, VITE_CASE_DATA: 'api' })).toBe('api')
    expect(caseDataMode({ DEV: false, VITE_CASE_DATA: 'demo' })).toBe('demo')
    expect(caseDataMode({ DEV: true, VITE_CASE_DATA: 'nonsense' })).toBe('api')
  })
})

describe('API adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports a missing endpoint as an error instead of falling back to demo cases', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })))
    const service = createApiCaseService(async () => 'token')
    expect(service.mode).toBe('api')
    await expect(service.list()).rejects.toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledWith('/api/cases', expect.objectContaining({ method: 'GET' }))
  })
})

describe('demo adapter', () => {
  it('keeps each instance isolated and starts fresh', async () => {
    const a = createDemoCaseService(member)
    const b = createDemoCaseService(member)
    await a.addNote('demo-case-001', 'Called resident')
    const aCase = (await a.list()).cases.find((c) => c.id === 'demo-case-001')
    const bCase = (await b.list()).cases.find((c) => c.id === 'demo-case-001')
    expect(aCase.timeline.length).toBe(bCase.timeline.length + 1)
  })

  it('returns copies, so callers cannot change the store', async () => {
    const s = createDemoCaseService(member)
    const first = await s.list()
    first.cases[0].title = 'changed'
    expect((await s.list()).cases[0].title).not.toBe('changed')
  })

  it('refuses changes outside the member’s scope and empty input', async () => {
    const s = createDemoCaseService(member)
    await expect(s.addNote('demo-case-002', 'x')).rejects.toThrow(/cannot change/)
    await expect(s.addNote('demo-case-001', '  ')).rejects.toThrow(/required/)
  })

  it('turns a member’s closure into a request a manager decides', async () => {
    const s = createDemoCaseService(member)
    const requested = await s.moveStage('demo-case-004', 'closed', 'All done')
    expect(requested.stage).toBe('ready_for_closure')
    expect(requested.pendingRequest).toMatchObject({ type: 'closure' })
    await expect(s.decideRequest('demo-case-004', true)).rejects.toThrow(/manager/)
  })

  it('lets a manager close a ready case and records the change', async () => {
    const s = createDemoCaseService(manager)
    const before = (await s.list()).cases.find((c) => c.id === 'demo-case-004')
    const closed = await s.moveStage('demo-case-004', 'closed')
    expect(closed.stage).toBe('closed')
    expect(closed.history.length).toBe(before.history.length + 1)
    // CAS-2026-001 has an active blocker, so it can't skip to Closure Ready.
    await expect(s.moveStage('demo-case-001', 'ready_for_closure')).rejects.toThrow(/blocker/)
  })

  it('labels logged communications as simulated', async () => {
    const s = createDemoCaseService(member)
    const c = await s.logCommunication('demo-case-001', { channel: 'Phone', direction: 'outbound', party: 'Resident', summary: 'Gave update' })
    expect(c.communications.at(-1).channel).toBe('Phone (simulated)')
  })
})

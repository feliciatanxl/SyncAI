// Guardrails for Ask SyncAI, applied on the server around every call to the AI service:
// - personal data (NRIC/FIN, phone, email, card numbers) is masked before it leaves SyncAI and in every reply;
// - obvious prompt-injection attempts are answered with a fixed refusal, without calling the model;
// - the "insight" context a browser sends is rebuilt from a fixed schema of counts, so no free text reaches the prompt;
// - a reply that leaks the system prompt is replaced with a refusal.

const PII = [
  [/\b[STFGM]\d{7}[A-Z]\b/gi, '[NRIC removed]'],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '[email removed]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[number removed]'],
  [/(?:\+?65[ -]?)?\b[3689]\d{3}[ -]?\d{4}\b/g, '[phone removed]'],
]

export function redact(text) {
  return PII.reduce((out, [pattern, label]) => out.replace(pattern, label), text)
}

const INJECTION = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|rules?|prompt|guardrails?|policy|policies)\b/i,
  /\b(system|developer|hidden|initial)\s+(prompt|message|instructions?)\b/i,
  /\b(you are now|act as|pretend (to be|you are)|roleplay as)\b/i,
  /\b(jailbreak|DAN mode|developer mode|do anything now)\b/i,
  /\breveal\b[^.\n]{0,30}\b(instructions?|prompt|rules?|config)/i,
]

export const isInjection = (text) => INJECTION.some((p) => p.test(text))

export const REFUSAL = {
  en: "I can't help with that. I can only answer questions about using SyncAI and your work in it.",
  zh: '我无法协助这个请求。我只能回答关于使用 SyncAI 及您在其中工作的问题。',
  ms: 'Saya tidak dapat membantu dengan itu. Saya hanya boleh menjawab soalan tentang penggunaan SyncAI dan kerja anda di dalamnya.',
  ta: 'அதற்கு என்னால் உதவ முடியாது. SyncAI பயன்பாடு மற்றும் அதில் உங்கள் பணி பற்றிய கேள்விகளுக்கு மட்டுமே பதிலளிக்க முடியும்.',
}

// ---- Insight context: counts only, rebuilt from a fixed schema ----

const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 100_000 ? v : undefined)
const counts = (raw, keys) => {
  if (!raw || typeof raw !== 'object') return undefined
  const out = {}
  for (const k of keys) if (count(raw[k]) !== undefined) out[k] = raw[k]
  return Object.keys(out).length ? out : undefined
}

const CASE_KEYS = ['open', 'overdue', 'dueSoon', 'followUps', 'blocked', 'readyForClosure', 'closureItemsPending', 'pendingRequests', 'closed']
const URGENCY_KEYS = ['critical', 'high', 'medium', 'low']
const STAGE_KEYS = ['open', 'in_progress', 'pending_external', 'ready_for_closure', 'closed']
const RULE_KEYS = ['resident_callback', 'contractor_pending', 'inspection_outcome', 'appointment_unconfirmed', 'missing_evidence', 'stale_case']

// Members and managers send counts of the cases they can already see. Anything outside the schema is dropped.
export function cleanCaseContext(raw, role) {
  if (!raw || typeof raw !== 'object' || (role !== 'member' && role !== 'manager')) return null
  const ctx = {
    cases: counts(raw.cases, CASE_KEYS),
    byUrgency: counts(raw.byUrgency, URGENCY_KEYS),
    byStage: counts(raw.byStage, STAGE_KEYS),
    followUpsByRule: counts(raw.followUpsByRule, RULE_KEYS),
  }
  // Managers: open/overdue per officer, unnamed, at most 50 rows.
  if (role === 'manager' && Array.isArray(raw.officers)) {
    const officers = raw.officers.slice(0, 50).map((o) => counts(o, ['open', 'overdue'])).filter(Boolean)
    if (officers.length) ctx.officers = officers
  }
  return Object.values(ctx).some(Boolean) ? ctx : null
}

// Admins: built on the server from the user store, never from the browser.
export function adminContext(people, teams) {
  const by = (pick) => people.reduce((acc, p) => ({ ...acc, [pick(p)]: (acc[pick(p)] ?? 0) + 1 }), {})
  return {
    people: { total: people.length, ...Object.fromEntries(Object.entries(by((p) => p.status)).map(([k, v]) => [`status_${k}`, v])) },
    roles: by((p) => p.role),
    teams: {
      total: teams.length,
      withoutManager: teams.filter((t) => !t.people.some((p) => p.kind === 'manager')).length,
      withoutMembers: teams.filter((t) => !t.people.some((p) => p.kind !== 'manager')).length,
    },
  }
}

// Plain lines for the system prompt. Keys and numbers only, so nothing here can carry instructions.
export function describeContext(ctx) {
  if (!ctx) return ''
  const lines = []
  for (const [group, value] of Object.entries(ctx)) {
    if (Array.isArray(value)) value.forEach((row, i) => lines.push(`${group}[${i + 1}]: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', ')}`))
    else if (value) lines.push(`${group}: ${Object.entries(value).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  return lines.join('\n')
}

// ---- Output ----

// Masks personal data in a streamed reply. Holds back the last few characters so a phone number or email split
// across two pieces is still caught; `leaked` turns true if the reply contains the system prompt's canary.
export function createStreamRedactor(canary, hold = 48) {
  let pending = ''
  let leaked = false
  const check = (s) => { if (canary && s.includes(canary)) leaked = true; return s }
  return {
    get leaked() { return leaked },
    push(piece) {
      // Mask the whole buffer before cutting, so a match that spans the cut is caught while it's still in one piece.
      pending = redact(check(pending + piece))
      if (pending.length <= hold) return ''
      // Cut at the last whitespace before the held tail, so no word is split.
      let cut = pending.lastIndexOf(' ', pending.length - hold)
      if (cut <= 0) cut = pending.length - hold
      const out = pending.slice(0, cut)
      pending = pending.slice(cut)
      return out
    },
    flush() {
      const out = redact(check(pending))
      pending = ''
      return out
    },
  }
}

// Ask SyncAI: answers questions about using SyncAI with Groq's hosted gpt-oss-120b.
// Only the conversation text is sent to Groq: no names, emails, case or task data (PDPA: send only what's needed).
// The key lives in server/.env and never reaches the browser.

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODEL = 'openai/gpt-oss-120b'
export const MAX_MESSAGES = 12
export const MAX_CHARS = 1000

const LANGUAGES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' }

const GUIDE = `You are "Ask SyncAI", the help assistant inside SyncAI, an AI-powered Smart Work Planner for Singapore estate
and property management teams (property officers, estate managers and administrators).

What SyncAI does (answer only from this; if something isn't here, say you don't know and suggest asking their manager or admin):
- Sign-in is with a Microsoft work account. New people start as "pending" until an administrator approves them.
- Roles: Team members (property officers) see their own tasks and cases. Managers also see the teams they lead and can
  approve requests. Administrators approve people, assign roles and arrange teams; they don't see anyone's casework.
- How SyncAI prioritises work, in order: 1) Safety, 2) Mandatory deadlines, 3) Service impact and long-term
  consequences, 4) Feasibility (whether the work fits the hours people really have).
- Principles: AI recommends, people approve. Every change is reviewed by a person. Recommendations show their reasons.
- Case Action Centre (members and managers): summary cards, a "Next up" queue, a Follow-Up Radar of outstanding
  commitments found by fixed rules, and the Operational Centre table/Kanban with stages Open, In Progress, Blocked,
  Closure Ready, Closed & Audited. Members request closure; managers approve it. Cases are never closed automatically.
- My tasks shows Microsoft To Do tasks and My plan shows the Outlook calendar (read-only); the full planning engine is coming.
- Settings: language (English, Chinese, Malay, Tamil), text size and light/dark theme.
- Privacy: SyncAI records access changes and sign-ins for accountability, not page views; records are kept for a limited time.

Rules:
- You cannot see the person's tasks, cases, calendar or account. Never claim to, and never invent cases, people or numbers.
- Never make or promise changes; tell people where in SyncAI to do it themselves.
- Keep answers short and plain: at most about 120 words, short paragraphs or a few bullet points, no tables.
- If asked something unrelated to SyncAI or their work in SyncAI, politely say you can only help with SyncAI.
- Remind people not to share personal or sensitive information if they do.`

export class AssistantError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
    this.expose = true
  }
}

// Checks the browser's conversation: alternating text messages, last one from the user, within size limits.
export function cleanConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new AssistantError(400, 'invalid_messages', 'messages must be a non-empty list.')
  const recent = messages.slice(-MAX_MESSAGES)
  const clean = recent.map((m) => {
    const role = m?.role
    const content = typeof m?.content === 'string' ? m.content.trim() : ''
    if (role !== 'user' && role !== 'assistant') throw new AssistantError(400, 'invalid_messages', 'Each message role must be user or assistant.')
    if (!content || content.length > MAX_CHARS) throw new AssistantError(400, 'invalid_messages', `Each message must be 1 to ${MAX_CHARS} characters.`)
    return { role, content }
  })
  if (clean.at(-1).role !== 'user') throw new AssistantError(400, 'invalid_messages', 'The last message must be from the user.')
  return clean
}

export function createAssistant({ apiKey, fetchImpl = fetch, timeoutMs = 20_000 }) {
  return {
    configured: Boolean(apiKey),
    async ask(messages, { language = 'en', role = 'member' } = {}) {
      if (!apiKey) throw new AssistantError(503, 'assistant_off', 'Ask SyncAI is not connected to its AI service yet.')
      const system = `${GUIDE}\n\nThe person asking is a ${role}. Reply in ${LANGUAGES[language] ?? 'English'}.`
      let res
      try {
        res = await fetchImpl(GROQ_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: system }, ...cleanConversation(messages)],
            temperature: 0.3,
            max_completion_tokens: 700,
            reasoning_effort: 'low',
            include_reasoning: false,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (err) {
        if (err instanceof AssistantError) throw err
        throw new AssistantError(504, 'assistant_unreachable', 'The AI service did not respond in time. Try again.')
      }
      if (res.status === 429) throw new AssistantError(429, 'assistant_busy', 'The AI service is busy. Try again in a minute.')
      if (!res.ok) {
        console.error('Groq request failed', res.status, await res.text().catch(() => ''))
        throw new AssistantError(502, 'assistant_failed', 'The AI service could not answer right now.')
      }
      const data = await res.json().catch(() => null)
      const reply = data?.choices?.[0]?.message?.content?.trim()
      if (!reply) throw new AssistantError(502, 'assistant_failed', 'The AI service returned an empty answer.')
      return reply
    },
  }
}

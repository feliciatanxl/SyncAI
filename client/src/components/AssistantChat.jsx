import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Textarea, Tooltip } from '@fluentui/react-components'
import {
  ArrowClockwise16Regular, ArrowRight16Regular, ArrowReset20Regular, Checkmark16Regular, Copy16Regular, PeopleCheckmark24Regular, PersonCircle24Regular,
  Send20Filled, ShieldKeyhole24Regular, Sparkle24Regular, TaskListLtr24Regular, TextFont24Regular, ThumbDislike16Filled, ThumbDislike16Regular,
  ThumbLike16Filled, ThumbLike16Regular, ChatSparkle24Regular, Keyboard16Regular, ShieldKeyhole16Regular,
} from '@fluentui/react-icons'
import { apiRequest, apiStream } from '../lib/api.js'
import { useLocale, usePreferences, useT } from '../lib/i18n.js'
import { renderMarkdown } from '../lib/markdown.jsx'
import { greetingName } from '../lib/time.js'
import { TOPICS, matchTopic } from '../lib/helpGuide.js'
import { Logo } from './Brand.jsx'
import { canUseCaseCentre, caseInsights, visibleCases } from '../features/cases/caseLogic.js'
import { caseDataMode, createCaseService } from '../features/cases/caseService.js'

const TOPIC_ICON = {
  decides: <Sparkle24Regular />,
  role: <PersonCircle24Regular />,
  settings: <TextFont24Regular />,
  privacy: <ShieldKeyhole24Regular />,
  approve: <PeopleCheckmark24Regular />,
  tasks: <TaskListLtr24Regular />,
}
// Questions that suit each kind of account, answered by the AI (they need more than the fixed help guide).
// The first ones use the person's live figures (see useCaseInsights; admins' are counted on the server).
const ROLE_PROMPTS = { manager: ['priorities', 'teamBalance', 'approveClosure'], member: ['priorities', 'atRisk', 'nextUp'], admin: ['teamsAttention', 'addTeam'], pending: ['approval'] }
const MAX_CHARS = 1000
const REPLY_DELAY = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400

let nextId = 1


// Ask SyncAI. Suggested help-guide questions get fixed, checked answers instantly; typed and role questions go to
// the AI through the SyncAI API (streamed as it writes). Without the AI, typed questions fall back to the help guide.
// `chat` is [messages, setMessages], owned by the signed-in page so the conversation survives switching tabs.
export default function AssistantChat({ me, name, photo, chat, goTo, available, getToken }) {
  const t = useT()
  const { language } = usePreferences()
  const [messages, setMessages] = chat
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)
  const isAdmin = me.role === 'admin' && me.status === 'active'
  const topics = TOPICS.filter((topic) => !topic.adminOnly || isAdmin)
  const rolePrompts = ROLE_PROMPTS[me.status === 'active' ? me.role : 'pending'] ?? []
  const waiting = busy && messages.at(-1)?.from === 'user'
  const insights = useCaseInsights(me, getToken)

  // Keep the newest message in view.
  useEffect(() => {
    if (messages.length) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: REPLY_DELAY ? 'smooth' : 'auto' })
  }, [messages])

  function guideAnswer(topic) {
    if (!topic) return { text: t('assistant.fallback') }
    if (topic.id === 'role') {
      const text = me.status === 'active'
        ? t('assistant.answer.role', { role: t(`role.${me.role}`), what: t(`role.${me.role}.text`) })
        : t('assistant.answer.rolePending')
      return { text }
    }
    return { text: t(`assistant.answer.${topic.id}`), action: topic.action }
  }

  const update = (id, patch) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  // Streams the AI's answer into a new bot message. Falls back to the help guide when the AI isn't connected.
  async function askAI(history, text) {
    const id = nextId++
    const body = { language, stream: true, ...(insights && { context: insights.counts }), messages: history.slice(-12).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text.slice(0, MAX_CHARS) })) }
    // When the answer could use live figures: when they were counted (admins' are counted with the question).
    const asOf = isAdmin ? new Date() : insights?.at
    let started = false
    try {
      const full = await apiStream('/assistant', {
        body,
        getToken,
        onText: (soFar) => {
          const shown = soFar.replace('\u0000', '')
          if (!started) { started = true; setMessages((list) => [...list, { id, from: 'bot', ai: true, streaming: true, text: shown, asOf, asOfOpen: insights?.counts.cases.open }]) }
          else update(id, { text: shown })
        },
      })
      const cut = full.includes('\u0000')
      const final = { streaming: false, text: full.replace('\u0000', '').trim(), cutOff: cut, retry: cut ? text : undefined }
      if (started) update(id, final)
      else setMessages((list) => [...list, { id, from: 'bot', error: true, retry: text, text: t('assistant.aiError') }])
    } catch (err) {
      const answer = [503, 404].includes(err.status) ? guideAnswer(matchTopic(text, isAdmin)) : { error: true, retry: text, text: t('assistant.aiError') }
      if (started) update(id, { streaming: false, cutOff: true, retry: text })
      else setMessages((list) => [...list, { id, from: 'bot', ...answer }])
    }
  }

  // `topic`: a help-guide question (fixed answer). Otherwise the AI answers.
  async function ask(question, topic) {
    const text = question.trim().slice(0, MAX_CHARS)
    if (!text || busy) return
    const history = [...messages.filter((m) => !m.error), { from: 'user', text }]
    setMessages((list) => [...list, { id: nextId++, from: 'user', text }])
    setDraft('')
    setBusy(true)
    if (topic || !getToken) {
      await new Promise((r) => setTimeout(r, REPLY_DELAY))
      setMessages((list) => [...list, { id: nextId++, from: 'bot', ...guideAnswer(topic ?? matchTopic(text, isAdmin)) }])
    } else {
      await askAI(history, text)
    }
    setBusy(false)
  }

  // Retry drops the failed (or cut-off) answer and asks the AI the same question again.
  async function retry(m) {
    if (busy) return
    const rest = messages.filter((x) => x.id !== m.id)
    setMessages(rest)
    setBusy(true)
    await askAI(rest.filter((x) => !x.error), m.retry)
    setBusy(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(draft)
    }
  }

  const suggestionCards = [
    ...rolePrompts.map((id) => ({ key: `ai-${id}`, label: t(`assistant.ai.q.${id}`), icon: <ChatSparkle24Regular />, run: () => ask(t(`assistant.ai.q.${id}`)) })),
    ...topics.map((topic) => ({ key: topic.id, label: t(`assistant.q.${topic.id}`), icon: TOPIC_ICON[topic.id], run: () => ask(t(`assistant.q.${topic.id}`), topic) })),
  ].slice(0, 6)

  return (
    <section className="assistant panel" aria-labelledby="assistant-h">
      <header className="assistant-bar">
        <span className="assistant-bar-logo" aria-hidden="true"><Logo size={26} /></span>
        <div className="assistant-bar-text">
          <h1 id="assistant-h">{t('nav.assistant')}</h1>
          <p className="muted small">{t('assistant.subtitle')}</p>
        </div>
        {messages.length > 0 && (
          <Button appearance="subtle" icon={<ArrowReset20Regular />} disabled={busy} onClick={() => setMessages([])}>{t('assistant.newChat')}</Button>
        )}
      </header>

      <ol className="assistant-messages" ref={listRef} aria-live="polite" aria-busy={busy}>
        {messages.length === 0 ? (
          <li className="assistant-welcome">
            <span className="assistant-welcome-icon" aria-hidden="true"><Logo size={40} /></span>
            <h2>{t('assistant.hello', { name: greetingName(name) })}</h2>
            <p className="muted">{t('assistant.intro')}</p>
            <div className="suggestion-cards" role="group" aria-label={t('assistant.suggested')}>
              {suggestionCards.map((s) => (
                <button key={s.key} type="button" className="suggestion-card" onClick={s.run}>
                  <span className="suggestion-icon" aria-hidden="true">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className={`msg ${m.from}`}>
              {m.from === 'bot'
                ? <span className="msg-avatar" aria-hidden="true"><Logo size={22} /></span>
                : <Avatar name={name} image={photo ? { src: photo, alt: '' } : undefined} size={32} color="colorful" aria-hidden="true" />}
              <div className={`msg-bubble${m.error ? ' msg-error' : ''}`}>
                <span className="visually-hidden">{m.from === 'bot' ? 'SyncAI: ' : `${t('assistant.you')}: `}</span>
                {m.from === 'bot' && m.ai ? <div className="msg-md">{renderMarkdown(m.text)}{m.streaming && <span className="msg-caret" aria-hidden="true" />}</div> : <span className="msg-text">{m.text}</span>}
                {m.cutOff && <p className="small muted">{t('assistant.cutOff')}</p>}
                {m.action && available.includes(m.action) && (
                  <Button size="small" appearance="primary" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => goTo(m.action)}>{t(`nav.${m.action}`)}</Button>
                )}
                {m.retry && !busy && (
                  <Button size="small" icon={<ArrowClockwise16Regular />} onClick={() => retry(m)}>{t('assistant.retry')}</Button>
                )}
                {m.ai && !m.streaming && !m.error && <AnswerTools m={m} isAdminAnswer={isAdmin} onRate={(helpful) => update(m.id, { rated: helpful })} getToken={getToken} />}
              </div>
            </li>
          ))
        )}
        {waiting && (
          <li className="msg bot">
            <span className="msg-avatar" aria-hidden="true"><Logo size={22} /></span>
            <div className="msg-bubble typing" aria-label={t('assistant.typing')}><span /><span /><span /></div>
          </li>
        )}
      </ol>

      {messages.length > 0 && (
        <div className="assistant-suggestions" role="group" aria-label={t('assistant.suggested')}>
          <div className="chips">
            {suggestionCards.map((s) => (
              <button key={s.key} type="button" className="chip" disabled={busy} onClick={s.run}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
        <Textarea
          value={draft}
          onChange={(_e, d) => setDraft(d.value.slice(0, MAX_CHARS))}
          onKeyDown={onKeyDown}
          placeholder={t('assistant.placeholder')}
          aria-label={t('assistant.placeholder')}
          aria-describedby="assistant-hint"
          resize="none"
          rows={1}
          maxLength={MAX_CHARS}
        />
        <Button type="submit" appearance="primary" icon={<Send20Filled />} disabled={!draft.trim() || busy} aria-label={t('assistant.send')}>
          <span className="hide-sm">{t('assistant.send')}</span>
        </Button>
      </form>
      <p className="assistant-foot small muted" id="assistant-hint">
        <span className="assistant-foot-hint"><Keyboard16Regular aria-hidden="true" />{t('assistant.hint')}</span>
        {draft.length > MAX_CHARS * 0.8 && <span className="assistant-count" aria-live="polite">{draft.length}/{MAX_CHARS}</span>}
        <span className="assistant-foot-note"><ShieldKeyhole16Regular aria-hidden="true" />{t('assistant.foot')}</span>
      </p>
    </section>
  )
}

// Under each finished AI answer: Copy and 👍/👎 (sent anonymously).
function AnswerTools({ m, isAdminAnswer, onRate, getToken }) {
  const t = useT()
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked: nothing to do */ }
  }
  const rate = (helpful) => {
    if (m.rated !== undefined) return
    onRate(helpful)
    apiRequest('/assistant/feedback', { method: 'POST', body: { helpful }, getToken }).catch(() => {})
  }
  return (
    <div className="msg-tools">
      <span className="msg-ai small muted">
        {t('assistant.aiLabel')}
        {m.asOf && <> · {t(isAdminAnswer ? 'assistant.asOfAdmin' : 'assistant.asOfCases', { n: m.asOfOpen ?? 0, time: m.asOf.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) })}</>}
      </span>
      <span className="msg-tools-right">
        <Tooltip content={copied ? t('assistant.copied') : t('assistant.copy')} relationship="label">
          <Button size="small" appearance="subtle" icon={copied ? <Checkmark16Regular /> : <Copy16Regular />} onClick={copy} />
        </Tooltip>
        <Tooltip content={t('assistant.helpful')} relationship="label">
          <Button size="small" appearance="subtle" aria-pressed={m.rated === true} disabled={m.rated !== undefined && m.rated !== true}
            icon={m.rated === true ? <ThumbLike16Filled /> : <ThumbLike16Regular />} onClick={() => rate(true)} />
        </Tooltip>
        <Tooltip content={t('assistant.notHelpful')} relationship="label">
          <Button size="small" appearance="subtle" aria-pressed={m.rated === false} disabled={m.rated !== undefined && m.rated !== false}
            icon={m.rated === false ? <ThumbDislike16Filled /> : <ThumbDislike16Regular />} onClick={() => rate(false)} />
        </Tooltip>
      </span>
    </div>
  )
}

// Counts of the cases this person can see, for the AI's insights (numbers only; see caseInsights). Admins' figures
// are counted on the server; people without the Case Action Centre send none. A failed load just means no figures.
function useCaseInsights(me, getToken) {
  const [insights, setInsights] = useState(null)
  useEffect(() => {
    setInsights(null)
    if (!canUseCaseCentre(me)) return
    let live = true
    createCaseService({ mode: caseDataMode(), me, getToken }).list().then(
      (data) => live && setInsights({ counts: caseInsights(visibleCases(data.cases, me, data.managedOfficerIds), me), at: new Date() }),
      () => live && setInsights(null),
    )
    return () => { live = false }
  }, [me, getToken])
  return insights
}

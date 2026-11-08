import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Textarea } from '@fluentui/react-components'
import {
  ArrowRight16Regular, ArrowReset20Regular, ChatSparkle24Regular, PeopleCheckmark24Regular, PersonCircle24Regular, Send20Filled,
  ShieldKeyhole24Regular, Sparkle20Filled, Sparkle24Filled, Sparkle24Regular, TaskListLtr24Regular, TextFont24Regular,
} from '@fluentui/react-icons'
import { useT } from '../lib/i18n.js'
import { greetingName } from '../lib/time.js'
import { TOPICS, matchTopic } from '../lib/helpGuide.js'
import PageHeader from './PageHeader.jsx'

const TOPIC_ICON = {
  decides: <Sparkle24Regular />,
  role: <PersonCircle24Regular />,
  settings: <TextFont24Regular />,
  privacy: <ShieldKeyhole24Regular />,
  approve: <PeopleCheckmark24Regular />,
  tasks: <TaskListLtr24Regular />,
}

let nextId = 1
const REPLY_DELAY = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600

// "Ask SyncAI" preview: a real chat interface answering from SyncAI's help guide. Labelled as a preview so
// nobody mistakes it for AI that knows their tasks. `chat` is [messages, setMessages], owned by the signed-in
// page so the conversation survives switching tabs and disappears on sign-out.
export default function AssistantChat({ me, name, chat, goTo, available }) {
  const t = useT()
  const [messages, setMessages] = chat
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const listRef = useRef(null)
  const isAdmin = me.role === 'admin' && me.status === 'active'
  const suggestions = TOPICS.filter((topic) => !topic.adminOnly || isAdmin)

  // Keep the newest message in view; the start screen stays scrolled to the top.
  useEffect(() => {
    if (messages.length || typing) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: REPLY_DELAY ? 'smooth' : 'auto' })
  }, [messages, typing])

  function answerFor(topic) {
    if (!topic) return { text: t('assistant.fallback') }
    if (topic.id === 'role') {
      const text = me.status === 'active'
        ? t('assistant.answer.role', { role: t(`role.${me.role}`), what: t(`role.${me.role}.text`) })
        : t('assistant.answer.rolePending')
      return { text }
    }
    return { text: t(`assistant.answer.${topic.id}`), action: topic.action }
  }

  function ask(question, topic = matchTopic(question, isAdmin)) {
    const text = question.trim()
    if (!text || typing) return
    setMessages((list) => [...list, { id: nextId++, from: 'user', text }])
    setDraft('')
    setTyping(true)
    setTimeout(() => {
      setMessages((list) => [...list, { id: nextId++, from: 'bot', ...answerFor(topic) }])
      setTyping(false)
    }, REPLY_DELAY)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(draft)
    }
  }

  return (
    <div className="assistant">
      <PageHeader
        icon={<ChatSparkle24Regular />}
        title={t('nav.assistant')}
        badge={<span className="hero-badge">{t('assistant.preview')}</span>}
        description={t('assistant.previewNote')}
      >
        {messages.length > 0 && (
          <Button className="hero-button" icon={<ArrowReset20Regular />} onClick={() => setMessages([])}>{t('assistant.clear')}</Button>
        )}
      </PageHeader>

      <section className="panel assistant-panel" aria-label={t('assistant.label')}>
        <ol className="assistant-messages" ref={listRef} aria-live="polite">
          {messages.length === 0 && !typing ? (
            // Start screen: a friendly greeting and the suggestions as large cards, easy for anyone to tap.
            <li className="assistant-welcome">
              <span className="assistant-welcome-icon" aria-hidden="true"><Sparkle24Filled /></span>
              <h2>{t('assistant.hello', { name: greetingName(name) })}</h2>
              <p className="muted">{t('assistant.intro')}</p>
              <div className="suggestion-cards" role="group" aria-label={t('assistant.suggested')}>
                {suggestions.map((topic) => (
                  <button key={topic.id} type="button" className="suggestion-card" onClick={() => ask(t(`assistant.q.${topic.id}`), topic)}>
                    <span className="suggestion-icon" aria-hidden="true">{TOPIC_ICON[topic.id]}</span>
                    <span>{t(`assistant.q.${topic.id}`)}</span>
                  </button>
                ))}
              </div>
            </li>
          ) : (
            <li className="msg bot">
              <span className="msg-avatar" aria-hidden="true"><Sparkle20Filled /></span>
              <div className="msg-bubble">{t('assistant.welcome', { name: greetingName(name) })}</div>
            </li>
          )}
          {messages.map((m) => (
            <li key={m.id} className={`msg ${m.from}`}>
              {m.from === 'bot'
                ? <span className="msg-avatar" aria-hidden="true"><Sparkle20Filled /></span>
                : <Avatar name={name} size={32} color="colorful" aria-hidden="true" />}
              <div className="msg-bubble">
                <span className="visually-hidden">{m.from === 'bot' ? 'SyncAI: ' : `${t('assistant.you')}: `}</span>
                {m.text}
                {m.action && available.includes(m.action) && (
                  <Button size="small" appearance="primary" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => goTo(m.action)}>
                    {t(`nav.${m.action}`)}
                  </Button>
                )}
              </div>
            </li>
          ))}
          {typing && (
            <li className="msg bot">
              <span className="msg-avatar" aria-hidden="true"><Sparkle20Filled /></span>
              <div className="msg-bubble typing" aria-label={t('assistant.typing')}><span /><span /><span /></div>
            </li>
          )}
        </ol>

        {(messages.length > 0 || typing) && (
          <div className="assistant-suggestions" role="group" aria-label={t('assistant.suggested')}>
            <span className="muted small">{t('assistant.suggested')}</span>
            <div className="chips">
              {suggestions.map((topic) => (
                <button key={topic.id} type="button" className="chip" disabled={typing} onClick={() => ask(t(`assistant.q.${topic.id}`), topic)}>
                  {t(`assistant.q.${topic.id}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
          <Textarea
            value={draft}
            onChange={(_e, d) => setDraft(d.value)}
            onKeyDown={onKeyDown}
            placeholder={t('assistant.placeholder')}
            aria-label={t('assistant.placeholder')}
            resize="none"
            rows={1}
            maxLength={500}
          />
          <Button type="submit" appearance="primary" icon={<Send20Filled />} disabled={!draft.trim() || typing} aria-label={t('assistant.send')}>
            <span className="hide-sm">{t('assistant.send')}</span>
          </Button>
        </form>
        <p className="assistant-foot small muted"><Sparkle24Filled aria-hidden="true" /> {t('assistant.foot')}</p>
      </section>
    </div>
  )
}

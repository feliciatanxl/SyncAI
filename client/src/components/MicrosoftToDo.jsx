import { Badge, Button, Select, Spinner } from '@fluentui/react-components'
import { ArrowSync20Regular, PlugConnected20Regular, ShieldKeyhole20Regular, TaskListLtr20Regular, TaskListLtr24Regular } from '@fluentui/react-icons'
import { GRAPH_SCOPES } from '../auth/msal.js'
import { formatDue, listTaskLists, listTasks } from '../lib/graph.js'
import { useLocale, useT } from '../lib/i18n.js'
import { useGraphData } from '../auth/useGraph.js'
import GraphErrorBar from './GraphErrorBar.jsx'

const STATUS_COLOR = { completed: 'success', inProgress: 'brand', waitingOnOthers: 'warning', deferred: 'informative', notStarted: 'informative' }
const IMPORTANCE_COLOR = { high: 'danger', normal: 'informative', low: 'subtle' }

// The person's lists, then the tasks of the chosen one (their default list until they pick another).
async function fetchToDo(tokenFor, interactive, listId) {
  const getToken = tokenFor(GRAPH_SCOPES.tasks, interactive)
  const lists = await listTaskLists({ getToken })
  const list = lists.find((l) => l.id === listId) ?? lists[0]
  if (!list) return { lists, listId: null, tasks: [], truncated: false }
  return { lists, listId: list.id, ...(await listTasks({ getToken, listId: list.id })) }
}

// The signed-in person's own Microsoft To Do lists and tasks, read live from Microsoft Graph.
// Read-only and never saved by SyncAI: nothing here creates, completes, edits or deletes a task, and these
// tasks are not SyncAI tasks. Rendered only for active accounts (see memberSections).
export default function MicrosoftToDo({ me }) {
  const t = useT()
  const locale = useLocale()
  const active = me.status === 'active'
  const { phase, data, error, load } = useGraphData('todo', 'tasks', active, fetchToDo)

  if (!active) return null
  const connected = Boolean(data)
  const busy = phase === 'loading'

  return (
    <section className="panel cal-panel" aria-labelledby="todo-h" aria-busy={busy}>
      <div className="cal-head">
        <span className="card-icon" aria-hidden="true"><TaskListLtr24Regular /></span>
        <div className="cal-head-text">
          <h2 id="todo-h">{t('todo.title')}</h2>
          <p className="muted">{t('todo.lead')}</p>
        </div>
        <Badge appearance="tint" color={connected ? 'success' : 'informative'} icon={<PlugConnected20Regular />}>
          {connected ? t('cal.live') : t('cal.notConnected')}
        </Badge>
      </div>

      {error && <GraphErrorBar error={error} />}

      <div className="cal-bar">
        {connected ? (
          <>
            <span className="cal-bar-text">
              {data.lists.length > 0 && (
                <Select aria-label={t('todo.list')} value={data.listId} disabled={busy} onChange={(_, { value }) => load(false, value)}>
                  {data.lists.map((list) => <option key={list.id} value={list.id}>{list.name ?? t('cal.untitled')}</option>)}
                </Select>
              )}
            </span>
            {busy && <Spinner size="tiny" label={t('todo.loading')} />}
            <Button icon={<ArrowSync20Regular />} disabled={busy} onClick={() => load(false, data.listId)}>{t('cal.refresh')}</Button>
          </>
        ) : busy ? (
          <Spinner size="tiny" label={t('todo.loading')} />
        ) : (
          <>
            <span className="cal-bar-text small"><ShieldKeyhole20Regular aria-hidden="true" />{t('todo.connectHint')}</span>
            <Button appearance="primary" icon={<TaskListLtr20Regular />} onClick={() => load(true)}>{t('todo.connect')}</Button>
          </>
        )}
      </div>

      {connected && data.tasks.length === 0 && (
        <p className="cal-empty muted">{data.lists.length === 0 ? t('todo.noLists') : t('todo.empty')}</p>
      )}
      {connected && data.tasks.length > 0 && (
        <ol className="cal-list">
          {data.tasks.map((task) => (
            <li key={task.id} className={`cal-item ${task.done ? 'todo-done' : ''}`}>
              <span className="cal-when">
                {task.due ? <time dateTime={task.due.toISOString()}>{formatDue(task, locale)}</time> : <span>{t('todo.noDue')}</span>}
              </span>
              <span className="cal-what"><strong>{task.title ?? t('cal.untitled')}</strong></span>
              <span className="cal-meta">
                <Badge appearance="outline" color={IMPORTANCE_COLOR[task.importance]}>{t(`todo.importance.${task.importance}`)}</Badge>
                <Badge appearance="tint" color={STATUS_COLOR[task.status]}>{t(`todo.status.${task.status}`)}</Badge>
              </span>
            </li>
          ))}
        </ol>
      )}
      {connected && data.truncated && <p className="cal-foot small muted">{t('todo.truncated', { count: data.tasks.length })}</p>}
      {connected && <p className="cal-foot small muted">{t('todo.note')}</p>}
    </section>
  )
}

import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, Spinner } from '@fluentui/react-components'
import { Dismiss20Regular } from '@fluentui/react-icons'

export default function UnscheduledTasks({ wide, open, onClose, tasks, loading, error, accessDenied, filtered, viewDuty,
  mine, priorityFactors, deadlineLabel, now }) {
  const contents = (
    <div className="planning-task-contents" aria-busy={loading}>
      {loading && <Spinner size="tiny" label="Loading tasks" />}
      {error && <p>{accessDenied ? 'You don’t have access to these tasks.' : 'Tasks are temporarily unavailable.'}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p>{filtered ? 'No tasks match your filters.' : 'Flexible duties appear here until they’re scheduled.'}</p>
      )}
      {tasks.length > 0 && (
        <ul className="planning-backlog-list">
          {tasks.map((duty) => {
            const priorities = priorityFactors.filter(({ key }) => duty.factors?.[key]).map(({ label }) => label)
            const overdue = duty.deadline && Date.parse(duty.deadline) <= +now
            return (
              <li key={duty.id}>
                <button type="button" className="planning-task" onClick={() => viewDuty(duty)}>
                  <strong>{duty.title}</strong>
                  <span>{duty.category}{!mine ? ' · ' + duty.officerName : ''}</span>
                  {priorities.length > 0 && <span className="planning-task-priority">Priority: {priorities.join(' · ')}</span>}
                  <span className="planning-task-timing">
                    <span data-overdue={Boolean(overdue)}>{duty.deadline ? (overdue ? 'Overdue · ' : 'Due ') + deadlineLabel(duty.deadline) : 'No deadline'}</span>
                    <span>{duty.durationMinutes} min</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
  const close = <Button size="small" appearance="subtle" aria-label="Close unscheduled tasks" icon={<Dismiss20Regular />} onClick={onClose} />

  if (wide) {
    return (
      <aside id="planning-backlog" className="planning-backlog" hidden={!open} aria-labelledby="planning-backlog-title">
        <div className="planning-backlog-header">
          <h2 id="planning-backlog-title">Unscheduled Tasks</h2>
          {close}
        </div>
        {contents}
      </aside>
    )
  }

  return (
    <OverlayDrawer id="planning-backlog" className="planning-task-drawer" position="end" size="small"
      open={open} onOpenChange={(_event, data) => { if (!data.open) onClose() }} aria-labelledby="planning-backlog-title">
      <DrawerHeader>
        <DrawerHeaderTitle action={close} heading={{ id: 'planning-backlog-title' }}>Unscheduled Tasks</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>{contents}</DrawerBody>
    </OverlayDrawer>
  )
}

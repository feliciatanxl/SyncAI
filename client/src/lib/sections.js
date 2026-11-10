// What each person sees depends on the status and role the SyncAI API reports: pending and disabled people
// get only what doesn't need approval (so no tasks, plan or Outlook calendar); managers also get Team workload.
export function memberSections(me) {
  if (me.status !== 'active') return ['overview', 'assistant', 'decides', 'settings']
  return ['overview', 'assistant', 'tasks', 'plan', ...(me.role === 'manager' ? ['team'] : []), 'decides', 'settings']
}

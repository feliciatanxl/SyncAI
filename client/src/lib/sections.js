// What each person sees depends on the status and role the SyncAI API reports: pending and disabled people
// get only what doesn't need approval (so no cases, tasks, plan or Outlook calendar); managers also get Team workload.
// Admins use AdminPortal, which never lists the Case Action Centre.
export function memberSections(me) {
  if (me.status !== 'active') return ['overview', 'assistant', 'settings']
  return ['overview', 'assistant', 'cases', 'tasks', 'plan', ...(me.role === 'manager' ? ['team'] : ['decides']), 'settings']
}

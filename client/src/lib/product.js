// Product copy shared by the public site and the signed-in portal, so the two never drift apart.

export const USP = 'Operationally aware AI scheduling'

export const FACTORS = [
  { n: 1, title: 'Safety', text: 'Genuine risks to people, staff and property.' },
  { n: 2, title: 'Mandatory deadlines', text: 'Statutory, regulatory, contractual and funding-approval dates that cannot slip.' },
  { n: 3, title: 'Service impact & long-term consequences', text: 'Real customer needs and what happens if the work waits. Not who complains loudest.' },
  { n: 4, title: 'Scheduling feasibility', text: 'Estimated task durations matched to each person’s free time and capacity.' },
]

export const ROLES = {
  admin: { label: 'Admin', text: 'Approves people, assigns roles and manages SyncAI settings.' },
  manager: { label: 'Manager', text: 'Sees the team’s workload, spots risks and approves reassignments.' },
  member: { label: 'Team member', text: 'Sees their own tasks and gets a daily plan that fits their time.' },
}

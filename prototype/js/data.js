// Fictional seed data for the SyncAI prototype. Names, blocks and tasks are
// illustrative only and do not represent real Town Council records.

import { TODAY, workDay, horizonDays, dt } from './time.js';

export const DATA_VERSION = 6;

export const CATEGORIES = [
  'Inspection',
  'Maintenance',
  'Resident Feedback',
  'Contractor',
  'Admin',
  'Cleaning',
  'Horticulture',
];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' },
];

export const SOURCES = ['SyncAI', 'Outlook', 'To Do', 'Planner', 'SharePoint'];

/** Skill required by each category, used for reassignment matching. */
export const CATEGORY_SKILL = {
  Inspection: 'inspection',
  Maintenance: 'maintenance',
  'Resident Feedback': 'resident',
  Contractor: 'contractor',
  Admin: 'admin',
  Cleaning: 'cleaning',
  Horticulture: 'horticulture',
};

/** Baseline effort (hours) used when SyncAI estimates a new task. */
export const CATEGORY_BASE_EFFORT = {
  Inspection: 1.5,
  Maintenance: 2,
  'Resident Feedback': 1,
  Contractor: 1.5,
  Admin: 1,
  Cleaning: 1,
  Horticulture: 1.5,
};

/** Historical team trend (sample data for the last six weeks). */
/** Fictional meeting minutes for the meeting-to-task demo. */
export function sampleMinutes() {
  return `Zone A & B Estate Operations Meeting — minutes (fictional sample)
Attendees: Jennifer Ong, Aisyah Rahman, Marcus Tan, Priya Nair, Daniel Lim

1. Lift performance
- Residents at Blk 208 reported jerky stops; vendor attended last week.
- Action: Aisyah to check lift lobby lighting at Blk 214 by Friday, about 1h.
- Action: Daniel to review lift vendor fault logs for Blk 322 tomorrow 3pm.

2. Cleanliness
- Corridor litter feedback at Blk 209 has increased this month.
- Marcus to verify cleaning contractor attendance records by tomorrow noon.

3. Community
- Priya will prepare a notice for the water supply interruption at Blk 206, urgent, today 4pm.
- Follow-up: compile resident feedback themes for the next committee meeting in 3 days.

Next meeting: same time next week.`;
}

export const WEEKLY_TREND = {
  labels: ['W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1'],
  created: [42, 38, 45, 51, 47, 49],
  completed: [40, 39, 41, 44, 45, 43],
  utilisation: [78, 74, 82, 91, 88, 86],
};

/**
 * Microsoft 365 integrations with their delivery phase. Everything is
 * simulated in the prototype; the phase reflects the product roadmap.
 */
export const INTEGRATIONS = [
  { id: 'entra', name: 'Microsoft Entra ID + MSAL', icon: 'shield', phase: 'Core', data: 'Sign-in, identity and Officer / Supervisor role claims.', ai: ['Role-based views', 'Access control'], demo: 'Website sign-in decides the role; the portal requires sign-in' },
  { id: 'outlook', name: 'Outlook Calendar (Microsoft Graph)', icon: 'calendar', phase: 'Core · MVP', data: "Reads officers' meetings and free/busy time; writes approved plan blocks.", ai: ['Dynamic time-blocking', 'Conflict detection', 'Emergency rescheduling', 'Realistic daily plans'], demo: 'Mock meetings in the Smart Planner' },
  { id: 'todo', name: 'Microsoft To Do (Microsoft Graph)', icon: 'check-square', phase: 'Core · MVP', data: 'Imports tasks with descriptions, deadlines and status; can sync updates back.', ai: ['Task categorisation', 'Priority scoring', 'Effort estimation', 'Daily task selection'], demo: 'Tasks tagged “To Do”' },
  { id: 'openai', name: 'Azure OpenAI', icon: 'sparkles', phase: 'Core', data: 'Natural-language task extraction, explanations and summaries.', ai: ['Natural-language tasks', 'Meeting-to-task extraction', 'Briefings', 'Ask SyncAI'], demo: 'Deterministic local rules stand in for the model' },
  { id: 'teams', name: 'Microsoft Teams', icon: 'message', phase: 'Phase 2', data: 'Sends alerts and approval requests to officers and supervisors.', ai: ['Smart reminders', 'Proactive workload alerts', 'Daily briefing notifications'], demo: 'Alerts panel (bell icon)' },
  { id: 'planner', name: 'Microsoft Planner', icon: 'columns', phase: 'Phase 2', data: 'Retrieves team-assigned tasks alongside personal tasks.', ai: ['Multi-source workload consolidation', 'Dependency awareness', 'Allocation suggestions'], demo: 'Tasks tagged “Planner”' },
  { id: 'sharepoint', name: 'SharePoint / OneDrive', icon: 'folder', phase: 'Stretch', data: 'Reads authorised documents such as meeting minutes and maintenance reports.', ai: ['Extract action items', 'Identify responsible officers', 'Suggest tasks and effort'], demo: 'Import from meeting minutes on My Tasks' },
];

function officers() {
  return [
    { id: 'o1', name: 'Aisyah Rahman', title: 'Property Officer', zone: 'Zone A', skills: ['inspection', 'lift', 'resident', 'admin'], availability: {} },
    { id: 'o2', name: 'Marcus Tan', title: 'Property Officer', zone: 'Zone B', skills: ['inspection', 'contractor', 'cleaning'], availability: {} },
    { id: 'o3', name: 'Priya Nair', title: 'Estate Officer', zone: 'Zone A', skills: ['resident', 'admin', 'cleaning'], availability: { [workDay(3)]: 'leave' } },
    { id: 'o4', name: 'Daniel Lim', title: 'Technical Officer', zone: 'Zone B', skills: ['lift', 'maintenance', 'contractor', 'inspection'], availability: {} },
    { id: 'o5', name: 'Chua Hui Min', title: 'Conservancy Officer', zone: 'Zone C', skills: ['cleaning', 'horticulture', 'inspection', 'resident'], availability: {} },
    { id: 'o6', name: 'Ravi Kumar', title: 'Estate Officer', zone: 'Zone C', skills: ['resident', 'admin', 'contractor'], availability: { [TODAY]: 'mc', [workDay(1)]: 'mc' } },
  ];
}

function meetings() {
  const list = [];
  const all = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6'];
  horizonDays().forEach((d, i) => {
    list.push({ id: `mh${i}`, title: 'Daily team huddle', date: d, start: '09:00', end: '09:15', ownerIds: all, location: 'Microsoft Teams', source: 'Outlook' });
  });
  const add = (id, title, date, start, end, ownerIds, location) =>
    list.push({ id, title, date, start, end, ownerIds, location, source: 'Outlook' });

  add('m1', 'Contractor coordination meeting', TODAY, '14:30', '15:30', ['o1'], 'Meeting Room 2');
  add('m2', 'Resident engagement call', TODAY, '15:00', '15:30', ['o1'], 'Microsoft Teams');
  add('m3', 'Town Council operations review', workDay(1), '10:00', '11:00', ['o1', 'o2', 'o4'], 'Level 3 Boardroom');
  add('m4', 'Joint inspection briefing', workDay(2), '14:00', '15:00', ['o1', 'o4'], 'Blk 208 void deck');
  add('m5', 'Tender evaluation panel', TODAY, '10:00', '11:30', ['o2'], 'Meeting Room 1');
  add('m6', 'Contractor site meeting — repainting', TODAY, '15:00', '16:00', ['o2'], 'Blk 312');
  add('m7', 'Cleaning contract audit', workDay(1), '13:30', '16:00', ['o2'], 'Meeting Room 1');
  add('m8', 'Lift vendor performance review', TODAY, '13:30', '14:30', ['o4'], 'Microsoft Teams');
  add('m9', 'Resident dialogue session', TODAY, '11:00', '12:00', ['o3'], 'Blk 204 MPH');
  add('m10', 'Horticulture vendor walk', workDay(1), '14:00', '15:00', ['o5'], 'Park connector, Blk 401');
  add('m11', 'Resident feedback triage sync', TODAY, '10:00', '11:00', ['o6'], 'Microsoft Teams');
  return list;
}

function tasks() {
  const list = [];
  const T = (id, ownerId, title, category, priority, dueDay, dueTime, effort, extra = {}) =>
    list.push({
      id,
      ownerId,
      title,
      description: extra.description || '',
      category,
      priority,
      due: dt(dueDay, dueTime),
      effort,
      spent: extra.spent || 0,
      status: extra.status || 'todo',
      location: extra.location || '',
      dependsOn: extra.dependsOn || [],
      source: extra.source || 'SyncAI',
      safety: !!extra.safety,
      impact: extra.impact || 'medium',
      createdAt: extra.createdAt || dt(workDay(-2), '09:00'),
      completedAt: extra.completedAt || null,
      actual: extra.actual || null,
      projectId: extra.projectId || null,
      checklist: extra.checklist || [],
    });

  // Aisyah Rahman (o1) — the demo officer
  T('t101', 'o1', 'Lift inspection — Blk 208 (Lifts A & B)', 'Inspection', 'High', TODAY, '12:00', 1.5, { safety: true, location: 'Blk 208', source: 'Planner', impact: 'high', description: 'Quarterly safety inspection following two resident reports of jerky stops.' });
  T('t102', 'o1', 'Review CleanPro monthly contractor report', 'Contractor', 'Medium', TODAY, '17:00', 1.5, { source: 'To Do', location: 'Office', description: 'Check KPI attainment and penalty items before the coordination meeting.' });
  T('t103', 'o1', 'Site check: ceiling seepage at Blk 211 #05-12', 'Inspection', 'High', TODAY, '17:00', 1, { source: 'Outlook', location: 'Blk 211', impact: 'high', description: 'Flagged email from resident. Determine if the source is the unit above or common pipe.' });
  T('t104', 'o1', 'Resident follow-up call: Blk 211 seepage', 'Resident Feedback', 'Medium', workDay(1), '12:00', 0.75, { dependsOn: ['t103'], location: 'Phone', impact: 'high' });
  T('t105', 'o1', 'Inspect playground equipment — Blk 215', 'Inspection', 'Medium', workDay(1), '17:00', 2, { safety: true, source: 'Planner', location: 'Blk 215 playground' });
  T('t106', 'o1', 'Verify corridor cleaning complaint — Blk 209', 'Cleaning', 'Medium', workDay(2), '17:00', 0.75, { location: 'Blk 209' });
  T('t107', 'o1', 'Compile common-area lighting defect summary', 'Admin', 'Low', workDay(3), '17:00', 2, { source: 'To Do', location: 'Office' });
  T('t108', 'o1', 'Update estate maintenance log on SharePoint', 'Admin', 'Low', workDay(4), '17:00', 1, { location: 'Office' });
  T('t109', 'o1', 'Lift inspection — Blk 212 (Lift C)', 'Inspection', 'High', workDay(3), '17:00', 1.5, { safety: true, location: 'Blk 212', source: 'Planner' });
  T('t110', 'o1', 'Inspect lift motor room access — Blk 213', 'Inspection', 'Medium', workDay(4), '17:00', 1, { safety: true, location: 'Blk 213', source: 'Planner' });

  // Marcus Tan (o2) — overloaded
  T('t201', 'o2', 'Submit defect rectification report — Blk 305', 'Admin', 'High', workDay(-1), '17:00', 1.5, { status: 'in_progress', spent: 0.5, location: 'Office', source: 'Planner' });
  T('t202', 'o2', 'Inspect refuse chute hopper — Blk 310', 'Inspection', 'High', TODAY, '17:00', 1.5, { safety: true, location: 'Blk 310' });
  T('t209', 'o2', 'Verify handover defects list — Blk 315', 'Inspection', 'Medium', TODAY, '17:00', 1, { location: 'Blk 315', source: 'Planner' });
  T('t203', 'o2', 'Contractor site walk — repainting works Blk 312', 'Contractor', 'Medium', TODAY, '17:00', 2, { location: 'Blk 312', source: 'Outlook' });
  T('t204', 'o2', 'Respond to resident petition on car park lighting', 'Resident Feedback', 'Medium', workDay(1), '12:00', 1.5, { impact: 'high', location: 'Office' });
  T('t205', 'o2', 'Check cleaning contractor attendance records', 'Cleaning', 'Medium', workDay(1), '17:00', 1.5, { location: 'Office', source: 'To Do' });
  T('t206', 'o2', 'Prepare repainting progress update for committee', 'Admin', 'Medium', workDay(2), '12:00', 2.5, { dependsOn: ['t203'], location: 'Office' });
  T('t207', 'o2', 'Inspect roof waterproofing works — Blk 318', 'Inspection', 'High', workDay(2), '17:00', 2, { safety: true, location: 'Blk 318' });
  T('t208', 'o2', 'Verify pest control treatment — Blk 306 bin centre', 'Cleaning', 'Low', workDay(3), '17:00', 1, { location: 'Blk 306' });

  // Priya Nair (o3) — balanced, on leave later this week
  T('t301', 'o3', 'Resident dialogue follow-ups (12 cases)', 'Resident Feedback', 'Medium', TODAY, '17:00', 2, { impact: 'high', location: 'Office' });
  T('t302', 'o3', 'Update notice boards — Blk 204 to 207', 'Admin', 'Low', workDay(1), '17:00', 1, { location: 'Blk 204–207' });
  T('t303', 'o3', 'Noise complaint mediation — Blk 202', 'Resident Feedback', 'High', workDay(1), '12:00', 1.5, { impact: 'high', location: 'Blk 202' });
  T('t304', 'o3', 'Prepare community event permit checklist', 'Admin', 'Low', workDay(4), '17:00', 1.5, { location: 'Office' });
  T('t305', 'o3', 'Corridor obstruction check — Blk 206', 'Inspection', 'Medium', workDay(3), '12:00', 1, { safety: true, location: 'Blk 206' });

  // Daniel Lim (o4) — technical, busy
  T('t401', 'o4', 'Lift fault investigation — Blk 322 Lift C', 'Maintenance', 'Critical', TODAY, '13:00', 2.5, { safety: true, status: 'in_progress', spent: 0.5, location: 'Blk 322', impact: 'high' });
  T('t402', 'o4', 'Review lift maintenance contractor logs', 'Contractor', 'Medium', TODAY, '17:00', 2.5, { location: 'Office', source: 'Planner' });
  T('t403', 'o4', 'Electrical DB inspection — Blk 325', 'Inspection', 'High', workDay(1), '17:00', 2, { safety: true, location: 'Blk 325' });
  T('t404', 'o4', 'Water pump servicing follow-up — Blk 330', 'Maintenance', 'Medium', workDay(2), '17:00', 1.5, { location: 'Blk 330' });
  T('t405', 'o4', 'Joint inspection preparation pack', 'Admin', 'Low', workDay(2), '12:00', 1, { location: 'Office' });

  // Chua Hui Min (o5) — spare capacity
  T('t501', 'o5', 'Tree pruning inspection — park connector Blk 401', 'Horticulture', 'Medium', workDay(1), '17:00', 1.5, { safety: true, location: 'Blk 401' });
  T('t502', 'o5', 'Review festive period cleaning schedule', 'Cleaning', 'Low', workDay(3), '17:00', 1, { location: 'Office' });
  T('t503', 'o5', 'Check drain choke report — Blk 405', 'Cleaning', 'Medium', workDay(2), '12:00', 1, { location: 'Blk 405' });

  // Ravi Kumar (o6) — unavailable today and tomorrow
  T('t601', 'o6', 'Resident feedback triage (iFeedback queue)', 'Resident Feedback', 'High', TODAY, '17:00', 1.5, { impact: 'high', location: 'Office' });
  T('t602', 'o6', 'Contractor invoice verification — Zone C', 'Contractor', 'Medium', workDay(1), '12:00', 1.5, { location: 'Office', source: 'To Do' });
  T('t603', 'o6', 'Prepare Zone C monthly estate report', 'Admin', 'Medium', workDay(2), '17:00', 2.5, { location: 'Office' });
  T('t604', 'o6', 'Follow up: bulky item removal — Blk 410', 'Resident Feedback', 'Low', workDay(3), '17:00', 0.5, { location: 'Blk 410' });

  // Completed history — used for estimated vs actual effort analysis
  const D = (id, ownerId, title, category, est, actual, daysAgo) =>
    T(id, ownerId, title, category, 'Medium', workDay(-daysAgo), '17:00', est, {
      status: 'done', actual, completedAt: dt(workDay(-daysAgo), '16:00'), createdAt: dt(workDay(-daysAgo - 2), '09:00'),
    });
  D('h01', 'o1', 'Lift inspection — Blk 203', 'Inspection', 1.5, 1.9, 3);
  D('h02', 'o2', 'Roof access inspection — Blk 301', 'Inspection', 2, 2.3, 4);
  D('h03', 'o4', 'Fire hose reel inspection — Blk 320', 'Inspection', 1, 1.3, 2);
  D('h04', 'o4', 'Lift door sensor replacement follow-up', 'Maintenance', 2, 2.8, 5);
  D('h05', 'o4', 'Booster pump fault check — Blk 327', 'Maintenance', 1.5, 2, 6);
  D('h06', 'o3', 'Resident appeal: parking season ticket', 'Resident Feedback', 1, 0.9, 2);
  D('h07', 'o6', 'Neighbour dispute follow-up — Blk 412', 'Resident Feedback', 1.5, 1.3, 3);
  D('h08', 'o1', 'Resident call-back: corridor lights', 'Resident Feedback', 0.75, 0.75, 1);
  D('h09', 'o2', 'Contractor KPI review — cleaning', 'Contractor', 2, 2.2, 5);
  D('h10', 'o6', 'Contractor quotation comparison', 'Contractor', 1.5, 1.7, 4);
  D('h11', 'o3', 'Weekly notice update', 'Admin', 1, 1, 1);
  D('h12', 'o1', 'Monthly defect statistics', 'Admin', 2, 2.1, 6);
  D('h13', 'o5', 'Bin centre washing audit', 'Cleaning', 1, 1.1, 2);
  D('h14', 'o2', 'Litter hotspot check — Blk 308', 'Cleaning', 0.75, 0.8, 3);
  D('h15', 'o5', 'Tree risk assessment — Blk 403', 'Horticulture', 1.5, 1.6, 4);

  // Project work: completed milestones and tasks due after the planning week
  const P = (id, ownerId, title, category, est, daysAgo, projectId) =>
    T(id, ownerId, title, category, 'Medium', workDay(-daysAgo), '17:00', est, {
      status: 'done', actual: est, projectId, completedAt: dt(workDay(-daysAgo), '15:00'), createdAt: dt(workDay(-daysAgo - 3), '09:00'),
    });
  P('p101', 'o2', 'Approve repainting colour scheme with RC', 'Contractor', 1.5, 12, 'p1');
  P('p102', 'o3', 'Issue repainting notice to residents', 'Admin', 1, 9, 'p1');
  P('p103', 'o2', 'Scaffolding safety check — Blk 312', 'Inspection', 1.5, 6, 'p1');
  T('p104', 'o2', 'Joint final inspection — repainting Blk 312', 'Inspection', 'High', workDay(9), '17:00', 2, { location: 'Blk 312', projectId: 'p1', createdAt: dt(workDay(-12), '09:00') });
  P('p201', 'o4', 'Lift vendor Q3 performance review', 'Contractor', 2, 8, 'p2');
  P('p301', 'o5', 'Confirm festive lighting contractor quote', 'Contractor', 1, 4, 'p3');
  P('p303', 'o5', 'Book void deck for year-end event', 'Admin', 1.5, 2, 'p3');
  P('p501', 'o4', 'Bin centre floor resurfacing — Blk 306', 'Maintenance', 2, 14, 'p5');
  P('p502', 'o2', 'Final inspection — Blk 306 bin centre upgrade', 'Inspection', 1.5, 11, 'p5');
  T('p302', 'o5', 'Install festive lighting — Blk 401 to 405', 'Maintenance', 'Medium', workDay(8), '17:00', 3, { location: 'Blk 401–405', projectId: 'p3', createdAt: dt(workDay(-4), '09:00') });
  P('p401', 'o6', 'Collect Zone C contractor timesheets', 'Admin', 1, 3, 'p4');
  return list;
}

/** Fictional projects (12h Project Tracker). Tasks join a project through task.projectId. */
function projects() {
  return [
    { id: 'p1', name: 'Blk 312 repainting works', ownerId: 'o2', color: '#0f6cbd', start: workDay(-15), due: workDay(10),
      description: 'Cyclical repainting of Blk 312 with RC approval, resident notices and a joint final inspection.',
      milestones: [{ name: 'Colour scheme approved', date: workDay(-12) }, { name: 'Works complete', date: workDay(6) }, { name: 'Handover', date: workDay(10) }] },
    { id: 'p2', name: 'Zone A lift reliability programme', ownerId: 'o1', color: '#b10e1c', start: workDay(-10), due: workDay(5),
      description: 'Inspect every lift in Zone A, clear outstanding faults and review the lift vendor after repeated breakdowns.',
      milestones: [{ name: 'Vendor review', date: workDay(-8) }, { name: 'All lifts inspected', date: workDay(4) }] },
    { id: 'p3', name: 'Year-end festive estate preparation', ownerId: 'o5', color: '#0e7a0d', start: workDay(-3), due: workDay(12),
      description: 'Festive lighting, cleaning schedule and community event permits for the year-end period.',
      milestones: [{ name: 'Lighting installed', date: workDay(8) }, { name: 'Event day', date: workDay(12) }] },
    { id: 'p4', name: 'Zone C monthly estate report', ownerId: 'o6', color: '#8a4b00', start: workDay(-5), due: workDay(3),
      description: 'Compile the Zone C monthly report: feedback cases, contractor invoices and outstanding issues.',
      milestones: [{ name: 'Report submitted', date: workDay(3) }] },
    { id: 'p5', name: 'Blk 306 bin centre upgrade', ownerId: 'o4', color: '#00788a', start: workDay(-20), due: workDay(-10),
      description: 'Resurface the bin centre floor and improve drainage after repeated pest feedback.',
      milestones: [{ name: 'Works complete', date: workDay(-12) }] },
  ];
}

// Existing tasks that belong to a project, and starter checklists.
const PROJECT_TASKS = {
  p1: ['t203', 't206'],
  p2: ['t101', 't109', 't110', 't401', 't402'],
  p3: ['t502', 't304'],
  p4: ['t601', 't602', 't603', 't604'],
};
const CHECKLISTS = {
  t203: [['Check surface preparation on 4 floors', true], ['Photograph defects', true], ['Confirm paint batch numbers', false], ['Sign contractor site log', false]],
  t101: [['Lift A: brakes and door sensors', false], ['Lift B: brakes and door sensors', false], ['Record findings in IEMS', false]],
  t603: [['Feedback case summary', true], ['Contractor invoice totals', false], ['Outstanding issues list', false]],
  p104: [['Defects list from contractor', false], ['RC member attendance', false], ['Handover form signed', false]],
};

/** Starter tasks for "New project from template": [title, category, effort, share of the timeline]. */
export const PROJECT_TEMPLATES = {
  blank: { label: 'Blank project', tasks: [] },
  lift: { label: 'Lift replacement', tasks: [['Notify residents of lift downtime', 'Admin', 1, 0.1], ['Site survey with lift contractor', 'Inspection', 2, 0.25], ['Review installation method statement', 'Contractor', 1.5, 0.4], ['Weekly progress inspection', 'Inspection', 1.5, 0.7], ['Lift testing and handover', 'Inspection', 2, 1]] },
  repaint: { label: 'Repainting works', tasks: [['Approve colour scheme with RC', 'Contractor', 1.5, 0.1], ['Issue works notice to residents', 'Admin', 1, 0.2], ['Scaffolding safety check', 'Inspection', 1.5, 0.35], ['Mid-works quality inspection', 'Inspection', 1.5, 0.6], ['Joint final inspection', 'Inspection', 2, 1]] },
  festive: { label: 'Festive event', tasks: [['Apply for event permits', 'Admin', 1.5, 0.15], ['Confirm decoration contractor', 'Contractor', 1, 0.3], ['Plan extra cleaning rounds', 'Cleaning', 1, 0.5], ['Install decorations', 'Maintenance', 3, 0.8], ['Post-event clean-up check', 'Cleaning', 1, 1]] },
};

function linkProjects(list) {
  for (const [projectId, ids] of Object.entries(PROJECT_TASKS)) ids.forEach((id) => (list.find((t) => t.id === id).projectId = projectId));
  for (const [id, items] of Object.entries(CHECKLISTS)) list.find((t) => t.id === id).checklist = items.map(([text, done]) => ({ text, done }));
  return list;
}

export function createSeedState() {
  return {
    version: DATA_VERSION,
    seededFor: TODAY,
    role: 'officer',
    currentOfficerId: 'o1',
    supervisor: { id: 's1', name: 'Jennifer Ong', title: 'Estate Manager' },
    settings: {
      workStart: '08:30',
      workEnd: '17:30',
      lunchStart: '12:30',
      lunchEnd: '13:30',
      bufferMin: 10,
      minChunkMin: 30,
    },
    officers: officers(),
    meetings: meetings(),
    tasks: linkProjects(tasks()),
    projects: projects(),
    plans: {},
    activity: [
      { at: dt(workDay(-1), '17:42'), actor: 'SyncAI', text: 'Synced 4 tasks from Microsoft To Do and Planner (simulated).' },
    ],
    dismissed: [],
    integrations: Object.fromEntries(INTEGRATIONS.map((i) => [i.id, true])),
    alertsRead: [],
    reminders: [],
    prefs: { taskView: 'list', sidebarCollapsed: false },
    nextId: 1000,
  };
}

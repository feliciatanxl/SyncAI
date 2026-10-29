// Fictional seed data for the SyncAI prototype. Names, blocks and tasks are
// illustrative only and do not represent real Town Council records.

import { TODAY, workDay, horizonDays, dt } from './time.js';

export const DATA_VERSION = 5;

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
  { id: 'entra', name: 'Microsoft Entra ID + MSAL', icon: 'shield', phase: 'Core', data: 'Sign-in, identity and Officer / Supervisor role claims.', ai: ['Role-based views', 'Access control'], demo: 'Role switcher in the top bar' },
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
    tasks: tasks(),
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

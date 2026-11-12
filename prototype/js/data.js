// Fictional seed data for the SyncAI prototype. Names, blocks and tasks are
// illustrative only and do not represent real Town Council records.

import { TODAY, workDay, horizonDays, dt } from './time.js';

export const DATA_VERSION = 11;

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

export const SOURCES = ['SyncAI', 'Outlook', 'To Do', 'Planner', 'SharePoint', 'OCC (Mock)'];

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
  { id: 'automate', name: 'Power Automate approvals', icon: 'check-square', phase: 'Phase 2', data: 'Posts an Approvals card in Teams when SyncAI recommends a reassignment or an emergency re-plan; the supervisor’s decision is sent back to SyncAI. Power Automate is in the baseline Microsoft licence at Town Councils, and EMS said it will arrange any licences the project needs.', ai: ['Supervisor approval of reassignments', 'Escalation when safety and statutory work clash'], demo: 'Approve / discard buttons in the What-If Simulator and Smart Planner' },
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
      statutory: !!extra.statutory,
      consequence: extra.consequence || null,
      complaints: extra.complaints || 0,
      impact: extra.impact || 'medium',
      slaDue: extra.slaDue || dt(dueDay, dueTime),
      slaType: extra.slaType || (extra.statutory ? 'Statutory SLA' : extra.safety ? 'Safety SLA (BCA standard)' : 'Service SLA (Town Council standard)'),
      appointmentTime: extra.appointmentTime || null,
      commitmentWindow: extra.commitmentWindow || null,
      createdAt: extra.createdAt || dt(workDay(-2), '09:00'),
      completedAt: extra.completedAt || null,
      actual: extra.actual || null,
      projectId: extra.projectId || null,
      checklist: extra.checklist || [],
    });

  // Aisyah Rahman (o1) — the demo officer
  T('t101', 'o1', 'Lift inspection — Blk 208 (Lifts A & B)', 'Inspection', 'High', TODAY, '12:00', 1.5, {
    safety: true,
    location: 'Blk 208',
    source: 'Planner',
    impact: 'high',
    slaDue: dt(TODAY, '12:00'),
    slaType: 'Safety SLA (4h BCA compliance)',
    appointmentTime: '10:30–12:00 (Lift technician joint check)',
    consequence: 'Deferred inspection risks passenger entrapment and regulatory stop-work notice under BCA lift regulations.',
    description: 'Quarterly safety inspection following two resident reports of jerky stops.',
  });
  T('t102', 'o1', 'Review CleanPro monthly contractor report', 'Contractor', 'Medium', TODAY, '17:00', 1.5, {
    source: 'To Do',
    location: 'Office',
    slaDue: dt(TODAY, '17:00'),
    slaType: 'Contractor Review SLA (monthly close)',
    description: 'Check KPI attainment and penalty items before the coordination meeting.',
  });
  T('t103', 'o1', 'Site check: ceiling seepage at Blk 211 #05-12', 'Inspection', 'High', TODAY, '17:00', 1, {
    source: 'Outlook',
    location: 'Blk 211',
    impact: 'high',
    slaDue: dt(TODAY, '17:00'),
    slaType: 'Resident Feedback SLA (24h response window)',
    appointmentTime: '16:00–17:00 (Resident site visit booked)',
    commitmentWindow: 'Fixed resident appointment at #05-12',
    consequence: 'Unchecked ceiling seepage penetrates structural slab causing concrete spalling and costly emergency repair.',
    description: 'Flagged email from resident. Determine if the source is the unit above or common pipe.',
  });
  T('t104', 'o1', 'Resident follow-up call: Blk 211 seepage', 'Resident Feedback', 'Medium', workDay(1), '12:00', 0.75, {
    dependsOn: ['t103'],
    location: 'Phone',
    impact: 'high',
    slaDue: dt(workDay(1), '12:00'),
    slaType: 'Resident Follow-up SLA (next working day)',
  });
  T('t112', 'o1', 'Submit contractor rectification work-order: Blk 211 seepage', 'Contractor', 'Medium', workDay(2), '17:00', 1.5, {
    dependsOn: ['t104'],
    location: 'Office',
    slaDue: dt(workDay(2), '17:00'),
    slaType: 'Contractor Work-Order SLA',
    consequence: 'Delayed work-order postpones water ingress repairs causing progressive structural reinforcement corrosion.',
    description: 'Prepared after resident inspection and follow-up call are concluded.',
  });
  T('t105', 'o1', 'Inspect playground equipment — Blk 215', 'Inspection', 'Medium', workDay(1), '17:00', 2, { safety: true, source: 'Planner', location: 'Blk 215 playground' });
  T('t106', 'o1', 'Verify corridor cleaning complaint — Blk 209', 'Cleaning', 'Medium', workDay(2), '17:00', 0.75, { location: 'Blk 209', complaints: 6, description: 'Six calls this week, mostly from one resident. Verify on site; the number of calls alone does not make it urgent.' });
  T('t107', 'o1', 'Compile common-area lighting defect summary', 'Admin', 'Low', workDay(3), '17:00', 2, { source: 'To Do', location: 'Office' });
  T('t108', 'o1', 'Update estate maintenance log on SharePoint', 'Admin', 'Low', workDay(4), '17:00', 1, { location: 'Office' });
  T('t111', 'o1', 'Submit funding claim — Blk 214 lighting upgrade', 'Admin', 'Medium', workDay(2), '12:00', 1.5, {
    statutory: true,
    source: 'SharePoint',
    location: 'Office',
    slaDue: dt(workDay(2), '12:00'),
    slaType: 'Statutory Grant Cut-Off SLA',
    commitmentWindow: 'Strict Town Council funding submission cutoff',
    consequence: 'Missed cut-off date causes permanent forfeiture of Town Council co-funding grant.',
    description: 'Approved project funding lapses if the claim misses the submission cut-off.',
  });
  T('t109', 'o1', 'Lift inspection — Blk 212 (Lift C)', 'Inspection', 'High', workDay(3), '17:00', 1.5, { safety: true, location: 'Blk 212', source: 'Planner' });
  T('t110', 'o1', 'Inspect lift motor room access — Blk 213', 'Inspection', 'Medium', workDay(4), '17:00', 1, { safety: true, location: 'Blk 213', source: 'Planner' });
  T('t113', 'o1', 'OCC Alert: Fire alarm false trigger reset check — Blk 207', 'Inspection', 'High', TODAY, '15:00', 1, {
    safety: true,
    location: 'Blk 207',
    source: 'OCC (Mock)',
    slaDue: dt(TODAY, '15:00'),
    slaType: 'OCC Dispatch SLA (3h response)',
    description: 'Dispatched via EM Services Operations Command Centre mock feed. Verify fire alarm panel reset after reported surge.',
  });

  // Marcus Tan (o2) — overloaded
  T('t201', 'o2', 'Submit defect rectification report — Blk 305', 'Admin', 'High', workDay(-1), '17:00', 1.5, { status: 'in_progress', spent: 0.5, location: 'Office', source: 'Planner' });
  T('t202', 'o2', 'Inspect refuse chute hopper — Blk 310', 'Inspection', 'High', TODAY, '17:00', 1.5, {
    safety: true,
    location: 'Blk 310',
    slaDue: dt(TODAY, '17:00'),
    slaType: 'Fire Safety Response SLA',
    consequence: 'Defective refuse hopper allows smoke and toxic fumes to draft upward into residential corridors during chute fires.',
  });
  T('t209', 'o2', 'Verify handover defects list — Blk 315', 'Inspection', 'Medium', TODAY, '17:00', 1, { location: 'Blk 315', source: 'Planner' });
  T('t203', 'o2', 'Contractor site walk — repainting works Blk 312', 'Contractor', 'Medium', TODAY, '17:00', 2, { location: 'Blk 312', source: 'Outlook' });
  T('t204', 'o2', 'Respond to resident petition on car park lighting', 'Resident Feedback', 'Medium', workDay(1), '12:00', 1.5, { impact: 'high', location: 'Office' });
  T('t205', 'o2', 'Check cleaning contractor attendance records', 'Cleaning', 'Medium', workDay(1), '17:00', 1.5, { location: 'Office', source: 'To Do' });
  T('t206', 'o2', 'Prepare repainting progress update for committee', 'Admin', 'Medium', workDay(2), '12:00', 2.5, { dependsOn: ['t203'], location: 'Office' });
  T('t207', 'o2', 'Inspect roof waterproofing works — Blk 318', 'Inspection', 'High', workDay(2), '17:00', 2, { safety: true, location: 'Blk 318', consequence: 'Delayed waterproofing allows rainwater ponding to corrode reinforcement rebar across top floor units.' });
  T('t208', 'o2', 'Verify pest control treatment — Blk 306 bin centre', 'Cleaning', 'Low', workDay(3), '17:00', 1, { location: 'Blk 306' });

  // Priya Nair (o3) — balanced, on leave later this week
  T('t301', 'o3', 'Resident dialogue follow-ups (12 cases)', 'Resident Feedback', 'Medium', TODAY, '17:00', 2, { impact: 'high', location: 'Office' });
  T('t302', 'o3', 'Update notice boards — Blk 204 to 207', 'Admin', 'Low', workDay(1), '17:00', 1, { location: 'Blk 204–207' });
  T('t303', 'o3', 'Noise complaint mediation — Blk 202', 'Resident Feedback', 'High', workDay(1), '12:00', 1.5, { impact: 'high', location: 'Blk 202', complaints: 4 });
  T('t304', 'o3', 'Prepare community event permit checklist', 'Admin', 'Low', workDay(4), '17:00', 1.5, { location: 'Office' });
  T('t305', 'o3', 'Corridor obstruction check — Blk 206', 'Inspection', 'Medium', workDay(3), '12:00', 1, { safety: true, location: 'Blk 206' });

  // Daniel Lim (o4) — technical, busy
  T('t401', 'o4', 'Lift fault investigation — Blk 322 Lift C', 'Maintenance', 'Critical', TODAY, '13:00', 2.5, {
    safety: true,
    status: 'in_progress',
    spent: 0.5,
    location: 'Blk 322',
    impact: 'high',
    slaDue: dt(TODAY, '13:00'),
    slaType: 'Emergency Lift SLA (2h response)',
    consequence: 'Unresolved recurring lift fault leads to passenger entrapment escalation and statutory safety audit penalty.',
  });
  T('t402', 'o4', 'Review lift maintenance contractor logs', 'Contractor', 'Medium', TODAY, '17:00', 2.5, { location: 'Office', source: 'Planner' });
  T('t403', 'o4', 'Electrical DB inspection — Blk 325', 'Inspection', 'High', workDay(1), '17:00', 2, {
    safety: true,
    statutory: true,
    location: 'Blk 325',
    slaDue: dt(workDay(1), '17:00'),
    slaType: 'EMA Statutory Compliance SLA',
    commitmentWindow: 'Periodic electrical compliance certificate expires this week',
    consequence: 'Expired electrical compliance certificate invalidates building fire insurance and violates EMA regulations.',
    description: 'Periodic electrical inspection required for compliance; the certificate expires at the end of the week.',
  });
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

/**
 * Fictional Town Councils for the HQ overview (12g). The demo team belongs to
 * 'nv', whose figures are computed live; the others are sample roll-ups.
 */
export const COUNCILS = [
  { id: 'nv', name: 'Northvale Town Council', short: 'Northvale', live: true },
  { id: 'eb', name: 'Eastbrook Town Council', short: 'Eastbrook', officers: 9, openTasks: 54, overdue: 2, highRisk: 4, utilisation: 0.78, feedbackRate: 0.95,
    projects: [{ name: 'Blk 118 lift replacement', level: 'on-track', progress: 0.55 }, { name: 'Covered linkway extension', level: 'attention', progress: 0.3 }, { name: 'Hawker centre repainting', level: 'done', progress: 1 }] },
  { id: 'wr', name: 'Westridge Town Council', short: 'Westridge', officers: 7, openTasks: 61, overdue: 9, highRisk: 11, utilisation: 1.04, feedbackRate: 0.81,
    projects: [{ name: 'Multi-storey car park waterproofing', level: 'risk', progress: 0.2 }, { name: 'Fitness corner upgrade', level: 'risk', progress: 0.45 }, { name: 'Festive lighting', level: 'on-track', progress: 0.1 }] },
  { id: 'sh', name: 'Southhaven Town Council', short: 'Southhaven', officers: 8, openTasks: 39, overdue: 0, highRisk: 1, utilisation: 0.66, feedbackRate: 0.97,
    projects: [{ name: 'Drainage improvement — Zone B', level: 'on-track', progress: 0.7 }, { name: 'Playground replacement', level: 'on-track', progress: 0.4 }] },
];

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

function seedApprovals() {
  return [
    {
      id: 'appr-101',
      requestType: 'reassignment',
      taskId: 't103',
      taskTitle: 'Site check: ceiling seepage at Blk 211 #05-12',
      requesterId: 'o1',
      requesterName: 'Aisyah Rahman',
      requesterRole: 'team_member',
      assignedManagerId: 's1',
      assignedManagerName: 'Jennifer Ong',
      escalationManagerId: 'h1',
      escalationManagerName: 'Lim Wei Ling',
      originalOwnerId: 'o1',
      originalSchedule: `${TODAY} 16:00 (Aisyah Rahman)`,
      proposedOwnerId: 'o3',
      proposedSchedule: `${TODAY} 16:00 (Priya Nair)`,
      reason: 'Displaced by urgent Blk 214 lift breakdown with trapped resident. Need handover to protect 16:00 resident appointment.',
      slaImpact: 'Protects 24h Resident Feedback SLA (would breach by 18h if deferred without handover).',
      operationalImpact: 'Priya Nair is qualified in Zone A inspection and has 3.5h spare capacity today.',
      status: 'pending',
      createdAt: dt(TODAY, '11:30'),
      decidedAt: null,
      decidedBy: null,
      decision: null,
      auditTrail: [
        { at: dt(TODAY, '11:30'), actor: 'Aisyah Rahman', action: 'SUBMITTED', channel: 'In-App', details: 'Submitted reassignment request for manager approval.' },
        { at: dt(TODAY, '11:31'), actor: 'SyncAI Notification Adapter', action: 'DISPATCHED', channel: 'Teams (Proposed)', details: 'Sent approval card to Jennifer Ong with secure link.' },
        { at: dt(TODAY, '11:31'), actor: 'SyncAI Notification Adapter', action: 'DISPATCHED', channel: 'WhatsApp (Proposed)', details: 'Simulated WhatsApp dispatch to Jennifer Ong: [SyncAI] Reassignment Approval Request (Ref: appr-101).' },
      ],
    },
    {
      id: 'appr-100',
      requestType: 'schedule_adjustment',
      taskId: 't102',
      taskTitle: 'Review CleanPro monthly contractor report',
      requesterId: 'o1',
      requesterName: 'Aisyah Rahman',
      requesterRole: 'team_member',
      assignedManagerId: 's1',
      assignedManagerName: 'Jennifer Ong',
      escalationManagerId: 'h1',
      escalationManagerName: 'Lim Wei Ling',
      originalOwnerId: 'o1',
      originalSchedule: `${TODAY} 17:00 (Aisyah Rahman)`,
      proposedOwnerId: 'o1',
      proposedSchedule: `${workDay(1)} 10:00 (Aisyah Rahman)`,
      reason: 'Rescheduled routine contractor KPI review to accommodate urgent lift coordination.',
      slaImpact: 'Within monthly contractor review cycle window; no contractual penalty.',
      operationalImpact: 'Routine admin postponed by 1 working day; no downstream task blocked.',
      status: 'approved',
      createdAt: dt(TODAY, '10:15'),
      decidedAt: dt(TODAY, '10:25'),
      decidedBy: 'Jennifer Ong',
      decision: 'Approved routine review postponement; contractor coordination meeting is tomorrow afternoon.',
      auditTrail: [
        { at: dt(TODAY, '10:15'), actor: 'Aisyah Rahman', action: 'SUBMITTED', channel: 'In-App', details: 'Requested schedule adjustment for CleanPro report.' },
        { at: dt(TODAY, '10:25'), actor: 'Jennifer Ong', action: 'APPROVED', channel: 'In-App', details: 'Approved postponement to tomorrow 10:00.' },
      ],
    },
  ];
}

function seedNotifications() {
  return [
    {
      id: 'notif-1',
      type: 'urgent_assignment',
      channel: 'whatsapp',
      channelLabel: 'WhatsApp (Proposed)',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'Urgent Disruption: Lift Breakdown with Trapped Resident',
      summary: 'Urgent response required at Blk 214 Lift B. Immediate safety protocol activated. Review adjusted schedule in SyncAI.',
      taskId: 'sim_inc',
      secureLink: 'syncai://planner/o1',
      timestamp: dt(TODAY, '11:15'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-01',
    },
    {
      id: 'notif-2',
      type: 'sla_warning',
      channel: 'teams',
      channelLabel: 'Microsoft Teams (Proposed)',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'SLA Warning: Blk 208 Lift Safety Inspection',
      summary: 'BCA 4h inspection deadline due at 12:00. Time block remaining: 45 minutes.',
      caseId: 'case-004',
      taskId: 't101',
      secureLink: '#cases/case-004',
      timestamp: dt(TODAY, '11:00'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-02',
    },
    {
      id: 'notif-3',
      type: 'approval_request',
      channel: 'whatsapp',
      channelLabel: 'WhatsApp (Proposed)',
      recipientId: 's1',
      recipientName: 'Jennifer Ong',
      recipientRole: 'manager',
      title: 'Approval Required: Reassign Blk 211 Seepage Check',
      summary: 'Aisyah Rahman requested reassigning Case DEMO-001 to Priya Nair to protect 16:00 resident appointment. Tap to review.',
      caseId: 'case-001',
      taskId: 't103',
      approvalId: 'appr-101',
      secureLink: '#cases/case-001',
      timestamp: dt(TODAY, '11:31'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-03',
    },
    {
      id: 'notif-6',
      type: 'resident_followup_due',
      priority: 'warning',
      channel: 'in_app',
      channelLabel: 'In-App',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'Resident Follow-Up Due: Blk 211',
      summary: 'Promised resident callback for Case DEMO-001 (Ceiling seepage) is due today. Tap to review.',
      caseId: 'case-001',
      taskId: 't104',
      secureLink: '#cases/case-001',
      timestamp: dt(TODAY, '10:00'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-06',
    },
    {
      id: 'notif-7',
      type: 'contractor_quote_pending',
      priority: 'warning',
      channel: 'teams',
      channelLabel: 'Microsoft Teams (Proposed)',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'Contractor Response Pending: Blk 211',
      summary: 'Eng Seng Plumbing requested access confirmation for unit #06-12. Scope quotation pending > 24h.',
      caseId: 'case-001',
      taskId: 't112',
      secureLink: '#cases/case-001',
      timestamp: dt(TODAY, '11:15'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-07',
    },
    {
      id: 'notif-8',
      type: 'blocker_detected',
      priority: 'urgent',
      channel: 'in_app',
      channelLabel: 'In-App',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'Case Blocker: Upper Unit Unreachable',
      summary: 'Upper unit #06-12 resident unreachable for moisture inspection. Physical door notice required.',
      caseId: 'case-001',
      secureLink: '#cases/case-001',
      timestamp: dt(TODAY, '11:30'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-08',
    },
    {
      id: 'notif-4',
      type: 'reassignment_approved',
      channel: 'in_app',
      channelLabel: 'In-App',
      recipientId: 'o1',
      recipientName: 'Aisyah Rahman',
      recipientRole: 'team_member',
      title: 'Schedule Change Approved: CleanPro Monthly Report',
      summary: 'Jennifer Ong approved rescheduling CleanPro review to tomorrow 10:00.',
      taskId: 't102',
      approvalId: 'appr-100',
      secureLink: 'syncai://tasks/t102',
      timestamp: dt(TODAY, '10:25'),
      read: true,
      privacySafe: true,
      auditId: 'aud-notif-04',
    },
    {
      id: 'notif-5',
      type: 'escalation',
      channel: 'teams',
      channelLabel: 'Microsoft Teams (Proposed)',
      recipientId: 'h1',
      recipientName: 'Lim Wei Ling',
      recipientRole: 'hq',
      title: 'Compliance Escalation: Electrical DB Statutory Inspection',
      summary: 'Technical Officer Daniel Lim has tight capacity before Blk 325 EMA compliance expiry. Standby contractor alerted.',
      taskId: 't403',
      secureLink: 'syncai://insights',
      timestamp: dt(TODAY, '09:30'),
      read: false,
      privacySafe: true,
      auditId: 'aud-notif-05',
    },
  ];
}

export function defaultUsers() {
  return [
    { id: 'a1', displayName: 'TAN, ALEX', email: 'alex.tan@syncai.demo', role: 'admin', status: 'active', teams: [] },
    { id: 's1', displayName: 'Jennifer Ong', email: 'jennifer.ong@towncouncil.gov.sg', role: 'manager', status: 'active', teams: [{ id: 'team-1', name: 'Zone A Operations', kind: 'manager' }, { id: 'team-2', name: 'Zone B Technical', kind: 'manager' }, { id: 'team-3', name: 'Zone C Conservancy', kind: 'manager' }] },
    { id: 'o1', displayName: 'Aisyah Rahman', email: 'aisyah.rahman@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-1', name: 'Zone A Operations', kind: 'member' }] },
    { id: 'o2', displayName: 'Marcus Tan', email: 'marcus.tan@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-2', name: 'Zone B Technical', kind: 'member' }] },
    { id: 'o3', displayName: 'Priya Nair', email: 'priya.nair@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-1', name: 'Zone A Operations', kind: 'member' }] },
    { id: 'o4', displayName: 'Daniel Lim', email: 'daniel.lim@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-2', name: 'Zone B Technical', kind: 'member' }] },
    { id: 'o5', displayName: 'Chua Hui Min', email: 'chua.huimin@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-3', name: 'Zone C Conservancy', kind: 'member' }] },
    { id: 'o6', displayName: 'Ravi Kumar', email: 'ravi.kumar@towncouncil.gov.sg', role: 'member', status: 'active', teams: [{ id: 'team-3', name: 'Zone C Conservancy', kind: 'member' }] },
    { id: 'p1', displayName: 'David Koh', email: 'david.koh@towncouncil.gov.sg', role: 'member', status: 'pending', teams: [] },
    { id: 'd1', displayName: 'Siti Nurhaliza', email: 'siti.nurhaliza@towncouncil.gov.sg', role: 'member', status: 'disabled', teams: [] },
  ];
}

export function defaultTeams() {
  return [
    {
      id: 'team-1',
      name: 'Zone A Operations',
      managers: [{ id: 's1', displayName: 'Jennifer Ong', email: 'jennifer.ong@towncouncil.gov.sg' }],
      members: [
        { id: 'o1', displayName: 'Aisyah Rahman', email: 'aisyah.rahman@towncouncil.gov.sg', role: 'Property Officer', lastActiveAt: new Date().toISOString() },
        { id: 'o3', displayName: 'Priya Nair', email: 'priya.nair@towncouncil.gov.sg', role: 'Estate Officer', lastActiveAt: new Date().toISOString() },
      ],
    },
    {
      id: 'team-2',
      name: 'Zone B Technical',
      managers: [{ id: 's1', displayName: 'Jennifer Ong', email: 'jennifer.ong@towncouncil.gov.sg' }],
      members: [
        { id: 'o2', displayName: 'Marcus Tan', email: 'marcus.tan@towncouncil.gov.sg', role: 'Property Officer', lastActiveAt: new Date().toISOString() },
        { id: 'o4', displayName: 'Daniel Lim', email: 'daniel.lim@towncouncil.gov.sg', role: 'Technical Officer', lastActiveAt: new Date().toISOString() },
      ],
    },
    {
      id: 'team-3',
      name: 'Zone C Conservancy',
      managers: [{ id: 's1', displayName: 'Jennifer Ong', email: 'jennifer.ong@towncouncil.gov.sg' }],
      members: [
        { id: 'o5', displayName: 'Chua Hui Min', email: 'chua.huimin@towncouncil.gov.sg', role: 'Conservancy Officer', lastActiveAt: new Date().toISOString() },
        { id: 'o6', displayName: 'Ravi Kumar', email: 'ravi.kumar@towncouncil.gov.sg', role: 'Estate Officer', lastActiveAt: null },
      ],
    },
  ];
}

export function sampleToDoData() {
  return {
    lists: [
      { id: 'l1', name: 'Tasks (Default)' },
      { id: 'l2', name: 'Estate Inspections' },
      { id: 'l3', name: 'Contractor Follow-ups' },
    ],
    tasks: {
      l1: [
        { id: 'td-1', title: 'Follow up with lift vendor on Blk 208 fault logs', due: dt(TODAY, '12:00'), status: 'inProgress', importance: 'high', done: false },
        { id: 'td-2', title: 'Prepare water seepage site inspection notes for #05-12', due: dt(TODAY, '17:00'), status: 'notStarted', importance: 'normal', done: false },
        { id: 'td-3', title: 'Submit weekly contractor coordination summary', due: dt(workDay(1), '17:00'), status: 'notStarted', importance: 'normal', done: false },
        { id: 'td-4', title: 'Complete monthly workplace safety e-learning module', due: dt(workDay(3), '17:00'), status: 'completed', importance: 'low', done: true },
      ],
      l2: [
        { id: 'td-5', title: 'Blk 208 lift shaft sensory alignment check', due: dt(TODAY, '11:00'), status: 'inProgress', importance: 'high', done: false },
        { id: 'td-6', title: 'Corridor lighting lux test Blk 214', due: dt(workDay(1), '14:00'), status: 'notStarted', importance: 'normal', done: false },
      ],
      l3: [
        { id: 'td-7', title: 'CleanPro penalty deduction sign-off', due: dt(TODAY, '16:00'), status: 'inProgress', importance: 'high', done: false },
        { id: 'td-8', title: 'Bin centre resurfacing warranty handover', due: dt(workDay(2), '17:00'), status: 'completed', importance: 'normal', done: true },
      ],
    },
  };
}

export function addDemoCases(state) {
  const seedCases = [
    {
      id: 'case-001', number: 'DEMO-001', caseNumber: 'DEMO-001', title: 'Ceiling seepage at Blk 211', category: 'Resident Feedback',
      status: 'In progress', ownerId: 'o1', location: 'Blk 211', estate: 'Zone A — Blk 211', block: 'Blk 211', unit: '#05-12',
      urgency: 'High', priority: 'High',
      description: 'A resident reported ceiling seepage. Inspect the affected unit, follow up with the resident and prepare the rectification work order.',
      summary: 'A resident reported ceiling seepage. Inspect the affected unit, follow up with the resident and prepare the rectification work order.',
      responseDue: dt(TODAY, '17:00'), followUpDue: dt(workDay(1), '12:00'), slaDue: dt(TODAY, '17:00'), slaType: 'Resident Follow-up SLA (next working day)',
      resident: { name: 'Mdm Tan Siew Lan', contact: '9123 4567', email: 'tan.sl@resident.demo', unit: '#05-12' },
      taskIds: ['t103', 't104', 't112'],
      blockers: [{ id: 'b-001-1', title: 'Upper unit resident (#06-12) unreachable by phone', recordedAt: dt(TODAY, '11:30'), resolved: false, suggestedAction: 'Dispatch physical inspection notice letter under door' }],
      checkpoints: [
        { id: 'cp-001-1', title: 'Unit #05-12 ceiling moisture & thermography inspection', completed: true, completedAt: dt(TODAY, '10:00'), actor: 'Aisyah Rahman', requiredForClosure: true },
        { id: 'cp-001-2', title: 'Resident follow-up call & acknowledgment', completed: false, due: dt(workDay(1), '12:00'), actor: 'Aisyah Rahman', requiredForClosure: true, looseEndReason: 'Resident follow-up promised on workDay(1) but outcome not recorded' },
        { id: 'cp-001-3', title: 'Upper unit #06-12 joint plumbing inspection', completed: false, due: dt(workDay(2), '17:00'), actor: 'Aisyah Rahman', requiredForClosure: true },
        { id: 'cp-001-4', title: 'Contractor rectification work-order sign-off', completed: false, due: dt(workDay(3), '17:00'), actor: 'Jennifer Ong', requiresManager: true, requiredForClosure: true },
      ],
      evidence: [
        { id: 'evi-001-1', title: 'Ceiling seepage photographic evidence', type: 'photo', uploadedAt: dt(TODAY, '10:15'), verified: true, sourceRef: 'IMG_20261111_1002.jpg' },
        { id: 'evi-001-2', title: 'Upper unit joint inspection notice copy', type: 'document', uploadedAt: null, verified: false, missing: true, sourceRef: 'Notice Ref #211-0612' },
      ],
      timeline: [
        { id: 'ev-001-1', at: dt(workDay(-1), '14:30'), type: 'reported', title: 'Resident Seepage Feedback Lodged', summary: 'Resident reported persistent water stains and paint peeling above master bedroom toilet.', source: 'OneService Portal / CRM', actor: 'OneService Connector' },
        { id: 'ev-001-2', at: dt(workDay(-1), '16:00'), type: 'assigned', title: 'Assigned to Zone A Property Officer', summary: 'Assigned to Aisyah Rahman for priority on-site inspection.', source: 'SyncAI Engine', actor: 'Jennifer Ong' },
        { id: 'ev-001-3', at: dt(TODAY, '10:00'), type: 'inspection', title: 'On-site moisture assessment completed', summary: 'Moisture level recorded at 78%. Suspected defective waterproof membrane or floor trap seal from #06-12.', source: 'Mobile Inspection Form', actor: 'Aisyah Rahman' },
      ],
      requiresManagerApprovalForClosure: true,
    },
    {
      id: 'case-002', number: 'DEMO-002', caseNumber: 'DEMO-002', title: 'Refuse chute hopper fault at Blk 310', category: 'Maintenance',
      status: 'Open', ownerId: 'o2', location: 'Blk 310', estate: 'Zone B — Blk 310', block: 'Blk 310', unit: '#02 Common Lobby',
      urgency: 'High', priority: 'High',
      description: 'The refuse chute hopper was reported faulty. Inspect the hopper and record the findings.',
      summary: 'The refuse chute hopper was reported faulty. Inspect the hopper and record the findings.',
      responseDue: dt(TODAY, '17:00'), followUpDue: null, slaDue: dt(TODAY, '17:00'), slaType: 'Estate Maintenance SLA',
      resident: { name: 'Resident Committee Zone B', contact: '6338 ****', email: 'rc.zoneb@estate.demo', unit: 'RC Centre' },
      taskIds: ['t202'],
      blockers: [],
      checkpoints: [
        { id: 'cp-002-1', title: 'Hopper latch mechanical inspection', completed: true, completedAt: dt(TODAY, '11:00'), actor: 'Marcus Tan', requiredForClosure: true },
        { id: 'cp-002-2', title: 'Conservancy contractor hinge replacement', completed: false, due: dt(TODAY, '16:45'), actor: 'Marcus Tan', requiredForClosure: true, looseEndReason: 'Contractor repair appointment scheduled today without confirmed attendance' },
      ],
      evidence: [
        { id: 'evi-002-1', title: 'Hopper latch misalignment photo', type: 'photo', uploadedAt: dt(TODAY, '11:10'), verified: true, sourceRef: 'IMG_20261111_1105.jpg' },
      ],
      timeline: [
        { id: 'ev-002-1', at: dt(TODAY, '09:00'), type: 'reported', title: 'Hopper Fault Reported', summary: 'Hopper door jammed ajar, causing odor in common lobby.', source: 'Hotline', actor: 'Hotline Operator' },
      ],
      requiresManagerApprovalForClosure: false,
    },
    {
      id: 'case-003', number: 'DEMO-003', caseNumber: 'DEMO-003', title: 'Drain obstruction at Blk 405', category: 'Cleaning',
      status: 'Open', ownerId: 'o5', location: 'Blk 405', estate: 'Zone C — Blk 405', block: 'Blk 405', unit: 'Perimeter Drain',
      urgency: 'Medium', priority: 'Medium',
      description: 'A possible drain obstruction was reported near the block. Confirm the location and extent during the site check.',
      summary: 'A possible drain obstruction was reported near the block. Confirm the location and extent during the site check.',
      responseDue: null, followUpDue: null, slaDue: dt(workDay(2), '12:00'), slaType: 'Public Cleanliness SLA',
      resident: { name: 'Estate Conservancy Patrol', contact: '6555 ****', email: 'conservancy@towncouncil.gov.sg', unit: 'Zone C Office' },
      taskIds: ['t503'],
      blockers: [],
      checkpoints: [
        { id: 'cp-003-1', title: 'Perimeter drain inspection', completed: false, due: dt(workDay(2), '12:00'), actor: 'Chua Hui Min', requiredForClosure: true },
      ],
      evidence: [],
      timeline: [
        { id: 'ev-003-1', at: dt(workDay(-1), '08:45'), type: 'reported', title: 'Drain Choke Report Lodged', summary: 'Leaves and silt accumulation reported near perimeter drain.', source: 'OneService', actor: 'OneService Connector' },
      ],
      requiresManagerApprovalForClosure: false,
    },
    {
      id: 'case-004', number: 'DEMO-004', caseNumber: 'DEMO-004', title: 'Reported lift jolts at Blk 208', category: 'Maintenance',
      status: 'Open', ownerId: 'o1', location: 'Blk 208', estate: 'Zone A — Blk 208', block: 'Blk 208', unit: 'Lifts A & B',
      urgency: 'Critical', priority: 'Critical',
      description: 'Residents reported jolts during lift travel. The officer will inspect the lifts with the technician.',
      summary: 'Residents reported jolts during lift travel. The officer will inspect the lifts with the technician.',
      responseDue: dt(TODAY, '12:00'), followUpDue: null, slaDue: dt(TODAY, '12:00'), slaType: 'BCA Lift Safety SLA (4h response)',
      resident: { name: 'Emergency Hotline', contact: '1800-***-****', email: 'ems.hotline@towncouncil.gov.sg', unit: 'Hotline Escalation' },
      taskIds: ['t101'],
      blockers: [],
      checkpoints: [
        { id: 'cp-004-1', title: 'Joint technical inspection with Lift Contractor', completed: false, due: dt(TODAY, '12:00'), actor: 'Aisyah Rahman', requiredForClosure: true, looseEndReason: 'BCA safety inspection appointment pending technician outcome sign-off' },
      ],
      evidence: [
        { id: 'evi-004-1', title: 'Preliminary vibration meter readout', type: 'log', uploadedAt: dt(TODAY, '10:45'), verified: true, sourceRef: 'VIB_LOG_208A.csv' },
      ],
      timeline: [
        { id: 'ev-004-1', at: dt(TODAY, '08:00'), type: 'reported', title: 'Lift Jolt Alert Logged', summary: 'Hotline dispatch received multiple resident calls regarding Lift A jolts between 8th and 10th floors.', source: 'Hotline', actor: 'Dispatch Operator' },
      ],
      requiresManagerApprovalForClosure: true,
    },
  ];

  if (!Array.isArray(state.cases)) {
    state.cases = seedCases;
  } else {
    const seedMap = new Map(seedCases.map((c) => [c.id, c]));
    for (const c of state.cases) {
      const seed = seedMap.get(c.id);
      if (seed) {
        if (!c.checkpoints || c.checkpoints.length === 0) c.checkpoints = JSON.parse(JSON.stringify(seed.checkpoints || []));
        if (!c.blockers || c.blockers.length === 0) c.blockers = JSON.parse(JSON.stringify(seed.blockers || []));
        if (!c.evidence || c.evidence.length === 0) c.evidence = JSON.parse(JSON.stringify(seed.evidence || []));
        if (!c.timeline || c.timeline.length === 0) c.timeline = JSON.parse(JSON.stringify(seed.timeline || []));
        c.estate = seed.estate;
        c.block = seed.block;
        c.unit = seed.unit;
        c.resident ??= seed.resident;
        c.urgency ??= seed.urgency;
        c.priority ??= seed.priority;
        c.taskIds ??= seed.taskIds;
        c.summary ??= seed.summary;
        c.slaDue ??= seed.slaDue;
        c.slaType ??= seed.slaType;
        c.requiresManagerApprovalForClosure ??= seed.requiresManagerApprovalForClosure;
        c.caseNumber ??= seed.number;
      }
    }
  }
  const caseByTask = {
    t103: 'case-001', t104: 'case-001', t112: 'case-001',
    t202: 'case-002', t503: 'case-003', t101: 'case-004',
  };
  for (const task of state.tasks) {
    if (caseByTask[task.id] && !Object.hasOwn(task, 'caseId')) task.caseId = caseByTask[task.id];
  }

  state.communications ??= [
    {
      id: 'comm-001-1',
      caseId: 'case-001',
      channel: 'in_app',
      channelLabel: 'In-App Portal',
      direction: 'inbound',
      sender: 'Mdm Tan Siew Lan (Resident #05-12)',
      senderRole: 'Resident',
      recipient: 'Aisyah Rahman (Property Officer)',
      timestamp: dt(workDay(-1), '14:35'),
      category: 'Resident Feedback',
      content: 'Water stains have spread across the toilet ceiling. Upper floor neighbor was not home when I knocked.',
      acknowledged: true,
      acknowledgedAt: dt(workDay(-1), '15:00'),
      sourceLabel: 'Simulated notification',
      linkedTaskId: 't103',
    },
    {
      id: 'comm-001-2',
      caseId: 'case-001',
      channel: 'whatsapp',
      channelLabel: 'WhatsApp (Proposed)',
      direction: 'outbound',
      sender: 'Aisyah Rahman (Property Officer)',
      senderRole: 'Property Officer',
      recipient: 'Mdm Tan Siew Lan (9123 4567)',
      timestamp: dt(TODAY, '10:30'),
      category: 'Inspection Update',
      content: 'Dear Mdm Tan, on-site inspection completed. Moisture meter recorded 78%. We will issue a joint inspection notice to #06-12 today.',
      acknowledged: true,
      acknowledgedAt: dt(TODAY, '10:45'),
      sourceLabel: 'Proposed external channel',
      linkedTaskId: 't104',
    },
    {
      id: 'comm-001-3',
      caseId: 'case-001',
      channel: 'teams',
      channelLabel: 'Microsoft Teams (Proposed)',
      direction: 'inbound',
      sender: 'Eng Seng Plumbing Pte Ltd (Contractor)',
      senderRole: 'Term Contractor',
      recipient: 'Zone A Operations Team',
      timestamp: dt(TODAY, '11:15'),
      category: 'Contractor Query',
      content: 'Need access to unit #06-12 to check floor trap pipe. Please confirm if inspection notice letter has been served under door.',
      acknowledged: false,
      sourceLabel: 'Proposed external channel',
      linkedTaskId: 't112',
    },
    {
      id: 'comm-002-1',
      caseId: 'case-002',
      channel: 'in_app',
      channelLabel: 'In-App Portal',
      direction: 'inbound',
      sender: 'Zone B RC Secretariat',
      senderRole: 'Resident Committee',
      recipient: 'Marcus Tan',
      timestamp: dt(TODAY, '09:05'),
      category: 'Estate Feedback',
      content: 'Refuse hopper at #02 common lobby jammed ajar. Odor complaint lodged by residents.',
      acknowledged: true,
      acknowledgedAt: dt(TODAY, '09:15'),
      sourceLabel: 'Simulated notification',
      linkedTaskId: 't202',
    },
    {
      id: 'comm-004-1',
      caseId: 'case-004',
      channel: 'in_app',
      channelLabel: 'In-App Portal',
      direction: 'inbound',
      sender: 'OCC Lift Dispatch Hotline',
      senderRole: 'Operations Centre',
      recipient: 'Aisyah Rahman',
      timestamp: dt(TODAY, '08:05'),
      category: 'BCA Lift Safety Alert',
      content: 'Lift A at Blk 208 reported jerking violently during descent between 10th and 8th floor. Joint technical inspection with Lift Contractor scheduled.',
      acknowledged: true,
      acknowledgedAt: dt(TODAY, '08:15'),
      sourceLabel: 'Simulated notification',
      linkedTaskId: 't101',
    },
  ];
  return state;
}

export function addPlanningDemoData(state) {
  state.appointments ??= [
    { id: 'repair-1', title: 'Lift technician joint check', date: TODAY, start: '10:30', end: '12:00', ownerId: 'o1', taskId: 't101', location: 'Blk 208' },
    { id: 'repair-2', title: 'Resident seepage inspection', date: TODAY, start: '16:00', end: '17:00', ownerId: 'o1', taskId: 't103', location: 'Blk 211' },
    { id: 'repair-3', title: 'Contractor pump servicing appointment', date: workDay(1), start: '13:30', end: '14:15', ownerId: 'o1', location: 'Blk 214 pump room' },
    { id: 'repair-4', title: 'Contractor refuse chute repair appointment', date: TODAY, start: '16:15', end: '16:45', ownerId: 'o2', location: 'Blk 310' },
  ];
  const tagsByTask = {
    t101: ['Lift', 'Technician'], t102: ['Contractor', 'Monthly report'],
    t103: ['Seepage', 'Resident visit'], t104: ['Seepage', 'Resident follow-up'],
    t105: ['Playground', 'Estate inspection'], t107: ['Lighting', 'Monthly report'],
    t112: ['Seepage', 'Contractor'], t203: ['Contractor', 'Repainting'], t401: ['Lift', 'Fault'],
  };
  for (const task of state.tasks) {
    if (tagsByTask[task.id]) task.tags ??= [...tagsByTask[task.id]];
  }
  return state;
}

export function createSeedState() {
  return addPlanningDemoData(addDemoCases({
    version: DATA_VERSION,
    seededFor: TODAY,
    role: 'team_member',
    status: 'active',
    currentOfficerId: 'o1',
    supervisor: { id: 's1', name: 'Jennifer Ong', title: 'Estate Manager' },
    admin: { id: 'a1', name: 'TAN, ALEX', displayName: 'TAN, ALEX', title: 'Town Council Administrator', email: 'alex.tan@syncai.demo' },
    hq: { id: 'h1', name: 'Lim Wei Ling', title: 'EMS HQ · Estate Operations' },
    council: 'nv',
    settings: {
      workStart: '08:30',
      workEnd: '17:30',
      lunchStart: '12:30',
      lunchEnd: '13:30',
      bufferMin: 10,
      minChunkMin: 30,
    },
    users: defaultUsers(),
    teams: defaultTeams(),
    todo: sampleToDoData(),
    officers: officers(),
    meetings: meetings(),
    tasks: linkProjects(tasks()),
    projects: projects(),
    plans: {},
    activity: [
      { at: dt(workDay(-1), '17:42'), actor: 'SyncAI', text: 'Synced 4 tasks from Microsoft To Do and Planner (simulated).' },
      { at: dt(TODAY, '10:25'), actor: 'Jennifer Ong', text: 'Approved schedule adjustment for CleanPro monthly contractor report (appr-100).' },
    ],
    approvals: seedApprovals(),
    notifications: seedNotifications(),
    dismissed: [],
    integrations: Object.fromEntries(INTEGRATIONS.map((i) => [i.id, true])),
    alertsRead: [],
    reminders: [],
    prefs: { taskView: 'list', sidebarCollapsed: false },
    nextId: 1000,
  }));
}

import { CASE_PRIORITY_ORDER } from './cases.js';
import { fmtDue, NOW, singaporeDateInput, singaporeInstant } from './time.js';

const CATEGORY_RULES = [
  ['Inspection', /\b(inspect(?:ion)?|site check|verify|survey|audit)\b/i],
  ['Resident Feedback', /\b(complaint|resident (?:report|feedback|follow-up)|seepage|mediation)\b/i],
  ['Cleaning', /\b(cleaning|litter|drain|pest|refuse)\b/i],
  ['Horticulture', /\b(tree|pruning|landscaping|grass)\b/i],
  ['Contractor', /\b(contractor|vendor|quotation|rectification work order)\b/i],
  ['Maintenance', /\b(lift|repair|pump|fault|servicing)\b/i],
  ['Admin', /\b(report|invoice|minutes|register|paperwork)\b/i],
];

export function suggestCategory(title, description) {
  for (const value of [title, description]) {
    for (const [category, pattern] of CATEGORY_RULES) {
      const match = pattern.exec(value || '');
      if (match) return { category, keyword: match[0] };
    }
  }
  return null;
}

export function parseTaskTags(value) {
  const tags = new Map();
  for (const item of String(value ?? '').split(',')) {
    const tag = item.trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > 32) throw new Error('Keep each tag to 32 characters or fewer.');
    const key = tag.toLowerCase();
    if (!tags.has(key)) tags.set(key, tag);
  }
  if (tags.size > 8) throw new Error('Choose up to eight tags per task.');
  return [...tags.values()];
}

export function taskDeadline(task) {
  const due = singaporeDateInput(task.dueAt || task.due);
  const sla = singaporeDateInput(task.slaDue);
  return sla && (!due || sla < due) ? { at: sla, label: 'SLA deadline' } : { at: due, label: 'Task deadline' };
}

export function deadlineAlert(task, now = NOW) {
  if (task.status === 'done') return null;
  const deadline = taskDeadline(task);
  if (!deadline.at) return null;
  const hours = (Date.parse(singaporeInstant(deadline.at)) - Date.parse(singaporeInstant(now))) / 3600000;
  if (hours <= 0) return { label: 'Overdue', tone: 'danger' };
  if (hours <= 24) return { label: 'Due within 24h', tone: 'warning' };
  return null;
}

export function priorityFactors(task) {
  const deadline = taskDeadline(task);
  const service = task.impact === 'high' ? 'The demo record marks a high impact on estate services.'
    : task.category === 'Maintenance' ? 'This work order is classified as estate maintenance.' : '';
  const safety = task.safety ? 'A resident safety risk is recorded on this task.' : '';
  const residents = task.category === 'Resident Feedback' ? 'This task follows up on resident feedback.' : '';
  const urgency = [
    deadline.at ? `${deadline.label} recorded for ${fmtDue(deadline.at)} SGT.` : '',
    task.statutory ? 'A statutory deadline is recorded.' : '',
    task.appointmentTime || task.fixedStartAt ? 'The task has a fixed commitment.' : '',
  ].filter(Boolean).join(' ');
  return [service, safety, residents, urgency].map((reason, i) => ({ factor: CASE_PRIORITY_ORDER[i], reason }))
    .filter(({ reason }) => reason);
}

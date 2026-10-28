// Simulated intelligence. Every function here is deterministic and returns
// the reasons behind its result so the UI can explain each recommendation.
// No network requests or real AI services are used.

import { CATEGORY_BASE_EFFORT, CATEGORIES } from './data.js';
import { isOpen, getTask, getOfficer, officerName } from './state.js';
import { TODAY, NOW, workDay, workDaysUntil, relDay, fmtTime, timePart, dt, parseDate } from './time.js';

const PRIORITY_POINTS = { Critical: 40, High: 30, Medium: 18, Low: 8 };

/**
 * Priority score (0–100) with an itemised explanation.
 * Bands: 70+ Do now · 50–69 Do next · 30–49 Plan · <30 Later.
 */
export function scoreTask(s, t) {
  const reasons = [];
  const add = (points, label) => {
    if (points) reasons.push({ points, label });
  };

  add(PRIORITY_POINTS[t.priority] ?? 18, `${t.priority} priority`);

  if (isOpen(t)) {
    const days = workDaysUntil(t.due);
    if (t.due < NOW) add(35, `Overdue since ${relDay(t.due).toLowerCase()} ${fmtTime(timePart(t.due))}`);
    else if (days === 0) add(timePart(t.due) <= '13:00' ? 32 : 28, `Due today at ${fmtTime(timePart(t.due))}`);
    else if (days === 1) add(20, 'Due tomorrow');
    else if (days <= 3) add(12, `Due in ${days} working days`);
    else if (days <= 5) add(6, 'Due this week');
  }

  if (isOpen(t) && t.effort >= 2 && t.due >= NOW && workDaysUntil(t.due) <= 2) add(6, `Needs ${t.effort}h of effort — start early`);
  if (t.safety) add(15, 'Safety-related — residents could be at risk');
  if (t.impact === 'high') add(8, 'High resident impact');

  const dependents = s.tasks.filter((x) => isOpen(x) && x.dependsOn.includes(t.id));
  if (dependents.length) add(Math.min(dependents.length * 6, 12), `Unblocks ${dependents.length} other task${dependents.length > 1 ? 's' : ''}`);

  if (t.status === 'in_progress') add(5, 'Already in progress');

  const blockers = t.dependsOn.map((id) => getTask(s, id)).filter((d) => d && isOpen(d));
  if (blockers.length) add(-10, `Waiting on “${blockers[0].title}”`);

  const score = Math.max(0, Math.min(100, reasons.reduce((n, r) => n + r.points, 0)));
  return { score, band: band(score), reasons };
}

export function band(score) {
  if (score >= 70) return { id: 'now', label: 'Do now' };
  if (score >= 50) return { id: 'next', label: 'Do next' };
  if (score >= 30) return { id: 'plan', label: 'Plan' };
  return { id: 'later', label: 'Later' };
}

/** Estimated vs actual effort by category from completed tasks. */
export function effortAccuracy(s) {
  const rows = {};
  s.tasks
    .filter((t) => t.status === 'done' && t.actual)
    .forEach((t) => {
      const r = (rows[t.category] ||= { category: t.category, est: 0, actual: 0, n: 0 });
      r.est += t.effort;
      r.actual += t.actual;
      r.n += 1;
    });
  return CATEGORIES.filter((c) => rows[c]).map((c) => ({ ...rows[c], ratio: rows[c].actual / rows[c].est }));
}

/** Duration estimate from category baselines, wording cues and team history. */
export function estimateEffort(s, { category, title = '' }) {
  const reasons = [];
  let hours = CATEGORY_BASE_EFFORT[category] ?? 1;
  reasons.push(`Typical ${category.toLowerCase()} task: ${hours}h`);

  const text = title.toLowerCase();
  if (/\b(all blocks|multiple|several|\d+\s*(cases|units|blocks|lifts))\b/.test(text)) {
    hours *= 1.5;
    reasons.push('Covers multiple locations or cases (×1.5)');
  } else if (/\b(quick|brief|short|call|phone)\b/.test(text)) {
    hours *= 0.6;
    reasons.push('Short interaction such as a call (×0.6)');
  }
  if (/\b(report|summary|compile|prepare|proposal)\b/.test(text)) {
    hours *= 1.25;
    reasons.push('Includes writing or report preparation (×1.25)');
  }

  const hist = effortAccuracy(s).find((r) => r.category === category);
  if (hist && hist.n >= 2 && Math.abs(hist.ratio - 1) >= 0.05) {
    hours *= hist.ratio;
    const pct = Math.round(Math.abs(hist.ratio - 1) * 100);
    reasons.push(`Recent ${category.toLowerCase()} tasks took ${pct}% ${hist.ratio > 1 ? 'longer' : 'less time'} than estimated (${hist.n} completed)`);
  }

  hours = Math.min(8, Math.max(0.25, Math.round(hours * 4) / 4));
  return { hours, reasons };
}

// ----- natural-language task input -----

const CATEGORY_KEYWORDS = [
  ['Maintenance', /\b(fault|breakdown|repair|leak|pump|burst|broken|replace|servic\w*|spalling)\b/g],
  ['Inspection', /\b(inspect\w*|check|audit|site visit|survey|verify)\b/g],
  ['Resident Feedback', /\b(resident|complain\w*|feedback|call back|follow[- ]up|petition|mediat\w*|appeal)\b/g],
  ['Contractor', /\b(contractor|vendor|invoice|quotation|tender|kpi)\b/g],
  ['Cleaning', /\b(clean\w*|litter|pest|refuse|drain|choke|bin)\b/g],
  ['Horticulture', /\b(tree|prun\w*|grass|plant\w*|landscap\w*)\b/g],
  ['Admin', /\b(report|update|prepare|log|summary|notice|minutes|memo)\b/g],
];

const SAFETY_RE = /\b(lift|trapped|fire|electric\w*|leak\w*|seepage|fallen|collapse|gas|spalling|playground|hazard)\b/i;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function nextWeekday(name) {
  const target = WEEKDAYS.indexOf(name);
  for (let i = 0; i < 10; i++) {
    const d = workDay(i);
    if (parseDate(d).getDay() === target) return d;
  }
  return null;
}

/**
 * Extract structured task fields from a sentence such as
 * "Urgent: inspect lift fault at Blk 208 tomorrow 3pm, about 2h".
 */
export function parseNaturalTask(s, input, defaultOwnerId) {
  const text = input.trim();
  const lower = text.toLowerCase();
  const found = [];
  let title = text;
  const strip = (re) => {
    title = title.replace(re, ' ');
  };

  // Priority
  let priority = 'Medium';
  let why = 'No urgency words found, so Medium is used';
  if (/\b(urgent|asap|immediately|emergency|critical)\b/.test(lower)) {
    priority = 'Critical';
    why = 'Urgency word detected';
  } else if (/\b(important|high priority)\b/.test(lower)) {
    priority = 'High';
    why = '“Important / high priority” detected';
  } else if (/\b(low priority|no rush|whenever)\b/.test(lower)) {
    priority = 'Low';
    why = '“Low priority / no rush” detected';
  }
  found.push({ field: 'Priority', value: priority, why });
  strip(/\b(urgent(ly)?|asap|immediately|emergency|critical|important|high priority|low priority|no rush|whenever)\b:?/gi);

  // Category
  const scores = CATEGORY_KEYWORDS.map(([cat, re]) => [cat, (lower.match(re) || []).length]);
  scores.sort((a, b) => b[1] - a[1]);
  const category = scores[0][1] > 0 ? scores[0][0] : 'Admin';
  found.push({ field: 'Category', value: category, why: scores[0][1] > 0 ? `Matched ${scores[0][1]} ${category.toLowerCase()} keyword${scores[0][1] > 1 ? 's' : ''}` : 'No category keywords — defaulted to Admin' });

  // Location
  const loc = text.match(/\b(?:blk|block)\s*(\d+[a-z]?)\b/i);
  const location = loc ? `Blk ${loc[1].toUpperCase()}` : '';
  if (location) found.push({ field: 'Location', value: location, why: 'Block number found' });

  // Owner (supervisors can assign by first name)
  let ownerId = defaultOwnerId;
  const ownerMatch = lower.match(/\b(?:for|assign(?:ed)? to)\s+([a-z]+)/);
  if (ownerMatch) {
    const o = s.officers.find((x) => x.name.toLowerCase().split(' ').includes(ownerMatch[1]));
    if (o) {
      ownerId = o.id;
      found.push({ field: 'Owner', value: o.name, why: `“${ownerMatch[0]}” matched an officer` });
      strip(new RegExp(`\\b(for|assign(ed)? to)\\s+${ownerMatch[1]}\\b`, 'gi'));
    }
  }

  // Deadline date
  let date = null;
  let dateWhy = '';
  if (/\b(today|tonight|eod|end of (the )?day)\b/.test(lower)) {
    date = TODAY;
    dateWhy = '“Today” detected';
  } else if (/\btomorrow\b/.test(lower)) {
    date = workDay(1);
    dateWhy = '“Tomorrow” detected';
  } else if (/\bnext week\b/.test(lower)) {
    date = workDay(5);
    dateWhy = '“Next week” detected';
  } else {
    const inDays = lower.match(/\bin (\d+) (working )?days?\b/);
    const wd = WEEKDAYS.find((w) => new RegExp(`\\b${w}\\b`).test(lower));
    if (inDays) {
      date = workDay(Number(inDays[1]));
      dateWhy = `“${inDays[0]}” detected`;
    } else if (wd) {
      date = nextWeekday(wd);
      dateWhy = `Next ${wd[0].toUpperCase() + wd.slice(1)}`;
    }
  }
  strip(/\b(by |before |on |due )?(today|tonight|tomorrow|next week|eod|end of (the )?day|in \d+ (working )?days?|monday|tuesday|wednesday|thursday|friday)\b/gi);

  // Deadline time
  let time = null;
  const ampm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const h24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === 'pm') h += 12;
    time = `${String(h).padStart(2, '0')}:${ampm[2] || '00'}`;
  } else if (h24) {
    time = `${h24[1].padStart(2, '0')}:${h24[2]}`;
  } else if (/\b(noon|morning)\b/.test(lower)) {
    time = '12:00';
  }
  strip(/\b(at |by )?(\d{1,2}(:\d{2})?\s*(am|pm)|([01]?\d|2[0-3]):[0-5]\d|noon|this morning|morning|this afternoon|afternoon)\b/gi);

  if (!date) {
    date = priority === 'Critical' ? TODAY : workDay(2);
    dateWhy = priority === 'Critical' ? 'No date found — urgent tasks default to today' : 'No date found — defaulted to 2 working days';
  }
  if (!time) time = '17:00';
  found.push({ field: 'Deadline', value: `${relDay(date)}, ${fmtTime(time)}`, why: dateWhy });

  // Effort
  let effort = null;
  let effortReasons = [];
  const hrs = lower.match(/\b(?:about |around |~)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?)\b/);
  const mins = lower.match(/\b(?:about |around |~)?(\d+)\s*(m|min|mins|minutes)\b/);
  if (hrs) {
    effort = Number(hrs[1]);
    effortReasons = ['Duration stated in the request'];
  } else if (mins) {
    effort = Math.max(0.25, Math.round((Number(mins[1]) / 60) * 4) / 4);
    effortReasons = ['Duration stated in the request'];
  }
  strip(/,?\s*\b(?:about |around |~|takes? )?\d+(?:\.\d+)?\s*(h|hr|hrs|hours?|m|min|mins|minutes)\b/gi);

  // Clean up the title
  title = title
    .replace(/^\s*(please|pls|remind me to|i need to|need to|todo:?|task:?)\s+/i, '')
    .replace(/\s+(at|by|on|due|before|for)\s*([,.;:]|$)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '')
    .trim();
  if (!title) title = text;
  title = title[0].toUpperCase() + title.slice(1);

  if (effort == null) {
    const est = estimateEffort(s, { category, title });
    effort = est.hours;
    effortReasons = est.reasons;
  }
  found.push({ field: 'Effort', value: `${effort}h`, why: effortReasons.join('; ') });

  const safety = SAFETY_RE.test(lower);
  if (safety) found.push({ field: 'Safety', value: 'Yes', why: 'Safety keyword detected' });

  return {
    task: { title, category, priority, due: dt(date, time), effort, location, ownerId, safety, impact: safety ? 'high' : 'medium' },
    found,
  };
}

/** Short natural-language summary of why a task is ranked where it is. */
export function explainScore(s, t) {
  const { reasons } = scoreTask(s, t);
  const top = reasons
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((r) => r.label.charAt(0).toLowerCase() + r.label.slice(1));
  return top.length ? `Ranked here because it is ${top.join(', ')}.` : 'No strong urgency signals.';
}

export function ownerLabel(s, id) {
  return getOfficer(s, id) ? officerName(s, id) : 'Unassigned';
}

// ----- natural-language work planner -----

const STOP_WORDS = new Set(['the', 'my', 'all', 'any', 'tasks', 'task', 'work', 'jobs', 'job', 'first', 'please', 'a', 'an', 'on', 'for']);

/**
 * Understand requests such as "Plan my Thursday, prioritise lift inspections".
 * Returns the target day and the task terms to prioritise, or null when the
 * text is not a planning request.
 */
export function parseDayPlanRequest(input) {
  const lower = input.toLowerCase().trim();
  if (!/\b(plan|schedule|organi[sz]e)\b/.test(lower)) return null;

  let date = null;
  if (/\btoday\b/.test(lower)) date = TODAY;
  else if (/\btomorrow\b/.test(lower)) date = workDay(1);
  else {
    const wd = WEEKDAYS.find((w) => new RegExp(`\\b${w}\\b`).test(lower));
    if (wd) date = nextWeekday(wd);
  }
  const dateWhy = date ? 'Day named in the request' : 'No day named, so today is used';
  if (!date) date = TODAY;

  const terms = [];
  const m = lower.match(/\b(?:prioriti[sz]e|focus on|start with|do)\s+(.+?)(?:[.;!?]|$)/);
  if (m) {
    for (const phrase of m[1].split(/,|\band\b|\bthen\b/)) {
      const words = phrase
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ''))
        .filter((w) => w && !STOP_WORDS.has(w))
        .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
      if (words.length) terms.push(words);
    }
  }
  return { date, dateWhy, terms, phrase: m ? m[1].trim() : '' };
}

// ----- meeting minutes to tasks -----

const ACTION_PREFIX = /^(action(\s+items?)?|ai|todo|to do|follow[- ]?up)\s*[:\-–]\s*/i;
const ACTION_VERBS = /\b(to|will|shall|must)\s+(inspect|check|follow|prepare|submit|update|review|arrange|call|verify|send|investigate|coordinate|repair|replace|engage|monitor|clean|trim|prune|issue|draft|compile|contact|schedule|put up)\b/i;

/**
 * Extract action items from meeting minutes. Each item is converted into a
 * structured task with an owner (officer named in the line) and the reasons
 * behind every extracted field.
 */
export function extractActionItems(s, text, defaultOwnerId) {
  const items = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^([-*•]|\d+[.)]|\[\s?\])\s*/, '');
    if (line.length < 10) continue;
    const prefixed = ACTION_PREFIX.test(line);
    if (!prefixed && !ACTION_VERBS.test(line)) continue;

    let body = line.replace(ACTION_PREFIX, '');
    const owner = s.officers.find((o) => new RegExp(`\\b${o.name.split(' ')[0]}\\b`, 'i').test(body));
    if (owner) {
      const first = owner.name.split(' ')[0];
      body = body
        .replace(new RegExp(`^${first}(\\s+[A-Z][a-z]+)?\\s+(to|will|shall|must)\\s+`, 'i'), '')
        .replace(new RegExp(`\\s*[(\\[–-]\\s*(owner|by|action by)?:?\\s*${first}[^)\\]]*[)\\]]?`, 'i'), '');
    }
    const parsed = parseNaturalTask(s, body, owner?.id || defaultOwnerId);
    parsed.task.ownerId = owner?.id || null;
    parsed.found.unshift({ field: 'Owner', value: owner ? owner.name : 'Not named', why: owner ? `“${owner.name.split(' ')[0]}” mentioned in the action` : 'No officer named — assign before importing' });
    items.push({ id: `ai${items.length + 1}`, source: line, task: parsed.task, found: parsed.found, why: prefixed ? 'Marked as an action item' : 'Contains an assignment such as “… to inspect”' });
  }
  return items;
}

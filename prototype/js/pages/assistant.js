// Ask SyncAI Page — Deterministic Simulated AI Assistant (matches full-stack AssistantChat)
import { html, raw, icon } from '../ui.js';
import {
  getState,
  getCurrentUser,
  isManager,
  isAdmin,
  isTeamMember,
  visibleTasks,
  getPendingApprovals,
  getTask,
} from '../state.js';
import { scoreTask } from '../ai.js';
import { assessRisk, dayCapacity, buildSchedule } from '../planner.js';
import { evaluateAlternatives } from '../ripple.js';
import { TODAY, fmtDue } from '../time.js';

let conversation = [];
let isTyping = false;
let nextMsgId = 1;

export default {
  render(s) {
    const user = getCurrentUser(s);
    const firstName = user.displayName.split(' ')[0];

    const SUGGESTIONS = [
      { id: 'first', title: 'What should I work on first?' },
      { id: 'capacity', title: 'Can I finish everything today?' },
      { id: 'sla', title: 'Which tasks are close to their SLA?' },
      { id: 'loose_ends', title: 'Why was Case DEMO-001 flagged by SyncAI?' },
      { id: 'lift', title: 'What happens if an urgent lift incident occurs?' },
      { id: 'mc', title: 'What happens if an officer is on MC?' },
      { id: 'delay', title: 'Which tasks are affected by this delay?' },
      { id: 'alternative', title: 'Which alternative is most feasible?' },
      { id: 'approvals', title: 'What approvals are pending?' },
    ];

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('sparkle', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Interactive Operations Assistant</p>
          <h1>Ask SyncAI <span class="hero-badge">Simulated AI</span></h1>
          <p>
            Get instant explainable answers about priority rankings, capacity bottlenecks, and disruption ripple effects based on your authorized demo data.
          </p>
        </div>
        <div class="page-hero-aside">
          ${conversation.length > 0
            ? html`
                <button type="button" class="hero-button" data-action="assistant-clear">
                  ${icon('reset', 14)} Clear chat
                </button>
              `
            : ''}
        </div>
      </header>

      <section class="panel assistant-panel" aria-label="Ask SyncAI chat interface">
        <ol class="assistant-messages" id="assistant-messages-list">
          ${conversation.length === 0 && !isTyping
            ? html`
                <li class="assistant-welcome">
                  <span class="assistant-welcome-icon" aria-hidden="true">${icon('sparkle', 32)}</span>
                  <h2>Hello, ${firstName}. How can I assist your operations today?</h2>
                  <p class="muted">
                    Ask me about your task priorities, schedule feasibility, or explore simulated disruption scenarios.
                  </p>
                  <div class="suggestion-cards" role="group" aria-label="Suggested questions">
                    ${SUGGESTIONS.map(
                      (q) => html`
                        <button
                          type="button"
                          class="suggestion-card"
                          data-action="assistant-ask-preset"
                          data-q="${q.title}"
                        >
                          <span class="suggestion-icon" aria-hidden="true">${icon('sparkle', 20)}</span>
                          <span>${q.title}</span>
                        </button>
                      `,
                    )}
                  </div>
                </li>
              `
            : html`
                <li class="msg bot">
                  <span class="msg-avatar" aria-hidden="true">${icon('sparkle', 16)}</span>
                  <div class="msg-bubble">
                    Hello, ${firstName}. I am ready to answer your questions regarding priorities, schedules and ripple effects.
                  </div>
                </li>
              `}

          ${conversation.map(
            (m) => html`
              <li class="msg ${m.from}">
                <span class="msg-avatar" aria-hidden="true">
                  ${m.from === 'bot' ? icon('sparkle', 16) : firstName.slice(0, 2).toUpperCase()}
                </span>
                <div class="msg-bubble">
                  ${m.text}
                </div>
              </li>
            `,
          )}

          ${isTyping
            ? html`
                <li class="msg bot">
                  <span class="msg-avatar" aria-hidden="true">${icon('sparkle', 16)}</span>
                  <div class="msg-bubble typing" aria-label="SyncAI is typing">
                    <span></span><span></span><span></span>
                  </div>
                </li>
              `
            : ''}
        </ol>

        <!-- Suggested Chips -->
        ${conversation.length > 0 || isTyping
          ? html`
              <div class="assistant-suggestions" role="group" aria-label="Follow-up suggestions">
                <span class="muted small">Suggested:</span>
                <div class="chips">
                  ${SUGGESTIONS.slice(0, 4).map(
                    (q) => html`
                      <button
                        type="button"
                        class="chip"
                        data-action="assistant-ask-preset"
                        data-q="${q.title}"
                        ${isTyping ? 'disabled' : ''}
                      >
                        ${q.title}
                      </button>
                    `,
                  )}
                </div>
              </div>
            `
          : ''}

        <!-- Chat Input Form -->
        <form class="assistant-input" data-action="assistant-submit">
          <textarea
            id="assistant-input-box"
            placeholder="Ask about priorities, capacity, SLAs, or disruption ripple effects..."
            aria-label="Ask SyncAI question"
            rows="1"
          ></textarea>
          <button type="submit" class="btn-primary" ${isTyping ? 'disabled' : ''}>
            ${icon('send', 16)} Send
          </button>
        </form>

        <p class="assistant-foot">
          ${icon('shield', 14)} Simulated AI — deterministic demo responses based on authorized Town Council records.
        </p>
      </section>
    `;
  },

  ask(s, questionText, onUpdate) {
    const q = questionText.trim();
    if (!q || isTyping) return;

    conversation.push({ id: nextMsgId++, from: 'user', text: q });
    isTyping = true;
    onUpdate();

    setTimeout(() => {
      const answer = generateLocalAnswer(s, q);
      conversation.push({ id: nextMsgId++, from: 'bot', text: answer });
      isTyping = false;
      onUpdate();

      // Scroll to bottom if in browser
      if (typeof document !== 'undefined') {
        const list = document.getElementById('assistant-messages-list');
        if (list) list.scrollTop = list.scrollHeight;
      }
    }, 450);
  },

  clear() {
    conversation = [];
  },
};

function generateLocalAnswer(s, query) {
  const q = query.toLowerCase();
  const user = getCurrentUser(s);
  const mgr = isManager(s);
  const adm = isAdmin(s);

  // Role privacy guardrail
  if (
    !mgr &&
    !adm &&
    (q.includes('other officer') ||
      q.includes("marcus's calendar") ||
      q.includes("priya's calendar") ||
      q.includes('admin settings') ||
      q.includes('all officers private'))
  ) {
    return 'Privacy Notice: As a Team Member, you are only authorised to view your own assigned work orders and schedule. Other officers’ personal calendars and administrator controls are restricted under Singapore PDPA policy.';
  }

  // Case loose ends & explanation question (#117)
  if (q.includes('demo-001') || q.includes('flagged') || q.includes('loose end') || q.includes('seepage')) {
    return `SyncAI flagged Case DEMO-001 (Ceiling seepage at Blk 211) due to two deterministic rule triggers:\n\n1. Rule EMS-LE-01 (Resident Follow-up Commitment): A moisture assessment was completed (reading: 78%), but no follow-up callback was recorded within the 24-hour SLA window.\n2. Rule EMS-LE-02 (Contractor Confirmation): Term contractor Eng Seng Plumbing has an active blocker pending upper unit access confirmation.\n\nResponsible AI Note: This is a deterministic rule-based finding — human review required. Click "Case Action Centre" in the sidebar to review the Evidence-Linked Explanation and log a follow-up.`;
  }

  // 1. What should I work on first?
  if (q.includes('first') || q.includes('start with') || q.includes('top priority')) {
    const tasks = visibleTasks(s).filter((t) => isOpen(t));
    if (tasks.length === 0) return 'All active work orders are completed for today!';
    const ranked = tasks.map((t) => ({ t, score: scoreTask(s, t).score })).sort((a, b) => b.score - a.score);
    const top = ranked[0].t;
    const score = ranked[0].score;
    return `You should work on "${top.title}" first (SyncAI Score: ${score}/100).\n\nReason: This task involves a genuine ${top.safety ? 'Safety Hazard' : 'Statutory Deadline'} (${top.location || 'Site'}) due at ${top.due.slice(11, 16)}. Completing this protects resident well-being and avoids regulatory escalation.`;
  }

  // 2. Can I finish everything today?
  if (q.includes('finish') || q.includes('capacity') || q.includes('fit') || q.includes('enough time')) {
    const cap = dayCapacity(s, s.currentOfficerId || 'o1', TODAY);
    const sched = buildSchedule(s, s.currentOfficerId || 'o1', TODAY);
    if (sched.totalEffort <= cap.freeHours) {
      return `Yes, today’s plan fits into your available working hours.\n\nYou have ${sched.totalEffort.toFixed(1)} hours of scheduled work orders against ${cap.freeHours.toFixed(1)} hours of available capacity, with protected lunch break (12:30–13:30) and Outlook meeting buffers accounted for.`;
    }
    return `Warning: Today's workload exceeds available capacity by ${(sched.totalEffort - cap.freeHours).toFixed(1)} hours. SyncAI recommends using the What-If Simulator on the My Plan page to reschedule routine tasks or request a reassignment.`;
  }

  // 3. Which tasks are close to their SLA?
  if (q.includes('sla') || q.includes('deadline') || q.includes('close to')) {
    const tasks = visibleTasks(s).filter((t) => isOpen(t));
    const tight = tasks.filter((t) => assessRisk(s, t).level === 'high' || t.safety || t.statutory);
    if (tight.length === 0) return 'All assigned tasks currently have safe SLA buffers.';
    const lines = tight
      .slice(0, 3)
      .map(
        (t) =>
          `• ${t.title}: Due at ${t.due.slice(11, 16)} (${t.slaType || 'Standard SLA'})`,
      )
      .join('\n');
    return `The following work orders are closest to their SLA thresholds:\n\n${lines}\n\nSyncAI recommends addressing these before starting flexible admin work.`;
  }

  // 4. What happens if an urgent lift incident occurs?
  if (q.includes('lift') || q.includes('urgent lift') || q.includes('entrapment')) {
    return `If an urgent passenger lift entrapment occurs at Blk 214 (fictional disruption):\n\n1. Genuine resident safety and statutory inspections remain locked in place.\n2. Lower-impact administrative tasks (such as the CleanPro monthly report review) are deferred to tomorrow morning.\n3. The fixed resident ceiling seepage appointment at Blk 211 is transferred to Priya Nair to protect the 16:00 resident commitment.\n\nOpen My Plan to inspect this scenario in the 3-Alternative Simulator.`;
  }

  // 5. What happens if an officer is on MC?
  if (q.includes('mc') || q.includes('medical leave') || q.includes('sick')) {
    return `When an officer is on medical leave (e.g. Ravi Kumar in Zone C):\n\n1. SyncAI marks the officer unavailable without exposing private medical records.\n2. Open safety and statutory tasks are immediately flagged for supervisor review.\n3. The What-If Simulator identifies qualified officers in adjacent zones with spare capacity (such as Chua Hui Min) to rebalance the load.`;
  }

  // 6. Which tasks are affected by this delay?
  if (q.includes('affect') || q.includes('delay') || q.includes('ripple') || q.includes('chain')) {
    return `Delays in upstream work trigger downstream ripple effects:\n\nFor example, delaying "Site check: ceiling seepage at Blk 211" (t103) cascades to:\n• Task t104 (Resident follow-up call) could miss its fictional follow-up deadline.\n• Task t112 (Contractor rectification work-order) delayed, allowing progressive water ingress and reinforcement rebar corrosion.\n\nSyncAI traces multi-level dependencies to safeguard resident commitments.`;
  }

  // 7. Which alternative is most feasible?
  if (q.includes('alternative') || q.includes('feasible') || q.includes('simulator')) {
    return `In the illustrative What-If comparison:\n\n• Alternative A (No Action): May miss recorded deadlines and a fixed resident appointment.\n• Alternative B (Reschedule Lower-Impact Work): Highly feasible for single-officer capacity shortages; defers routine admin by 1 day.\n• Alternative C (Reassign Eligible Work): Best when fixed resident commitments clash with emergency safety calls; transfers eligible work to an officer with matching skills.`;
  }

  // 8. What approvals are pending?
  if (q.includes('approval') || q.includes('pending') || q.includes('queue')) {
    const pending = getPendingApprovals(s);
    if (pending.length === 0) return 'There are no schedule adjustments or reassignments pending approval right now.';
    const list = pending
      .map(
        (a) =>
          `• ${a.taskTitle}: Requested by ${a.requesterName} (${a.requestType.replace('_', ' ')}). Reason: ${a.reason}`,
      )
      .join('\n');
    return `Pending Approval Requests:\n\n${list}\n\n${mgr ? 'As a Manager, you can approve or decline these in My Team.' : 'Your request is currently awaiting review by Estate Manager Jennifer Ong.'}`;
  }

  // Fallback
  return `I can help with that. SyncAI schedules work according to four operational factors:\n1. Safety risks\n2. Mandatory statutory deadlines\n3. Service impact & long-term consequences\n4. Scheduling feasibility around Outlook meetings.\n\nYou can also click the quick suggestions above to inspect priorities, capacity, and disruption simulations.`;
}

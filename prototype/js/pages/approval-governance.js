import { html, icon } from '../ui.js';
import { getApprovals, getOperationalChangeVersions } from '../state.js';

export const approvalGovernanceView = { typeFilter: 'all', statusFilter: 'all' };

export const MANAGER_REVIEW_TYPES = [
  { key: 'operational_change', label: 'Operational Change', requestTypes: ['operational_change'] },
  { key: 'schedule_adjustment', label: 'Schedule Adjustment', requestTypes: ['schedule_adjustment'] },
  { key: 'case_reassignment', label: 'Case Reassignment', requestTypes: ['reassign', 'reassignment'] },
  { key: 'case_closure', label: 'Case Closure', requestTypes: ['case_closure', 'closure'] },
];

export function managerReviewType(approval) {
  return MANAGER_REVIEW_TYPES.find((type) => type.requestTypes.includes(approval?.requestType)) || null;
}

export function isManagerReviewApproval(approval) {
  return !!managerReviewType(approval);
}

const AUDIT_ACTION_LABELS = {
  SUBMITTED: 'Request submitted',
  DISPATCHED: 'Notification dispatched',
  APPROVED: 'Request approved',
  REJECTED: 'Request rejected',
  ESCALATED: 'Request escalated',
  INFORMATION_REQUESTED: 'Manager requested additional information',
  INFORMATION_PROVIDED: 'Requester submitted additional information',
};

function auditEventLabel(action) {
  if (!action) return 'Recorded event';
  return AUDIT_ACTION_LABELS[action]
    || action.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatAuditTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
}

export function renderApprovalHistory(approval) {
  const events = (Array.isArray(approval?.auditTrail) ? approval.auditTrail : [])
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftTime = left.event?.at ? Date.parse(left.event.at) : Number.NaN;
      const rightTime = right.event?.at ? Date.parse(right.event.at) : Number.NaN;
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime || left.index - right.index;
      if (Number.isFinite(leftTime)) return -1;
      if (Number.isFinite(rightTime)) return 1;
      return left.index - right.index;
    });

  return html`
    <section class="panel" aria-labelledby="approval-request-history-title">
      <h3 id="approval-request-history-title">Request History</h3>
      ${events.length ? html`<ol class="approval-history">
        ${events.map(({ event }) => html`<li>
          <strong>${auditEventLabel(event?.action)}</strong>
          ${event?.actor ? html`<div class="small">Actor: ${event.actor}</div>` : ''}
          ${event?.at ? html`<div class="small">${formatAuditTimestamp(event.at)}</div>` : ''}
          ${event?.details ? html`<p class="small">${event.details}</p>` : ''}
        </li>`)}
      </ol>` : html`<p class="small muted">No history available yet.</p>`}
    </section>
  `;
}

const OPERATIONAL_VERSION_FIELDS = [
  ['unexpectedSituation', 'Unexpected situation'],
  ['reason', 'Reason'],
  ['proposedChanges', 'Proposed changes'],
  ['requestedScope', 'Requested approval scope'],
  ['potentialCostImpact', 'Potential cost impact'],
  ['potentialScheduleImpact', 'Potential schedule impact'],
  ['potentialOperationalImpact', 'Potential operational impact'],
  ['supportingEvidence', 'Supporting evidence'],
];

function versionHasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function versionValueText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => [item.title, item.fileName, item.reference].filter(Boolean).join(' - ') || 'Evidence reference').join('; ');
  }
  return String(value ?? '');
}

function summarizeVersion(version) {
  const request = version.request || {};
  const included = OPERATIONAL_VERSION_FIELDS
    .filter(([key]) => versionHasValue(request[key]))
    .map(([, label]) => label);
  if (versionHasValue(version.supplementaryResponse)) included.push('Additional information response');
  return included.length ? included.join(', ') : 'No request details recorded.';
}

export function renderOperationalChangeVersionHistory(approval) {
  if (approval?.requestType !== 'operational_change') return '';
  const versions = getOperationalChangeVersions(approval);
  if (!versions.length) return '';
  const latestVersionNumber = versions[versions.length - 1].version;
  return html`
    <section class="panel" aria-labelledby="operational-change-version-history-title">
      <h3 id="operational-change-version-history-title">Version History</h3>
      ${versions.map((version) => html`
        <details class="approval-version">
          <summary>Version ${version.version}${version.version === 1 ? ' - Original submission' : ''}${version.version === latestVersionNumber ? ' - Current submission' : ''}</summary>
          <p class="small"><strong>Submitted:</strong> ${formatSubmittedAt(version.submittedAt)}</p>
          <p class="small"><strong>Submitted by:</strong> ${version.submittedByName || version.submittedById || 'Not recorded'}</p>
          <p class="small"><strong>Included information:</strong> ${summarizeVersion(version)}</p>
          ${version.clarificationQuestion ? html`<p><strong>Manager's clarification:</strong> ${version.clarificationQuestion}</p>` : ''}
          ${version.supplementaryResponse ? html`<p><strong>Supplementary response:</strong> ${version.supplementaryResponse}</p>` : ''}
          <dl class="task-details-extra-list">
            ${OPERATIONAL_VERSION_FIELDS.map(([key, label]) => {
              const value = version.request?.[key];
              if (!versionHasValue(value)) return '';
              return html`<div><dt>${label}</dt><dd>${versionValueText(value)}</dd></div>`;
            })}
          </dl>
        </details>
      `)}
    </section>
  `;
}

export function renderOperationalChangeVersionComparison(approval) {
  if (approval?.requestType !== 'operational_change') return '';
  const versions = getOperationalChangeVersions(approval);
  if (versions.length < 2) {
    return html`<section class="panel" aria-labelledby="operational-change-version-comparison-title"><h3 id="operational-change-version-comparison-title">Version Comparison</h3><p class="small muted">No resubmitted version is available to compare yet.</p></section>`;
  }

  const original = versions[0];
  const latest = versions[versions.length - 1];
  const originalFields = { ...original.request, supplementaryResponse: original.supplementaryResponse || '' };
  const latestFields = { ...latest.request, supplementaryResponse: latest.supplementaryResponse || '' };
  const fields = [...OPERATIONAL_VERSION_FIELDS, ['supplementaryResponse', 'Additional information response']];
  const groups = { added: [], changed: [], unchanged: [] };
  for (const [key, label] of fields) {
    const before = originalFields[key];
    const after = latestFields[key];
    // A missing latest value is unavailable data, not evidence of a change.
    if (!versionHasValue(after)) continue;
    if (!versionHasValue(before)) {
      groups.added.push({ label, after });
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      groups.changed.push({ label, before, after });
    } else {
      groups.unchanged.push({ label, after });
    }
  }

  const renderGroup = (title, entries, kind) => html`
    <section aria-label="${title}">
      <h4>${title}</h4>
      ${entries.length ? html`<ul>${entries.map((entry) => html`<li><strong>${entry.label}:</strong> ${kind === 'changed'
        ? html`Version 1: ${versionValueText(entry.before)}; Latest: ${versionValueText(entry.after)}`
        : versionValueText(entry.after)}</li>`)}</ul>` : html`<p class="small muted">No ${title.toLowerCase()}.</p>`}
    </section>
  `;

  return html`
    <section class="panel" aria-labelledby="operational-change-version-comparison-title">
      <h3 id="operational-change-version-comparison-title">Version Comparison</h3>
      <p class="small muted">Version 1 compared with Version ${latest.version} (current submission).</p>
      ${renderGroup('Newly added information', groups.added, 'added')}
      ${renderGroup('Changed information', groups.changed, 'changed')}
      ${renderGroup('Unchanged information', groups.unchanged, 'unchanged')}
    </section>
  `;
}

const textValue = (value) => String(value ?? '').trim();
const hasText = (value) => textValue(value).length > 0;

function evidenceReferenceText(evidence) {
  if (!Array.isArray(evidence)) return '';
  return evidence.map((item) => [item?.title, item?.fileName, item?.reference].filter(Boolean).join(' ')).join(' ');
}

/** Deterministic, local demonstration logic. This does not make or record a decision. */
export function generateSimulatedApprovalAssessment(approval, task = null) {
  if (approval?.requestType !== 'operational_change') return null;

  const summary = [];
  const taskLabel = task
    ? `${task.title || approval.taskTitle || 'Untitled task'} (${task.id || approval.taskId || 'task ID unavailable'})`
    : approval.taskId
      ? `${approval.taskTitle || 'Task'} (${approval.taskId})`
      : 'No linked task is recorded';
  const caseLabel = approval.caseId ? `, linked to case ${approval.caseId}` : '';
  summary.push(`This request concerns ${taskLabel}${caseLabel}.`);
  summary.push(hasText(approval.proposedChanges)
    ? `Proposed change: ${textValue(approval.proposedChanges)}`
    : 'The proposed change is not recorded.');
  if (hasText(approval.unexpectedSituation)) summary.push(`Unexpected situation: ${textValue(approval.unexpectedSituation)}`);
  summary.push(hasText(approval.reason)
    ? `Requester’s reason: ${textValue(approval.reason)}`
    : 'The requester’s reason is not recorded.');

  const risks = [];
  const missing = [];
  const actions = [];
  const requestText = [approval.unexpectedSituation, approval.reason, approval.proposedChanges, approval.requestedScope].map(textValue).join(' ');
  const evidenceText = evidenceReferenceText(approval.supportingEvidence);
  const hasEvidence = Array.isArray(approval.supportingEvidence) && approval.supportingEvidence.length > 0;
  const costImpact = textValue(approval.potentialCostImpact);
  const scheduleImpact = textValue(approval.potentialScheduleImpact);
  const operationalImpact = textValue(approval.potentialOperationalImpact);
  const financialContext = /cost|quotation|quote|expenditure|budget|price|contractor|invoice|repair/i.test(requestText);
  const technicalContext = /repair|replace|installation|pipe|electrical|structural|technical|equipment/i.test(requestText);
  const safetyContext = /safety|hazard|danger|injur|electrical|gas leak|structural|fire|lift|trapped/i.test(`${requestText} ${task?.category || ''} ${task?.priority || ''}`);
  const scopeContext = /additional|extra|extend|expanded|expand|new contractor|change contractor|replace|scope|resource/i.test(`${textValue(approval.proposedChanges)} ${textValue(approval.requestedScope)}`);
  const uncertaintyPattern = /pending|unknown|uncertain|estimate|not yet|tbc|tbd|subject to/i;

  if (financialContext || costImpact) {
    if (costImpact) {
      risks.push(`Potential financial exposure is reported as “${costImpact}”; the amount and supporting basis have not been verified.`);
    } else {
      risks.push('The request text refers to cost-related matters, but no potential cost impact is recorded.');
      missing.push('A potential cost estimate or an explicit statement that there is no additional cost is not recorded.');
    }
    if (uncertaintyPattern.test(costImpact)) {
      missing.push('The recorded cost impact is uncertain; a quotation or cost justification may be relevant before deciding.');
    }
    if (!/quotation|quote|estimate|cost|invoice|price/i.test(evidenceText) && financialContext) {
      missing.push(hasEvidence
        ? 'The evidence references do not identify a quotation or cost document; confirm whether one is relevant.'
        : 'No quotation or cost document is referenced; confirm whether one is relevant to this request.');
    }
    actions.push('If additional expenditure is proposed, review the cost basis and confirm available budget before deciding.');
  }

  if (scheduleImpact) {
    risks.push(`The requester reports this potential schedule impact: “${scheduleImpact}”; the operational effect is not independently verified.`);
    actions.push('Check the stated schedule impact against service commitments and other affected work.');
  }
  if (operationalImpact) {
    risks.push(`The requester reports this potential operational or service impact: “${operationalImpact}”; assess its practical effect before deciding.`);
  }
  if (scopeContext) {
    risks.push('The described change may affect work scope or resource needs; the extent depends on the proposed arrangement and requested limits.');
    actions.push('Compare the requested scope with the proposed work and make any approval limits explicit.');
  }
  if (safetyContext) {
    risks.push('The request or linked task contains safety-related terms; this indicates a potential concern to review, not a verified hazard.');
    actions.push('Where relevant to the described work, review the appropriate safety or technical information before deciding.');
  } else {
    risks.push('No specific safety concern is identified in the submitted text; this does not establish that the work is safe.');
  }

  if (technicalContext && !/technical|inspection|photo|photograph|report|diagram|assessment/i.test(evidenceText)) {
    missing.push(hasEvidence
      ? 'The listed evidence references do not identify technical or inspection material; confirm whether such information is relevant.'
      : 'No technical or inspection evidence is referenced; confirm whether it is relevant to the described work.');
    actions.push('If the proposed work depends on a technical finding, request or review the supporting technical material.');
  }
  if (!scheduleImpact && /schedule|delay|day|time|urgent|resident|access/i.test(requestText)) {
    missing.push('A potential schedule impact is not recorded despite schedule or access-related wording in the request.');
    actions.push('Clarify any timing or access effects if they could affect residents or service delivery.');
  }
  if (!operationalImpact && /resident|access|service|contractor|operational|disruption/i.test(requestText)) {
    missing.push('A potential operational or service impact is not recorded although the request mentions operationally relevant matters.');
  }

  if (hasEvidence) {
    risks.push(`The requester supplied ${approval.supportingEvidence.length} evidence reference(s). References and metadata are available; file contents have not been inspected or verified.`);
    actions.push('Open or verify any referenced evidence through the available source; the prototype only records references and metadata.');
  } else if (technicalContext) {
    actions.push('Consider whether supporting photographs, a quotation, or technical documentation would help assess the described work.');
  }
  if (missing.length === 0) missing.push('No clearly relevant missing information was identified by these simple rules. This does not confirm that the submission is complete.');
  if (actions.length === 0) actions.push('Review the requested scope against the submitted justification and applicable internal requirements.');

  return {
    requestSummary: summary,
    riskIdentification: risks,
    missingInformation: missing,
    suggestedNextActions: actions,
    disclaimer: 'Simulated rule-based assessment for prototype demonstration only. No external AI service or investigation was used. This is decision support, not a decision.',
  };
}

export function renderSimulatedApprovalAssessment(assessment) {
  if (!assessment) return '';
  const sections = [
    ['Request Summary', assessment.requestSummary],
    ['Risk Identification', assessment.riskIdentification],
    ['Missing Information', assessment.missingInformation],
    ['Suggested Next Actions', assessment.suggestedNextActions],
  ];
  return html`
    <section class="panel" aria-labelledby="simulated-approval-assessment-title">
      <h3 id="simulated-approval-assessment-title">AI Approval Assessment</h3>
      <p class="small muted">${assessment.disclaimer}</p>
      <div class="approval-assessment-grid">
        ${sections.map(([title, items]) => html`<section class="approval-assessment-section"><h4>${title}</h4><ul>${items.map((item) => html`<li>${item}</li>`)}</ul></section>`)}
      </div>
    </section>
  `;
}

function formatSubmittedAt(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
}

function renderRequest(approval) {
  const type = managerReviewType(approval);
  const related = [
    approval.taskId ? `Task ${approval.taskId}${approval.taskTitle ? ` · ${approval.taskTitle}` : ''}` : '',
    approval.caseId ? `Case ${approval.caseId}` : '',
  ].filter(Boolean).join(' · ') || 'No task or case reference recorded';
  return html`
    <li style="align-items: flex-start;">
      <div class="queue-who" style="min-width: 0;">
        <strong>${approval.taskTitle || approval.id}</strong>
        <span class="small">Request ID: ${approval.id}</span>
        <span class="small">Request type: <strong>${type.label}</strong></span>
        <span class="small">Requester: ${approval.requesterName || 'Not recorded'}</span>
        <span class="small">${related}</span>
        <span class="small">Submitted: ${formatSubmittedAt(approval.createdAt)}</span>
      </div>
      <div class="queue-actions">
        <span class="tag ${approval.status === 'approved' ? 'tag-success' : approval.status === 'rejected' ? 'tag-danger' : 'tag-warning'}">${approval.status ? approval.status[0].toUpperCase() + approval.status.slice(1) : 'Unknown'}</span>
        <button type="button" class="btn-secondary btn-sm" data-action="manager-governance-review" data-id="${approval.id}">View Details</button>
        <button type="button" class="btn-ghost btn-sm" data-action="manager-governance-audit" data-id="${approval.id}">View Audit</button>
      </div>
    </li>
  `;
}

export default {
  render(s) {
    const managerRequests = getApprovals(s).filter(isManagerReviewApproval);
    const scopedRequests = approvalGovernanceView.typeFilter === 'all'
      ? managerRequests
      : managerRequests.filter((approval) => managerReviewType(approval)?.key === approvalGovernanceView.typeFilter);
    const displayedRequests = approvalGovernanceView.statusFilter === 'all'
      ? scopedRequests
      : scopedRequests.filter((approval) => approval.status === approvalGovernanceView.statusFilter);
    const pending = displayedRequests.filter((approval) => approval.status === 'pending');
    const approved = displayedRequests.filter((approval) => approval.status === 'approved');
    const rejected = displayedRequests.filter((approval) => approval.status === 'rejected');

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('shield', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Manager Portal</p>
          <h1>Approval Governance</h1>
          <p>Review and manage requests requiring managerial authorisation.</p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat"><strong>${displayedRequests.length}</strong><span>Total Requests</span></div>
          <div class="hero-stat"><strong>${pending.length}</strong><span>Pending</span></div>
          <div class="hero-stat"><strong>${approved.length}</strong><span>Approved</span></div>
          <div class="hero-stat"><strong>${rejected.length}</strong><span>Rejected</span></div>
        </div>
      </header>

      <section class="panel" aria-label="Filter requests by type">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong class="small">Request type</strong>
          <button type="button" class="${approvalGovernanceView.typeFilter === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-type-filter" data-type="all" aria-pressed="${approvalGovernanceView.typeFilter === 'all'}">All Requests</button>
          ${MANAGER_REVIEW_TYPES.map((type) => html`<button type="button" class="${approvalGovernanceView.typeFilter === type.key ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-type-filter" data-type="${type.key}" aria-pressed="${approvalGovernanceView.typeFilter === type.key}">${type.label}</button>`)}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          <strong class="small">Status</strong>
          ${['all', 'pending', 'approved', 'rejected'].map((status) => html`<button type="button" class="${approvalGovernanceView.statusFilter === status ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-status-filter" data-status="${status}" aria-pressed="${approvalGovernanceView.statusFilter === status}">${status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}</button>`)}
        </div>
      </section>

      <section class="panel" aria-labelledby="manager-approval-requests-title">
        <div class="panel-head">
          <div>
            <h2 id="manager-approval-requests-title">Manager review requests</h2>
            <p class="muted small">Review the existing request record before recording a decision.</p>
          </div>
          <span class="tag ${displayedRequests.length ? 'tag-warning' : 'tag-neutral'}">${displayedRequests.length} shown</span>
        </div>
        ${displayedRequests.length ? html`<ul class="queue">${displayedRequests.map(renderRequest)}</ul>` : html`<div class="empty">${icon('check', 20)}<p>No requests match these filters.</p></div>`}
      </section>
    `;
  },
};

// The prototype's evidence-linked explanation for each follow-up rule (prototype/js/state.js detectLooseEnds),
// filled from this case's own records. Rule text is English, like the findings themselves in caseLogic.js.

const short = (iso) => (iso ? iso.slice(0, 16) : 'next working day')
const place = (c) => c.block || c.estate || 'site'

const RULES = {
  resident_callback: (c, f) => ({
    ruleCode: 'EMS-LE-01', ruleName: 'Resident Follow-up Commitment', title: 'Outstanding Resident Callback',
    explanation: 'Promised resident update call has not been recorded following the initial site inspection.',
    whyDetected: 'Following the on-site assessment, an operational commitment was recorded to update the resident. More than 24 hours have elapsed without a logged telephone call or direct contact acknowledgment in the case timeline.',
    ruleThreshold: 'Mandatory resident callback within 24 hours of inspection completion (OneService / Town Council Customer Service Charter).',
    verifiedFacts: [
      ...(c.timeline ?? []).filter((e) => e.type === 'inspection').map((e) => `Inspection recorded at ${place(c)}: ${e.summary || e.title}`),
      `Resident contact on file: ${c.resident?.name || 'Tenant'}.`,
      `Follow-up deadline scheduled for ${short(f.due)}.`,
    ],
    ruleDeductions: [
      'No matching contact entry or call log found in timeline since initial inspection.',
      'Elapsed operational duration exceeds standard 24h resident communication SLA.',
      'Unfulfilled resident commitments risk public escalation to grassroots/OneService.',
    ],
    missingInfo: 'Documented resident phone conversation log, visit note, or SMS acknowledgment.',
    suggestedAction: `Contact resident ${c.resident?.name || 'tenant'} to provide investigation update and record callback.`,
  }),
  contractor_pending: (c, f) => ({
    ruleCode: 'EMS-LE-02', ruleName: 'Contractor Quotation & Scope Turnaround', title: 'Contractor Quotation & Scope Pending',
    explanation: 'Contractor confirmation has exceeded the standard 24h turnaround without a recorded submission.',
    whyDetected: 'Term contractor was notified of required works, but quotation or work schedule confirmation has not been submitted within the 24-hour turnaround SLA.',
    ruleThreshold: 'Contractor quote submission required within 24 hours of site assessment (EMS Maintenance SLA).',
    verifiedFacts: [`Record still open: ${f.record.label}.`, `SLA due date: ${short(f.due)}.`],
    ruleDeductions: [
      'No formal quotation document attached in case evidence files.',
      'Delayed contractor estimation stalls work order creation and coordination.',
    ],
    missingInfo: 'Contractor itemized scope of works and signed quotation slip.',
    suggestedAction: f.nextStep,
  }),
  inspection_outcome: (c, f) => ({
    ruleCode: 'EMS-LE-03', ruleName: 'Inspection Outcome Documentation', title: 'Site Inspection Lacks Documented Findings',
    explanation: 'Scheduled inspection took place, but mandatory outcome findings have not been uploaded.',
    whyDetected: 'An inspection was due according to schedule, but mandatory findings (checklist and signed technician log) have not been filed.',
    ruleThreshold: 'Inspection findings are logged once the scheduled inspection time has passed.',
    verifiedFacts: [`Inspection scheduled at ${place(c)}.`, `Checklist item "${f.record.label}" remains uncompleted.`],
    ruleDeductions: [
      'Absence of endorsed outcome report prevents compliance sign-off.',
      'Critical severity assigned due to safety implications.',
    ],
    missingInfo: 'Certified technician service log slip and endorsed inspection findings.',
    suggestedAction: 'Upload certified technician service log slip and endorse inspection findings.',
  }),
  stale_case: (c, f) => ({
    ruleCode: 'EMS-LE-04', ruleName: 'Case Activity Stalemate Detector', title: 'Stale Case Activity (>48h Inactive)',
    explanation: 'Open case has received no progress log or site inspection note in the last 48 hours.',
    whyDetected: 'Open case has remained in progress without an updated timeline entry, progress report, or communication event for more than 48 operational hours.',
    ruleThreshold: 'Active cases must record progress at least once every 48 hours.',
    verifiedFacts: [`Case stage: ${c.stage}.`, `Last timeline event: "${f.record.label}".`],
    ruleDeductions: ['Zero activity recorded for over 48 hours indicates workflow stagnation or unrecorded offline action.'],
    missingInfo: 'Updated site status, resident follow-up note, or contractor progress log.',
    suggestedAction: 'Request status confirmation from attending property officer.',
  }),
  missing_evidence: (c, f) => ({
    ruleCode: 'EMS-LE-05', ruleName: 'Mandatory Compliance Evidence Verification', title: 'Required Supporting Evidence Missing',
    explanation: 'Mandatory technical records required by Town Council compliance standards are unattached.',
    whyDetected: 'Case requires mandatory documentation before work orders or closures can be certified.',
    ruleThreshold: 'All mandatory evidence items marked "required for closure" must be uploaded and verified before case completion.',
    verifiedFacts: [
      `Required evidence unattached: ${f.record.label}.`,
      `Verified evidence present: ${(c.evidence ?? []).filter((e) => e.status === 'verified').map((e) => e.title).join(', ') || 'None'}.`,
    ],
    ruleDeductions: ['Missing statutory notices prevent compliance sign-off.'],
    missingInfo: `Unattached files: ${f.record.label}.`,
    suggestedAction: 'Request mandatory photo/document attachments before proceeding to rectification.',
  }),
  appointment_unconfirmed: (c, f) => ({
    ruleCode: 'EMS-LE-08', ruleName: 'Fixed Resident Appointment Protection', title: 'Upcoming Appointment Lacks Confirmation',
    explanation: 'Repair appointment is scheduled within 24 hours without recorded access confirmation.',
    whyDetected: 'A fixed access appointment is scheduled, but confirmation has not been recorded within the standard 24h pre-visit window.',
    ruleThreshold: 'Resident attendance confirmation required 24 hours prior to fixed repair block.',
    verifiedFacts: [`Appointment: ${short(f.due)}.`, `Resident contact: ${c.resident?.name || 'Resident'}.`],
    ruleDeductions: ['Unconfirmed appointments risk wasted contractor trips and abortive site visit charges.'],
    missingInfo: 'Recorded tenant SMS or call confirming presence at unit during scheduled block.',
    suggestedAction: 'Send SMS/Call resident to verify home access availability.',
  }),
}

const REF = { checkpoint: 'Checkpoint', blocker: 'Blocker', evidence: 'Evidence', timeline: 'Timeline' }

export function explainFinding(c, f) {
  const rule = RULES[f.ruleId]?.(c, f) ?? {
    ruleCode: f.ruleId, ruleName: f.title, title: f.title, explanation: f.reason, whyDetected: f.reason, ruleThreshold: f.threshold,
    verifiedFacts: [f.record.label], ruleDeductions: [f.reason], missingInfo: 'No missing files recorded.', suggestedAction: f.nextStep,
  }
  return { ...rule, severity: f.severity, sourceRecordRef: `${REF[f.record.type] ?? 'Record'}: ${f.record.label}` }
}

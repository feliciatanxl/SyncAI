// FICTIONAL demo cases, adapted from the prototype's seed data (prototype/js/data.js). Never real residents,
// units or contractors. Dates are relative to `now` so the radar and countdowns always have something to show.
// Two cases belong to the signed-in person so a team member sees their own; the rest belong to demo teammates.

const at = (now, hours) => new Date(now.getTime() + hours * 3_600_000).toISOString()

export function demoOfficers(me) {
  return [
    { id: me.id, name: me.displayName || me.email || 'You' },
    { id: 'demo-officer-2', name: 'Marcus Tan' },
    { id: 'demo-officer-3', name: 'Chua Hui Min' },
  ]
}

export function demoCases(me, now = new Date()) {
  const you = me.displayName || me.email || 'You'
  return [
    {
      id: 'demo-case-001', number: 'CAS-2026-001', title: 'Ceiling seepage at Blk 211', category: 'Resident feedback',
      stage: 'in_progress', ownerId: me.id, estate: 'Zone A', block: 'Blk 211', unit: '#05-12', urgency: 'high',
      description: 'Resident reported ceiling seepage. Inspect the unit, update the resident and prepare the repair work order.',
      deadline: at(now, 6), resident: { name: 'Mdm Tan (#05-12)' }, taskRefs: [],
      blockers: [{ id: 'blk-001-1', title: 'Upper unit #06-12 not reachable for joint inspection', responsibleParty: 'Upper-unit resident', partyType: 'resident', resolved: false, recordedAt: at(now, -20) }],
      checkpoints: [
        { id: 'cp-001-1', kind: 'inspection', title: 'Inspect ceiling moisture in #05-12', completed: true, completedAt: at(now, -26), requiredForClosure: true },
        { id: 'cp-001-2', kind: 'resident', title: 'Call resident with inspection update', completed: false, due: at(now, -2), requiredForClosure: true },
        { id: 'cp-001-3', kind: 'inspection', title: 'Joint inspection with upper unit #06-12', completed: false, due: at(now, 30), requiredForClosure: true },
        { id: 'cp-001-4', kind: 'contractor', title: 'Repair work order sign-off', completed: false, due: at(now, 72), requiresManager: true, requiredForClosure: true },
      ],
      evidence: [
        { id: 'ev-001-1', title: 'Ceiling seepage photo', fileName: 'seepage_0511.jpg', type: 'Photo', size: '2.4 MB', uploadedAt: at(now, -25), uploadedBy: you, status: 'verified', verifiedBy: 'Jennifer Ong', requiredForClosure: true },
        { id: 'ev-001-2', title: 'Joint inspection notice copy', fileName: null, type: 'Document', status: 'missing', requiredForClosure: true },
      ],
      timeline: [
        { id: 'tl-001-1', at: at(now, -44), type: 'reported', title: 'Feedback lodged', summary: 'Water stains above master bedroom toilet.', source: 'OneService', actor: 'Intake' },
        { id: 'tl-001-2', at: at(now, -40), type: 'assigned', title: 'Assigned for inspection', summary: `Assigned to ${you}.`, source: 'Manual assignment', actor: 'Jennifer Ong' },
        { id: 'tl-001-3', at: at(now, -26), type: 'inspection', title: 'Moisture inspection completed', summary: 'High moisture reading; suspected leak from unit above.', source: 'Inspection note', actor: you },
      ],
      history: [{ id: 'h-001-1', at: at(now, -40), actor: 'Jennifer Ong', field: 'Assigned officer', before: 'Unassigned', after: you, reason: 'Zone A officer' }],
      communications: [{ id: 'cm-001-1', at: at(now, -43), channel: 'Phone (simulated)', direction: 'inbound', party: 'Resident', summary: 'Resident described the stain and asked for a visit.' }],
      pendingRequest: null,
    },
    {
      id: 'demo-case-002', number: 'CAS-2026-002', title: 'Refuse chute hopper fault at Blk 310', category: 'Maintenance',
      stage: 'pending_external', ownerId: 'demo-officer-2', estate: 'Zone B', block: 'Blk 310', unit: 'Common lobby', urgency: 'high',
      description: 'Hopper door jammed ajar, causing odour in the lobby. Contractor to replace the hinge.',
      deadline: at(now, 5), resident: null, taskRefs: [],
      blockers: [{ id: 'blk-002-1', title: 'Contractor quotation for hinge replacement', responsibleParty: 'CleanPro Conservancy', partyType: 'contractor', resolved: false, recordedAt: at(now, -6), due: at(now, 3) }],
      checkpoints: [
        { id: 'cp-002-1', kind: 'inspection', title: 'Inspect hopper latch', completed: true, completedAt: at(now, -6), requiredForClosure: true },
        { id: 'cp-002-2', kind: 'appointment', title: 'Contractor repair visit', completed: false, due: at(now, 8), requiredForClosure: true },
      ],
      evidence: [{ id: 'ev-002-1', title: 'Hopper latch photo', fileName: 'hopper_310.jpg', type: 'Photo', size: '1.8 MB', uploadedAt: at(now, -6), uploadedBy: 'Marcus Tan', status: 'pending_review', requiredForClosure: true }],
      timeline: [{ id: 'tl-002-1', at: at(now, -9), type: 'reported', title: 'Hopper fault reported', summary: 'Hopper door jammed ajar.', source: 'Estate hotline', actor: 'Hotline' }],
      history: [], communications: [], pendingRequest: null,
    },
    {
      id: 'demo-case-003', number: 'CAS-2026-003', title: 'Drain obstruction at Blk 405', category: 'Cleaning',
      stage: 'open', ownerId: 'demo-officer-3', estate: 'Zone C', block: 'Blk 405', unit: 'Perimeter drain', urgency: 'medium',
      description: 'Possible drain obstruction near the block. Confirm location and extent on site.',
      deadline: at(now, 50), resident: null, taskRefs: [],
      blockers: [],
      checkpoints: [{ id: 'cp-003-1', kind: 'inspection', title: 'Perimeter drain inspection', completed: false, due: at(now, 48), requiredForClosure: true }],
      evidence: [],
      timeline: [{ id: 'tl-003-1', at: at(now, -60), type: 'reported', title: 'Drain choke reported', summary: 'Leaves and silt near the perimeter drain.', source: 'OneService', actor: 'Intake' }],
      history: [], communications: [], pendingRequest: null,
    },
    {
      id: 'demo-case-004', number: 'CAS-2026-004', title: 'Corridor lighting repaired at Blk 214', category: 'Maintenance',
      stage: 'ready_for_closure', ownerId: me.id, estate: 'Zone A', block: 'Blk 214', unit: 'Level 7 corridor', urgency: 'low',
      description: 'Two corridor lights were out. Contractor replaced both fittings.',
      deadline: at(now, 30), resident: null, taskRefs: [],
      blockers: [],
      checkpoints: [
        { id: 'cp-004-1', kind: 'inspection', title: 'Check corridor lighting', completed: true, completedAt: at(now, -30), requiredForClosure: true },
        { id: 'cp-004-2', kind: 'contractor', title: 'Contractor replaces fittings', completed: true, completedAt: at(now, -5), requiredForClosure: true },
      ],
      evidence: [{ id: 'ev-004-1', title: 'Completion photo', fileName: 'corridor_214.jpg', type: 'Photo', size: '1.1 MB', uploadedAt: at(now, -5), uploadedBy: you, status: 'verified', verifiedBy: 'Jennifer Ong', requiredForClosure: true }],
      timeline: [
        { id: 'tl-004-1', at: at(now, -32), type: 'reported', title: 'Lights out reported', summary: 'Two fittings out on level 7.', source: 'OneService', actor: 'Intake' },
        { id: 'tl-004-2', at: at(now, -5), type: 'update', title: 'Repair completed', summary: 'Contractor replaced both fittings.', source: 'Progress note', actor: you },
      ],
      history: [{ id: 'h-004-1', at: at(now, -4), actor: you, field: 'Stage', before: 'In progress', after: 'Closure ready', reason: 'Repair verified' }],
      communications: [], pendingRequest: null,
    },
    {
      id: 'demo-case-005', number: 'CAS-2026-005', title: 'Lift jolts reported at Blk 208', category: 'Maintenance',
      stage: 'closed', ownerId: 'demo-officer-2', estate: 'Zone A', block: 'Blk 208', unit: 'Lift A', urgency: 'critical',
      description: 'Residents reported jolts. Joint inspection with the lift contractor found and fixed a sensor fault.',
      deadline: at(now, -24), resident: null, taskRefs: [],
      blockers: [],
      checkpoints: [{ id: 'cp-005-1', kind: 'inspection', title: 'Joint inspection with lift contractor', completed: true, completedAt: at(now, -30), requiredForClosure: true }],
      evidence: [{ id: 'ev-005-1', title: 'Lift service report', fileName: 'lift_208A.pdf', type: 'Report', size: '340 KB', uploadedAt: at(now, -29), uploadedBy: 'Marcus Tan', status: 'verified', verifiedBy: 'Jennifer Ong', requiredForClosure: true }],
      timeline: [{ id: 'tl-005-1', at: at(now, -20), type: 'closed', title: 'Case closed', summary: 'Closure approved by manager.', source: 'Approval', actor: 'Jennifer Ong' }],
      history: [{ id: 'h-005-1', at: at(now, -20), actor: 'Jennifer Ong', field: 'Stage', before: 'Closure ready', after: 'Closed & audited', reason: 'All checks complete' }],
      communications: [], pendingRequest: null,
    },
  ]
}

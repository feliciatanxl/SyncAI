# SyncAI — PS 12i Smart Work Planner Static Prototype

> **"Know what matters. Plan what fits. Adapt when work changes."**  
> An explainable, capacity-aware AI Smart Work Planner prototype designed for EM Services Property Officers, Estate Managers, and Administrators, aligned with **EMS Challenge PS 12i**.

---

## 1. Overview & Architecture

This `/prototype` folder is a **pure, standalone static web application** designed to showcase the complete visual design, navigation, role-based workflows, and user experience of SyncAI. It mirrors the full-stack SyncAI application (`/client`) without requiring any runtime backend, database, Node.js packages, or build tools.

### Key Technical Characteristics
- **Zero Runtime Dependencies:** Built strictly with **HTML5, CSS3, and Vanilla JavaScript (ES Modules)**. No React, Vite, Babel, Webpack, MSAL, or external runtime libraries.
- **Client-Side State & Logic:** Uses an in-memory observable store (`prototype/js/state.js`) initialized from seeded fictional Town Council data (`prototype/js/data.js`), with session persistence.
- **Deterministic AI & Scheduling:** Powered by local, transparent rule engines (`ai.js`, `planner.js`, `ripple.js`) providing mathematical priority scoring, capacity constraint scheduling, downstream dependency cascades, and What-If disruption simulations.
- **Dual Visual Themes & Fully Responsive Layout:** Fully supports Fluent UI Light and Dark modes with responsive design across desktop (1920px/1440px), laptop/tablet (1024px/768px), and mobile (430px/390px/320px). Features a responsive off-canvas mobile navigation drawer with hamburger toggle, focus trap, and keyboard navigation.

### Relationship to the Full-Stack Application
- **Source of Truth:** The full-stack React frontend (`/client`) and Express backend (`/server`) represent the production application.
- **Role of the Prototype:** The prototype serves as an immediately testable, zero-setup demonstration for stakeholders, reviewers, and offline evaluation. It exhibits matching branding, typography, color palettes, card layouts, navigation hierarchy, and UX flows while keeping all operations safely simulated in browser memory.

---

## 2. Quick Start

Because modern browsers enforce CORS restrictions on ES modules loaded via the `file://` protocol, you must run a static HTTP server to view the prototype.

A lightweight, zero-dependency Python static server is included:

```bash
# Start the static server (default port: 8765)
python prototype/serve.py

# Or specify a custom port
python prototype/serve.py 3000
```

Once started, open your browser to:
- **Public Landing Page:** `http://localhost:8765/site/index.html`
- **Simulated Sign-In:** `http://localhost:8765/site/login.html`
- **Application Portal:** `http://localhost:8765/index.html`

*(Alternative static servers such as VS Code Live Server, `npx serve prototype`, or `python -m http.server 8765` from within `/prototype` are also fully supported).*

---

## 3. Simulated Microsoft Sign-In Bypass & Demo Accounts

In compliance with prototype design constraints, **Microsoft sign-in is 100% simulated**:
- **No External Connection:** Clicking **"Sign in with Microsoft"** does not contact Microsoft Entra ID (Azure AD), does not issue live OAuth/OIDC tokens, and never prompts for real passwords or tenant permissions.
- **Interactive Role Chooser:** Clicking the sign-in button opens a demo role modal allowing immediate entry into five fictional personas:
  1. **Team Member (Property Officer):** Aisyah Rahman (`aisyah.rahman@towncouncil.gov.sg`, Zone A Operations)
  2. **Estate Manager:** Jennifer Ong (`jennifer.ong@towncouncil.gov.sg`, Supervisory Manager)
  3. **System Administrator:** Alex Tan / `TAN, ALEX` (`alex.tan@syncai.demo`, Governance & Audit)
  4. **Pending Account (Reviewer Preview):** David (`pending@syncai.demo`, awaiting administrative approval)
  5. **Disabled Account (Reviewer Preview):** Siti (`disabled@syncai.demo`, account suspended)
- **Quick Role Switcher:** Once inside the portal, you can switch between roles at any time using the role pill dropdown in the top navigation bar or the Microsoft 365 Account Menu popover.

---

## 4. Four Interconnected Feature Workstreams

The prototype demonstrates Team 24's **four primary feature areas** collaborating as one unified application:

### A. Task Visibility & Case Action Centre V7 (Category C — Felicia Tan)
Located in the primary navigation (`Overview` → `Ask SyncAI` → `My Tasks` → `Case Action Centre` → `My Plan`):

- **Category C V7 Core Enhancements & Task Visibility Capabilities:**
  - **#021 — Smart Deadline Countdown:**
    - Calculates real-time countdowns relative to Singapore SGT (`UTC+8`) for all recorded SLA deadlines and compliance milestones.
    - Deterministic clock injection via `getDeadlineCountdown(targetIso, nowIso = null)` ensuring consistent evaluation during automated tests and historical replays.
    - Four standardized operational countdown states with high-contrast, accessible badges:
      - *Overdue:* `.deadline-badge-overdue` (e.g. `Overdue by 2h 15m`)
      - *Due Soon ($\le 48\text{h}$):* `.deadline-badge-soon` (e.g. `Due in 4h 30m`)
      - *Upcoming ($> 48\text{h}$):* `.deadline-badge-upcoming` (e.g. `Due in 5d`)
      - *None / Indefinite:* `.deadline-badge-none` (e.g. `No active SLA deadline`)
    - Embedded throughout the interface: Case Action Centre table view, Kanban cards, and Case Details modal.
  - **#024 + #029 — Assignee History & Task Change Comparison:**
    - Dedicated **History & Changes** tab in Case Journey modal (`renderJourneyHistoryTab`).
    - *Assignee Reassignment History:* Chronological log recording previous officer, new officer, requesting party, approving manager, justification reason, and status.
    - *Clean Empty State Handling:* Cases without reassignments display an explicit, user-friendly notice: `"No previous reassignment recorded."`
    - *Linked Task Owner Synchronization:* When an Estate Manager approves a case reassignment in the Manager Approval Queue, SyncAI automatically updates ownership across both the case and all linked tasks in shared state (`decideApproval`).
    - *Task & Case Change Comparison:* Structured before/after comparison grid (`.before-after-grid`) comparing previous values directly against modified attributes, displaying requesting actor, approving manager, and auditable notes.
  - **#027 — Evidence Attachments & Verification:**
    - Dedicated **Evidence & Docs** tab in Case Journey modal (`renderJourneyEvidenceTab`).
    - Complete metadata schema: file title, original filename, type label (`Site Inspection Photo`, `Thermography Scan`, `BCA Structural Report`, `Handover Memo`, `Contractor Quote`), file size, upload timestamp, uploading officer, description, status (`pending_review`, `verified`, `rejected`), verified by, and verification timestamp.
    - *Client-Side Demo Upload:* Interactive file upload form with instant client-side validation: title required ($\ge 3$ characters), file selection validation, and file size guardrail ($\le 5\text{ MB}$).
    - *Role-Enforced Verification Workflow:* Property Officers can view and upload evidence; only authorized Estate Managers (`manager`) can verify (`case-verify-evidence`) or reject (`case-reject-evidence`) attachments.
    - *Auditable Rejection Safeguard:* Rejecting evidence requires an explicit operational explanation ($\ge 4$ characters).
    - *Closure Readiness Integration:* Direct gate in `checkClosureReadiness`. Cases with pending or missing mandatory evidence are prevented from closure with clear statutory guidance.
  - **Human-Readable AI Case Brief:**
    - Replaced raw monospaced `<pre>` terminal dumps with an executive-ready, human-readable structured dashboard (`renderJourneyBriefTab`).
    - Visual cards organized by operational priority:
      1. *Case Overview:* Status, priority, reported date, dynamic officer zone, assigned officer, location.
      2. *Executive Summary / What Happened:* Clear plain-English problem statement and resident report context.
      3. *Work Completed:* Categorized breakdown of verified on-site actions, repairs, and technical inspections.
      4. *Outstanding Loose Ends:* Bulleted attention items needing officer follow-up.
      5. *Next Actions & Recommended Steps:* Operational guidance for the handling officer.
      6. *Statutory Readiness Check:* BCA/EMS compliance status, required documentation checklist, and sign-off eligibility.
      7. *Supporting Records & Verification:* Direct clickable links to verified timeline items and evidence files.
      8. *Responsible AI Disclosures:* Prominent disclaimer clarifying deterministic synthesis and human accountability.
    - *Dynamic Officer Zone Derivation:* `getOfficerZone` derives officer coverage zones dynamically (`Zone A`, `Zone B`, `Zone C`) without hardcoded values.
    - *Missing Data Fallbacks:* Safely falls back on missing attributes (e.g. `"Responsible party not yet recorded."`) without breaking template structure.
    - *Clipboard Copy Compatibility:* Keeps clean plaintext populated in an accessible `#case-brief-text` element, preserving 100% compatibility with one-click clipboard copying.
  - **Redesigned Move Case Modal:**
    - Guided destination stage cards for all 5 canonical stages (`renderCaseMoveStageModal`).
    - Plain-English explanations for stage availability and clear blocker explanations.
    - Role-aware actions: straightforward transitions offer one-click movement; manager sign-off stages prompt for "Request Approval".
  - **7-Step Manager Closure Sign-Off Modal:**
    - Structured, readable 7-step layout (`renderCaseTransitionModal`):
      1. *Case Summary Card:* Reference ID, title, and assigned officer.
      2. *Workflow Progression:* Visual from-to stage transition.
      3. *Compliance & Justification:* Executive review standards.
      4. *Requirements Inspection:* Live pass/fail checklist of statutory items.
      5. *Closure Memo / Rationale:* Required operational note textarea ($\ge 4$ characters).
      6. *Post-Submission Explanation:* Clear guidance on audit logging and record archiving.
      7. *Explicit Action Buttons:* Dedicated Submit and Cancel triggers with clear visual hierarchy.
  - **Consistent Case Journey Modal Tabs:**
    - Segmented navigation with 8 comprehensive tabs: `Timeline & Notes`, `Outstanding Follow-Ups`, `Blockers`, `Ready to Close?`, `Evidence & Docs` (#027), `History & Changes` (#024+#029), `Communications`, and `AI Case Brief`.
  - **Responsive Layout Verification:**
    - Fully tested and responsive across desktop (1440px), laptop/tablet (1024px, 768px), and mobile (430px, 390px, 320px).
    - Table transforms to stacked mobile cards at $\le 768\text{px}$.
    - Modal drawers include full ARIA dialog attributes, visible close buttons, and focus management.

- **Functional Drag-and-Drop Kanban & Workflow Transition Engine (V5/V7):**
  - **Real State-Driven Drag-and-Drop:** Fully functional desktop HTML5 drag-and-drop between all five canonical workflow stages (`Open / Intake`, `In Progress`, `Awaiting External / Blocked`, `Closure Ready`, `Closed & Audited`). Moving a card modifies shared prototype state (`state.js`), updates case status and blockers, appends audit events, and updates column counters dynamically.
  - **Central Workflow Transition Engine (`requestCaseStageTransition`):** All stage transitions—whether triggered via mouse drag-and-drop or the accessible "Move to Stage" dialog—pass through a single central transition engine with structured validation:
    - *Open → In Progress:* Permitted for authorized case owners or supervisory managers, logging operational start timestamps and updating active state.
    - *In Progress → Awaiting External / Blocked:* Requires an auditable hold reason ($\ge 4$ characters) and records an active external dependency/blocker.
    - *Awaiting External → In Progress:* Enforces active blocker resolution. Direct transitions without blocker resolution are rejected with an explicit explanation; provides a one-click *"Resolve Blocker & Move to In Progress"* flow for authorized officers.
    - *Active Case → Closure Ready:* Strictly validates the closure checklist (`checkClosureReadiness`). If statutory checkpoints or required evidence are incomplete, the transition is blocked with clear itemized requirements.
    - *Closure Ready → Closed & Audited:* Follows hierarchical governance. Front-line Team Members cannot close directly; the engine creates a Manager Closure Review approval request (`createApprovalRequest`). Estate Managers can close cases directly when all checklist criteria are satisfied, or record an auditable manager exception reason ($\ge 4$ characters) if closing with incomplete items.
    - *Closed → Active Stages (Reopening):* Team Members cannot reopen closed cases. Estate Managers may reopen closed cases with an auditable justification reason ($\ge 4$ characters), appending an official audit log entry.
  - **Role-Based Transition Segregation:**
    - Property Officers (`member`) can only move cases assigned directly to them.
    - Estate Managers (`manager`) can transition cases across their supervised team.
    - Administrators (`admin`) hold governance/oversight access with view-only operational restrictions.
    - Inactive, pending, or disabled accounts are strictly denied transition capabilities.
  - **Consequential Transition Confirmation Dialog (`renderCaseTransitionModal`):**
    - Seamless immediate movement for straightforward permitted transitions.
    - Dedicated, accessible confirmation dialog for consequential transitions requiring input: hold/blocker reason, manager closure approval routing, auditable manager exceptions, and case reopening justifications.
  - **Accessible Keyboard & Mobile Alternative ("Move to Stage"):**
    - Every case card on the Kanban board and every row in the Table view includes an accessible **"Move to Stage"** button.
    - Opens a focused, accessible modal (`renderCaseMoveStageModal`) listing all 5 destination stages with current stage indicator, real-time eligibility checks, and explicit explanatory reasons for disabled stages.
    - 100% accessible via keyboard (Tab, Enter, Space, Escape) and touchscreens.
  - **Safe Interaction Separation:** Clicking interactive elements (links, buttons, "Move to Stage") executes only that action with `stopPropagation()`; dragging a card never accidentally triggers case detail drawers (`isDraggingCard` suppression); clicking neutral card/row surfaces opens the case details modal.

- **Modern Visual Hierarchy & Layout Redesign:**
  - **Section A — Page Header:** Consistent navy/blue gradient hero with title, role badge (`Manager Workspace` / `Property Officer Workspace`), value-focused description, and clear `Fictional Demo Environment` indicator. Clean and compact without duplicate metric counts, with dedicated title and badge cluster row preventing text clustering across desktop and mobile.
  - **Section B — Operational Overview:** Four equal-width, interactive metric cards (**Open Cases**, **Outstanding Follow-Ups**, **Blocked Cases**, **Ready to Close?**) with aligned icons, primary values, and clickable filters that immediately filter cases. Responsive 4-column desktop, 2-column tablet, and 1-column mobile grid.
  - **Section C — Follow-Up Radar:** High-priority banner with filter tabs (`All`, `Critical`, `Resident Callbacks`, `Contractor`), aligned action cards, and distinct card zones:
    - *Header:* Finding type badge with alert icon, monospace case ID link, and bold case title.
    - *Explanation:* Comfortable line-height "Why it matters" narrative with balanced text density.
    - *Evidence:* Distinct subtle Supporting Record box displaying verified source references without tiny fonts.
    - *Actions:* Consistently bottom-aligned triggers for **"Why was this flagged?"** (Evidence-Linked Explanation) and **"Take Action"** (Jump to Loose Ends in Drawer).
  - **Section D — Operational Cases Workspace & Toolbar:**
    - *Two-Row Structured Toolbar:* Row 1 hosts case status tabs and List/Kanban toggles; Row 2 hosts the full-width search bar, Estate/Block dropdown with visible label, Urgency dropdown with visible label, and Reset filters action.
    - *Action Hierarchy:* Prominent **View Case** primary action, accessible **Move to Stage** secondary action, and contextual **Loose Ends** badges.
    - *Redesigned Kanban Columns & Cards:* Balanced column widths, distinct drop-zone highlighting (`.is-drop-target`, `.is-invalid-target`), drag handles, operational indicators (outstanding follow-up counts, active blocker alerts, next deadlines), and dual action buttons (**View Case** and **Move to Stage**).
    - *Case Table & Compact Deadlines:* Clear column order (`Case / Location`, `Category`, `Status`, `Assigned Officer`, `Deadlines (SGT)`, `Actions`) with clickable rows and compact Singapore timestamps (e.g., `11 Nov 2026 · 5:00 PM`) preventing excessive row heights.
    - *Responsive Mobile Stacked Cards:* At tablet/mobile viewports ($\le 768px$), table rows transform seamlessly into stacked, accessible case cards with clear uppercase section labels.
  - **Section E — Case Detail Drawer:**
    - *Header:* Monospace case number, primary status badge, location/estate, assigned officer (`Assigned: Aisyah Rahman`), case title, and a clearly visible, accessible **'X' close button** (`drawer-close-btn`).
    - *Responsive Wrapped Navigation:* Replaces overflowing horizontal tabs with wrapped segmented pills (`Timeline & Notes`, `Outstanding Follow-Ups`, `Blockers`, `Ready to Close?`, `Evidence & Docs`, `History & Changes`, `Communications`, `AI Case Brief`), eliminating horizontal scrollbars and off-screen tabs.
    - *Compact Content:* Dynamic content-driven height. Empty timelines display a compact, helpful notice (*"No case updates have been recorded yet."*) without excessive whitespace.
    - *Context-Aware Footer:* Action buttons for **Reassign Case**, **View in Planner**, and **Close Case** with checklist validation status.
  - **Streamlined Layout (Duplicate Panel Removal):** Removed the redundant bottom EMS case prioritisation list from the Case Action Centre, keeping the application clean while preserving the dedicated "How SyncAI decides" page and client priority requirements.

- **Fixed Kanban Single-Column Classification (No Duplication):**
  - Evaluates each case through a single deterministic classifier (`getCaseKanbanColumn`).
  - Columns: `Open / Intake`, `In Progress`, `Awaiting External / Blocked`, `Closure Ready`, `Closed & Audited`.
  - Blocked cases in progress (e.g. Ceiling seepage at Blk 211 with upper-unit access blocker) appear strictly in `Awaiting External / Blocked` with secondary priority badges, eliminating duplicate cards across columns.

- **Evidence-Linked Explanations (#117 — Signature Responsible AI Capability):**
  - **"Why did SyncAI flag this case?"** Interactive explanation panel launched directly from any Follow-Up card or table alert.
  - Transparent 4-part structured breakdown:
    1. *Verified Recorded Facts:* Concrete case data from site logs, thermography readouts, or OneService intakes.
    2. *Rule-Based Deductions:* Clear logical deductions derived from EMS turnaround rules.
    3. *Missing Information:* Specific unrecorded call logs, pending quotations, or missing documents.
    4. *Proposed Recommendations:* Actionable next steps for the property officer.
  - *Clickable Evidence References:* Click **"View Supporting Record →"** to jump directly to the verified timeline entry, checkpoint, or blocker with glowing pulse animation and a **"← Back to Follow-Ups List"** return path.
  - *Responsible AI Guardrail:* Explicitly discloses that findings are deterministic rule-based outputs requiring human review, not generative black-box predictions.

- **Actionable Notification Centre (#071):**
  - Reusable notification bell in the portal top bar with dynamic unread count badge.
  - **14 Realistic Operational Notifications:** Covers resident callbacks due, overdue follow-ups, contractor confirmations pending, repair appointments approaching, missing inspection evidence, blockers identified, reassignment awaiting approval, reassignment approved, new cases assigned, SLA deadlines approaching, case handover notes, closure reviews requested, urgent safety incidents, and governance compliance audits.
  - Popover with **All** and **Unread** filter tabs, per-item **Mark read**, bulk **Mark all read**, and one-click deep links (`View Case →`) that open the target case drawer directly.

- **Case Communication Hub & Message-to-Task Drafting (#076):**
  - Simulated multi-channel communication timeline supporting `In-App`, `WhatsApp (Proposed)`, `Microsoft Teams (Proposed)`, and `Telegram (Proposed)`.
  - Filter communications by channel; track acknowledgment states and view sender roles.
  - **Manual Communication Logging:** Log resident phone calls or contractor inquiries directly into the case history and timeline.
  - **Suggested Reply Generator:** One-click contextual draft generator tailored to resident name and case details, with one-click clipboard copying.
  - **Communication-to-Task Drafting (#076):** Paste or load fictional incoming messages to extract structured tasks (title, category, priority, due date) with mandatory human confirmation before saving to Smart Planner.

- **Closure Readiness Checker & AI Case Brief:**
  - Multi-checkpoint gate preventing premature closure while statutory checkpoints or evidence files remain incomplete.
  - Role-differentiated closure workflow: Property Officers can submit closure requests for manager sign-off without prematurely altering case status, while Estate Managers can directly approve closures.
  - Deterministic synthesized case brief with transparent `[DISCLOSED MISSING INFORMATION]` section detailing unverified evidence or missing documentation, with one-click clipboard copy and refresh capability.

- **High-Contrast Metric Typography & WCAG AA Accessibility:**
  - Metric values on all operational overview cards (`.stat-value`) utilize high-contrast color tokens (`--stat-value-color: #102B4E` and `--stat-value-warn-color: #7a4d00` in light mode, `#ffffff` and `#f9d86c` in dark mode) ensuring contrast ratios >= 11:1, far exceeding WCAG AA requirements (4.5:1).
  - Accessible dialog semantics: modal drawers include `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, visible close button, Escape key dismissal, and active Tab key focus trapping with focus return to triggers upon closing.

- **Interactive Case Modal Workflows:**
  - **Operational Progress Notes:** Validated note logging (minimum 4 characters) immediately updates shared state, chronological timeline, and system audit logs.
  - **Outcome Resolution:** Record outcomes directly on Loose-End follow-up cards (`data-action="case-resolve-finding"`), completing underlying checkpoints or tasks and clearing related notifications in real time.
  - **Blocker Resolution & Ripple Navigation:** Update blocker statuses (`data-action="case-resolve-blocker"`) and jump directly to What-If Ripple Analysis (`data-action="case-ripple-nav"`) when tasks have dependencies.
  - **Multi-Channel Communications:** Supports In-App, WhatsApp, Teams, and Telegram with acknowledgment toggles and visual clipboard confirmation badges.

### B. Smart Planning (Category B — Charlisa Tan)
- **Schedule Preferences Dialog:** Configure working hours, lunch break window, protected focus periods, daily hours limit, and working days (Monday–Friday).
- **Calendar-Aware Time Blocking:** Places flexible tasks around protected Outlook meetings, fixed repair appointments, and travel buffers (`prototype/js/smartSchedule.js`).
- **Daily & Weekly Schedule Review:** Generate a daily or Monday–Sunday draft around fictional protected commitments. Review warnings and unscheduled work, then choose **Accept Schedule** or **Discard Draft**. Accepted dates persist in the browser. Changes to planning inputs require regenerating a draft before acceptance.
- **Task Capture with Case Linking:** Create work orders (`taskCaptureDialog.js`) with manual priority, category tags, optional case linking, and offset-aware Singapore deadlines.

### C. Operational Ripple Intelligence (Category D — Shamreen Rizmiya)
- **What-If Disruption Simulator:** Simulates unexpected operational emergencies (e.g. *Urgent Lift Incident in Block 214*, *Property Officer on Medical Leave*).
- **Cascade & Dependency Tracing:** Traverses multi-level task dependencies (`t103` → `t104` → `t112`), highlighting exposed statutory compliance deadlines and cumulative defect risks.
- **Three-Alternative Decision Matrix:**
  - *Alternative A (No Action):* Demonstrates the cost of inaction—quantifying SLA breaches and cascading stalls.
  - *Alternative B (Reschedule Lower-Impact Work):* Defers routine admin to protect safety and compliance cut-offs with the primary officer.
  - *Alternative C (Reassign Eligible Work):* Recommends qualified officers with available capacity, enforcing domain skill certifications (e.g. lift specialist validation) and flagging unqualified candidates.

### D. Approvals & Audit (Category G — Nann)
- **Hierarchical Manager Approval Queue:** Supervisors review schedule shifts and cross-officer reassignments. Approving an item updates the schedule and case ownership immediately; rejections require an operational rationale.
- **Self-Approval Guardrails:** Front-line officers cannot self-approve restricted requests.
- **Append-Only Audit Logging:** Records every approval, reassignment, and status transition with actor timestamps.
- **Simulated Multi-Channel Notifications:** Models notification adapters (In-App, Teams, WhatsApp) with privacy-safe payloads and deep links (`syncai://approval/...`) directing users to authenticated in-app reviews.

---

## 5. Role-Based Workflows & Portal Features

The prototype enforces role-aware views matching the full-stack system:

### 1. Team Member (`member` / `team_member` — Aisyah Rahman)
- Strictly isolated operational view: sees only own assigned tasks, cases, and commitments.
- My Tasks work orders with category tags, SLA deadline indicators, and case links.
- Case Action Centre showing own cases, Follow-Up Radar warnings, and closure checklists.
- Smart Planner daily proposal, Outlook calendar preview, and schedule preferences.
- Ask SyncAI assistant with role privacy guardrails (never exposes peer medical leave or calendars).

### 2. Estate Manager (`manager` — Jennifer Ong)
- Multi-zone operational oversight across Zones A, B, and C.
- Team-wide capacity, workload heatmaps, absence previews (MC/leave type only—no diagnosis data).
- Case Action Centre displaying team cases, cross-zone loose ends, and handover statuses.
- Full What-If Simulator and Ripple Intelligence scenario evaluation.
- Manager Approval Queue with decision actions and audit recording.

### 3. System Administrator (`admin` — Alex Tan / `TAN, ALEX`)
- Administrative governance portal (`AdminPortal.jsx` design alignment).
- People directory for approving new accounts, changing roles, or toggling statuses.
- Teams directory for structuring operational zones and assigning supervisors.
- 12-month activity audit log.
- **Data Minimisation Guardrail:** In accordance with Singapore Town Council data minimisation principles, administrators view system configuration, compliance metrics, and audit logs—with zero access to private officer calendars or operational resident casework.

### 4. Reviewer Preview Accounts (`pending` & `disabled` — David & Siti)
- Demonstrates account lifecycle gates before administrative approval or following suspension.
- Restricted access banner with quick-switch demo actions.

---

---

## 5. Scope Boundary Management (PS 12i Focus)

In accordance with the competition scope for **Challenge PS 12i (Smart Work Planner)**:
- **Primary Scope:** Capacity-aware scheduling, operational priority scoring, statutory deadline tracking, dependency tracing, What-If simulation, and simulated Microsoft Graph touchpoints.
- **Excluded Overlaps:** Irrelevant features from PS 12g (Cross-Council Operations Hub) and PS 12h (Project Portfolio Management & Gantt Trackers) have been completely removed from primary navigation, menus, and user journeys. (Any underlying math helpers are retained strictly for backward compatibility with automated unit tests).

---

## 6. Simulated vs. Real Breakdown

| Capability | Static Prototype Implementation | Full-Stack Production Implementation |
| :--- | :--- | :--- |
| **Authentication** | Simulated role selector (session-based) | Real Microsoft Entra ID (MSAL / OAuth2 PKCE) |
| **Outlook Calendar** | Fictional calendar events & deterministic conflict check | Real Microsoft Graph `/me/calendarView` API |
| **Microsoft To Do** | Fictional task lists & sync simulation | Real Microsoft Graph `/me/todo/lists` API |
| **AI Assistant** | Deterministic local rule engine with role-aware privacy | LLM-backed service with database context |
| **Database & Persistence** | Browser memory / `sessionStorage` with reset control | PostgreSQL database with Knex migrations |
| **Notifications** | In-app notification cards & simulated Teams cards | In-app socket alerts & proposed webhook delivery |
| **Audit Trails** | Client-side event logging in application state | Persistent append-only database audit log table |

---

## 7. Known Prototype Limitations

1. **Client-Side Storage:** Refreshing the page preserves session state in memory; clicking **"Reset Demo Data"** restores the default seeded state. State is not synced across disparate browsers.
2. **Deterministic Responses:** Ask SyncAI operates on deterministic intent matching against known operational patterns rather than a probabilistic generative AI model.
3. **Illustrative Thresholds:** All SLA response times, statutory inspection windows, and capacity quotas are illustrative configurations for Town Council scenarios, not official statutory regulations.
4. **Demonstration RBAC:** Role restrictions demonstrate operational access segregation within the browser UI. They are not cryptographically enforced security boundaries.

---

## 8. Five-Minute Case Action Centre V2 Demo Walkthrough

Follow this step-by-step walkthrough to demonstrate the Case Action Centre V2 capabilities during stakeholder evaluations:

1. **Start the Local Prototype Server:**
   ```bash
   python prototype/serve.py
   ```
   Open `http://localhost:8765/index.html` in your browser.

2. **Sign In as Property Officer Aisyah:**
   - In the top navigation bar, ensure the role selector is set to **Team Member (Aisyah)**.
   - Click **Case Action Centre** in the left sidebar navigation.

3. **Inspect the Redesigned Visual Hierarchy:**
   - Note **Section A (Page Header):** Gradient hero with summary counters.
   - Note **Section B (Operational Overview):** 4 equal-width metric cards (Open Cases, Loose Ends, Blocked Cases, Closure Warnings).
   - Note **Section C (Follow-Up Radar):** Review the attention items detected by the Loose-End Detector.

4. **Experience Evidence-Linked Explanations (#117):**
   - In the Follow-Up Radar, click **"Why was this flagged?"** on Case DEMO-001 (Outstanding Resident Callback).
   - Observe the slide-in drawer showing the **Evidence-Linked Explanation**:
     - Transparent Responsible AI disclosure banner.
     - 4-part breakdown: *1. Verified Recorded Facts*, *2. Rule-Based Deductions*, *3. Missing Information*, and *4. Proposed Recommendations*.
   - Click **"Inspect Source Record →"**: Watch the drawer transition to the verified source event, highlighting it with glowing animation. Click **"← Back to Explanation"** to return.

5. **Test V5 Interactive Drag-and-Drop Kanban & Workflow Transitions:**
   - In Section D, toggle to **Kanban Board View**.
   - **Real Drag-and-Drop:** Drag an open case card (e.g. `DEMO-004`) and drop it into the `In Progress` column. Watch the card immediately move, column count badges update, and shared state update with an audit log.
   - **Consequential Transition Confirmation:** Drag an in-progress case to `Awaiting External / Blocked`. A compact confirmation dialog appears prompting for an auditable hold reason. Enter a reason (e.g., *"Awaiting HDB contractor scaffolding permit"*) and confirm. Observe the case move and a new active blocker registered.
   - **Blocker Resolution Safeguard:** Attempt to drag the blocked case back into `In Progress`. The transition engine rejects the silent move, explaining the unresolved blocker.
   - **Accessible "Move to Stage" Alternative:** Click **"Move to Stage"** on any card or table row. Select `In Progress` from the accessible dialog. Notice the option to *"Resolve Blocker & Move to In Progress"*, which resolves the blocker and transitions the case in a single auditable action.
   - **Governance & Closure Readiness:** Attempt to move a case with incomplete checkpoints to `Closure Ready`; the engine blocks the move, explaining missing checklist items. For `Closed & Audited`, Team Members trigger a Manager Approval Request, while Estate Managers can close directly or provide an auditable exception reason.
   - **Reset Demo Data:** Click **"Reset Demo Data"** in the top bar or profile menu at any time to restore initial seeded states.

6. **Test the Case Communication Hub & Message-to-Task Drafting (#076):**
   - Click **Journey** on Case DEMO-001 to open the drawer, then select the **Communications** tab.
   - Filter messages by channel (`In-App`, `WhatsApp`, `Teams`).
   - Click **"Log Update"** to simulate recording a phone call or resident message into the case timeline.
   - Click **"Generate Draft"** to synthesize a contextual resident reply, then click **"Copy to Clipboard"**.
   - Under **Message-to-Task Drafting (#076)**, click **"Sample: Contractor Access"**, then click **"Extract Task Draft"**. Notice the deterministic extraction of case number, priority, and deadline. Click **"Confirm & Create Task in Smart Planner"** to persist it into shared state.

7. **Test Actionable In-App Notifications (#071):**
   - Look at the top portal header: click the **Notification Bell** icon.
   - Review unread operational alerts with case links. Click **"View Case →"** on any notification to jump directly into that case workspace.
   - Click **"Mark all read"** to clear pending badges.

8. **Test Evidence Attachments & Manager Verification (#027):**
   - Open Case DEMO-001 or DEMO-004 in Case Action Centre and switch to the **Evidence & Docs** tab.
   - Inspect existing evidence attachments with complete metadata (file type badge, file size, uploading officer, verification status).
   - In the **Upload Supporting Evidence** form, test real-time validation: try submitting without a title or with a file exceeding 5MB.
   - Upload a sample demo document (e.g. `BCA Notice of Completion`) and observe it added as `Pending Review`.
   - Switch role to **Estate Manager (Jennifer)**: click **"Verify"** to mark the evidence as verified, or **"Reject"** to supply an auditable rejection reason ($\ge 4$ characters).

9. **Test Assignee History & Task Change Comparison (#024 + #029):**
   - Switch to the **History & Changes** tab on Case DEMO-001.
   - Review the **Assignee History** log showing previous reassignments, requested by, approved by, and audit timestamps. Cases without reassignments show the clean empty state: `"No previous reassignment recorded."`
   - Review the **Task & Case Change Comparison** grid: inspect before-and-after snapshots comparing previous values against newly applied attributes, requesting actors, and manager approval notes.
   - Trigger a reassignment request from Officer Aisyah to Officer Marcus; switch to Manager Jennifer and approve the reassignment in the Approval Queue. Return to the case drawer to verify synchronized ownership across the case and all linked tasks in shared state.

10. **Inspect the Structured Human-Readable AI Case Brief:**
    - Switch to the **AI Case Brief** tab in Case DEMO-001.
    - Experience the human-readable card layout: Case Overview with dynamically derived officer zone (`Zone A`), Executive Summary, Work Completed, Outstanding Loose Ends, Next Actions, Statutory Readiness Check, and Supporting Records links.
    - Note the transparent **Responsible AI Disclosures** panel detailing deterministic rule generation and missing information disclosures.
    - Click **"Copy Case Brief"** to verify that clean plaintext is copied to clipboard seamlessly.

11. **Test Role Governance & Data Minimisation:**
    - Use the top role dropdown to switch to **Admin (Alex Tan)**.
    - Open **Case Action Centre**: notice the view switches to **Operational Governance Mode** showing aggregate SLA compliance rules without exposing private resident casework.
    - Switch back to **Team Member (Aisyah)** to resume operations.

---

## 9. Verification & Test Suite

The prototype includes an automated regression test suite ensuring business logic, scheduling invariants, ripple intelligence, role boundaries, responsive UX, and Case Action Centre workflows function correctly in Node.js:

```bash
# Run all 148 automated prototype tests across 16 suites
node --test "prototype/tests/*.test.mjs"
```

### Test Coverage Summary (148 tests passing across 16 suites):
- `category-c-v7.test.mjs` (17 tests): Validates Category C V7 Task Visibility capabilities: Smart Deadline Countdown (#021) with Singapore SGT local time and deterministic clock injection; Assignee History & Task Change Comparison (#024 + #029) with empty state, snapshot tracking, and linked task owner synchronization upon manager approval; Evidence Attachments & Verification (#027) with rich metadata, client upload validation ($\le 5\text{MB}$), and manager-only verification/rejection with auditable reasons; Human-Readable AI Case Brief with dynamic officer zone derivation, missing data fallbacks, and clipboard compatibility; guided Move Stage modal; 7-step readable Manager Closure Sign-Off modal; and CSS selector/media query integrity.
- `case-modal-controls.test.mjs` (3 tests): Validates case workspace DOM event delegation, visible close button layout at compact widths, and reassignment dialog transition.
- `case-kanban-workflow.test.mjs` (11 tests): Validates Case Action Centre V5 functional drag-and-drop workflow engine (`requestCaseStageTransition`), status transitions across all 5 stages, active blocker constraints, hold reason validation, closure readiness checklist enforcement, manager closure exceptions and approval requests, closed case reopen restrictions, role-based transition access segregation, deterministic classification without duplication, state persistence and resetDemo, and accessible Move to Stage / Transition confirmation modal rendering.
- `case-action-centre-v4.test.mjs` (6 tests): Validates V4 hero header structure, compact Singapore deadline timestamps, Follow-Up Radar internal card layout (Header, Explanation, Evidence, Actions), 2-row filter toolbar, case table with responsive mobile card data-labels, and CSS media queries.
- `case-modal-interaction.test.mjs` (8 tests): Validates high-contrast metric CSS tokens, timeline notes logging with validation, follow-up outcome resolution, blocker resolution, closure approval workflow, multi-channel communications, AI Case Brief missing information disclosures, and modal dialog accessibility attributes.
- `case-action-centre-v3.test.mjs` (7 tests): Validates UI refinement, header single summary presentation, drawer redesign, user-friendly terminology, notification centre, and role consistency.
- `case-action-centre-v2.test.mjs` (7 tests): Validates single-column Kanban classification, 4-part Evidence-Linked Explanations, role-based visibility, Actionable Notifications (#071), Case Communication Hub, and Message-to-Task Drafting (#076).
- `cases.test.mjs` (5 tests): Validates documented EMS priority order, recorded deadlines, role-based case access, task-case links, and browser persistence after day rollover.
- `category-c-cases.test.mjs` (5 tests): Validates Category C Case Action Centre role-aware views, 8-rule deterministic Loose-End Detector, Closure Readiness checker, simulated AI Case Brief generator, and reassignment approval workflow.
- `smart-planning.test.mjs` (8 tests): Validates Category B calendar time-blocking around meetings/appointments, schedule preferences validation & persistence, and weekly planning across Monday–Sunday.
- `task-capture.test.mjs` (6 tests): Validates Category B task capture with manual priority and offset-aware deadlines, category/tag persistence, and Singapore due date filters.
- `rules.test.mjs` (20 tests): Validates 4-tier client priority scoring, safety non-negotiables, repeat complaint zero-weighting, and capacity checks.
- `ripple.test.mjs` (20 tests): Validates Category D dependency cascade propagation, downstream impact scoring, and 3-alternative generation with skill certification matching.
- `client-requirements.test.mjs` (17 tests): Verifies appointment window protection, statutory deadline enforcement, self-approval prevention, and What-If state isolation.
- `rebuild-user-journey.test.mjs` (7 tests): Comprehensive suite testing role switching, simulated M365 touchpoints, admin user governance, manager approval workflows, and Ask SyncAI privacy guardrails.
- `status-codes.test.mjs` (1 test): Validates status codes dictionary, unique keys, and query matching.

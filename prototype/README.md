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
- **Dual Visual Themes:** Fully supports Fluent UI Light and Dark modes with responsive desktop, tablet, and mobile layouts.

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

### A. Task Visibility & Case Action Centre V3 (Category C — Felicia Tan)
Located in the primary navigation (`Overview` → `Ask SyncAI` → `My Tasks` → `Case Action Centre` → `My Plan`):

- **Modern Visual Hierarchy & Layout Redesign (V3):**
  - **Section A — Page Header:** Consistent navy/blue gradient hero with title, role badge (`Manager Workspace` / `Property Officer Workspace`), value-focused description, and clear `Fictional Demo Environment` indicator. Clean and compact without duplicate metric counts.
  - **Section B — Operational Overview:** Four equal-width, interactive metric cards (**Open Cases**, **Outstanding Follow-Ups**, **Blocked Cases**, **Ready to Close?**) with aligned icons, primary values, and clickable filters that immediately filter cases.
  - **Section C — Follow-Up Radar:** High-priority banner with filter tabs (`All`, `Critical`, `Resident Callbacks`, `Contractor`), aligned action cards, and prominent **"Why was this flagged?"** and **"Take Action"** triggers.
  - **Section D — Operational Cases:** Real-time search by case number, title, estate, or resident with accessible labels, Estate and Urgency filters, and a clear **"Reset filters"** button. Proportional table column widths, non-wrapping Singapore deadline timestamps, and single primary **"View Case"** action buttons.
  - **Section E — Case Detail Drawer (V3 Redesign):**
    - *Header:* Monospace case number, primary status badge, location/estate, assigned officer (`Assigned: Aisyah Rahman`), case title, and a clearly visible, accessible **'X' close button** (`drawer-close-btn`).
    - *Responsive Wrapped Navigation:* Replaces overflowing horizontal tabs with wrapped segmented pills (`Timeline & Notes`, `Outstanding Follow-Ups`, `Blockers`, `Ready to Close?`, `Communications`, `AI Case Brief`), eliminating horizontal scrollbars and off-screen tabs.
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
  - Deterministic synthesized case brief with one-click copy to clipboard.

### B. Smart Planning (Category B — Charlisa Tan)
- **Schedule Preferences Dialog:** Configure working hours, lunch break window, protected focus periods, daily hours limit, and working days (Monday–Friday).
- **Calendar-Aware Time Blocking:** Places flexible tasks around protected Outlook meetings, fixed repair appointments, and travel buffers (`prototype/js/smartSchedule.js`).
- **Daily & Weekly Plan Generation:** Visual timeline of proposed time blocks for the day, and a weekly planning grid balancing workloads across Monday–Sunday without task duplication.
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

5. **Verify Single-Column Kanban Classification (No Duplication):**
   - Scroll to Section D and toggle the view switcher to **Kanban Board View** (columns icon).
   - Note that Case DEMO-001 (Ceiling seepage at Blk 211) appears **strictly once** under `Awaiting External / Blocked` with a High Priority badge and Blocked tag, and is **not duplicated** in `In Progress`.

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

8. **Test Role Governance & Data Minimisation:**
   - Use the top role dropdown to switch to **Admin (Alex Tan)**.
   - Open **Case Action Centre**: notice the view switches to **Operational Governance Mode** showing aggregate SLA compliance rules without exposing private resident casework.
   - Switch back to **Team Member (Aisyah)** to resume operations.

---

## 9. Verification & Test Suite

The prototype includes an automated regression test suite ensuring business logic, scheduling invariants, ripple intelligence, role boundaries, and Case Action Centre V2 workflows function correctly in Node.js:

```bash
# Run all 95 automated prototype tests across 9 suites
node --test "prototype/tests/*.test.mjs"
```

### Test Coverage Summary (95 tests passing across 9 suites):
- `case-action-centre-v2.test.mjs` (7 tests): Validates single-column Kanban classification, 4-part Evidence-Linked Explanations, role-based visibility, Actionable Notifications (#071), Case Communication Hub, and Message-to-Task Drafting (#076).
- `cases.test.mjs` (5 tests): Validates documented EMS priority order, recorded deadlines, role-based case access, task-case links, and browser persistence after day rollover.
- `category-c-cases.test.mjs` (5 tests): Validates Category C Case Action Centre role-aware views, 8-rule deterministic Loose-End Detector, Closure Readiness checker, simulated AI Case Brief generator, and reassignment approval workflow.
- `smart-planning.test.mjs` (8 tests): Validates Category B calendar time-blocking around meetings/appointments, schedule preferences validation & persistence, and weekly planning across Monday–Sunday.
- `task-capture.test.mjs` (6 tests): Validates Category B task capture with manual priority and offset-aware deadlines, category/tag persistence, and Singapore due date filters.
- `rules.test.mjs` (20 tests): Validates 4-tier client priority scoring, safety non-negotiables, repeat complaint zero-weighting, and capacity checks.
- `ripple.test.mjs` (20 tests): Validates Category D dependency cascade propagation, downstream impact scoring, and 3-alternative generation with skill certification matching.
- `client-requirements.test.mjs` (17 tests): Verifies appointment window protection, statutory deadline enforcement, self-approval prevention, and What-If state isolation.
- `rebuild-user-journey.test.mjs` (7 tests): Comprehensive suite testing role switching, simulated M365 touchpoints, admin user governance, manager approval workflows, and Ask SyncAI privacy guardrails.

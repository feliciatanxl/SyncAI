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

### A. Task Visibility & Case Action Centre (Category C — Felicia Tan)
Located in the primary navigation (`Overview` → `Ask SyncAI` → `My Tasks` → `Case Action Centre` → `My Plan`):
- **Interactive Case Workspace:** Search cases by number, title, block, or resident name. Filter by estate zone and urgency, or toggle between **List view** and **Kanban board** grouped by operational lifecycle stages (`Open`, `In Progress`, `Awaiting External / Blocked`, `Closure Ready`, `Closed`).
- **Operational Loose-End Detector ("Follow-Up Radar"):** A signature deterministic engine identifying hidden operational loose ends before tasks breach SLAs:
  1. *Outstanding Resident Follow-Up:* Promised callbacks unrecorded after site visits.
  2. *Pending Contractor Confirmation:* Issued work orders awaiting contractor acknowledgment.
  3. *Inspection Without Documented Outcome:* Completed inspection blocks lacking recorded results.
  4. *Stale Case Alert:* Cases without meaningful timeline updates within threshold days.
  5. *Missing Supporting Evidence:* Completed repairs lacking mandatory photos or notices.
  6. *Premature Closure Check:* Cases marked ready while required checkpoints remain open.
  7. *Pending Reassignment Handover:* Assignment changes without receiving officer sign-off.
  8. *Unconfirmed Repair Appointment:* Scheduled resident visits without confirmed access.
- **Case Journey Drawer:** Inspect full chronological event timelines (reports, site checks, contractor milestones, resident contacts, manager approvals) and prerequisite checkpoint verifications.
- **Closure Readiness Checker:** Multi-checkpoint evaluation preventing premature case closure.
- **Evidence-Linked AI Case Brief:** Deterministic summary generator with one-click clipboard copying.
- **Case Reassignment Workflow:** Reassignment requests route directly to the Manager Approvals queue.

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

## 8. Verification & Test Suite

The prototype includes an automated regression test suite ensuring business logic, scheduling invariants, ripple intelligence, and role boundaries function correctly in Node.js:

```bash
# Run all 88 automated prototype tests across 8 suites
node --test "prototype/tests/*.test.mjs"
```

### Test Coverage Summary (88 tests passing across 8 suites):
- `cases.test.mjs` (5 tests): Validates documented EMS priority order, recorded deadlines, role-based case access, task-case links, and browser persistence after day rollover.
- `category-c-cases.test.mjs` (5 tests): Validates Category C Case Action Centre role-aware views, 8-rule deterministic Loose-End Detector, Closure Readiness checker, simulated AI Case Brief generator, and reassignment approval workflow.
- `smart-planning.test.mjs` (8 tests): Validates Category B calendar time-blocking around meetings/appointments, schedule preferences validation & persistence, and weekly planning across Monday–Sunday.
- `task-capture.test.mjs` (6 tests): Validates Category B task capture with manual priority and offset-aware deadlines, category/tag persistence, and Singapore due date filters.
- `rules.test.mjs` (20 tests): Validates 4-tier client priority scoring, safety non-negotiables, repeat complaint zero-weighting, and capacity checks.
- `ripple.test.mjs` (20 tests): Validates Category D dependency cascade propagation, downstream impact scoring, and 3-alternative generation with skill certification matching.
- `client-requirements.test.mjs` (17 tests): Verifies appointment window protection, statutory deadline enforcement, self-approval prevention, and What-If state isolation.
- `rebuild-user-journey.test.mjs` (7 tests): Comprehensive suite testing role switching, simulated M365 touchpoints, admin user governance, manager approval workflows, and Ask SyncAI privacy guardrails.

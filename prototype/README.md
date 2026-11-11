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

## 3. Simulated Microsoft Sign-In Bypass

In compliance with the prototype design constraints, **Microsoft sign-in is 100% simulated**:
- **No External Connection:** Clicking **"Sign in with Microsoft"** does not contact Microsoft Entra ID (Azure AD), does not issue OAuth/OIDC tokens, and never prompts for real passwords or tenant permissions.
- **Interactive Role Chooser:** Clicking the sign-in button opens a demo role modal allowing immediate entry as:
  1. **Team Member (Property Officer):** `officer@syncai.demo` (Northvale Estate Office)
  2. **Estate Manager:** `manager@syncai.demo` (Northvale Estate Office)
  3. **System Administrator:** `admin@syncai.demo` (IT & Operations Governance)
  4. **Pending Account (Reviewer Preview):** `pending@syncai.demo`
  5. **Disabled Account (Reviewer Preview):** `disabled@syncai.demo`
- **Quick Role Switcher:** Once inside the portal, you can switch between roles at any time using the role pill dropdown in the top navigation bar or the Microsoft 365 Account Menu popover.

---

## 4. Role-Based Workflows & Portal Features

The prototype implements the same three primary roles as the full-stack system:

### 1. Team Member (`member` / `team_member`)
- **Overview:** Personal task countdown, daily Outlook calendar glance, setup progress checklist, and quick links to planning.
- **My Tasks:** Filterable and searchable operational task list with SLA countdown badges, priority scores, and task inspection modals. Includes a simulated **Microsoft To Do integration card** with fictional synchronized lists (`Estate Work`, `High Priority`, `Maintenance`).
- **My Plan:** Day and week interactive schedule views with fixed working hours (08:30–17:30) and lunch break boundaries (12:00–13:00). Features a simulated **Outlook Calendar card** displaying synchronized appointments and conflict detection.
- **Ask SyncAI:** Context-aware assistant providing deterministic answers to operational queries (e.g., *"What should I work on first?"*, *"Can I finish everything today?"*). Strictly respects privacy boundaries—never reveals peer calendar or medical leave details.
- **How SyncAI Decides:** Interactive documentation explaining the 4-factor scoring rubric and Responsible AI governance principles.
- **Settings:** Interface preferences (font size, language, theme appearance), simulated Graph connection tester, and demo data reset.

### 2. Estate Manager (`manager`)
All Team Member capabilities, plus managerial oversight:
- **Manager Overview:** Team-wide task health, statutory compliance countdowns, pending schedule change approvals, and team capacity summaries.
- **My Team:** Comprehensive workload dashboard displaying officer availability, utilization heatmaps, assigned task counts, and absence previews (MC/leave type only—no sensitive diagnosis data).
- **Manager Approval Queue:** Review schedule-change requests and reassignment proposals submitted by officers. Approving an item updates the operational schedule and logs an audit record; rejections require an explanation.
- **Operational Ripple Intelligence (What-If Simulator):** Test disruption scenarios (e.g., *Urgent Lift Incident in Block 104*, *Property Officer on Medical Leave*). Generates a multi-level downstream dependency cascade and evaluates **three side-by-side alternatives**:
  - **Alternative A (No Action):** Quantifies SLA breaches and secondary inspection stalls.
  - **Alternative B (Reschedule Lower-Impact Work):** Defers routine admin to maintain safety and compliance milestones.
  - **Alternative C (Reassign Eligible Work):** Suggests reassigning high-priority items to qualified officers with available capacity.
- **Ask SyncAI:** Extended managerial intelligence answering team-wide inquiries (e.g., *"Which alternative is most feasible?"*, *"What approvals are pending?"*).

### 3. System Administrator (`admin`)
Dedicated administrative governance portal matching `AdminPortal.jsx`:
- **Admin Overview:** Tenant statistics, active user counts, pending access requests, and quick administrative actions.
- **People Directory:** Fictional user management with role assignment (`admin`, `manager`, `member`), account approvals, and disable/restore controls.
- **Teams Directory:** Town Council team structuring, assigning designated Estate Managers and managing officer assignments.
- **Activity Log:** Comprehensive, privacy-sanitized operational audit trail recording schedule changes, role updates, and system decisions.
- **Governance Guardrails:** Admin cannot view private officer calendar appointments, preserving workplace privacy.

### 4. Reviewer Preview Accounts (`pending` & `disabled`)
Allows reviewers to evaluate non-standard account states:
- **Pending Approval:** Shows an onboarding hold screen with status details, access explanation, and simulated approval verification.
- **Account Disabled:** Displays an IT security notice instructing the user to contact the system administrator.

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
# Run all automated prototype tests
node prototype/tests/rules.test.mjs
node prototype/tests/ripple.test.mjs
node prototype/tests/client-requirements.test.mjs
node prototype/tests/status-codes.test.mjs
node prototype/tests/rebuild-user-journey.test.mjs
```

### Test Coverage Summary:
- `cases.test.mjs`: Validates Category C Case Action Centre, role-based case isolation, 8-rule deterministic Loose-End Detector, Case Journey timeline, Closure Readiness checker, AI Case Brief generator, and cross-workstream Approvals & Smart Planner sync.
- `rules.test.mjs`: Validates 4-tier client priority scoring, safety non-negotiables, repeat complaint zero-weighting, and capacity checks.
- `ripple.test.mjs`: Tests dependency cascade propagation, downstream impact scoring, and 3-alternative generation.
- `client-requirements.test.mjs`: Verifies appointment window protection, statutory deadline enforcement, and self-approval prevention.
- `status-codes.test.mjs`: Checks task state transitions and validation constraints.
- `rebuild-user-journey.test.mjs`: Comprehensive suite testing role switching, simulated M365 touchpoints, admin user governance, manager approval workflows, and Ask SyncAI privacy guardrails.

# SyncAI Client

The production React frontend for **SyncAI — Smart Work Planner**. Built with React 19, Vite, Microsoft Fluent UI components, MSAL for Microsoft Entra ID authentication, and Vitest. Communicates with the Node.js + Express API in [`server/`](../server/README.md).

---

## Getting Started

### Prerequisites

- **Node.js 22 or later**
- Running Express backend on port 3000 (see [`server/README.md`](../server/README.md))

### Installation & Development

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The development server starts at <http://localhost:5173> and automatically proxies `/api` requests to the Express server on `http://localhost:3000`.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Builds optimized production assets into `dist/`. |
| `npm run preview` | Locally serves the built production bundle. |
| `npm run lint` | Runs code quality checks with Oxlint. |
| `npm test` | Runs the Vitest automated test suite (16 tests across 4 suites). |

---

## Microsoft Entra ID Authentication

SyncAI uses passwordless, single-tenant or multi-tenant authentication via Microsoft Entra ID (OIDC / OAuth 2.0 PKCE flow for Single Page Applications).

### App Registration in Microsoft Azure Portal

1. Open **Microsoft Entra ID → App registrations → New registration**:
   - **Supported account types:** Select *Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)*, or restrict to your specific Town Council tenant.
   - **Redirect URI:** Select platform *Single-page application (SPA)*, set to `http://localhost:5173/login`. Add your production HTTPS redirect URI upon deployment.
2. Under **Expose an API**:
   - Set Application ID URI to `api://<client-id>`.
   - Add a scope named `access_as_user` with *Admins and users* consent enabled. The Express backend strictly requires this scope.
3. Configure `client/.env`:
   ```bash
   VITE_ENTRA_CLIENT_ID=<Your Azure Application (client) ID>
   VITE_ENTRA_TENANT_ID=common
   # Optional overrides:
   # VITE_API_BASE_URL=http://localhost:3000/api
   # VITE_API_SCOPE=api://<client-id>/access_as_user
   ```

> **Security Requirement:** Never place client secrets or backend credentials in `client/.env`. All `VITE_` variables are bundled into client-side JavaScript and publicly visible.

---

## Microsoft Graph & Outlook Calendar (read-only)

Active members and managers see **My Outlook Calendar** inside **My Plan**: their own Outlook events for the next 7 days, read live from Microsoft Graph in the browser. Admins get a **Microsoft Graph connection** test at the bottom of **Settings** (profile only). Pending and disabled accounts get neither.

| Delegated scope | Requested when | Used for |
| :--- | :--- | :--- |
| `User.Read` | Sign-in (already the case) | `GET /v1.0/me` connection status and profile, profile photo |
| `Calendars.Read` | The person clicks **Connect calendar** | `GET /v1.0/me/calendarView` (read-only) |
| `Tasks.Read` | The person clicks **Connect Microsoft To Do** | `GET /v1.0/me/todo/lists`, `GET /v1.0/me/todo/lists/{id}/tasks` (read-only) |

- **Incremental consent:** sign-in is unchanged. `getGraphToken()` in `src/auth/msal.js` tries `acquireTokenSilent()` and only sends the person to Microsoft's consent screen from a button click. No other Graph scope registered on the app is requested, and nothing asks for `.default` or any write scope.
- **Two kinds of token:** `getApiToken()` (scope `api://<client-id>/access_as_user`) is the only token sent to the Express API. `getGraphToken()` tokens go only to `https://graph.microsoft.com` (`src/lib/graph.js`). They are never interchangeable, stored by SyncAI, or logged.
- **No extra configuration:** the existing `VITE_ENTRA_*` variables are enough. The app registration must list `Calendars.Read` under *API permissions → Microsoft Graph → Delegated*. Tenant-wide admin consent is not needed unless your tenant blocks user consent.
- **What SyncAI reads:** subject, start, end, all-day flag, show-as (busy, tentative, away, free) and location. `Calendars.Read` would also allow body, attendees and attachments, but SyncAI never requests those fields. It cannot create, change or delete events.
- **Timezones:** events are requested in UTC and displayed in the browser's timezone. All-day events keep their calendar date.
- **Account compatibility:** needs a work or school account with an Exchange Online mailbox. Guest accounts, and personal Microsoft accounts without an Outlook.com mailbox, get a clear "no mailbox" message. A tenant that disables user consent shows the permission message until an administrator approves the scope.
- **Access control limit:** the calendar only renders after the Express API reports the account as `active`, but Graph calls go from the browser straight to Microsoft with the person's own delegated token, so the SyncAI backend does not sit in that path. A signed-in person can always read their own calendar from Microsoft directly; SyncAI never shows anyone else's.
- **Not the planner:** this is real calendar data shown next to the My Plan placeholder. SyncAI does not yet schedule around it, write to Outlook, or save events in PostgreSQL. Scheduling remains simulated in `/prototype` only.

### Microsoft To Do (read-only)

Active members and managers see **My Microsoft To Do** inside **My Tasks**: their own To Do lists, with a list picker, and each task's title, due date (if it has one), importance and status. Admins, pending and disabled accounts do not get it.

- **Consent is separate from the calendar.** `Tasks.Read` is requested only from **Connect Microsoft To Do**. Connecting the calendar does not connect To Do, and the app checks that Microsoft granted `Tasks.Read` before calling Graph.
- **Read-only.** SyncAI never requests `Tasks.ReadWrite` and never creates, edits, completes or deletes a To Do task. A task shows as completed only when Microsoft says it is.
- **Own tasks only.** Every call is to `/me/todo/...`. Managers see their own lists, never their team's.
- **Not SyncAI tasks.** These are external Microsoft tasks shown as they are. They are not stored in PostgreSQL, not scored, not scheduled, and not mixed with the fictional tasks in `/prototype`. The "Coming soon" card under the panel is still the future SyncAI task list.
- **Limits:** up to 500 tasks per list are loaded; due dates are shown in the browser's timezone; tasks with no due date are listed after dated ones; reminders, notes, steps and attachments are not shown. The app registration must list `Tasks.Read` under *API permissions → Microsoft Graph → Delegated*.

**Manual test:** sign in as an active member or manager → **My Tasks** → **Connect Microsoft To Do** → accept Microsoft's prompt (it should ask only to read your tasks) → you return to My Tasks with your default list shown. Switch lists with the picker, add a task in Microsoft To Do and press **Refresh**, and check that a task without a due date shows "No due date". Then confirm **My Plan** still shows your calendar, an admin has no My Tasks section, and a pending account has none either.

### Troubleshooting a 403

The error box shows what Microsoft answered: HTTP status, Graph error code, its message and a request ID. SyncAI checks that Microsoft granted `Calendars.Read` before calling Graph, and asks for consent again if it was left out, so a 403 that still appears is Microsoft refusing the request for that account or mailbox.

- **Why `Calendars.Read` and not `Calendars.ReadBasic`:** Microsoft documents `ReadBasic` for `calendarView`, but in testing a personal Outlook account got `403 ErrorAccessDenied` with it, while `Calendars.Read` returned 200 in Graph Explorer. `Calendars.Read` is still read-only.
- If a 403 persists, repeat the call in [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) with the same account and only `Calendars.Read` consented, and compare the error code.
- One refused request is sent once per page load. Only **Connect calendar** or **Refresh** sends another.

### Manual test

1. Start the server and client (see below) and sign in.
2. **Member / Manager (active):** open **My Plan** → **Connect calendar** → accept Microsoft's prompt (it should list only reading your calendar). You return to My Plan with the badge *Live from Microsoft Graph* and your events; **Refresh** reloads them. Managers: **Team** still works and shows no calendars.
3. **Cancel path:** click **Connect calendar** and cancel at Microsoft. You return unconnected, with nothing shown.
4. **Admin:** **Settings** → **Test connection** shows your Microsoft name and email. No My Plan or calendar appears.
5. **Pending / disabled:** sign in with such an account: there is no My Plan section.
6. To repeat the consent step, remove SyncAI at <https://myapps.microsoft.com> (work) or <https://account.live.com/consent/Manage> (personal), then sign in again.

---

## Application Structure & Routes

```
client/src/
├── auth/                 # MSAL configuration, token acquisition, profile photo hooks
├── components/           # Fluent UI layout, admin panels, team drawers, audit logs
├── lib/                  # API client, i18n, preferences, time helpers, HTTP status map
├── pages/                # Landing, Login, Workspace, AdminPortal, MemberPortal, Status
└── main.jsx              # Application bootstrap and theme providers
```

### Route Map

| Route | Protection | Page & Purpose |
| --- | --- | --- |
| `/` | Public | Public landing page introducing SyncAI, the EMS 12i challenge, and the flagship USP. |
| `/login` | Public | Microsoft Entra ID sign-in page with interactive MSAL redirect / popup trigger. |
| `/app` | Authenticated (`<RequireAuth>`) | Main portal workspace. Dispatches to `AdminPortal` (active admins) or `MemberPortal` (managers & team members). Unauthenticated users are redirected to `/login`. |
| `/status` | Public | Visual catalog and reference for all HTTP status codes (1xx–5xx). |
| `/status/:code` | Public | Dedicated error and status display pages (e.g. 403, 404, 500, 503). |

---

## Admin Portal

Accessed via `/app` by accounts with the `admin` role and `active` status ([`src/pages/AdminPortal.jsx`](src/pages/AdminPortal.jsx)):

- **Overview:** Live clock (accurate to the minute), greeting, active user statistics, administrative approval queue, copyable invite link, and the USP four-factor summary. The user list refreshes automatically every minute when active.
- **People:** Searchable, filterable directory of all registered users. Inspect exact last active timestamps, promote/demote between `admin`, `manager`, and `member` roles, and approve or disable accounts. Administrators cannot deactivate or demote themselves.
- **Teams (`src/components/TeamsAdmin.jsx`):** Accordion-based team directory. Create, rename, and delete teams (deletion is restricted to empty teams). Assign managers and team members using pickers that filter for eligible candidates. Role changes automatically remove invalid team assignments.
- **Activity Log (`src/components/ActivityLog.jsx`):** 12-month read-only audit log of access and governance events (first sign-ins, daily opens, approvals, role adjustments, team updates). Filterable by person and action type.
- **Data Minimisation & Privacy:** Administrators govern users, team placements, and compliance audit logs, with zero access to private officer calendars or operational resident casework.
- **How SyncAI Decides:** Overview of the four operational prioritisation factors and human-in-the-loop safeguards.
- **Settings:** Text size, language, and appearance settings.

---

## Member Portal

Accessed via `/app` by Property Officers (`member`) and Estate Managers (`manager`) ([`src/pages/MemberPortal.jsx`](src/pages/MemberPortal.jsx)):

- **Overview:** Displays current date and time, personalized greeting, account status (`active`, `pending`, or `disabled`), setup checklist, and current team/manager assignment.
- **Case Action Centre:** Active members and managers only. See [Case Action Centre](#case-action-centre-category-c) below.
- **My Team (`src/components/MyTeam.jsx`):** Visible to active managers. Displays team members across managed zones with active statuses and last-active indicators.
- **My Tasks & My Plan (Placeholders):** Informative placeholders marked *Coming soon*. Transparently explains what the upcoming task board and smart calendar will do once the planning engine is migrated to the backend API. Does not present fake or unpersisted tasks.
- **Ask SyncAI (Preview):** In-portal assistant answering questions from SyncAI's four-language help guide ([`src/lib/helpGuide.js`](src/lib/helpGuide.js)). Does not call external LLMs in the current phase; model integration is planned for later backend development.
- **How SyncAI Decides:** Explains the four priority factors (Safety, Mandatory Deadlines, Service Impact & Long-term Consequences, Feasibility).
- **Settings:** Personal accessibility and appearance preferences.

---

## Case Action Centre (Category C)

Task visibility and operational intelligence for property officers and estate managers, in [`src/features/cases/`](src/features/cases/). It ports the prototype's Case Action Centre (`prototype/js/pages/cases.js`, `state.js`) into React and Fluent UI. It doesn't import any prototype module or its localStorage state.

| File | Role |
| --- | --- |
| `caseLogic.js` | Pure domain rules: visibility, Kanban stage, Follow-Up Radar rules, closure readiness, stage-transition checks, deadline countdowns, case brief, summary counts |
| `caseService.js` | The only data access. One interface, two adapters: `demo` (in memory) and `api` (future endpoints below) |
| `demoCases.js` | Fictional demo cases only |
| `CaseActionCentre.jsx` | Page: header, summary cards, filters, list/Kanban, dialogs |
| `FollowUpRadar.jsx`, `CaseViews.jsx`, `CaseDetails.jsx`, `CaseStageDialog.jsx` | UI pieces |
| `caseStrings.js`, `cases.css` | Four-language UI text and styles (Fluent tokens) |

### Features
- **Shift view:** the banner shows the time, overdue cases and cases due in 24 h. *Next up* lists the three most pressing open cases (overdue, then due soon, then urgency) with one Start button each. Next up and the Follow-Up Radar start collapsed, with a count in a circle on each heading; click to open. The table and Kanban use the same priority order, and every row and card has an urgency colour stripe next to its text badge.
- **Summary cards:** open cases, outstanding follow-ups, blocked cases and cases ready to close. Each count comes from the same rules as the lists, and selecting a card filters the list.
- **Follow-Up Radar:** outstanding commitments (resident callback, contractor confirmation, inspection outcome, unconfirmed appointment, missing required evidence, no update in 48 h). Each item shows the case, the reason, the supporting record, the deadline and a recommended next step. It also has *View case*, *Why was this flagged?* and *Take action* buttons. The radar is labelled **rule-based**: it is not an AI model, and every finding asks for human review.
- **Operational cases:** search by ID or title, and filter by estate, urgency, stage or summary card. Switch between a list (a table that turns into cards on phones) and a five-column Kanban, where each case appears in exactly one column and an active blocker puts a case under *Blocked*.
- **Move stage dialog:** every target stage shows whether the move is allowed and why. It enforces blocker resolution, the closure checklist and required reasons. A member's closure becomes a request for a manager, and only a manager can reopen a closed case. Kanban cards can also be dragged between columns: a drop runs the same checks, moves straight away when nothing more is needed, and otherwise opens the dialog with that stage selected.
- **Case details:** timeline and progress notes, follow-ups with explanations, blockers, a closure checklist, evidence with verification status and missing-item indicators, history (before/after, actor, reason) with reassignment, communications (logged only; channels are labelled *simulated*), and a case brief. The brief is assembled by fixed templates from the case's own records and keeps facts, recommendations and missing information apart.

### Data: demo vs real
The SyncAI server has **no case endpoints yet**.
- `caseDataMode()` picks the adapter. `VITE_CASE_DATA=demo|api` wins; otherwise the Vite dev server uses `demo` and **production builds use `api`**.
- **Demo adapter:** fictional cases, with two of them assigned to the signed-in person. Changes live in memory for one page visit and are never saved. The page does not label them as demo data, since the same UI will show PostgreSQL data once the API exists. The sample cases are bundled but unreachable in a production build unless `VITE_CASE_DATA=demo` is set.
- **API adapter:** calls the endpoints below. Until they exist the page shows *Case service not available yet*. It **never falls back to demo cases**.

Future endpoints (each must enforce the role rules on the server):

| Method & path | Purpose |
| --- | --- |
| `GET /api/cases` | `{ cases, officers, managedOfficerIds }` for the caller's scope |
| `POST /api/cases/:id/notes` | `{ text }` progress note |
| `POST /api/cases/:id/communications` | `{ channel, direction, party, summary }` |
| `POST /api/cases/:id/stage` | `{ target, reason }`; re-checks `checkTransition`, creates a closure request for members |
| `POST /api/cases/:id/request/decision` | `{ approve, note }`; managers only |
| `POST /api/cases/:id/reassignment` | `{ toOfficerId, reason }`; request (member) or direct reassignment (manager) |

Each write returns the updated case. Every case keeps a stable `id` and `number`, plus `taskRefs` for linking to My Tasks, My Plan, Smart Planning, Ripple Intelligence and Approvals & Audit later. **None of those modules are connected yet.** Nothing here writes to Microsoft Graph.

### Role permissions (client side)
| Account | Case Action Centre |
| --- | --- |
| Active member | Own assigned cases: notes, communications, stage moves within the rules, closure and reassignment *requests* |
| Active manager | Cases of the teams they manage: everything above, plus approve/reject requests, close ready cases, reopen with a reason, and reassign |
| Admin | No access (admins manage accounts, not casework) |
| Pending / disabled | No access (section hidden) |

Hiding things in the browser is **not a security boundary**. The production API must apply the same visibility and transition rules (`visibleCases`, `checkTransition`) to every request.

### Manual test
1. Run `npm run dev` and sign in as an active member. *Case Action Centre* appears in the sidebar .
2. Check that the summary cards match the list, and that selecting a card filters it.
3. In the radar, open *Why was this flagged?* (it expands inline) and *Take action* (it opens the case on Follow-ups).
4. Search, use each filter, and switch between List and Kanban. Each case should appear in exactly one column.
5. Use *Move stage* on DEMO-001 → *In Progress*. It should be refused because of the active blocker. As a member, move DEMO-004 → *Closed & Audited*: a closure request is created, not a closure.
6. As a manager, approve the request in the case details, add a note, log a communication and reassign a case.
7. Check desktop, tablet (768px) and phone (375px) widths: the list becomes cards, the Kanban scrolls sideways and the dialogs fill the screen.
8. Sign in as an admin, pending or disabled account: there is no Case Action Centre.

---

## Accessibility & Localization (i18n)

### User Preferences & Accessibility

Settings are saved in local browser storage (`src/lib/preferences.jsx`) and take effect immediately:

- **Text Size:** Standard (100%), Large (112.5%), Extra Large (125%). Scales Fluent UI components, typography, tables, and buttons proportionally.
- **Appearance:** Light, Dark, or Match Device.
- **Localization:** 4 supported languages:
  - English
  - 中文 (Chinese)
  - Bahasa Melayu (Malay)
  - தமிழ் (Tamil)

Translations are statically mapped in [`src/lib/strings.js`](src/lib/strings.js) with zero third-party telemetry or cloud translation dependencies. Automated tests verify key parity and placeholder integrity across all 4 languages.

---

## Automated Tests

The client includes automated tests using Vitest:

```bash
npm test
```

Verified test coverage (16 tests across 4 test suites):
- `src/lib/helpGuide.test.js`: Help-guide question matching, fallback behavior, and multi-language answers.
- `src/lib/time.test.js`: Time formatting, greeting determinations, and relative date calculations.
- `src/lib/httpStatus.test.js`: HTTP status code catalog mapping and friendly user messaging.
- `src/features/cases/caseLogic.test.js`: Case visibility and role rules, single-column Kanban, Follow-Up Radar rules, deadline countdowns, closure readiness, stage transitions, case brief.
- `src/features/cases/caseService.test.js`: Demo/API mode selection, no fallback from the API to demo data, demo adapter isolation, scope checks, closure approval flow.
- `src/features/cases/CaseActionCentre.test.jsx`: Case details sections render (server-rendered), loading state, demo labelling, no access for admin/inactive accounts.
- `src/lib/strings.test.js`: Translation key parity and template variable validation across English, Chinese, Malay, and Tamil.

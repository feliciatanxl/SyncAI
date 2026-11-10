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
| `Calendars.ReadBasic` | The person clicks **Connect calendar** | `GET /v1.0/me/calendarView` |

- **Incremental consent:** sign-in is unchanged. `getGraphToken()` in `src/auth/msal.js` tries `acquireTokenSilent()` and only sends the person to Microsoft's consent screen from a button click. No other Graph scope registered on the app is requested, and nothing asks for `.default`, `Calendars.Read` or any write scope.
- **Two kinds of token:** `getApiToken()` (scope `api://<client-id>/access_as_user`) is the only token sent to the Express API. `getGraphToken()` tokens go only to `https://graph.microsoft.com` (`src/lib/graph.js`). They are never interchangeable, stored by SyncAI, or logged.
- **No extra configuration:** the existing `VITE_ENTRA_*` variables are enough. The app registration must list `Calendars.ReadBasic` under *API permissions → Microsoft Graph → Delegated*. Tenant-wide admin consent is not needed unless your tenant blocks user consent.
- **What `Calendars.ReadBasic` gives:** subject, start, end, all-day flag, show-as (busy, tentative, away, free) and location. Body, attendees and attachments are not available at this level and are not shown.
- **Timezones:** events are requested in UTC and displayed in the browser's timezone. All-day events keep their calendar date.
- **Account compatibility:** needs a work or school account with an Exchange Online mailbox. Guest accounts, and personal Microsoft accounts without an Outlook.com mailbox, get a clear "no mailbox" message. A tenant that disables user consent shows the permission message until an administrator approves the scope.
- **Access control limit:** the calendar only renders after the Express API reports the account as `active`, but Graph calls go from the browser straight to Microsoft with the person's own delegated token, so the SyncAI backend does not sit in that path. A signed-in person can always read their own calendar from Microsoft directly; SyncAI never shows anyone else's.
- **Not the planner:** this is real calendar data shown next to the My Plan placeholder. SyncAI does not yet schedule around it, write to Outlook, or save events in PostgreSQL. Scheduling remains simulated in `/prototype` only.

### Troubleshooting a 403

The error box shows what Microsoft answered: HTTP status, Graph error code, its message and a request ID. SyncAI checks that Microsoft granted `Calendars.ReadBasic` before calling Graph, and asks for consent again if it was left out, so a 403 that still appears is Microsoft refusing the request for that account or mailbox.

- `ErrorAccessDenied` on a personal account: Microsoft documents `Calendars.ReadBasic` as supported for personal accounts on `calendarView`, so first confirm the Graph call itself in [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) with the same account and only `Calendars.ReadBasic` consented.
- Optional diagnostic, only if you choose to: temporarily change `GRAPH_SCOPES.calendar` in `src/auth/msal.js` to `['Calendars.Read']` and reconnect. If that works where `ReadBasic` does not, the limit is on Microsoft's side for that account type. SyncAI never makes this change by itself.
- One refused request is sent once per page load. Only **Connect calendar** or **Refresh** sends another.

### Manual test

1. Start the server and client (see below) and sign in.
2. **Member / Manager (active):** open **My Plan** → **Connect calendar** → accept Microsoft's prompt (it should list only basic calendar access). You return to My Plan with the badge *Live from Microsoft Graph* and your events; **Refresh** reloads them. Managers: **Team** still works and shows no calendars.
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
- **How SyncAI Decides:** Overview of the four operational prioritisation factors and human-in-the-loop safeguards.
- **Settings:** Text size, language, and appearance settings.

---

## Member Portal

Accessed via `/app` by Property Officers (`member`) and Estate Managers (`manager`) ([`src/pages/MemberPortal.jsx`](src/pages/MemberPortal.jsx)):

- **Overview:** Displays current date and time, personalized greeting, account status (`active`, `pending`, or `disabled`), setup checklist, and current team/manager assignment.
- **My Team (`src/components/MyTeam.jsx`):** Visible to active managers. Displays team members across managed zones with active statuses and last-active indicators.
- **My Tasks & My Plan (Placeholders):** Informative placeholders marked *Coming soon*. Transparently explains what the upcoming task board and smart calendar will do once the planning engine is migrated to the backend API. Does not present fake or unpersisted tasks.
- **Ask SyncAI (Preview):** In-portal assistant answering questions from SyncAI's four-language help guide ([`src/lib/helpGuide.js`](src/lib/helpGuide.js)). Does not call external LLMs in the current phase; model integration is planned for later backend development.
- **How SyncAI Decides:** Explains the four priority factors (Safety, Mandatory Deadlines, Service Impact & Long-term Consequences, Feasibility).
- **Settings:** Personal accessibility and appearance preferences.

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
- `src/lib/strings.test.js`: Translation key parity and template variable validation across English, Chinese, Malay, and Tamil.

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

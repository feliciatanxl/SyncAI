# SyncAI client

The React frontend for SyncAI, the AI Smart Work Planner. Full JavaScript: React + Vite, Fluent UI, MSAL for Microsoft Entra ID sign-in, and Vitest. It talks to the Node.js + Express API in [`../server`](../server/README.md). See [docs/architecture.md](../docs/architecture.md).

## Run it

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5173> and forwards `/api` to the Express API on port 3000, so run the server too (see [server/README.md](../server/README.md)).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Run the Vitest tests |

## Microsoft sign-in

SyncAI has no usernames or passwords. People sign in with their own Microsoft account, personal (Outlook.com, Hotmail) or work and school, through Microsoft Entra ID.

1. In the Azure portal, open **Microsoft Entra ID → App registrations → New registration**:
   - **Supported account types:** *Any Entra ID Tenant + Personal Microsoft accounts*.
   - **Redirect URI:** platform *Single-page application (SPA)*, `http://localhost:5173/login`. Add your deployed address later.
2. Under **Expose an API**, accept the default Application ID URI (`api://<client-id>`) and add a scope named `access_as_user` that *Admins and users* can consent to. The Express API only accepts tokens for this scope.
3. Copy `.env.example` to `.env` (git-ignored) and set:

   ```
   VITE_ENTRA_CLIENT_ID=<Application (client) ID>
   VITE_ENTRA_TENANT_ID=common
   ```

   Leave `VITE_API_BASE_URL` and `VITE_API_SCOPE` empty to use the defaults. Never put secrets here: every `VITE_` value is visible in the browser.
4. Restart `npm run dev`. Vite only reads `.env` when it starts.

Until the IDs are set, the site still runs and the login page explains what is missing.

Signing out clears SyncAI's session and returns to the home page without Microsoft's sign-out page; the browser stays signed in to Microsoft itself.

## Pages

| Route | Page |
| --- | --- |
| `/` | Public website |
| `/login` | Sign in with Microsoft |
| `/app` | Signed-in area. Active admins get the admin portal; everyone else sees their access status and Settings. Sends you to `/login` if you are not signed in |
| `/status` | Reference of every HTTP status code the API may return |
| `/status/:code` | The designed page for one status, e.g. `/status/503` |
| anything else | 404 page |

## Admin portal

[`src/pages/AdminPortal.jsx`](src/pages/AdminPortal.jsx), for active admins:

| Section | What it does |
| --- | --- |
| **Overview** | Greeting, live counts, the approval queue (approve as team member or manager, or decline), an invite link to copy, and the USP with its four priority factors |
| **People** | Search and filter everyone who has signed in; change roles; approve, turn off or turn back on access. Turning off asks for confirmation, and you cannot change your own access |
| **How SyncAI decides** | The USP in plain language: the four factors and the human-approval principles |
| **Settings** | Text size, language and appearance (see below) |

The account menu at the top right shows the person's Microsoft profile photo (initials if there is none) and has *Manage your Microsoft account*, *Sign in with a different account* and *Sign out*. On tablets and phones the sidebar becomes a tab strip and the People table becomes cards.

## Settings and accessibility

Everyone signed in can open **Settings**: admins from the portal sidebar, everyone else from the Settings button in the header ([`src/components/SettingsPanel.jsx`](src/components/SettingsPanel.jsx)):

| Setting | Options |
| --- | --- |
| Text size | Standard, Large (112.5%), Extra large (125%). Scales the page and Fluent UI's own font sizes, so buttons, tables and menus grow too |
| Language | English, 中文 (Chinese), Bahasa Melayu, தமிழ் (Tamil) |
| Appearance | Match my device, Light, Dark |

Choices apply straight away and are saved in the browser's local storage on that device ([`src/lib/preferences.jsx`](src/lib/preferences.jsx)). If storage is blocked, the defaults are used. The page's `lang` attribute follows the chosen language, so screen readers pronounce it correctly.

## Translations

The portal's own words are fixed translations in [`src/lib/strings.js`](src/lib/strings.js): no translation service, no API key, and nothing is sent to a third party. Components read them with `const t = useT()` and `t('key', { name })` from [`src/lib/i18n.js`](src/lib/i18n.js). A missing string falls back to English.

- **Add or change text:** edit the key in all four languages. [`src/lib/strings.test.js`](src/lib/strings.test.js) fails if a language is missing a key or a `{placeholder}`.
- **Review:** the Chinese, Malay and Tamil text was machine-assisted and must be checked by a native speaker before release.
- **Not translated yet:** the public website, login and status pages, and text people type (names, emails, future task notes).

## API status codes

[`src/lib/httpStatus.js`](src/lib/httpStatus.js) lists every HTTP status code (1xx–5xx, including WebDAV and common non-standard ones) with its technical meaning and the plain-language message users see. It exports named constants such as `HTTP.NOT_FOUND`.

[`src/lib/api.js`](src/lib/api.js) wraps `fetch` for the API: it adds the Entra bearer token, returns parsed JSON (or `null` for 204), and throws an `ApiError` carrying the status, its friendly message and any server message. A network failure becomes status `0`.

```js
import { apiRequest, ApiError } from './lib/api.js'

try {
  const tasks = await apiRequest('/tasks', { getToken })
} catch (err) {
  if (err instanceof ApiError) showMessage(err.message) // e.g. 429 → "You're going a bit fast…"
}
```

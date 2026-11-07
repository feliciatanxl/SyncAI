# SyncAI client

The React frontend for SyncAI, the Smart Work Planner for EMS problem statement 12i. Full JavaScript: React + Vite, Fluent UI, MSAL for Microsoft Entra ID sign-in, and Vitest. It talks to the Node.js + Express API in `../server` over HTTPS. See [docs/architecture.md](../docs/architecture.md).

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Run the Vitest tests |

## Microsoft sign-in

SyncAI has no usernames or passwords. Users sign in with their organisation's Microsoft account through Microsoft Entra ID.

1. In the Entra admin centre, register an app with a **Single-page application** platform and the redirect URI `http://localhost:5173/login` (add your deployed URL later).
2. Copy `.env.example` to `.env.local` and fill in `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID`.
3. Restart `npm run dev`.

Until those are set, the site still runs and the login page explains what is missing.

## Pages

| Route | Page |
| --- | --- |
| `/` | Public website |
| `/login` | Sign in with Microsoft |
| `/app` | Signed-in workspace (placeholder; sends you to `/login` if you are not signed in) |
| `/status` | Reference of every HTTP status code the API may return |
| `/status/:code` | The designed page for one status, e.g. `/status/503` |
| anything else | 404 page |

## API status codes

[`src/lib/httpStatus.js`](src/lib/httpStatus.js) lists every HTTP status code (1xx–5xx, including WebDAV and common non-standard ones) with its technical meaning and the plain-language message officers see. It exports named constants such as `HTTP.NOT_FOUND`.

[`src/lib/api.js`](src/lib/api.js) wraps `fetch` for the API: it adds the Entra bearer token, returns parsed JSON (or `null` for 204), and throws an `ApiError` carrying the status, its friendly message and any server message. A network failure becomes status `0`.

```js
import { apiRequest, ApiError } from './lib/api.js'

try {
  const tasks = await apiRequest('/tasks', { getToken })
} catch (err) {
  if (err instanceof ApiError) showMessage(err.message) // e.g. 429 → "You're going a bit fast…"
}
```

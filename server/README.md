# SyncAI server

The Node.js + Express API for SyncAI. It checks each request's Microsoft Entra sign-in token, stores users in PostgreSQL, and enforces approvals and roles. Express 5, `pg`, `jose` and `express-rate-limit`; tests use Node's built-in test runner.

## Run it

Requires Node.js 22 or later and a PostgreSQL database (the team uses Railway).

```bash
npm install
npm run dev
```

The API runs at <http://localhost:3000/api>. On start-up it creates the `users` table if it doesn't exist.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with auto-restart on file changes |
| `npm start` | Start once |
| `npm test` | Run the API tests (no database needed) |

## Configuration

Copy [`.env.example`](.env.example) to `.env` (git-ignored) and fill it in:

| Variable | What to put |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. On Railway, use `DATABASE_PUBLIC_URL` when running on your laptop (needs **Add Public Access** on the database) and the internal `DATABASE_URL` once the API itself runs on Railway |
| `ENTRA_CLIENT_ID` | The app registration's Application (client) ID, the same value as `VITE_ENTRA_CLIENT_ID` in `client/.env` |
| `ADMIN_EMAILS` | Comma-separated emails. Only used while the database has no admin: the first listed person to sign in becomes an approved admin. After that it does nothing |
| `ALLOWED_TENANT_IDS` | Optional comma-separated Entra tenant IDs. Empty means any Microsoft account can sign in, but still starts as pending |
| `PORT` | Defaults to 3000 |

Never put these values in `client/.env` or any `VITE_` variable: those are visible to every visitor.

The app registration also needs **Expose an API** with an `access_as_user` scope (see [client/README.md](../client/README.md)).

## How access works

1. Every `/api` request except `/api/health` must carry a Microsoft access token for SyncAI's `access_as_user` scope. The server checks Microsoft's signature, the issuer for the account's own tenant, and the audience.
2. The person is looked up by tenant ID and object ID, not by email. On their first sign-in they are created as a **pending** member.
3. Pending and disabled people can only call `/api/me`, so the app can show them the right message.
4. Only active admins can list people and change roles or access. Admins cannot change their own role or access.
5. Each IP address is limited to 300 API requests per 15 minutes.

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /api/health` | Anyone | `{ ok, db }`, checks the database |
| `GET /api/me` | Any signed-in person | Their record: role (`admin`, `manager`, `member`) and status (`pending`, `active`, `disabled`) |
| `GET /api/users` | Active admins | Everyone who has signed in |
| `PATCH /api/users/:id` | Active admins | Change `role` and/or `status` |

## Before hosting

- Switch `DATABASE_URL` to Railway's internal address and remove the database's public access.
- Add CORS for the client's deployed address, and set Express's `trust proxy` so rate limiting sees each visitor's real IP.
- Add the deployed client's `/login` and `/` addresses as redirect URIs in the app registration.

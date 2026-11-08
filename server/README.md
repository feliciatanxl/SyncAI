# SyncAI server

The Node.js + Express API for SyncAI. It checks each request's Microsoft Entra sign-in token, stores users in PostgreSQL, enforces approvals and roles, and keeps an audit trail of sign-ins and access changes. Express 5, `pg`, `jose` and `express-rate-limit`; tests use Node's built-in test runner.

## Run it

Requires Node.js 22 or later and a PostgreSQL database (the team uses Railway).

```bash
npm install
npm run dev
```

The API runs at <http://localhost:3000/api>. On start-up it creates or updates its tables (`users`, `activity`) and deletes activity older than the retention period; that clean-up then runs daily.

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
| `ACTIVITY_RETENTION_DAYS` | How long activity records are kept. Defaults to 365 (12 months) |
| `PORT` | Defaults to 3000 |

Never put these values in `client/.env` or any `VITE_` variable: those are visible to every visitor.

The app registration also needs **Expose an API** with an `access_as_user` scope (see [client/README.md](../client/README.md)).

## How access works

1. Every `/api` request except `/api/health` must carry a Microsoft access token for SyncAI's `access_as_user` scope. The server checks Microsoft's signature, the issuer for the account's own tenant, and the audience.
2. The person is looked up by tenant ID and object ID, not by email. On their first sign-in they are created as a **pending** member.
3. Pending and disabled people can only call `/api/me`, so the app can show them the right message.
4. Only active admins can list people, change roles or access, and read the activity log. Admins cannot change their own role or access. Role and status are read from the database on every request, never from the browser.
5. Each IP address is limited to 300 API requests per 15 minutes.

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /api/health` | Anyone | `{ ok, db }`, checks the database |
| `GET /api/me` | Any signed-in person | Their own record: role (`admin`, `manager`, `member`), status (`pending`, `active`, `disabled`) and `lastActiveAt` |
| `POST /api/signin` | Any signed-in person | Called by the app straight after a Microsoft sign-in instead of `/api/me`: records `signed_in` and returns the same record |
| `POST /api/signout` | Any signed-in person | Records that they signed out (204). The app calls it before clearing the session and signs out anyway if it fails |
| `GET /api/users` | Active admins | Everyone who has signed in, with `lastActiveAt` |
| `PATCH /api/users/:id` | Active admins | Change `role` and/or `status`; the change and its audit record are saved together |
| `GET /api/teams` | Active admins | Every team with its managers and members |
| `POST /api/teams`, `PATCH /api/teams/:id`, `DELETE /api/teams/:id` | Active admins | Create or rename a team (`name`, 1–80 characters, unique ignoring case); delete it only when empty |
| `POST /api/teams/:id/members`, `DELETE /api/teams/:id/members/:userId` | Active admins | Add someone (`userId`, `kind`: `manager` or `member`) or remove them |
| `GET /api/my-teams` | Active managers | Only the teams they manage, with each member's name, email, status and last active |
| `GET /api/activity` | Active admins | The audit trail, newest first. Optional `person` (user id, matches who did it or who it was done to), `action`, `limit` (1–100, default 50) and `before` (for the next page) |

`GET /api/me` (and `POST /api/signin`) also return `teams`: the teams the person is in, as manager or member, with each team's managers.

## Teams

Admins arrange teams; managers see only the teams they lead; team members see only their own team and its managers. The rules live in [`src/teams.js`](src/teams.js), shared by the database code and the tests:

- Only people with the **Manager** role can manage a team, and only **Team members** can join one as members. Admins can't be in teams, so they never get a team-wide view of anyone's work.
- Each team member belongs to **one** team; a manager can lead several. (The `team_memberships` table allows more, and a partial unique index enforces one per member, so relaxing it later is a one-line change.)
- Turned-off accounts can't be added to a team.
- Changing someone's role removes team places that no longer fit (managers lose teams they led, team members leave the team they were in), recorded in the activity log in the same transaction.
- Team names are unique ignoring case, and a team can only be deleted when it's empty.
- Broken rules return a `code` (for example `member_has_team`) that the app translates.

## Activity log and personal data (PDPA)

SyncAI records only what accountability needs, not how people use the app:

| Recorded | When |
| --- | --- |
| `signed_up` | Someone signs in for the first time |
| `signed_in` | Someone signs in through Microsoft (every time; a first sign-in is recorded as `signed_up` instead) |
| `opened` | Someone opens SyncAI while still signed in from before, at most once per day (Singapore time) |
| `signed_out` | Someone clicks **Sign out**. Closing the tab or browser sends nothing, so this shows explicit sign-outs only; use Last active to see whether someone is still using SyncAI |
| `approved`, `declined` | An admin approves or declines a new person |
| `role_changed`, `status_changed` | An admin changes someone's role or status |
| `access_off`, `access_on` | An admin turns someone's access off or back on |
| `team_created`, `team_renamed`, `team_deleted` | An admin creates, renames or deletes a team |
| `team_member_added`, `team_member_removed` | An admin adds or removes someone, or a role change removes them |

- **Not recorded:** page views, clicks, time on screen, IP addresses or device details.
- **Last active:** `users.last_active_at` is updated at most every 5 minutes, so ordinary requests don't write to the database.
- **Append-only:** there is no API to edit or delete activity. Access changes and their records are written in one database transaction, so a change can't be saved without its record.
- **Retention:** records older than `ACTIVITY_RETENTION_DAYS` (12 months by default) are deleted automatically.
- **Who can see it:** active admins only.
- **Notice:** the sign-in page and Settings tell everyone that sign-ins, sign-outs and access changes are recorded and kept for 12 months.

## Security (OWASP Top 10)

| Risk | How the API handles it |
| --- | --- |
| A01 Broken access control | Every protected route checks a verified token, then the person's current status and role from the database. Admin-only routes reject pending, disabled and non-admin accounts. Admins can't change their own access. `/api/me` only returns the caller's own record. Tests cover each case |
| A02 Cryptographic failures | Tokens are verified against Microsoft's published signing keys (`jose`); unsigned or tampered tokens are rejected. Use HTTPS for any hosted deployment |
| A03 Injection | All SQL uses parameters. Query values (`limit`, `before`, `person`, `action`, `role`, `status`, ids) are checked against fixed formats or allow-lists before use |
| A04 Insecure design | New accounts start pending; admin is granted only to the first listed email while no admin exists; the audit trail is append-only |
| A05 Security misconfiguration | `X-Powered-By` removed; responses send `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a deny-all `Content-Security-Policy`. Errors never expose internals |
| A06 Vulnerable components | Few dependencies; run `npm audit` before each release |
| A07 Identification and authentication failures | No passwords: Microsoft Entra ID handles sign-in. The token's issuer must match its own tenant and its audience must be SyncAI; `ALLOWED_TENANT_IDS` can restrict tenants |
| A08 Software and data integrity failures | Audit records can't be edited or deleted through the app and are written in the same transaction as the change they describe |
| A09 Security logging and monitoring failures | The activity log records sign-ins, sign-outs and every access change with who, what, whom and when |
| A10 Server-side request forgery | The API never fetches URLs supplied by users |

Request bodies are limited to 100 KB, and malformed JSON gets a 400 rather than a server error.

## Before hosting

- Switch `DATABASE_URL` to Railway's internal address and remove the database's public access.
- Serve the API and client over HTTPS only.
- Add CORS for the client's deployed address, and set Express's `trust proxy` so rate limiting sees each visitor's real IP.
- Add the deployed client's `/login` and `/` addresses as redirect URIs in the app registration.
- Run `npm audit` in `server/` and `client/`.

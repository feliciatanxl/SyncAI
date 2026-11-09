# Contributing to SyncAI

Thanks for helping build **SyncAI — Smart Work Planner** (EM Services Challenge PS 12i). This guide explains our development workflow, standards, and review process.

By contributing, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md), and that your contributions are licensed under the [MIT License](LICENSE).

---

## Repository Layout

| Path | What it is |
| --- | --- |
| `prototype/` | Interactive HTML/CSS/JS design prototype with explainable rules, What-If simulator, and Operational Ripple Intelligence (no build step). See [`prototype/README.md`](prototype/README.md). |
| `client/` | Production React 19 + Vite frontend with Fluent UI, MSAL Microsoft Entra ID authentication, admin and member portals. See [`client/README.md`](client/README.md). |
| `server/` | Production Node.js 22 + Express 5 API with PostgreSQL, JWT token verification, RBAC, team management, and 12-month audit logging. See [`server/README.md`](server/README.md). |
| `docs/` | System architecture, demonstration scripts, and EMS requirement mappings. |
| `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` | Project governance and policies. |

The production application is implemented across `client/` and `server/`. Microsoft Entra ID authentication and PostgreSQL user/team management are implemented; Microsoft Graph, Power Automate, and backend task planning migration are planned for the upcoming phase. Reuse the prototype's validated business rules and layout patterns rather than copying client-side prototype code wholesale.

---

## Getting Started

1. Clone the repository and inspect the active branch:

   ```bash
   git checkout feature/frontend-design
   git pull
   git checkout -b feature/short-description
   ```

2. Run the static prototype locally:

   ```bash
   python prototype/serve.py
   ```

   Then open <http://localhost:8765>. `serve.py` disables caching so your edits show up on refresh.

3. Run the full-stack application (requires Node.js 22+ and PostgreSQL):

   ```bash
   # Terminal 1: Backend API
   cd server && npm install && npm run dev

   # Terminal 2: React Frontend
   cd client && npm install && npm run dev
   ```

   Then open <http://localhost:5173>.

---

## Automated Testing Expectations

Before opening a pull request, run the relevant automated test suites:

```bash
# 1. Prototype rules and ripple tests (Node.js built-in runner, 42 tests)
node --test "prototype/tests/*.test.mjs"

# 2. Client frontend tests (Vitest, 16 tests)
cd client && npm test

# 3. Server API and security tests (Node.js built-in runner, 21 tests)
cd server && npm test
```

All 79 automated tests across the repository must pass without errors or unhandled rejections.

---

## Branch Naming

| Prefix | Use for | Example |
| --- | --- | --- |
| `feature/` | New functionality | `feature/ripple-intelligence` |
| `fix/` | Bug fixes | `fix/planner-lunch-overlap` |
| `prototype/` | Design and prototype exploration | `prototype/simulator-alternatives` |
| `docs/` | Documentation updates | `docs/align-architecture-spec` |
| `chore/` | Tooling, config, and dependency updates | `chore/update-oxlint` |

---

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```text
feat(planner): skip buffers before back-to-back meetings
fix(tasks): keep search focus when filtering
docs: align documentation with ripple intelligence
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Keep the subject line concise (under 72 characters) and use the message body to explain *why* the change was made.

---

## Pull Requests

1. Keep each pull request focused on one logical change.
2. Provide a clear description of what changed, why, and how it was tested. Attach screenshots or screen recordings for UI changes.
3. Reference relevant issues or requirements where applicable.
4. Obtain at least **one approving review** from a team member before merging.
5. Merge using **squash and merge** into the target branch.
6. **Never force-push** to `main` or shared development branches.

### Review Checklist

- [ ] Works in current Chromium browsers (Edge and Chrome) at desktop and mobile widths
- [ ] No console errors or unhandled promise rejections
- [ ] Dynamic user-supplied text is properly escaped
- [ ] Accessible markup: labelled controls, keyboard navigable, visible focus states
- [ ] Status is never communicated by colour alone
- [ ] AI suggestions explain *why* and preserve human review (Accept / Modify / Dismiss)
- [ ] No secrets, real passwords, or personal resident data committed
- [ ] Automated tests pass across modified components
- [ ] Documentation updated if features, schemas, or endpoints changed

---

## Coding Standards

### General

- Prefer clear, domain-driven naming (`officer`, `task`, `plan`, `capacity`, `ripple`).
- Keep business logic (scoring, scheduling, ripple dependency analysis) deterministic and testable.
- Document *why*, not just *what*.

### Prototype (`prototype/`)

- Vanilla HTML5, CSS3, and JavaScript ES modules only. No external build steps or frameworks.
- Format with standard conventions: 2-space indentation, single quotes, semicolons.
- State updates must route through `update()` in `js/state.js` to ensure consistency.
- Render dynamic HTML using the `html` tagged template in `js/ui.js`.
- Use Fluent 2 CSS custom properties from `css/style.css`.
- Keep simulated intelligence deterministic (no random seeds in business logic).

### React Client (`client/`)

- React 19 functional components with hooks.
- Fluent UI components (`@fluentui/react-components`) for Microsoft 365 alignment.
- Translations in `src/lib/strings.js` across English, Chinese, Malay, and Tamil.
- Client `.env` files must never contain secrets or API keys.

### Express Server (`server/`)

- Modular Express 5 route handlers with parameterized SQL queries via `pg`.
- Cryptographic token verification via `jose`.
- Strict RBAC enforcement and append-only audit logging for security events.

---

## Data Protection & Responsible Disclosure

- **Fictional Data Only:** Use fictional sample data in code, tests, and documentation. Never commit real resident names, unit addresses, phone numbers, or NRIC/FIN numbers.
- **Privacy (PDPA):** Absences must be recorded only as generic categories (MC or leave), never medical details.
- **Security Vulnerabilities:** Do not file public issues for security vulnerabilities. Follow the reporting procedure in [SECURITY.md](SECURITY.md).

---

## Questions & Support

Reach out in the team chat or open a GitHub Discussion.

# Contributing to SyncAI

Thanks for helping build **SyncAI — Your Work. Your Time. In Sync.** This guide explains how we work together on the project.

By contributing, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md), and that your contributions are licensed under the [MIT License](LICENSE).

## Repository layout

| Path | What it is |
| --- | --- |
| `prototype/` | Interactive HTML/CSS/JS design prototype (no build step). See [`prototype/README.md`](prototype/README.md). |
| `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` | Project policies |

The production application (React frontend, Node.js/Express API, Microsoft Graph and Azure OpenAI integration) will be added in its own folders. Reuse the prototype's layouts, data model and business rules rather than copying its code wholesale.

## Getting started

1. Clone the repository and create a branch from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b feature/short-description
   ```

2. Run the prototype locally:

   ```bash
   python prototype/serve.py
   ```

   Then open <http://localhost:8765>. Any static server works, but `serve.py` disables caching so your edits show up on refresh.

## Branch naming

| Prefix | Use for |
| --- | --- |
| `feature/` | New functionality, for example `feature/outlook-sync` |
| `fix/` | Bug fixes, for example `fix/planner-lunch-overlap` |
| `prototype/` | Design and prototype exploration |
| `docs/` | Documentation only |
| `chore/` | Tooling, config and dependency updates |

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```text
feat(planner): skip buffers before back-to-back meetings
fix(tasks): keep search focus when filtering
docs: add what-if demo script
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Keep the subject under 72 characters and use the body to explain *why*.

## Pull requests

1. Keep each PR focused on one change. Smaller PRs get reviewed faster.
2. Fill in the description with what changed, why, and how you tested it. Add screenshots or a short screen recording for UI changes.
3. Link the related issue or task (for example `Closes #12`).
4. Get at least **one approving review** from another team member before merging.
5. Use **squash and merge** into `main`, and delete the branch afterwards.
6. Never force-push to `main`.

### Review checklist

- [ ] Works in the latest Edge and Chrome, at desktop and mobile widths
- [ ] No console errors
- [ ] Dynamic text is escaped (prototype: built with the `html` template from `js/ui.js`)
- [ ] Keyboard accessible, with visible focus and labelled controls
- [ ] Status is not shown by colour alone (use text or icons too)
- [ ] AI recommendations explain *why*, and offer Accept / Modify / Dismiss
- [ ] Anything that changes calendars or task owners requires human approval
- [ ] No secrets, tokens or real personal data in code, tests or screenshots
- [ ] Docs updated if behaviour changed

## Coding standards

### General

- Prefer clear, readable code over clever code. Name things after the domain (officer, task, plan, capacity).
- Keep functions small and pure where possible. Business rules (scoring, scheduling, risk) should be deterministic and testable.
- Comment *why*, not *what*.

### Prototype (`prototype/`)

- Vanilla HTML5, CSS3 and JavaScript ES modules only. Do not add frameworks or build tools.
- Format with Prettier defaults: 2-space indent, single quotes, semicolons, 160-character lines.
- State changes go through `update()` in `js/state.js` so every page stays consistent and persisted.
- Render HTML with the `html` tagged template. Use `raw()` only for markup you generated yourself.
- Use the design tokens (CSS custom properties) in `css/style.css` instead of hard-coded colours.
- Keep simulated AI deterministic. No `Math.random()` in business logic.

### Data and privacy

- Use fictional sample data only, such as the officers and blocks in `prototype/js/data.js`.
- Record absences only as a category (MC or leave), never with medical details.
- See [SECURITY.md](SECURITY.md) for secrets handling and PDPA guidance.

## Reporting bugs and requesting features

- **Bugs:** open a GitHub issue with steps to reproduce, the expected and actual result, browser and screen size, and screenshots if helpful.
- **Features:** describe the user (officer or supervisor), the problem, and how SyncAI should help. Link it to the EMS 12i requirements where you can.
- **Security issues:** do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Questions

Ask in the team chat or open a GitHub Discussion. No question is too small.

# Security Policy

SyncAI is an AI-powered Smart Work Planner for Town Council officers (EMS Challenge 12i). It is designed to connect to Microsoft 365 and will eventually handle staff schedules, task records and resident-related information, so we treat security and data protection as requirements from day one.

## Supported versions

| Component | Status | Security fixes |
| --- | --- | --- |
| `main` branch | Active development | ✅ |
| `prototype/` (HTML/CSS/JS demo) | Design prototype with fictional data only | ✅ Best effort |
| Feature branches / forks | Not supported | ❌ |

There is no production deployment yet. Please do not run SyncAI against real Town Council tenants or real resident data until a release is marked production-ready.

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues, pull requests or discussions.**

1. Go to the repository's **Security** tab and choose **Report a vulnerability** (GitHub private vulnerability reporting). Maintainers: enable this under *Settings → Code security → Private vulnerability reporting*.
2. If that option is unavailable, contact a maintainer privately through GitHub and ask for a private channel. Do not include exploit details in the first message.

Please include:

- A description of the issue and its potential impact
- Steps to reproduce, or a proof of concept
- Affected files, pages, branches or commits
- Any suggested fix or mitigation

### What to expect

| Step | Target |
| --- | --- |
| Acknowledge your report | Within 3 working days |
| Initial assessment and severity | Within 7 working days |
| Fix or mitigation plan for confirmed issues | Agreed with you, based on severity |
| Credit in release notes (if you want it) | When the fix is published |

We ask that you give us reasonable time to fix confirmed issues before any public disclosure, and that you avoid accessing, modifying or deleting data that is not your own while investigating.

## Scope

In scope:

- Code in this repository, including `prototype/`
- Authentication and authorisation flows (Microsoft Entra ID, role checks)
- Handling of Microsoft Graph data (Outlook, To Do, Planner, Teams, SharePoint)
- Azure OpenAI prompts and outputs (prompt injection, data leakage between users)
- Cross-site scripting, injection and access-control issues
- Exposure of secrets, tokens or personal data

Out of scope:

- Vulnerabilities in Microsoft 365, Azure or other third-party services themselves (report those to the vendor)
- Denial-of-service or load testing against any environment
- Social engineering of team members, clients or Town Council staff
- Issues that require a compromised device or browser

## Security practices for contributors

### Secrets

- Never commit secrets: client secrets, API keys, connection strings, access or refresh tokens, certificates or `.env` files.
- Use `.env` files locally (they are git-ignored) and Azure Key Vault or GitHub Actions secrets for shared environments.
- If a secret is committed by mistake, **rotate it immediately**, then remove it from history. Deleting the file in a later commit is not enough.

### Personal data (PDPA)

- Use **fictional data only** in code, tests, screenshots and demos. Never copy real resident names, unit numbers, phone numbers, NRIC/FIN numbers or case details into the repository.
- Record staff absence only as a category (for example MC or leave). Never store diagnoses or medical details.
- Collect and display the minimum data needed. Officers should only see their own tasks; team workload is restricted to supervisors.
- Handle personal data in line with Singapore's Personal Data Protection Act (PDPA) and the client's data policies.

### Microsoft 365 and Azure

- Request the **least-privilege** Microsoft Graph permissions. Prefer delegated permissions over application permissions.
- Validate tokens and roles on the server. Never trust role or user IDs sent from the browser.
- Keep AI-generated plans and reassignments behind **human approval**. SyncAI must not silently change official calendars or task owners.
- Treat all model output and all content from emails, tasks and documents as untrusted input. Defend against prompt injection, and never let model output trigger actions without validation.

### Code

- Escape all dynamic content before rendering it as HTML. In the prototype, use the `html` tagged template in `prototype/js/ui.js`. Never assign untrusted strings to `innerHTML`.
- Keep the Content Security Policy in `prototype/index.html` strict. Do not add inline scripts or unvetted third-party CDNs.
- Validate input on the client for usability and on the server for security.
- Keep dependencies minimal and up to date, and review Dependabot alerts promptly.

Thank you for helping keep SyncAI and its users safe.

# Security Policy

SyncAI is an AI-enabled Smart Work Planner for Town Council officers (EMS Challenge PS 12i). Because the system manages staff schedules, operational tasks, and potentially sensitive estate records, security, access governance, and data protection are core architectural priorities.

> **Disclaimer:** SyncAI is an academic and client-driven proof-of-concept under active development. While security controls are implemented following OWASP Top 10 guidelines and Singapore Personal Data Protection Act (PDPA) principles, we do not claim formal third-party regulatory certification. Do not connect SyncAI to live Town Council production tenants or real resident datasets without written client authorization.

---

## Supported Versions

| Component | Status | Security Fixes |
| --- | --- | --- |
| `main` branch | Release branch | Supported |
| `feature/frontend-design` | Active development branch | Supported |
| `prototype/` | Static design prototype (fictional data only) | Best effort |
| Stale forks / legacy branches | Archived exploration | Unsupported |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities in public GitHub issues, pull requests, or public channels.**

1. Open the repository's **Security** tab and select **Report a vulnerability** (GitHub Private Vulnerability Reporting).
2. Alternatively, contact a repository maintainer privately through GitHub to arrange a secure communication channel. Do not include exploit payloads in the initial contact.

### Required Details

- Summary of the vulnerability and potential operational impact.
- Clear steps to reproduce or a minimal proof of concept.
- Specific affected files, routes, components, or commits.
- Any suggested remediation or mitigation.

### Response Targets

| Stage | Target Timeline |
| --- | --- |
| Initial acknowledgement | Within 3 working days |
| Triage and severity assessment | Within 7 working days |
| Remediation and patch release | Coordinated with reporter based on severity |
| Public credit in release notes | Upon publication of patch (optional) |

---

## Scope

### In Scope
- Code hosted in this repository (`prototype/`, `client/`, `server/`).
- Authentication and authorization flows (Microsoft Entra ID token verification, role enforcement).
- Session management, HTTP security headers, and rate limiting.
- Cross-site scripting (XSS), SQL injection, and broken access controls.
- Exposure of secrets, private tokens, or personal identifiers.

### Out of Scope
- Infrastructure vulnerabilities in Microsoft Azure, Microsoft 365, or Railway platform services.
- Distributed denial-of-service (DDoS) testing against hosted endpoints.
- Social engineering attacks targeting students, lecturers, or EM Services staff.
- Attacks requiring physical access to a compromised client machine or browser.

---

## Security Controls & Contributor Guidelines

### 1. Secret & Credential Handling
- **Never commit secrets:** API keys, database connection strings, JWT signing secrets, client secrets, or private certificates must never enter version control.
- Git-ignored `.env` files must be used for local development. Never commit `.env` files.
- If a secret is committed accidentally, **rotate it immediately**, then scrub it from Git history using `git-filter-repo` or BFG. Simply deleting the file in a subsequent commit leaves the secret in the commit history.

### 2. Token Handling & Server-Side Authorization
- The client acquires Microsoft Entra ID tokens via MSAL (PKCE flow). Tokens must never be stored in persistent unencrypted cookies.
- The Express server cryptographically validates access tokens on every request using `jose` against Microsoft's public JWKS endpoints.
- Role and account approval status are queried directly from the PostgreSQL database on every request; client-provided role claims are never trusted for authorization.
- System administrators cannot participate in operational teams, and have no access to private officer calendars or confidential resident casework, enforcing strict data minimisation and separation of duties.
- Prototype browser-level access controls demonstrate UI behaviour only and do not provide production security; all production authorization is cryptographically enforced server-side.

### 3. Personal Data Protection (PDPA) & Privacy
- **Fictional Datasets Only:** Use strictly fictional data in code, tests, documentation, and screenshots. Never commit real resident names, unit numbers, telephone numbers, NRIC/FIN identifiers, or case notes.
- **Absence Minimization:** Staff absences must be recorded solely as categorical "MC" or "leave". Storing medical diagnoses, clinic names, or doctor notes is strictly prohibited.
- **Append-Only Audit Logging:** Security-sensitive administrative operations (approvals, role adjustments, team changes) are logged to an append-only audit trail with automated 12-month data retention.
- **No Behavioral Tracking:** No mouse tracking, keystroke logging, or IP fingerprinting is stored in database records.

### 4. Code & Injection Safeguards
- **SQL Injection Defense:** 100% of SQL queries executed through `pg` must use parameterized statements (`$1, $2`). Dynamic SQL string concatenation is strictly forbidden.
- **Cross-Site Scripting (XSS):**
  - In `prototype/`, all dynamic text is escaped using the `html` tagged template in `js/ui.js`.
  - In `client/`, React JSX handles string escaping automatically; never bypass this with `dangerouslySetInnerHTML`.
  - Strict Content Security Policy (CSP) and security headers are enforced in both prototype shell and Express API middleware.
- **Rate Limiting:** Express API enforces rate limiting (300 requests per 15 minutes per IP) to mitigate automated probing.

### 5. Notification Adapters & Approval Verification
- **Simulated Notification Channels:** Multi-channel notification adapters (In-App, Teams, WhatsApp) are simulated locally. No real WhatsApp Business API or Meta credentials are used, eliminating third-party data transmission risks.
- **Privacy-Safe Notification Payloads:** Notification previews must never transmit sensitive resident data, personal identifiers, or unencrypted approval tokens.
- **Authenticated In-App Decisions:** Notification links (`syncai://approval/...`) act as deep links routing the user into SyncAI. Decisions (approvals, rejections, escalations) can only be executed by authenticated, authorized managers within the application shell and are committed to the audit log.
- **Hierarchical Self-Approval Prevention:** Front-line officers cannot self-approve restricted schedule changes, preventing unauthorized privilege escalation.

---

Thank you for helping keep SyncAI and its users safe.

# SyncAI

**Your Work. Your Time. In Sync.**

SyncAI is an AI-powered **Smart Work Planner** for Town Council Property Officers and their supervisors. It is Team 24's (IT2134-05) answer to EM Services (EMS) problem statement **12i — Smart Work Planner (Microsoft-based)**, built for the NYP School of IT × SCCCI × EM Services Techno Semester (Oct 2026).

## What makes it different

**Operationally Aware AI Scheduling:** understand operational priorities, build achievable plans, and explain the changes when work shifts.

A generic to-do list ranks work by due date. SyncAI ranks it the way EMS told us Property Officers should, then fits it into the time an officer really has:

| Factor | What it means |
| --- | --- |
| **1. Safety** | Genuine risks to residents, staff and property come first |
| **2. Mandatory deadlines** | Statutory, compliance and funding-approval dates that cannot be missed |
| **3. Service impact and long-term consequences** | Real resident needs, disruption to operations, and what happens if the work is delayed. A resident who complains loudly or often does not move up the list for that reason alone |
| **4. Scheduling feasibility** | Estimated task durations matched against the officer's availability, meetings and capacity |

These factors are weighed together. They are not an official ranking formula, and the weights are our own proposal, to be checked with EMS. AI recommends; an officer or supervisor approves every change.

## The problem statement

| 12i asks for | How SyncAI answers it |
| --- | --- |
| Organise officers' tasks and schedules | My Tasks (list and Kanban), natural-language task entry, meeting-minutes-to-tasks, Smart Planner calendar around Outlook meetings |
| Prioritise work by deadline and effort | Explainable priority score built on the four factors above, effort estimates, start-by warnings |
| Suggest a realistic daily or weekly plan | AI time-blocking, a schedule check, alternative schedules and emergency re-planning when urgent work arrives |

Our three proposed AI capabilities:

1. **Smart Priority:** rank tasks by safety, mandatory deadlines, service impact and long-term consequences.
2. **Realistic Planning:** propose schedules around task durations, availability, meetings and existing commitments.
3. **Team Rebalancing:** spot capacity problems and evaluate adjustments when an officer is away or urgent work lands (What-If Simulator).

**Out of scope for 12i:** resident case consolidation (PS 12g Operations Hub), project tracking (PS 12h Project Tracker), HR and medical records, payroll, resident-facing complaint portals, and production access to live EMS systems. The prototype still contains Projects, HQ overview and Data sources pages from earlier exploration; they are demo extras, not part of our 12i proposal.

## What's in this repository

| Path | What it is |
| --- | --- |
| [`prototype/`](prototype/) | The interactive Smart Work Planner (HTML, CSS, JavaScript; fictional data, no backend). See [prototype/README.md](prototype/README.md). Live at <https://feliciatanxl.github.io/SyncAI/site/index.html>. |
| [`prototype/site/`](prototype/site/) | The public website that explains SyncAI, with sign-in, forgot-password and reset-password pages that lead into the portal. |
| [`client/`](client/) | The React (Vite) frontend for the real build. Just scaffolded. See [client/README.md](client/README.md). |
| `server/` | The Node.js + Express API (not started yet). |
| [`docs/architecture.md`](docs/architecture.md) | Proposed architecture, what EMS told us, how the prototype maps onto the build, and open questions. |
| [`docs/demo-script.md`](docs/demo-script.md) | A 7-minute demo walkthrough with likely questions and answers. |
| [`prototype/tests/`](prototype/tests/) | Automated tests for the rules engine. |

## Run it

Prototype (Python 3, standard library only):

```bash
python prototype/serve.py
```

| Open | For |
| --- | --- |
| <http://localhost:8765/site/> | Public website |
| <http://localhost:8765/site/login.html> | Sign in (demo accounts are shown on the page) |
| <http://localhost:8765/> | Portal (sends you to sign in first if you are not signed in) |

Rules-engine tests (Node.js 20 or later, no install needed):

```bash
node --test "prototype/tests/*.test.mjs"
```

React client (Node.js 20 or later):

```bash
cd client && npm install && npm run dev
```

## Proposed stack

| Part | Technology | Status |
| --- | --- | --- |
| Web app | React (Vite), officer and supervisor dashboards | We build |
| API and planning engine | Node.js + Express: prioritisation, scheduling, workload calculations | We build |
| Database | PostgreSQL | We build |
| Sign-in | Microsoft Entra ID (MSAL) | Proposed, subject to tenant access |
| Calendar and tasks | Microsoft Graph: Outlook Calendar, Microsoft To Do | Proposed, subject to permissions |
| Approvals and alerts | Power Automate approval flows, Microsoft Teams notifications | Proposed, subject to licensing |
| Language features | Azure OpenAI | Optional, later phase |

EMS confirmed Microsoft is the baseline at every Town Council (Power Automate and Copilot at least; more varies by council) and said it will handle licences. Tenant access, API permissions and deployment requirements are still to be confirmed. The prototype simulates every Microsoft connection; none is live. We do not claim GCC compliance.

## Project documents

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [LICENSE](LICENSE)

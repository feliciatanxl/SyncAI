# SyncAI

**Your Work. Your Time. In Sync.**

SyncAI is a Microsoft-based Town Council Operations Hub for EM Services (EMS), built for the NYP School of IT × SCCCI × EM Services Techno Semester Hackathon (Oct 2026). It answers EMS problem statements **12g, 12h and 12i** as one product: the hub is the platform, and the Smart Work Planner and Project Tracker are its first two modules.

## Problem statements we cover

| Statement | What EMS asked for | How SyncAI answers it | Status |
| --- | --- | --- | --- |
| **12g** Town Council Operations Hub | One Microsoft-based hub over IEMS, TCMS, D365 and SharePoint, with a shared data layer, built-in intelligence, role-based sharing across Town Councils and EMS HQ, and mobile-first design. Deliver the architecture plus a working slice. | SyncAI is the hub. The Smart Work Planner is the working slice, with officer and supervisor roles and Microsoft 365 integration points mapped out. | Architecture and slice in progress |
| **12h** Project Tracker | Create projects and break them into tasks, assign owners and deadlines, and monitor task status and overall progress. | Second module. Reuses the planner's tasks, owners, deadlines, statuses and dependencies, grouped under projects. | Next |
| **12i** Smart Work Planner | Organise officers' tasks and schedules, prioritise by deadline and effort, and suggest a realistic daily or weekly plan. | First module. Explainable priority scores, effort estimates, AI time-blocking around Outlook meetings, team workload and What-If simulation. | Interactive prototype built |

The brief notes that 12h and 12i "pair naturally and could become modules of the Operations Hub (12g)", which is the structure we follow.

## What's in this repository

| Path | What it is |
| --- | --- |
| [`prototype/`](prototype/) | The interactive Smart Work Planner portal (HTML, CSS, JavaScript; fictional data, no backend). See [prototype/README.md](prototype/README.md). |
| [`prototype/site/`](prototype/site/) | The public website that explains and sells SyncAI, with sign-in, forgot-password and reset-password pages that lead into the portal. |

## Run it

Requires Python 3 (standard library only).

```bash
python prototype/serve.py
```

| Open | For |
| --- | --- |
| <http://localhost:8765/site/> | Public website |
| <http://localhost:8765/site/login.html> | Sign in (demo accounts are shown on the page) |
| <http://localhost:8765/> | Portal (sends you to sign in first if you are not signed in) |

## Target Microsoft stack

| Layer | Microsoft service |
| --- | --- |
| Sign-in and roles | Microsoft Entra ID (single sign-on, security groups for officer, supervisor, Town Council and HQ) |
| Calendar and tasks | Microsoft Graph: Outlook Calendar, Microsoft Planner / To Do |
| Alerts | Microsoft Teams (adaptive cards and activity feed) |
| Shared data layer | Dataverse or SharePoint lists, with connectors to D365, IEMS and TCMS |
| AI | Azure OpenAI for natural-language features; deterministic rules for scoring and scheduling so results stay explainable |

The prototype simulates all of these in the browser. No real Microsoft 365 or Azure connection is made.

## Project documents

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [LICENSE](LICENSE)

# SyncAI — PS 12i Smart Work Planner Prototype

**"Know what matters. Plan what fits. Adapt when work changes."**
An AI-powered Smart Work Planner for EM Services Property Officers and Estate Managers: focused exclusively on **EMS Challenge PS 12i (Microsoft-based)**. See the [repository README](../README.md).

### Signature Product Differentiators
1. **Flagship USP — Operationally Aware AI Scheduling:** A scheduling experience that considers real operational priorities, genuine public safety hazards, mandatory statutory compliance deadlines (BCA/SCDF), and available working capacity. Repeat complaint volume awards zero priority points.
2. **Signature Differentiator — Operational Ripple Intelligence:** Understand the downstream consequences of delaying or reassigning work before making changes. Evaluates multi-level task dependency cascades, flags mandatory statutory deadline risks, and compares three feasible operational alternatives side-by-side.
3. **Supporting Differentiator — Capacity-Aware Planning:** Accurately evaluates whether open tasks can realistically fit into available working hours around Microsoft Outlook meetings, lunch breaks, and travel buffer, proactively flagging impossible scheduling conflicts.

> **Note:** These are proposed product differentiators for EM Services challenge PS 12i, not claims of commercial exclusivity or verified commercial uniqueness. All intelligence is simulated client-side via deterministic, explainable rules using fictional Town Council data.

SyncAI directly addresses three core operational questions:
1. **What work matters most?** Genuine safety hazards and non-negotiable statutory compliance obligations outrank loud complaints and routine admin.
2. **What could happen if that work is delayed?** Operational Ripple Intelligence traces downstream dependency cascades, identifying secondary inspection stalls, contractor delay claims, and potential regulatory breaches.
3. **Which feasible alternative best protects operational obligations?** Compares No Action, Rescheduling Lower-Impact Work, and Reassigning to Qualified Officers, with trade-offs and manager escalation warnings.

## Run it

You need any static web server, because ES modules do not load from `file://`.

```bash
python prototype/serve.py
```

Then open **<http://localhost:8765/site/login.html>** and sign in with a demo account (password `SyncAI-demo1`). See [docs/architecture.md](../docs/architecture.md) for how the prototype maps to the production design.

| Email | Role | Operational Workflow |
| --- | --- | --- |
| `officer@syncai.demo` | **Property Officer** (`team_member`) | Property Officer operational day: AI briefing, next task recommendation, statutory alerts, calendar time-blocking. |
| `manager@syncai.demo` | **Estate Manager** (`manager`) | Supervisory workflow: team capacity heatmap, What-If simulation, reassignment approvals, statutory oversight. |
| `admin@syncai.demo` | **System Administrator** (`admin`) | Lightweight administration: demo user accounts, role permission matrix, approvals policy status, audit logging. |

*(Legacy login aliases `member@syncai.demo` and `supervisor@syncai.demo` remain fully supported.)*

`serve.py` uses only the Python standard library. It binds to `127.0.0.1` and disables caching so edits appear on refresh. Alternatives: VS Code **Live Server** (open `prototype/site/login.html`), or `npx serve prototype`.

The portal always requires sign-in. Opening `index.html` without signing in sends you to the login page. Each account sees only its own role's view. Use **Sign out** (under your name at the bottom of the sidebar) to switch accounts. Ticking **Keep me signed in** keeps the sign-in after the tab closes; otherwise it lasts for the tab only.

## Aligned Roles & Scopes

### 1. Role Alignment with Full-Stack Application
- **Property Officer (`team_member`):** Front-line estate officer managing inspections, resident follow-ups, and daily calendar time-blocking.
- **Estate Manager (`manager`):** Supervisory oversight across estate zones, workload balancing, and disruption replanning.
- **System Administrator (`admin`):** Lightweight governance demonstrating role-based access control (RBAC), approval requirements, and tenant settings without operational clutter.
- **EMS HQ (`hq`):** Demo login retired from the primary prototype to focus cleanly on PS 12i.

### 2. PS 12g / 12h Scope Boundary Management
Capabilities identified as overlapping with other problem statements have been cleanly retired from primary navigation and marketing while preserving source files and data integrity:
- **PS 12g overlaps retired from primary navigation:** Cross-council roll-up hub (`pages/hub.js`) and data sources monitor (`pages/sources.js`).
- **PS 12h overlap retired from primary navigation:** Project portfolio tracking, Gantt timelines, and templates (`pages/projects.js`). Tasks belonging to estate initiatives retain their contextual project name without broken links.

## Priority, SLA & Feasibility Engine

All scoring in `prototype/js/ai.js` and scheduling in `planner.js` is explainable, transparent, and deterministic:
- **Client 4-Tier Assessment Breakdown:** Maps tasks to EM Services' stated criteria (1. Service Focus, 2. Safety Focus, 3. Residents' Well-Being, 4. Actual Concern / Urgency).
- **Operational Non-Negotiables:** Imminent physical danger (lift entrapments, exposed wiring) and statutory deadlines (BCA/SCDF) represent hard constraints that cannot be outranked by routine service requests.
- **SLA & Commitment Window Tracking:** Evaluates `slaDue` and `appointmentTime` attributes. Breached SLAs produce immediate high-risk alerts (+18 pts); tight SLA windows (<60m) raise medium-risk warnings (+8 pts). Resident appointment windows are protected during schedule re-planning.
- **Genuine Safety Hazards (+20 pts):** Direct hazards to resident or public safety are explicitly identified and prioritised above routine work.
- **Mandatory Statutory Deadlines (+25 / +15 pts):** BCA annual lift certifications and SCDF compliance deadlines are treated as hard scheduling constraints that cannot slip.
- **Long-Term Operational Consequences (+12 pts):** Evaluates severe structural risks (e.g., ceiling seepage penetrating rebar) or regulatory stop-work orders if work is deferred.
- **Repeat Complaints = 0 Points:** Resident complaint volume alone awards 0 priority points, protecting officers from loudest-voice bias while maintaining professional service.
- **Scheduling Feasibility & Impossible Conflict Detection:** `checkTaskFeasibility(s, t)` computes remaining task effort against Outlook meetings, lunch, and working hours before deadline. Mathematically impossible deadlines are flagged with warning badges rather than silently ignored.
- **Configurable Prototype Assumptions:** All scoring rules are clearly labeled in the UI as illustrative prototype configuration assumptions, not EMS-approved corporate standards.
- **Hierarchical Approvals & Self-Approval Prevention:** Property Officers cannot self-approve restricted schedule changes. The prototype includes an interactive approval workflow routing change requests to assigned managers.
- **Multi-Channel Simulated Notifications:** In-app, Microsoft Teams (proposed), and WhatsApp (proposed) notifications with privacy-safe summaries and direct in-app verification links (`syncai://approval/...`). Zero external Meta API integration.

## Public website

`site/` is the marketing website: problem, features, how it works, the priority logic, Responsible AI, plans, FAQ and a demo-request form. It also has the sign-in flow:

| Page | What it does |
| --- | --- |
| `site/index.html` | Landing page. "Request a demo" validates the form and shows a thank-you; nothing is sent. |
| `site/login.html` | Email and password sign-in, a mock **Sign in with Microsoft** button, and one-click demo accounts. A correct sign-in opens the portal in that account's role. |
| `site/forgot-password.html` | Asks for an email and always gives the same reply, so it never reveals whether an account exists. Shows a prototype link to the reset page. |
| `site/reset-password.html` | New password with live rule checks (12+ characters, mixed case, number, symbol) and a confirm field. |

Add `?selftest` to any site URL to run the form-validation self-checks in the browser console, or to the portal URL (for example `index.html?selftest#/projects`) to check the project health rules.

## Features

| Page | Officer | Supervisor | Highlights |
| --- | --- | --- | --- |
| **Dashboard** | ✅ | ✅ | Officer: AI Daily Briefing, workload vs free time, top priorities, today's schedule, **smart reminders**. Supervisor: AI Team Briefing, capacity, at-risk deadlines, approvals. |
| **My Tasks / Team Tasks** | ✅ | ✅ | List and Kanban (drag-and-drop or keyboard select), add/edit/delete/complete, search, filters, sorting, dependencies, natural-language task entry, explainable AI score, **meeting-minutes-to-tasks generator**, status tabs (Open, Today, Upcoming, Overdue, At risk, In progress, Done, All) with counts, **10 / 25 / 50 / all rows per page** with numbered pages, a **Clear filters** bar with the match count, **group by** status, priority, category, project or owner, and a **task timer** for officers on their own tasks (start / stop; time spent updates remaining effort, with a running clock in the top bar). |
| **HQ overview** (extra, 12g idea) | 🔒 | 🔒 | Outside the 12i scope. EMS HQ only. **Town Council switcher** (All councils, Northvale, Eastbrook, Westridge, Southhaven), roll-up KPIs, an **AI HQ briefing** that ranks councils and suggests where spare capacity could help, a comparison table, and each council's projects. Shows counts and project health only, never officer names. A **Project categories** table (sample figures) shows each category's on-time rate and whether it needs manpower up front or later, for budget requests. Northvale is live from the demo data; the other councils are sample figures. |
| **Data sources** (extra, 12g idea) | 🔒 | ✅ | Outside the 12i scope. Supervisors and HQ. How IEMS, TCMS, Dynamics 365, SharePoint, Microsoft 365 and Entra ID feed one shared data layer, with each source's data, connector, schedule, record count, last sync and a simulated **Sync now**. |
| **Projects** (extra, 12h idea) | ✅ | ✅ | Outside the 12i scope (project tracking belongs to PS 12h). Project cards with progress, due date, team and **AI project health** (On track, Needs attention, At risk, Complete), with filter tabs. Each project has **Board** (Trello-style cards, drag and drop, quick add), **List** and **Timeline** (Gantt bars, milestones, today line) views, checklists on tasks, and reassignment suggestions for supervisors. Supervisors create projects from templates (Lift replacement, Repainting works, Festive event), and can edit or delete them (deleting keeps the tasks). Tasks have checklists you can tick, add to and remove from. A **Projects** card on both dashboards, project answers in **Ask SyncAI**, and **Alerts** for projects at risk. Officers see only projects they are part of, and only their own tasks. |
| **Client-informed scoring** | ✅ | ✅ | From the EMS briefing: genuine **safety** first, **statutory / compliance / funding** deadlines that cannot slip (*Statutory* badge and form flag), **service impact**, and repeat complaints shown at 0 points so volume alone never raises priority. Long-term consequences are in the proposed priority logic but not scored separately yet. See [architecture §3 and §8](../docs/architecture.md). |
| **Smart Planner** | ✅ | ✅ | Day and week calendar, mock Outlook meetings, AI time-blocking, generate → review → accept or discard. **Natural-language work planner**, **manual editing** (move, resize, add or remove blocks), a **schedule check** that flags unrealistic plans, **alternative schedules** including a field-visit optimiser, and **emergency rescheduling**. The AI side panel can be hidden for a full-width calendar; on phones the week view becomes a day-by-day agenda with meeting clashes marked. |
| **Team Workload** | 🔒 | ✅ | Capacity stats and four tabs: **Overview** (daily and weekly heatmap, skill- and availability-aware reassignment recommendations), **Officer capacity** (officer table, **why officers are falling behind**, per-officer breakdown), **Task distribution** (open tasks by officer and priority, with a note that counts are not performance) and **Absence management** (absence type only, tasks due while away, preview impact). |
| **AI Insights** | ✅ | ✅ | Tabs for **Overview** (daily and weekly briefings, **overload forecast**, **AI weekly reflection**), **Deadline risks** (including **start-by** warnings), **Workload trends** (estimated vs actual effort, workload trend) and **Recommendations**, each saying what was detected, why it matters, what it affects and what to do. |
| **What-If Simulator** | 🔒 | ✅ | Numbered steps: choose a scenario (MC/absence, urgent incident, extra assignment, multiple absences), configure it, then review the before / after-no-action / after-with-SyncAI comparison, recommended reassignments, affected schedule, and apply or discard. |
| **Settings & Integrations** | ✅ | ✅ | Microsoft 365 integration **roadmap (Core / MVP, Phase 2, Stretch)** with the data and AI features each enables, planning preferences, Responsible AI notes, activity log, **Reset demo data**, in tabs. |
| **Search** (Ctrl+K) | ✅ | ✅ | Search button in the top bar or **Ctrl+K / Cmd+K** anywhere: pages, projects and tasks the signed-in role may see. Arrow keys and Enter to open. |
| **Alerts (bell)** | ✅ | ✅ | Proactive alerts that would be delivered through Microsoft Teams: start-by warnings, at-risk deadlines, over-capacity days, plans awaiting approval, reminders, overloaded officers, help requests. |
| **Ask SyncAI** | ✅ | ✅ | Slide-out assistant that answers supported questions from local data, with role restrictions. Typing “Plan tomorrow, prioritise inspections” opens a proposed schedule. |

### Questions SyncAI answers

| Question | Where |
| --- | --- |
| What should I work on first? | Dashboard briefing and Top priorities, AI score breakdown, Ask SyncAI |
| Can I realistically finish everything today? | Dashboard workload card, Smart Planner schedule check, Ask SyncAI |
| What happens if an urgent task comes in? | Smart Planner → **Urgent task arrived** (officer); What-If Simulator (team) |
| How can I organise my workload more efficiently? | Generate my plan, **Alternative schedules**, natural-language planner |
| Which tasks are at risk of missing their deadlines? | AI Insights risk alerts, start-by warnings, Alerts |
| What happens when an officer is on MC? Who can take over? | What-If Simulator, reassignment recommendations |
| Who is overloaded, who has spare capacity, and who is falling behind? | Team Workload heatmap and **Falling behind?** column |
| Which officers are likely to become overloaded in the coming days? | AI Insights daily briefing forecast, heatmap |
| What happens if multiple officers are unavailable? | What-If Simulator → Two officers unavailable |

### Design principles

- **Microsoft Fluent 2-inspired:** navy navigation, Microsoft blue accents, neutral surfaces, Segoe UI.
- **AI built into the workflow:** recommendations appear where work happens, not only in a chatbot.
- **Explainable:** every score, estimate, risk and recommendation shows the reasons behind it.
- **Human approval:** plans, reassignments and simulations change nothing until a person accepts them. Every approval is logged.
- **Role-based and privacy-aware:** officers see only their own work. Absences show as MC or leave only, never medical details.
- **Easy to scan on any screen:** status filter tabs with live counts and numbered pages on the task list; **Show all / Show less** on long lists (schedule, reminders, risk alerts, reassignments, activity log); Settings, Team Workload and AI Insights split into keyboard-accessible tabs (arrow keys, Home, End). A **scroll-to-top** button appears on long pages. On phones, task rows become cards and nothing scrolls sideways.
- **Accessible:** skip link, keyboard navigation, focus trapping in dialogs, labelled controls, `aria-live` updates, and statuses that never rely on colour alone.

## Demo scenarios

Use **Settings → Reset demo data** before a demo. Dates are generated relative to today, and weekends roll forward to Monday. The demo clock is fixed at 08:30.

### 1. "What should I work on first?" (Officer, ~2 min)

1. Open the **Dashboard** as Aisyah. The briefing says today's work fits and recommends starting with the Blk 208 lift inspection.
2. Click the **AI score** on any task to see the itemised scoring: priority, deadline, safety, statutory deadline, service impact and dependencies.
3. Note the **meeting clash** at 3pm and the dependency hint: the seepage site check unblocks the resident call.

### 2. Natural-language task entry (Officer, ~1 min)

1. Go to **My Tasks** and click the example *"Urgent: lift fault at Blk 214 trapping resident, today 2pm"*.
2. SyncAI extracts the title, priority, category, location, deadline, effort and safety flag, with a reason for each.
3. **Accept & create**, or **Modify** to open the pre-filled form.

### 3. Generate my plan (Officer, ~2 min)

1. Click **Generate my plan**. SyncAI time-blocks tasks around Outlook meetings, lunch and 10-minute buffers.
2. Review the draft (dashed purple blocks) and the **Couldn't fit** panel, then **Accept plan**.
3. Click **Add appointment** to create an 11:00–12:00 meeting today. The planner flags the clash and marks the plan out of date, so you can regenerate it.

### 4. Team overload and reassignment (Supervisor, ~2 min)

1. **Sign out** and sign in as `supervisor@syncai.demo`. The Team Briefing shows Marcus is overloaded and Ravi is on MC.
2. Open **Team Workload** to see the heatmap and the reassignment recommendations. Each one explains why the task is at risk and why the receiving officer fits: skills, free time before the deadline, zone, and a check that the move won't make their other work late.
3. **Accept**, **Modify** (choose another officer) or **Dismiss**.

### 5. What-If Simulator & Operational Ripple Intelligence — the signature demo (Manager, ~3 min)

1. Open **What-If Simulator** and select the signature preset: **The Ripple Effect (Urgent Lift Incident)** (11:15 AM lift entrapment at Blk 214).
2. Inspect the **Disruption Cascade & Downstream Ripple**: see how shifting Aisyah's morning ceiling inspection cascades across 3 dependency levels to stall follow-up calls and contractor rectification work orders.
3. Compare the **Three Operational Alternatives** side-by-side:
   - **Alternative A: No Action** — exposes severe statutory breaches, unmitigated deadline slips, and unresolved conflict.
   - **Alternative B: Reschedule Lower-Impact Tasks** — shifts non-safety routine tasks later into the planning horizon, keeping work with the primary officer while protecting compliance.
   - **Alternative C: Reassign Eligible Work** — evaluates skill-certified candidates with spare capacity before deadlines, explicitly flagging officers who have free time but lack required domain certifications (e.g. lift specialist).
4. Review the dynamic recommendation banner and trade-off summary (or manager escalation warning if team capacity cannot accommodate obligations).
5. **Apply to live schedule** (with confirmation) or **Discard**. The live schedule remains completely untouched until explicit approval.

### 6. Natural-language planning and manual edits (Officer, ~3 min)

1. On the **Smart Planner**, click the example *"Plan my ⟨day⟩, prioritise lift inspections"*. SyncAI opens that day with the lift inspections first, and explains which matching tasks stay earlier because they're due sooner.
2. Click any block and move it to 2:40pm today. The **Schedule check** flags the meeting clash, the missed deadline and any overbooked day, and marks the block in red.
3. Click **Suggest alternative schedules**. Compare Balanced, Deadline-first and **Fewer site trips** (the field visit optimiser: less travel, but possibly some late tasks), then load one as a draft.

### 7. Emergency rescheduling (Officer, ~2 min)

1. Click **Urgent task arrived**, type *"Water leak from ceiling at Blk 210 lift lobby, about 1.5h, today 1pm"* and click **Fill from description**.
2. **Preview new schedule** shows where the emergency fits, which critical or same-day safety work is protected, what moved, and anything now at risk.
3. **Approve**. The plan updates, and if work became late, a help request is sent to the supervisor (visible in their Alerts).

### 8. Meeting minutes to tasks (~1 min)

1. On **My Tasks**, click **From meeting minutes**, then **Load sample minutes** (or upload a `.txt` / `.md` file).
2. **Extract action items**: SyncAI finds each action, its owner, deadline, priority and effort, with reasons.
3. Officers import their own items. Supervisors choose an owner for each item and import all of them.

### 9. Retired Scopes (Preserved for Reference & Context)

- **PS 12h Project Portfolio Tracking:** Files `pages/projects.js` remain in the repository for architectural reference and task foreign-key integrity, but are retired from primary PS 12i navigation.
- **PS 12g Cross-Council HQ & Data Sources:** Files `pages/hub.js` and `pages/sources.js` remain intact for dependencies and cross-module tests, but are retired from active PS 12i navigation.

### 10. Alerts and Reminders

Open the **bell** to see the alerts that would go to Microsoft Teams: statutory compliance warnings, start-by warnings, and capacity overload alerts. On the Dashboard, **Smart reminders** suggest when to be reminded based on each task's latest start time and preparation needs.

### 11. Ask SyncAI

Open **Ask SyncAI** and try *"What should I do first?"*, *"Can I realistically finish today?"*, *"Why is this task urgent?"*, or *"Which deadlines are at risk?"*.

## How the simulated intelligence works

All logic is deterministic. The same data always gives the same result.

| Capability | Where | Rule summary |
| --- | --- | --- |
| Priority score (0–100) | `js/ai.js` `scoreTask` | Priority (8–40) + deadline urgency (6–35) + genuine safety hazard (+20) + mandatory/statutory compliance (+25 within 3 working days, otherwise +15) + long-term consequence (+12) or high service impact (+8) + tight feasibility margin / effort (+5 to +6) + unblocks others (+6 each, max 12) + in progress (+5) − waiting on dependency (−10) + breached SLA (+18) + tight SLA window (+8). Explains client 4-tier criteria (Service, Safety, Well-being, Urgency). Repeat complaints award 0 points. Proactively flags impossible scheduling conflicts when free hours before deadline are insufficient. Recalculated on every change. Bands: Do now ≥ 70, Do next ≥ 50, Plan ≥ 30. |
| Feasibility check | `js/ai.js` `checkTaskFeasibility` | Calculates net working hours against Outlook meetings, lunch, and scheduled absences before the deadline. Flags impossible conflicts and tight buffers. |
| Start-by deadline | `planner.js` `latestStart` | Works backwards from the deadline through the officer's free time to find the latest start. Raises a warning within 2 hours of it, and high risk if it has already passed. |
| Smart reminders | `planner.js` `smartReminders` | Latest start minus a lead time: 60 min for safety work, 45 for “Do now”, 30 for “Do next”, otherwise 15. |
| Schedule check | `planner.js` `checkPlan` | Flags blocks outside working hours, on unavailable days, overlapping meetings, lunch or other blocks, finishing after the deadline, starting before a dependency, unplanned work, overbooked days and out-of-priority order. |
| Alternative schedules | `planner.js` `compareStrategies` | Balanced, Deadline-first, and Fewer site trips (groups visits by block area). Compared on tasks planned, late tasks, travel minutes and trips. |
| Natural-language planner | `ai.js` `parseDayPlanRequest` | Finds the day and the work to prioritise; matching tasks are placed first on that day when their deadlines allow. |
| Emergency rescheduling | `planner.js` `emergencyReschedule` | Keeps realistic blocks for Critical and same-day safety work, inserts the urgent task, re-plans everything else, and lists what moved or became late. |
| Council status | `pages/hub.js` `statusOf` | Needs support: 5+ overdue tasks, 8+ high-risk deadlines, utilisation over 100%, or 2+ projects at risk. Watch: any overdue task, 4+ high-risk deadlines, utilisation 85%+, one project at risk, or feedback response under 85%. Otherwise healthy. Spare capacity is suggested only from councils that are not struggling. |
| Project health | `pages/projects.js` `projectHealth` | Progress is effort-weighted (hours of done tasks ÷ all task hours) and compared with the share of project time used. At risk: past deadline with open work, any overdue task, two or more high-risk tasks, or more than 25 points behind. Needs attention: one high-risk task, 10–25 points behind, or an owner who is overloaded or away. Reasons naming other officers are shown to supervisors only. |
| Meeting-to-task | `ai.js` `extractActionItems` | Finds lines marked “Action:” or phrased “⟨name⟩ to ⟨verb⟩…”, identifies the officer, then reuses natural-language task parsing. |
| Effort estimate | `ai.js` `estimateEffort` | Category baseline × wording cues (multiple sites ×1.5, calls ×0.6, reports ×1.25) × the team's historical actual/estimate ratio for that category. |
| Natural-language parsing | `ai.js` `parseNaturalTask` | Keyword and regex extraction for priority, category, block number, date, time, duration, owner and safety. |
| Scheduling | `js/planner.js` `buildSchedule` | "Do now" tasks first, then earliest deadline day, then score. Dependencies go first. Fills free slots around working hours, lunch, meetings and buffers, with a minimum block length. Flags late and unschedulable tasks. |
| Capacity | `planner.js` `analyseOfficer` | (Meetings + remaining effort due) ÷ working time, per day and per week. Status: Unavailable, Overloaded, Near capacity, Balanced or Spare. |
| Deadline & SLA risk | `planner.js` `assessRisk` | High if overdue, breached SLA, owner away until deadline, unschedulable, or finishing late. Medium if tight SLA buffer (<60m), owner away on due date, or waiting on another task. Flags fixed appointment commitment windows. |
| Reassignment | `js/simulation.js` | Ranks officers by skills, free time before deadline, overload and zone. Safety work prefers skilled officers. Each move is checked against receiver's re-planned schedule. |
| What-If | `simulation.js` `runSimulation` | Runs on cloned state: applies absences and new work, compares snapshots, and proposes reassignments. Commits only on approval. |
| Operational Ripple Intelligence | `js/ripple.js` | Traces multi-level downstream and upstream dependency chains with cycle detection. Evaluates capacity deficits, mandatory compliance exposures, SLA risks, and compares Three Meaningful Alternatives (No Action, Reschedule, Reassign). Enforces hierarchical management approval rules. |
| Hierarchical Approvals | `js/state.js` | Full workflow: request, review, approve, reject, escalate with immutable audit trail. Strictly enforces self-approval prevention for Property Officers. |
| Notification Adapters | `js/state.js` & `pages/alerts.js` | Multi-channel simulated alerts (In-App, Teams, WhatsApp) with privacy-safe payloads and secure deep links (`syncai://approval/...`). No external API or Meta credentials. |

## Tests

The rules and ripple engines have automated tests that run with Node's built-in test runner (Node.js 20 or later, nothing to install). From the repository root:

```bash
node --test "prototype/tests/*.test.mjs"
```

The test suite contains **56 automated tests** across four test suites:
- `prototype/tests/rules.test.mjs` (19 tests): Seed data integrity, foreign keys, explainable priority scoring, hard statutory constraints, scheduling feasibility, meeting avoidance, project health, timers, and role alignment.
- `prototype/tests/ripple.test.mjs` (20 tests): Multi-level dependency cascades (`t103` → `t104` → `t112`), circular dependency termination, missing task resilience, urgent safety incidents, capacity deficits, officer unavailability, skill-based reassignment restrictions, Three Alternatives evaluation, state isolation, explicit commit verification, and calibrated language enforcement.
- `prototype/tests/client-requirements.test.mjs` (14 tests): Client prioritisation 4-tier criteria, conflicting priorities resolution, repeat complaint handling, SLA deadlines and breach risks, fixed resident appointments, downstream cascade tracing, Three Alternatives SLA protection, hierarchical approval workflow, unauthorized self-approval prevention, multi-channel notification audit events, simulation isolation, seed reset behavior, role boundaries, and missing data resilience.
- `prototype/tests/status-codes.test.mjs` (3 tests): HTTP status code definitions, query-string text lookups, and presentation consistency.

## Project structure

```text
prototype/
├── index.html          App shell (sidebar, top bar, modal and toast hosts, CSP)
├── site/               Public website: landing, login, forgot and reset password (site.css, site.js)
├── tests/              Rules and ripple tests (node --test)
├── serve.py            No-cache local dev server
├── css/style.css       Fluent 2-inspired design tokens, components and responsive layout
├── assets/syncai-logo.png  SyncAI mark
└── js/
    ├── app.js          Router, navigation, role switch, event delegation
    ├── state.js        Shared state, localStorage persistence, selectors
    ├── data.js         Fictional seed data (officers, tasks, meetings, projects, councils, history)
    ├── time.js         Demo clock and date helpers
    ├── ai.js           Scoring, estimation, natural-language parsing
    ├── planner.js      Scheduling, capacity, conflicts, deadline risk
    ├── ripple.js       Operational Ripple Intelligence, multi-level dependencies, alternatives
    ├── simulation.js   Reassignment recommendations and What-If simulations
    ├── ui.js           Safe HTML templating, icons, dialogs, toasts
    ├── ctx.js          Late-bound hooks (rerender, navigate, route parameter)
    ├── search.js       Ctrl+K quick search
    ├── timer.js        Task timer (start, stop, time spent)
    └── pages/          hub, dashboard, tasks, projects, planner, team, insights, simulator, sources, settings, assistant, alerts, shared
```

## Security notes

- All dynamic text is escaped by the `html` tagged template (`js/ui.js`). User input is never inserted as raw HTML.
- A Content Security Policy in `index.html` blocks inline scripts and all network requests (`connect-src 'none'`).
- No credentials, tokens or external services are used. Data stays in this browser's `localStorage`.
- See the repository [SECURITY.md](../SECURITY.md).

## Known limitations

- **One live council:** only Northvale is computed from the demo data. The other Town Councils in the HQ overview are fixed sample figures, and every data source connection is simulated.
- **Mock prototype sign-in:** the prototype website's login checks a demo password in the browser and stores only the role in `sessionStorage` / `localStorage` (key `syncai.session`). The portal refuses to open without it, but this is a browser-only demonstration mechanism. In contrast, the full-stack application (`client/` and `server/`) implements real Microsoft Entra ID authentication and database role checks.
- **Simulated integrations in prototype:** within this static prototype, Microsoft Graph, Outlook Calendar, Teams notifications, and Power Automate are simulated using mock data and local browser dialogs.
- **Fixed demo clock:** "now" is 08:30 on the current working day. Data is re-seeded automatically on a new day, which discards earlier changes.
- **Single browser:** prototype state lives in `localStorage` per browser and is not shared between users or devices.
- **Deterministic rules vs. predictive ML:** natural-language parsing and minutes extraction handle common phrasings via regex and keyword matching, and the assistant answers a fixed set of question types. No trained black-box model is used; priority scoring and ripple logic are deterministic and auditable.
- **Configurable scoring assumptions:** scoring weights (+20 safety, +25 statutory, +12 consequence) are proposed baselines derived from EMS qualitative guidance, to be calibrated against EMS time-study data.
- **Travel estimate:** the field visit optimiser uses block numbers as a proxy for distance, not real maps or routes.
- **Greedy scheduler:** fast and explainable, but not mathematically optimal. A production version could use a constraint solver.
- **Demand-based capacity:** utilisation counts work *due* in a period, so later days look lighter until more work is known.
- **Small screens:** every page fits a 375px phone without sideways scrolling. The heatmap scrolls inside its own card, and the week calendar switches to an agenda list.
- Tested in current Chromium-based browsers (Edge and Chrome).

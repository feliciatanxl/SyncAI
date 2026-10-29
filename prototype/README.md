# SyncAI — Interactive Prototype

**Your Work. Your Time. In Sync.**
An AI-powered Smart Work Planner for Town Council officers and supervisors (EMS Challenge 12i), and the first module of the SyncAI Operations Hub (12g). See the [repository README](../README.md) for how 12g–12i fit together.

This folder contains a working HTML/CSS/JavaScript prototype for demonstrating SyncAI's user experience and AI features to EMS stakeholders and lecturers before the React / Node.js build. Everything runs in the browser using fictional data and deterministic, explainable rules. **No real Microsoft 365 or Azure OpenAI connection is made.**

## Run it

You need any static web server, because ES modules do not load from `file://`.

```bash
python prototype/serve.py
```

Then open **<http://localhost:8765/site/login.html>** and sign in with a demo account (password `SyncAI-demo1`). See [docs/architecture.md](../docs/architecture.md) for how the prototype maps to the production design.

| Email | Opens |
| --- | --- |
| `officer@syncai.demo` | Officer view (Aisyah Rahman) |
| `supervisor@syncai.demo` | Supervisor view (Jennifer Ong) |
| `hq@syncai.demo` | EMS HQ view (Lim Wei Ling): roll-ups across Town Councils |

`serve.py` uses only the Python standard library. It binds to `127.0.0.1` and disables caching so edits appear on refresh. Alternatives: VS Code **Live Server** (open `prototype/site/login.html`), or `npx serve prototype`.

The portal always requires sign-in. Opening `index.html` without signing in sends you to the login page. Each account sees only its own role's view; there is no role switcher. Use **Sign out** (under your name at the bottom of the sidebar) to switch accounts. Ticking **Keep me signed in** keeps the sign-in after the tab closes; otherwise it lasts for the tab only.

## Public website

`site/` is the marketing website: problem, features, how it works, the Operations Hub modules, Responsible AI, plans, FAQ and a demo-request form. It also has the sign-in flow:

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
| **My Tasks / Team Tasks** | ✅ | ✅ | List and Kanban (drag-and-drop or keyboard select), add/edit/delete/complete, search, filters, sorting, dependencies, natural-language task entry, explainable AI score, **meeting-minutes-to-tasks generator**, status tabs with counts and numbered pages, **group by** status, priority, category, project or owner, and a **task timer** for officers on their own tasks (start / stop; time spent updates remaining effort, with a running clock in the top bar). |
| **HQ overview** (12g) | 🔒 | 🔒 | EMS HQ only. **Town Council switcher** (All councils, Northvale, Eastbrook, Westridge, Southhaven), roll-up KPIs, an **AI HQ briefing** that ranks councils and suggests where spare capacity could help, a comparison table, and each council's projects. Shows counts and project health only, never officer names. Northvale is live from the demo data; the other councils are sample figures. |
| **Data sources** (12g) | 🔒 | ✅ | Supervisors and HQ. How IEMS, TCMS, Dynamics 365, SharePoint, Microsoft 365 and Entra ID feed one shared data layer, with each source's data, connector, schedule, record count, last sync and a simulated **Sync now**. |
| **Projects** (12h) | ✅ | ✅ | Project cards with progress, due date, team and **AI project health** (On track, Needs attention, At risk, Complete), with filter tabs. Each project has **Board** (Trello-style cards, drag and drop, quick add), **List** and **Timeline** (Gantt bars, milestones, today line) views, checklists on tasks, and reassignment suggestions for supervisors. Supervisors create projects from templates (Lift replacement, Repainting works, Festive event), and can edit or delete them (deleting keeps the tasks). Tasks have checklists you can tick, add to and remove from. A **Projects** card on both dashboards, project answers in **Ask SyncAI**, and **Alerts** for projects at risk. Officers see only projects they are part of, and only their own tasks. |
| **Smart Planner** | ✅ | ✅ | Day and week calendar, mock Outlook meetings, AI time-blocking, generate → review → accept or discard. **Natural-language work planner**, **manual editing** (move, resize, add or remove blocks), a **schedule check** that flags unrealistic plans, **alternative schedules** including a field-visit optimiser, and **emergency rescheduling**. |
| **Team Workload** | 🔒 | ✅ | Capacity stats, daily and **weekly** heatmap, **why officers are falling behind**, officer breakdown, skill- and availability-aware reassignment recommendations. |
| **AI Insights** | ✅ | ✅ | Daily and weekly briefings, **overload forecast**, deadline-risk alerts (including **start-by** warnings), estimated vs actual effort, workload trend, **AI weekly reflection**, corrective actions. |
| **What-If Simulator** | 🔒 | ✅ | MC/absence, urgent incidents, extra assignments, multiple absences. Before / after-no-action / after-with-SyncAI comparison. Apply or discard. |
| **Settings & Integrations** | ✅ | ✅ | Microsoft 365 integration **roadmap (Core / MVP, Phase 2, Stretch)** with the data and AI features each enables, planning preferences, Responsible AI notes, activity log, **Reset demo data**. |
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
- **Easy to scan on any screen:** status filter tabs with live counts and numbered pages on the task list; **Show all / Show less** on long lists (schedule, reminders, risk alerts, reassignments, activity log); Settings split into tabs. On phones, task rows become cards and nothing scrolls sideways.
- **Accessible:** skip link, keyboard navigation, focus trapping in dialogs, labelled controls, `aria-live` updates, and statuses that never rely on colour alone.

## Demo scenarios

Use **Settings → Reset demo data** before a demo. Dates are generated relative to today, and weekends roll forward to Monday. The demo clock is fixed at 08:30.

### 1. "What should I work on first?" (Officer, ~2 min)

1. Open the **Dashboard** as Aisyah. The briefing says today's work fits and recommends starting with the Blk 208 lift inspection.
2. Click the **AI score** on any task to see the itemised scoring: priority, deadline, safety, resident impact and dependencies.
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

### 5. What-If Simulator — the standout demo (Supervisor, ~3 min)

1. Open **What-If Simulator** and click **Officer on MC**, which marks Daniel unavailable for 2 days.
2. Compare **Before**, **After (no action)** and **After (with SyncAI actions)**. High-risk deadlines rise sharply without action and drop once SyncAI's reassignments are applied.
3. Review the per-officer capacity bars, the reassignments (untick any you disagree with), the schedule changes, and **Still at risk**: work no one can absorb, with escalation options.
4. Try **Urgent lift breakdown** or **Two officers unavailable**.
5. **Apply to live schedule** (with confirmation) or **Discard**. The baseline never changes until you apply.

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

### 9. Projects (Supervisor, ~2 min)

1. Open **Projects**. Three projects are at risk, one is on track and one is complete. Use the tabs to filter.
2. Open **Blk 312 repainting works**. **AI project health** explains the risk: tasks at high risk, behind schedule for the time used, and Marcus overloaded. It suggests reassignments you can accept.
3. On the **Board**, drag a card to another column or change its status. Click a card to tick off its checklist. Switch to **Timeline** to see bars, milestones and today's line.
4. Click **New project**, choose the **Lift replacement** template and create it. Five tasks are spread across the project dates.

### 10. EMS HQ overview (HQ, ~2 min)

1. Sign out and sign in as `hq@syncai.demo`. The **HQ overview** opens with roll-ups across four Town Councils.
2. The **AI HQ briefing** says Westridge and Northvale need support and that Southhaven has spare capacity, with the reason for each.
3. Use the **council tabs** to switch to one council and see its figures and projects. Note that HQ never sees officer names.
4. Open **Data sources** to show how every EMS system feeds the shared data layer. Try **Sync now**.

### 11. Alerts and reminders

Open the **bell** to see the alerts that would go to Microsoft Teams. On the Dashboard, **Smart reminders** suggest when to be reminded based on each task's latest start time and preparation needs.

### 12. Ask SyncAI

Open **Ask SyncAI** and try *"Can I finish everything today?"*, *"When am I free today?"*, *"Who is overloaded?"* or *"What happens if Ravi is on MC?"*. As an officer, team questions are politely refused.

## How the simulated intelligence works

All logic is deterministic. The same data always gives the same result.

| Capability | Where | Rule summary |
| --- | --- | --- |
| Priority score (0–100) | `js/ai.js` `scoreTask` | Priority (8–40) + deadline urgency (6–35) + safety (+15) + high resident impact (+8) + large task due within 2 days (+6) + unblocks others (+6 each, max 12) + in progress (+5) − waiting on a dependency (−10). Recalculated on every change. Bands: Do now ≥ 70, Do next ≥ 50, Plan ≥ 30. |
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
| Deadline risk | `planner.js` `assessRisk` | High if overdue, owner away until the deadline, unschedulable, or finishing late. Medium if less than 90 minutes of buffer, owner away on the due date, or waiting on another task. |
| Reassignment | `js/simulation.js` | Ranks officers by skills, free time before the deadline, overload and zone. Safety work prefers skilled officers. Each move is checked against the receiver's re-planned schedule. |
| What-If | `simulation.js` `runSimulation` | Runs on a cloned state: applies absences and new work, compares snapshots, and proposes reassignments. Commits only on approval. |

## Tests

The rules engine has automated tests that run with Node's built-in test runner (Node.js 20 or later, nothing to install). From the repository root:

```bash
node --test "prototype/tests/*.test.mjs"
```

They check the seed data, priority scoring, deadline risk, the scheduler (no blocks outside working hours or on top of meetings), project health, the privacy flag on project reasons, the council status thresholds, the task timer and task grouping.

## Project structure

```text
prototype/
├── index.html          App shell (sidebar, top bar, modal and toast hosts, CSP)
├── site/               Public website: landing, login, forgot and reset password (site.css, site.js)
├── tests/              Rules-engine tests (node --test)
├── serve.py            No-cache local dev server
├── css/style.css       Fluent 2-inspired design tokens, components and responsive layout
├── assets/logo.svg     SyncAI mark
└── js/
    ├── app.js          Router, navigation, role switch, event delegation
    ├── state.js        Shared state, localStorage persistence, selectors
    ├── data.js         Fictional seed data (officers, tasks, meetings, projects, councils, history)
    ├── time.js         Demo clock and date helpers
    ├── ai.js           Scoring, estimation, natural-language parsing
    ├── planner.js      Scheduling, capacity, conflicts, deadline risk
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
- **Mock sign-in:** the website's login checks a demo password in the browser and stores only the role in `sessionStorage` / `localStorage` (key `syncai.session`). The portal refuses to open without it, but this is not real access control: anyone can set that value in the browser's developer tools. Production would use Entra ID role claims.
- **Simulated only:** no Microsoft Entra ID sign-in, Microsoft Graph, Teams notifications or Azure OpenAI. "Accept plan" and notifications are mock.
- **Fixed demo clock:** "now" is 08:30 on the current working day. Data is re-seeded automatically on a new day, which discards earlier changes.
- **Single browser:** state lives in `localStorage` per browser and is not shared between users or devices.
- **Rule-based "AI":** natural-language parsing and minutes extraction handle common phrasings only, and the assistant answers a fixed set of question types.
- **Travel estimate:** the field visit optimiser uses block numbers as a proxy for distance, not real maps or routes.
- **Greedy scheduler:** fast and explainable, but not mathematically optimal. A production version could use a constraint solver.
- **Demand-based capacity:** utilisation counts work *due* in a period, so later days look lighter until more work is known.
- **Small screens:** every page fits a 375px phone without sideways scrolling, except the week calendar and heatmap, which scroll inside their own card.
- Tested in current Chromium-based browsers (Edge and Chrome).

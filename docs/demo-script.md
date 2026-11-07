# SyncAI demo script (about 7 minutes)

A walkthrough of EMS statement **12i — Smart Work Planner** in the order a Property Officer's day happens: the officer plans the day, an urgent safety task arrives, and the supervisor rebalances the team. The thread through all of it is our USP, **Operationally Aware AI Scheduling**.

## Before you start

1. Run `python prototype/serve.py` and open <http://localhost:8765/site/>, or use the live site at <https://feliciatanxl.github.io/SyncAI/site/index.html>.
2. Sign in as the supervisor and use **Settings → Reset demo data**, so the numbers match this script. Demo data is shared by all accounts in the same browser.
3. Keep this password handy: `SyncAI-demo1`.
4. Optional: open the browser at phone width in a second window to show the mobile layout.

| Account | Who | Shows |
| --- | --- | --- |
| `officer@syncai.demo` | Aisyah Rahman, Property Officer | Priorities, planning, emergency re-planning |
| `supervisor@syncai.demo` | Jennifer Ong, Estate Manager | Team workload, reassignment, What-If Simulator |

Say up front: the data is fictional, the "AI" is explainable rules, and every Microsoft connection is simulated. Microsoft integrations are proposed, subject to tenant access, permissions and licensing.

## 0. The pitch (30 s) — public website

- Landing page: *"Your Work. Your Time. In Sync."*
- EMS told us Property Officers should put genuine safety first, never miss statutory or funding deadlines, weigh real service impact over how loudly someone complains, and plan around how long work really takes. SyncAI is built around exactly that.
- Click **Sign in**.

## 1. Officer: what should I work on first? (2 min)

Sign in as **officer**.

1. **Dashboard:** the AI Daily Briefing says today's work fits and to start with the Blk 208 lift inspection.
2. Click an **AI score** to open the breakdown: safety, statutory deadline, service impact, deadline urgency, effort and dependencies. Point out that repeat complaints are listed at **0 points**: visible, but volume alone never raises priority.
3. **Smart Planner → Generate my plan:** tasks are time-blocked around Outlook meetings and lunch, with a schedule check for anything unrealistic. Accept it.

## 2. Officer: an urgent safety task arrives (2 min) — the USP moment

1. Click **Urgent task arrived**, type *"Water leak from ceiling at Blk 210 lift lobby, about 1.5h, today 1pm"* and click **Fill from description**.
2. **Preview new schedule:** SyncAI shows where the emergency fits, which safety and statutory work stays protected, what moved and what is now at risk, with a reason for each change.
3. **Approve.** If work became late, a help request goes to the supervisor.

Talking point: this is a simulated re-planning scenario, not live client data. Nothing changes until a person approves.

## 3. Supervisor: rebalance the team (2.5 min)

Sign out (bottom of the sidebar) and sign in as **supervisor**.

1. **Dashboard:** *"Marcus is overloaded, and Ravi is unavailable today."* The help request from step 2 is in **Alerts**.
2. **Team Workload:** heatmap and reassignment suggestions. Each one explains why the task is at risk and why the receiving officer fits: skills, free time before the deadline, zone, and a check that their own work won't slip.
3. **What-If Simulator → Officer on MC:** before, after with no action, after with SyncAI's reassignments. Untick a reassignment you disagree with, then **Discard** (or apply).

Talking point: in the build, a reassignment would go out as a Power Automate approval to Teams (proposed).

## 4. Close (30 s)

*"Smarter priorities. More realistic plans."* Our next step is validating the priority rules with EMS and replacing our assumed task durations with EMS's Property Officer time study.

## Optional extras (outside 12i scope)

The prototype also has **Projects**, **HQ overview** (`hq@syncai.demo`) and **Data sources** pages from an earlier, wider concept covering 12g and 12h. Only show them if asked; they are not part of our 12i proposal.

## Likely questions

| Question | Answer |
| --- | --- |
| Is the AI real? | Scoring, scheduling and risk are deterministic rules, so they are explainable and repeatable. Azure OpenAI could later handle language features, but it is not needed for the first prototype. |
| Where do the priority weights come from? | They are our proposal based on what EMS told us. EMS has not given a formula; we will validate the weights with our account owner. |
| How does it know how long tasks take? | Today from assumed baselines adjusted by the team's estimated-vs-actual history. We plan to use EMS's Property Officer task-duration analysis once access is arranged. |
| Doesn't the Operations Command Centre already show this? | It shows where officers are and what they are doing now. SyncAI adds forward-looking planning: what to do next, whether the day is realistic, and what to change when work shifts. |
| Is it Microsoft-based? | React and Node.js host the planning engine. Entra ID sign-in, Outlook Calendar and To Do through Graph, Power Automate approvals and Teams alerts are the proposed Microsoft integrations, subject to access and licensing. |
| What happens to medical information? | Absences are stored as MC or leave only. No medical details are recorded. |
| How is it tested? | `node --test "prototype/tests/*.test.mjs"` runs the rules-engine tests: scoring, risk, scheduling, the timer and grouping. |

# SyncAI demo script (about 8 minutes)

A walkthrough that covers EMS statements **12i → 12h → 12g** in the order a Town Council day happens: an officer plans their day, a supervisor balances the team and projects, and HQ sees every council.

## Before you start

1. Run `python prototype/serve.py` and open <http://localhost:8765/site/>.
2. Sign in as the supervisor and use **Settings → Reset demo data**, so the numbers match this script. Demo data is shared by all three accounts in the same browser.
3. Keep this password handy: `SyncAI-demo1`.
4. Optional: open the browser at phone width in a second window to show the mobile layout.

| Account | Who | Shows |
| --- | --- | --- |
| `officer@syncai.demo` | Aisyah Rahman, Property Officer | 12i Smart Work Planner |
| `supervisor@syncai.demo` | Jennifer Ong, Estate Manager | 12i team view, 12h Project Tracker |
| `hq@syncai.demo` | Lim Wei Ling, EMS HQ | 12g Operations Hub |

## 0. The pitch (30 s) — public website

- Landing page: *"Your Work. Your Time. In Sync."* One hub on Microsoft 365, with the planner and project tracker as modules.
- Point at the **Platform** section: Smart Work Planner and Project Tracker are available, more EMS modules plug into the same data layer.
- Click **Sign in**.

## 1. Officer: plan my day (12i, 2 min)

Sign in as **officer**.

1. **Dashboard:** the AI Daily Briefing says today's work fits and to start with the Blk 208 lift inspection. *"Prioritises work by deadline and effort"* — click an **AI score** to show the explanation.
2. **Smart Planner → Generate my plan:** tasks are time-blocked around Outlook meetings and lunch. *"Suggests a realistic daily or weekly plan."* Accept it.
3. **Urgent task arrived:** type *"Water leak from ceiling at Blk 210 lift lobby, about 1.5h, today 1pm"* → Preview → Approve. Safety work is protected; anything now late is flagged.
4. On **My Tasks**, click ▶ on a task to start the **timer**; the clock runs in the top bar and the time spent feeds the plan. Try **Group: priority**.
5. Press **Ctrl+K**, type *lift*, and open a task — everything is one search away.

Talking point: every suggestion shows its reasons, and nothing changes until the officer accepts.

## 2. Supervisor: balance the team and track projects (12i + 12h, 3 min)

Sign out (bottom of the sidebar) and sign in as **supervisor**.

1. **Dashboard:** *"Marcus is overloaded, and Ravi is unavailable today. 8 deadlines are at high risk."* The new **Projects** card shows three projects at risk.
2. **Projects:** cards with progress, days left and team. Filter with the **At risk** tab.
3. Open **Blk 312 repainting works**:
   - **AI project health** explains *why* it is at risk: 2 high-risk tasks, 38% done with 60% of the time used, Marcus overloaded.
   - **Suggested actions:** accept a reassignment right here.
   - **Board:** drag a card to *In review*. Open a card and tick a checklist item; add a new one.
   - **Timeline:** bars, milestones and today's line.
4. **New project → Lift replacement template:** five tasks spread across the dates in one click. *"Create projects and break them into tasks; assign owners and deadlines."*
5. **What-If Simulator → Officer on MC:** before, after with no action, after with SyncAI. This is the standout demo if time allows.

Talking point: projects reuse the planner's tasks, so a delay on site shows up in both the officer's day and the project's health.

## 3. HQ: one view across councils (12g, 2 min)

Sign out and sign in as **hq**.

1. **HQ overview:** roll-ups across four Town Councils. The **AI HQ briefing** says Westridge and Northvale need support and Southhaven has spare capacity.
2. Use the **council tabs** to switch to Westridge and back. Point out the **What HQ can see** card: counts and project health, never officer names.
3. **Data sources:** IEMS, TCMS, Dynamics 365, SharePoint and Microsoft 365 feed one shared data layer. Click **Sync now**. IEMS and TCMS are marked *to confirm* — we will ask EMS about them.
4. Show the phone layout: bottom tab bar, cards instead of tables.

Talking point: *"One Microsoft-based hub with a shared data layer and built-in intelligence; role-based data sharing across Town Councils and EMS HQ."* Then open `docs/architecture.md` for the full design.

## Likely questions

| Question | Answer |
| --- | --- |
| Is the AI real? | Scoring, scheduling and risk are deterministic rules, so they are explainable and repeatable. Azure OpenAI would handle language (task text, minutes, briefings) in production. |
| How does it connect to IEMS and TCMS? | Through Power Automate or scheduled exports into Dataverse. We need EMS to confirm what each system exposes; see the questions in `docs/architecture.md`. |
| Can HQ see individual officers? | No. HQ sees council roll-ups. Officer detail stays with each council's supervisors, enforced by Entra ID roles and Dataverse row-level security. |
| What about mobile? | Every page fits a phone, with a bottom tab bar. In production it also runs as a Microsoft Teams tab. |
| What happens to medical information? | Absences are stored as MC or leave only. No medical details are recorded. |
| How is it tested? | `node --test "prototype/tests/*.test.mjs"` runs 11 tests on scoring, risk, scheduling, project health, council status, the timer and grouping. |

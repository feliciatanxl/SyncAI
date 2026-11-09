# SyncAI — Operational Ripple Intelligence Demo Script

**A 7-minute presentation walkthrough of EM Services Challenge PS 12i — Smart Work Planner (Microsoft-based)**  
**Team:** IT2134 Team 24 | **Target Audience:** Lecturers, EM Services Representatives, and Solution Architects  
**Core Message:** *"Know what matters. Understand what changes. Choose the safer plan."*

---

## Demonstration Overview & Timings

| Segment | Speaker Focus | Screen / View | Duration |
| --- | --- | --- | --- |
| **0. Opening & Context** | The Town Council Property Officer scheduling dilemma; our USP | Public Landing Page | 0:30 |
| **1. Property Officer Workflow** | Next task recommendation, explainable score, and capacity time-blocking | Officer Dashboard & Smart Planner | 2:00 |
| **2. The Signature Disruption** | Emergency lift entrapment arrives at Blk 214 | What-If Simulator Scenario Setup | 1:00 |
| **3. Operational Ripple Analysis** | Multi-level dependency cascade, statutory risks, and capacity deficits | Disruption Cascade & Dependency Chain | 1:30 |
| **4. Three Alternatives Compared** | No Action vs. Reschedule vs. Reassign; skill validation and trade-offs | Three Operational Alternatives Grid | 1:30 |
| **5. Closing & Architecture** | Human approval, OCC complementarity, full-stack roadmap | What-If Commit & Admin Governance | 0:30 |

---

## Preparation Checklist

1. **Start the local prototype server:**
   ```bash
   python prototype/serve.py
   ```
   Open **<http://localhost:8765/site/>** in Microsoft Edge or Google Chrome.  
   *(Fallback URL if running remotely: <https://feliciatanxl.github.io/SyncAI/site/index.html>)*
2. **Reset Demo State:**
   Sign in as Estate Manager (`manager@syncai.demo`), navigate to **Settings → Reset demo data**, and confirm. This guarantees consistent dates, tasks, and metrics.
3. **Demo Credentials:**
   - Property Officer: `officer@syncai.demo` | Password: `SyncAI-demo1` (Aisyah Rahman, Zone A)
   - Estate Manager: `manager@syncai.demo` | Password: `SyncAI-demo1` (Jennifer Ong, Estate Manager)
   - System Administrator: `admin@syncai.demo` | Password: `SyncAI-demo1` (System Admin)
4. **Presentation Fallback Plan:**
   If local Python hosting is interrupted, switch immediately to the hosted GitHub Pages prototype link. If browser storage becomes desynchronized, click **Reset demo data** in Settings or reload with `?selftest`.

---

## 0. Opening: The Problem & Our Flagship USP (0:30)

**Visual:** Landing page (<http://localhost:8765/site/>).

**Presenter Speaking Track:**
> "Good morning. In Singapore's Town Councils, each Property Officer oversees roughly 2,600 residential units. Every day, they face an impossible juggling act: urgent lift faults, statutory compliance deadlines, routine contractor checks, and hundreds of resident complaints.
>
> Generic to-do lists sort work simply by deadline or who shouts the loudest. That approach creates operational blindness.
>
> For EM Services Challenge PS 12i, Team 24 presents **SyncAI**, built on our flagship USP: **Operationally Aware AI Scheduling**, powered by our signature proposed differentiator: **Operational Ripple Intelligence**.
>
> SyncAI's promise is simple: *Know what matters. Understand what changes. Choose the safer plan.* Let's see how this works in a Property Officer's daily shift."

*Click **Sign in**, select **Property Officer (Aisyah Rahman)**, and enter the portal.*

---

## 1. Property Officer Walkthrough: Consequence-Aware Planning (2:00)

**Visual:** Officer Dashboard (<http://localhost:8765/#/dashboard>).

**Key Actions & Talking Points:**
1. **Explainable AI Recommendation:**
   - Point to the AI Daily Briefing: SyncAI recommends Aisyah begin her morning with **Lift inspection — Blk 208 (Lifts A & B)** (`t101`), due at 12:00 PM.
   - Click the task's **AI Score (88 pts)** to open the transparent score breakdown modal:
     - **Genuine Safety Hazard (+20 pts):** Direct risk of passenger entrapment following reported jerky stops.
     - **Mandatory Statutory Deadline (+20 pts):** Regulatory inspection window.
     - **Service Impact (+8 pts):** Major high-traffic lift core.
     - **Repeat Complaints (0 pts):** Point out explicitly that 6 repeat complaint calls received on a separate cleaning issue (`t106`) awarded exactly **0 priority points**. Volume is visible to the officer, but loudest voices never distort safety priorities.
2. **Capacity-Aware Smart Planner:**
   - Navigate to **Smart Planner** (<http://localhost:8765/#/planner>).
   - Click **Generate my plan**.
   - Show how tasks are automatically time-blocked around fixed commitments:
     - Morning inspection scheduled first.
     - Respects the 14:30 contractor meeting and 15:00 resident engagement call (`m1`, `m2`).
     - Incorporates travel buffers between estate blocks and protects lunch.
   - Click **Accept plan**. Aisyah's morning is organized, achievable, and operationally sound.

---

## 2. The Signature Disruption: Emergency Lift Breakdown (1:00)

**Visual:** Switch to Estate Manager view (<http://localhost:8765/site/login.html> → `manager@syncai.demo`). Open **What-If Simulator** (<http://localhost:8765/#/simulator>).

**Presenter Speaking Track:**
> "In estate management, no plan survives the morning unchanged. At 11:15 AM, an emergency hits: a lift breakdown with a trapped resident at Blk 214.
>
> An emergency physical inspection requires 2.5 hours of urgent effort. When an emergency strikes, what happens to the rest of the schedule?
>
> In typical operations, supervisors reassign work by guesswork, inadvertently causing secondary inspections to stall or statutory compliance deadlines to be missed. This is where **Operational Ripple Intelligence** comes in."

**Key Action:**
- Under Quick Scenarios, click the signature preset: **The Ripple Effect (Urgent Lift Incident)**.
- Point out the scenario parameters: Incident = Lift breakdown (resident trapped, 2.5h, Blk 214); Target Assignee = Aisyah Rahman (`o1`).
- Click **Run simulation**.

---

## 3. Operational Ripple Analysis: Tracing the Cascade (1:30)

**Visual:** Step 3: Operational Ripple Analysis card & Dependency Chain.

**Key Actions & Talking Points:**
1. **The Three-Stage Ripple Grid:**
   - **Column 1 (Trigger Disruption):** The 2.5-hour emergency absorbs Aisyah's remaining morning capacity, creating an immediate operational deficit.
   - **Column 2 (Displaced Routine Work):** SyncAI flags that Aisyah's planned morning tasks must be displaced.
   - **Column 3 (Downstream Dependents):** SyncAI traces how displacing this work cascades into secondary obligations.
2. **Multi-Level Dependency Cascade:**
   - Scroll down to the **Multi-Level Dependency Chain**:
   - Trace the exact 3-level chain:
     $$\text{Site check: ceiling seepage at Blk 211 } (t103) \longrightarrow \text{Resident follow-up call } (t104) \longrightarrow \text{Contractor work order } (t112)$$
   - Highlight the operational risks surfaced by the ripple engine:
     - If `t103` is deferred, resident call `t104` cannot proceed.
     - Work order `t112` slips past its cutoff, delaying water ingress repairs and risking structural reinforcement rebar corrosion.
     - Meanwhile, Aisyah's statutory co-funding claim for Blk 214 lighting (`t111`) faces deadline exposure.
> "SyncAI doesn't just ask 'who is free?'. It asks: 'If I move this task, what downstream obligations break?'"

---

## 4. Three Operational Alternatives Compared (1:30)

**Visual:** Step 4: Three Operational Alternatives Compared card.

**Presenter Speaking Track:**
> "Rather than forcing an opaque automated schedule change, SyncAI provides transparent decision support by evaluating **Three Meaningful Alternatives** side-by-side."

**Walk Through the Three Alternatives:**

1. **Alternative A: No Action (Status: Infeasible)**
   - Shows what happens if the team does not intervene: 2 overdue tasks, severe statutory compliance breaches, and cascading resident delays.
   - *Trade-off:* Zero coordination effort upfront, but severe regulatory and resident dissatisfaction risks.
2. **Alternative B: Reschedule Lower-Impact Tasks (Status: Feasible)**
   - Reorganises work within Aisyah's schedule: protects her statutory obligations and the urgent lift incident, while deferring routine admin and non-statutory inspections to later in the week.
   - *Trade-off:* Keeps work with the primary officer who knows the block, but delays 2 routine reports.
3. **Alternative C: Reassign Eligible Work (Status: Feasible / Featured)**
   - SyncAI searches the team for officers who have spare capacity *and* possess the required domain certification.
   - Point out **Skill Matching & Verification**:
     - Daniel Lim (`o4`) holds technical lift certifications and has spare capacity; he is recommended for technical tasks.
     - Point out the **Skill Mismatch Notice**: Priya Nair (`o3`) has available working hours but lacks the required technical lift certification. SyncAI explicitly flags her as ineligible for lift work, preventing compliance breaches.
4. **Recommendation Banner & Escalation Warning:**
   - Highlight the SyncAI Recommendation banner recommending Alternative C (or Alternative B depending on team load).
   - Mention that if total team capacity is exhausted, SyncAI displays an explicit **Manager Escalation Required** warning rather than generating an impossible plan.

---

## 5. Closing & Full-Stack Implementation Roadmap (0:30)

**Key Actions & Conclusion:**
1. **Human-in-the-Loop Sign-off:**
   - Scroll to Step 9: **Apply or Discard**.
   - Emphasize: *The live schedule has not changed.* Nothing is committed until the Estate Manager explicitly reviews the trade-offs and clicks **Apply to live schedule**.
2. **Complementing Existing Systems:**
   > "SyncAI does not seek to replace the Operations Command Centre. The OCC tells EMS where officers are right now; SyncAI gives officers and managers the forward-looking intelligence to plan achievable days and navigate disruptions safely."
3. **Current Build vs. Roadmap Truthfulness:**
   > "What you have seen in this demonstration is our interactive prototype running deterministic, explainable intelligence.
   >
   > In our separate production repository, we have already implemented the full-stack foundation: React 19, Express 5, PostgreSQL, and enterprise Microsoft Entra ID single sign-on with role-based access control and a 12-month audit trail.
   >
   > Our active next step is migrating these proven scheduling and ripple intelligence algorithms into the Express backend and connecting with Microsoft Graph."

---

## Anticipated Client Questions & Answers

| Question | Recommended Answer |
| --- | --- |
| **Is the AI a machine-learning model?** | No. Priority scoring, scheduling feasibility, and ripple dependency tracing are 100% deterministic, rules-based algorithms. For Town Council compliance and safety, scheduling must be repeatable, auditable, and mathematically explainable. Language models (like Azure OpenAI) are planned strictly for natural-language parsing (e.g. converting meeting notes to draft tasks). |
| **Did EM Services officially approve the scoring weights (+20 safety, +25 statutory)?** | No. These scoring weights represent our team's proposed baseline formulated directly from EMS kickstart guidance (prioritising genuine safety and statutory cut-offs over complaint volume). The weights are fully configurable and will be calibrated against EMS's Property Officer time studies. |
| **Does SyncAI duplicate the Operations Command Centre (OCC)?** | Not at all. The OCC provides real-time situational tracking (GPS locations, active incident alerts). SyncAI operates as a personal and team planning layer: forecasting feasibility, building daily schedules, and calculating downstream ripple impacts before work is shifted. |
| **Are Microsoft 365 services live today?** | In the prototype, M365 interactions (Outlook meetings, Teams alerts, To Do sync) are simulated. In the full-stack app, Microsoft Entra ID authentication is fully implemented with MSAL and JWT signature verification. Microsoft Graph and Power Automate integrations are designed and awaiting EMS tenant permissions. |
| **How does SyncAI protect resident and staff privacy (PDPA)?** | Minimal data collection. Staff absences record only general categories (MC or annual leave), never medical diagnoses. Audit logs are append-only and record access and governance actions only, with automated 12-month data retention policies. |

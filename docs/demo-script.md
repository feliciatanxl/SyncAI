# SyncAI — Operational Ripple Intelligence Demo Script

**A 7-minute presentation walkthrough of EM Services Challenge PS 12i — Smart Work Planner (Microsoft-based)**  
**Team:** IT2134 Team 24 | **Target Audience:** Lecturers, EM Services Representatives, and Solution Architects  
**Core Message:** *"Know what matters. Understand what changes. Choose the safer plan."*

---

## Demonstration Overview & Timings

| Segment | Speaker Focus | Screen / View | Duration |
| --- | --- | --- | --- |
| **0. Opening & Context** | The Town Council Property Officer scheduling dilemma; our USP | Public Landing Page | 0:30 |
| **1. Property Officer Workflow** | SLAs, fixed appointments, client prioritisation, and capacity time-blocking | Officer Dashboard & Commitments | 1:45 |
| **2. The Signature Disruption** | Emergency lift entrapment arrives at Blk 214 (OCC mock telemetry) | What-If Simulator Scenario Setup | 0:45 |
| **3. Operational Ripple Analysis** | Multi-level cascade, statutory risks, SLA breaches, and appointment preservation | Disruption Cascade & Dependency Chain | 1:15 |
| **4. Three Alternatives Compared** | No Action vs. Reschedule vs. Reassign; skill validation and governance | Three Operational Alternatives Grid | 1:15 |
| **5. Hierarchical Approvals & Alerts** | Manager approval queue, self-approval guardrails, WhatsApp/Teams alerts | Manager Dashboard & Alerts View | 1:00 |
| **6. Closing & Architecture** | Human sign-off, OCC complementarity, full-stack roadmap | Governance & Summary | 0:30 |

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

## 1. Property Officer Walkthrough: Consequence-Aware Planning (1:45)

**Visual:** Officer Dashboard (<http://localhost:8765/#/dashboard>).

**Key Actions & Talking Points:**
1. **Explainable AI Recommendation & Client Prioritisation:**
   - Point to the AI Daily Briefing: SyncAI recommends Aisyah begin her morning with **Lift inspection — Blk 208 (Lifts A & B)** (`t101`), due at 12:00 PM.
   - Click the task's **AI Score (88 pts)** to open the transparent score breakdown modal:
     - **Client 4-Tier Assessment Breakdown:** Demonstrates how the task maps against EM Services' stated criteria:
       - *1. Service Focus:* High-traffic residential lift core.
       - *2. Safety Focus:* Passenger entrapment prevention.
       - *3. Residents' Well-Being:* Essential daily vertical transport.
       - *4. Actual Concern / Urgency:* Emergency SLA deadline (`slaDue: 12:00`).
     - **Safety & Statutory Constraints:** Direct risk (+20 pts) and statutory compliance (+20 pts) ensure hard regulatory dates are protected.
     - **Repeat Complaints (0 pts):** Point out explicitly that 6 repeat complaint calls received on a separate cleaning issue (`t106`) awarded exactly **0 priority points**. Volume is visible to the officer, but loudest voices never distort safety priorities.
     - **Configurable Model Notice:** Note the clear banner stating these weights represent Team 24's proposed operational model awaiting formal EMS calibration.
2. **Fixed Commitments & SLA Tracking:**
   - Point to the **Fixed Commitments & SLAs** card on Aisyah's dashboard:
     - Shows the **10:00 AM joint inspection appointment** with resident Mr. Tan at Blk 211 (`t103`).
     - Highlights the **12:00 PM Emergency SLA cut-off** for Blk 208 (`t101`).
3. **Proposing an Adjustment (Hierarchical Workflow):**
   - Click **Request adjustment** on task `t103`:
   - Note that Property Officers cannot unilaterally approve restricted schedule shifts. An approval request modal opens pre-filled for assigned manager **Jennifer Ong**, explaining the reason and operational impact.
4. **Capacity-Aware Smart Planner:**
   - Navigate to **Smart Planner** (<http://localhost:8765/#/planner>) and click **Generate my plan**.
   - Show how tasks are automatically time-blocked around fixed commitments, meetings (`m1`, `m2`), travel buffers, and lunch. Accept the plan.

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
   - Shows what happens if the team does not intervene: 2 overdue tasks, severe statutory compliance breaches, 1 breached SLA, 1 missed resident appointment, and cascading delays.
   - *Trade-off:* Zero coordination effort upfront, but catastrophic regulatory and resident satisfaction failure.
2. **Alternative B: Reschedule Lower-Impact Tasks (Status: Feasible)**
   - Reorganises work within Aisyah's schedule: protects her statutory obligations, the urgent lift incident, and her 10:00 AM joint inspection appointment, while deferring routine admin and non-statutory inspections to later in the week.
   - *Trade-off:* Keeps work with the primary officer who knows the block, but delays 2 routine reports.
3. **Alternative C: Reassign Eligible Work (Status: Feasible / Featured)**
   - SyncAI searches the team for officers who have spare capacity *and* possess the required domain certification.
   - Point out **Skill Matching & Verification**:
     - Daniel Lim (`o4`) holds technical lift certifications and has spare capacity; he is recommended for technical tasks.
     - Point out the **Skill Mismatch Notice**: Priya Nair (`o3`) has available working hours but lacks the required technical lift certification. SyncAI explicitly flags her as ineligible for lift work, preventing compliance breaches.
   - **SLA & Appointment Protection:** Confirms that Daniel Lim can meet the 12:00 PM SLA cut-off without disrupting other resident appointments.
4. **Recommendation Banner & Escalation Warning:**
   - Highlight the SyncAI Recommendation banner recommending Alternative C (or Alternative B depending on team load).
   - Point out the **Management Hierarchy Governance Notice**: Reassignments across officers cannot be executed unilaterally by front-line staff; they require formal Estate Manager sign-off.

---

## 5. Hierarchical Approvals & Auditable Communications (1:00)

**Visual:** Switch to Estate Manager Dashboard (<http://localhost:8765/#/dashboard>) and Alerts (<http://localhost:8765/#/alerts>).

**Key Actions & Talking Points:**
1. **Manager Approval Queue:**
   - On the Estate Manager Dashboard, show the **Pending Operational Approvals** card:
     - View pending requests submitted by Property Officers (e.g. Aisyah requesting reschedule of `t103`).
     - Point out the decision buttons: **Approve**, **Reject**, **Escalate**, and **View Audit**.
     - Click **Approve**: the schedule adjustment takes effect immediately, and an immutable audit record is committed.
   - **Self-Approval Guardrail:** Note that when logged in as an officer, the user cannot approve their own restricted requests.
2. **Auditable Multi-Channel Communications:**
   - Navigate to **Alerts** (<http://localhost:8765/#/alerts>).
   - Point out the channel tabs: **All**, **WhatsApp (Proposed)**, **Microsoft Teams (Proposed)**, and **In-App**.
   - Click the **WhatsApp** tab:
     - Show simulated WhatsApp notification for emergency assignment `t113` and approval request `appr-101`.
     - Highlight the **Privacy-Safe Content**: contains zero sensitive resident details, only an operational reference and deep link (`syncai://approval/appr-101`).
     - Clicking the notification opens the in-app approval modal directly, maintaining full auditability and authentication within SyncAI.
     - Emphasize to the audience: *No real WhatsApp Business API or Meta credentials are used; this is a simulated privacy-first communication adapter.*

---

## 6. Closing & Full-Stack Implementation Roadmap (0:30)

**Key Actions & Conclusion:**
1. **Human-in-the-Loop Sign-off:**
   - Emphasize: *The live schedule is never modified automatically by AI.* Every re-plan requires authorized human sign-off following the established management hierarchy.
2. **Complementing Existing Systems:**
   > "SyncAI does not replace the Operations Command Centre. The OCC gives real-time situational tracking; SyncAI provides forward-looking operational planning, SLA compliance, and downstream consequence intelligence."
3. **Current Build vs. Roadmap Truthfulness:**
   > "What you have seen in this demonstration is our interactive prototype running deterministic, explainable intelligence with 56 automated tests.
   >
   > In our separate production repository, we have already implemented the full-stack foundation: React 19, Express 5, PostgreSQL, and enterprise Microsoft Entra ID single sign-on with role-based access control and a 12-month audit trail.
   >
   > Our active next step is migrating these proven scheduling and ripple intelligence algorithms into the Express backend and connecting with Microsoft Graph."

---

## Anticipated Client Questions & Answers

| Question | Recommended Answer |
| --- | --- |
| **Is the AI a machine-learning model?** | No. Priority scoring, scheduling feasibility, and ripple dependency tracing are 100% deterministic, rules-based algorithms. For Town Council compliance and safety, scheduling must be repeatable, auditable, and mathematically explainable. Language models (like Azure OpenAI) are planned strictly for natural-language parsing (e.g. converting meeting notes to draft tasks). |
| **Did EM Services officially approve the scoring weights (+20 safety, +25 statutory)?** | No. These scoring weights represent our team's proposed baseline formulated from EMS kickstart guidance. The prototype also displays EMS's stated 4-tier criteria (Service, Safety, Well-being, Urgency). The weights are fully configurable and will be calibrated against EMS's Property Officer time studies. |
| **Why doesn't Service outrank Safety if EMS listed Service first?** | In operational Town Council environments, imminent physical danger (trapped lift passengers, falling spalling concrete) and statutory regulations (BCA/SCDF) represent mandatory legal obligations that cannot be deferred for routine service requests. Our model treats safety and statutory compliance as non-negotiable boundaries while ranking service and well-being within achievable work. |
| **Does SyncAI duplicate the Operations Command Centre (OCC)?** | Not at all. The OCC provides real-time situational tracking (GPS locations, active incident alerts). SyncAI operates as a personal and team planning layer: forecasting feasibility, building daily schedules, protecting SLAs, and calculating downstream ripple impacts before work is shifted. The prototype ingests mock OCC feeds (`OCC (Mock)`). |
| **Is WhatsApp integrated with Meta APIs?** | No. WhatsApp is implemented strictly as a simulated notification adapter with privacy-safe payloads and secure deep links back to SyncAI. No external WhatsApp Business API, Meta credentials, or third-party connections are used. All approvals occur securely inside SyncAI. |
| **How does hierarchical approval work?** | In accordance with EMS's management structure, Property Officers can request schedule shifts, but restricted changes require review and sign-off by their assigned Estate Manager. Front-line officers are technically prevented from self-approving their own restricted requests. |
| **Are Microsoft 365 services live today?** | In the prototype, M365 interactions (Outlook meetings, Teams alerts, To Do sync) are simulated. In the full-stack app, Microsoft Entra ID authentication is fully implemented with MSAL and JWT signature verification. Microsoft Graph and Power Automate integrations are designed and awaiting EMS tenant permissions. |
| **How does SyncAI protect resident and staff privacy (PDPA)?** | Minimal data collection. Staff absences record only general categories (MC or annual leave), never medical diagnoses. Audit logs are append-only and record access and governance actions only, with automated 12-month data retention policies. Simulated notifications omit resident personal details. |

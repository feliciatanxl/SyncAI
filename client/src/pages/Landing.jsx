import { Link } from 'react-router-dom'
import {
  ArrowRight20Regular,
  CalendarLtr24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Eye24Regular,
  LockClosed24Regular,
  PeopleSwap24Regular,
  PersonFeedback24Regular,
  ShieldCheckmark24Regular,
  TaskListLtr24Regular,
} from '@fluentui/react-icons'
import SiteLayout from '../components/SiteLayout.jsx'
import { MicrosoftLogo } from '../components/Brand.jsx'

const PROBLEMS = [
  { icon: <TaskListLtr24Regular />, title: 'Many demands at once', text: 'Operations teams juggle inspections, customer requests, contractor follow-ups and admin, often across thousands of units each.' },
  { icon: <PersonFeedback24Regular />, title: 'Loudest is not most urgent', text: 'The most frequent complaint is not automatically the priority. Genuine safety risks and mandatory deadlines are.' },
  { icon: <Clock24Regular />, title: 'Plans that do not fit the day', text: 'Urgent work arrives mid-day. Without a realistic plan, it is hard to see what can move and what cannot.' },
]

const CAPABILITIES = [
  { n: '01', icon: <ShieldCheckmark24Regular />, title: 'Smart priority', text: 'Ranks tasks by safety, mandatory deadlines, service impact and long-term consequences, and shows the reason for every score.' },
  { n: '02', icon: <CalendarLtr24Regular />, title: 'Realistic planning', text: 'Proposes daily and weekly schedules around task durations, availability, meetings and existing commitments.' },
  { n: '03', icon: <PeopleSwap24Regular />, title: 'Team rebalancing', text: 'Spots capacity problems when someone is away or urgent work lands, and suggests changes for a manager to approve.' },
]

const FACTORS = [
  { n: 1, title: 'Safety', text: 'Genuine risks to people, staff and property.' },
  { n: 2, title: 'Mandatory deadlines', text: 'Statutory, regulatory, contractual and funding-approval dates that cannot slip.' },
  { n: 3, title: 'Service impact & long-term consequences', text: 'Real customer needs and what happens if the work waits. Not who complains loudest.' },
  { n: 4, title: 'Scheduling feasibility', text: 'Estimated task durations matched to each person’s free time and capacity.' },
]

const STEPS = [
  { title: 'Sign in with Microsoft', text: 'Use your organisation’s Microsoft account. No separate SyncAI password.' },
  { title: 'Review your plan', text: 'SyncAI ranks your tasks and drafts a day that fits around your Outlook meetings.' },
  { title: 'Approve the changes', text: 'Move anything you like, then accept. Nothing changes until you or your manager say so.' },
]

const INTEGRATIONS = ['Microsoft Entra ID', 'Outlook Calendar', 'Microsoft To Do', 'Power Automate', 'Microsoft Teams']

const TRUST = [
  { icon: <Eye24Regular />, title: 'Explainable', text: 'Every score, estimate and suggestion lists the reasons behind it.' },
  { icon: <CheckmarkCircle24Regular />, title: 'Human approval', text: 'AI recommends. A team member or manager approves every change, and every approval is logged.' },
  { icon: <LockClosed24Regular />, title: 'Private by design', text: 'Role-based access through Microsoft Entra ID. Absences are recorded as MC or leave only, never medical details.' },
]

export default function Landing() {
  return (
    <SiteLayout>
      <section className="hero">
        <div className="wrap hero-inner">
          <div>
            <p className="eyebrow">AI Smart Work Planner</p>
            <h1>Plan the day your team actually has.</h1>
            <p className="lead">
              SyncAI ranks work the way real operations run, safety first and deadlines protected, then fits it into the time each person has. When urgent work lands, it explains what should move.
            </p>
            <div className="hero-actions">
              <Link to="/login" className="btn-microsoft"><MicrosoftLogo /> Sign in with Microsoft</Link>
              <a href="#how" className="btn-ghost">See how it works <ArrowRight20Regular /></a>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="section" aria-labelledby="problem-h">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">The challenge</p>
            <h2 id="problem-h">Competing demands, limited hours</h2>
          </div>
          <div className="grid-3">
            {PROBLEMS.map((p) => (
              <article key={p.title} className="card">
                <span className="card-icon">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="capabilities" aria-labelledby="cap-h">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Operationally aware AI scheduling</p>
            <h2 id="cap-h">Understand priorities. Build achievable plans. Explain the changes.</h2>
          </div>
          <div className="grid-3">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="card">
                <div className="card-top"><span className="card-icon">{c.icon}</span><span className="card-num">{c.n}</span></div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="priority" aria-labelledby="priority-h">
        <div className="wrap split">
          <div className="section-head left">
            <p className="eyebrow">Priority logic</p>
            <h2 id="priority-h">Ranked by what matters on the ground</h2>
            <p className="lead">Four operational factors, weighed together and tunable to your organisation’s own rules.</p>
          </div>
          <ol className="factors">
            {FACTORS.map((f) => (
              <li key={f.n}>
                <span className="factor-n" aria-hidden="true">{f.n}</span>
                <div><h3>{f.title}</h3><p>{f.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt" id="how" aria-labelledby="how-h">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-h">From a long task list to an approved plan</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card">
                <span className="step-n">Step {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="integrations">
            <p className="muted small">Works with the Microsoft 365 tools your team already uses</p>
            <ul className="pills">{INTEGRATIONS.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section" id="trust" aria-labelledby="trust-h">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Responsible AI</p>
            <h2 id="trust-h">AI that shows its working</h2>
          </div>
          <div className="grid-3">
            {TRUST.map((t) => (
              <article key={t.title} className="card">
                <span className="card-icon">{t.icon}</span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap cta-inner">
          <h2>Smarter priorities. More realistic plans.</h2>
          <Link to="/login" className="btn-microsoft on-dark"><MicrosoftLogo /> Sign in with Microsoft</Link>
        </div>
      </section>
    </SiteLayout>
  )
}

// Illustrative preview of the planner, built from markup so it stays crisp and themeable.
function HeroPreview() {
  const rows = [
    { time: '08:30', title: 'Lift inspection · Block A', tag: 'Safety', tone: 'danger' },
    { time: '10:00', title: 'Funding claim submission', tag: 'Statutory', tone: 'warning' },
    { time: '11:30', title: 'Water leak check · Block C', tag: 'Service', tone: 'brand' },
    { time: '14:00', title: 'Contractor claim review', tag: 'Admin', tone: 'neutral' },
  ]
  return (
    <figure className="preview" aria-label="Example of a SyncAI daily plan">
      <div className="preview-head">
        <strong>Today’s plan</strong>
        <span className="preview-fit">Fits your day · 6.5h of 7h</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.time}>
            <span className="preview-time">{r.time}</span>
            <span className="preview-title">{r.title}</span>
            <span className={`tag tag-${r.tone}`}>{r.tag}</span>
          </li>
        ))}
      </ul>
      <figcaption className="preview-note">
        <ShieldCheckmark24Regular /> Urgent leak at Block D? Safety and statutory work stay in place; the claim review moves to 15:30.
      </figcaption>
    </figure>
  )
}

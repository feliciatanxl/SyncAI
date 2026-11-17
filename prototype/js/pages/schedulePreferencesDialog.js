import { getState, storage, update } from '../state.js';
import { schedulePreferences, saveSchedulePreferences, WORKING_DAYS } from '../schedulePreferences.js';
import { closeModal, html, openModal, toast } from '../ui.js';

export function openSchedulePreferences(officer) {
  const prefs = schedulePreferences(getState(), officer.id);
  const customLunchCount = Object.keys(prefs.lunchByDay || {}).length;
  const time = (name, label, value, required = false) => html`<label>${label}
    <input name="${name}" type="time" value="${value}" ${required ? 'required' : ''} />
  </label>`;
  openModal(html`
    <header class="task-details-header">
      <div><h2 class="modal-title" id="modal-title">Schedule Preferences</h2>
        <p class="small muted">${officer.name} · Singapore time (UTC+08:00)</p></div>
    </header>
    <form id="schedule-preferences-form" class="schedule-preferences-form">
      <div class="task-details-body schedule-preferences-body">
      <p class="capture-error" role="alert" tabindex="-1" hidden></p>
      <section class="schedule-preference-section" aria-labelledby="working-schedule-title">
        <h3 id="working-schedule-title">Working Schedule</h3>
        <fieldset class="schedule-working-days">
          <legend>Working days</legend>
          <div class="schedule-day-options">${WORKING_DAYS.map((day, index) => html`
            <label><input class="visually-hidden" type="checkbox" name="days" aria-label="${day}" value="${index + 1}" ${prefs.days.includes(index + 1) ? 'checked' : ''} />
              <span>${day.slice(0, 3)}</span></label>
          `)}</div>
        </fieldset>
        <div class="schedule-time-pair">
          ${time('workStart', 'Start time', prefs.workStart, true)}
          ${time('workEnd', 'End time', prefs.workEnd, true)}
        </div>
      </section>
      <section class="schedule-preference-section" aria-labelledby="schedule-lunch-title">
        <h3 id="schedule-lunch-title">Lunch Break</h3>
        <div class="schedule-time-pair">
          ${time('lunchStart', 'Default lunch start', prefs.lunchStart)}
          ${time('lunchEnd', 'Default lunch end', prefs.lunchEnd)}
        </div>
        <details class="schedule-lunch schedule-preference-disclosure" data-preference-section="custom-lunch">
        <summary>Lunch times by day ${customLunchCount ? html`<span class="small muted">· ${customLunchCount} customised</span>` : ''}</summary>
        <p class="small muted">Set a different lunch window on any working day. Leave both times blank to use the default.</p>
        <div class="schedule-lunch-days">
          ${WORKING_DAYS.map((day, index) => {
            const key = index + 1;
            const lunch = prefs.lunchByDay?.[key];
            return html`<fieldset class="schedule-lunch-day" data-lunch-day="${key}" ${prefs.days.includes(key) ? '' : 'hidden disabled'}>
              <legend>${day}</legend>
              <div class="schedule-time-pair">
                ${time(`lunchStart${key}`, 'Start', lunch?.start)}
                ${time(`lunchEnd${key}`, 'End', lunch?.end)}
              </div>
            </fieldset>`;
          })}
        </div>
        </details>
      </section>
      <details class="schedule-preference-section schedule-preference-disclosure" data-preference-section="focus">
        <summary>Focus Periods <span class="small muted">(Optional)</span>
          <span class="schedule-focus-summary small muted">${prefs.focus.length ? prefs.focus.map(({ start, end }) => `${start}–${end}`).join(' · ') : 'None set'}</span>
        </summary>
        ${[0, 1].map((index) => html`<div class="schedule-time-pair">
          ${time(`focusStart${index}`, `Focus period ${index + 1} start`, prefs.focus[index]?.start)}
          ${time(`focusEnd${index}`, `Focus period ${index + 1} end`, prefs.focus[index]?.end)}
        </div>`)}
      </details>
      <section class="schedule-preference-section" aria-labelledby="workload-limit-title">
      <h3 id="workload-limit-title">Workload Limit</h3>
      <label class="schedule-hours-limit">Maximum daily working hours
        <input name="maxHours" type="number" min="0.01" max="24" step="0.01"
          value="${Number((prefs.maxMinutes / 60).toFixed(2))}" required />
      </label>
      </section>
      </div>
      <footer class="task-details-footer">
        <button type="button" class="btn-secondary btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">Save Preferences</button>
      </footer>
    </form>
  `, { variant: 'task-details-modal schedule-preferences-modal' });
  const form = document.getElementById('schedule-preferences-form');
  form.addEventListener('invalid', (event) => {
    const section = event.target.closest('details');
    if (section) section.open = true;
  }, true);
  form.addEventListener('change', (event) => {
    if (event.target.name !== 'days') return;
    const day = form.querySelector(`[data-lunch-day="${event.target.value}"]`);
    day.hidden = day.disabled = !event.target.checked;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const days = values.getAll('days');
    try {
      update((state) => saveSchedulePreferences(state, officer.id, {
        ...Object.fromEntries(values),
        days,
        lunchByDay: Object.fromEntries(days.map((day) => [day, {
          start: values.get(`lunchStart${day}`), end: values.get(`lunchEnd${day}`),
        }])),
        focus: [0, 1].map((index) => ({ start: values.get(`focusStart${index}`), end: values.get(`focusEnd${index}`) })),
      }));
    } catch (error) {
      for (const section of form.querySelectorAll('[data-preference-section]')) {
        if (error.sections?.includes(section.dataset.preferenceSection)) section.open = true;
      }
      const message = form.querySelector('[role="alert"]');
      message.hidden = false;
      message.textContent = error.message;
      message.focus();
      return;
    }
    closeModal();
    toast(storage.ok ? 'Schedule preferences saved.' : 'Preferences saved for this session.', storage.ok ? 'success' : 'info');
  });
}

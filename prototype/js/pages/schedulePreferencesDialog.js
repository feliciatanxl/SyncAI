import { getState, storage, update } from '../state.js';
import { schedulePreferences, saveSchedulePreferences, WORKING_DAYS } from '../schedulePreferences.js';
import { closeModal, html, openModal, toast } from '../ui.js';

export function openSchedulePreferences(officer) {
  const prefs = schedulePreferences(getState(), officer.id);
  const time = (name, label, value, required = false) => html`<label>${label}
    <input name="${name}" type="time" value="${value}" ${required ? 'required' : ''} />
  </label>`;
  openModal(html`
    <h2 class="modal-title" id="modal-title">Schedule preferences</h2>
    <form id="schedule-preferences-form" class="capture-form">
      <p class="capture-wide small muted">${officer.name} · Singapore time (UTC+08:00)</p>
      <p class="capture-wide capture-error" role="alert" hidden></p>
      <fieldset class="capture-wide schedule-days">
        <legend>Working days</legend>
        <div class="capture-checks">${WORKING_DAYS.map((day, index) => html`
          <label><input type="checkbox" name="days" value="${index + 1}" ${prefs.days.includes(index + 1) ? 'checked' : ''} /> ${day}</label>
        `)}</div>
      </fieldset>
      ${time('workStart', 'Working start', prefs.workStart, true)}
      ${time('workEnd', 'Working end', prefs.workEnd, true)}
      ${time('lunchStart', 'Lunch start', prefs.lunchStart)}
      ${time('lunchEnd', 'Lunch end', prefs.lunchEnd)}
      ${[0, 1].map((index) => html`
        ${time(`focusStart${index}`, `Focus period ${index + 1} start`, prefs.focus[index]?.start)}
        ${time(`focusEnd${index}`, `Focus period ${index + 1} end`, prefs.focus[index]?.end)}
      `)}
      <label class="capture-wide">Maximum daily working hours
        <input name="maxHours" type="number" min="0.01" max="24" step="0.01"
          value="${Number((prefs.maxMinutes / 60).toFixed(2))}" required />
      </label>
      <div class="modal-actions capture-wide">
        <button type="button" class="btn-secondary btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">Save preferences</button>
      </div>
    </form>
  `);
  const form = document.getElementById('schedule-preferences-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    try {
      update((state) => saveSchedulePreferences(state, officer.id, {
        ...Object.fromEntries(values),
        days: values.getAll('days'),
        focus: [0, 1].map((index) => ({ start: values.get(`focusStart${index}`), end: values.get(`focusEnd${index}`) })),
      }));
    } catch (error) {
      const message = form.querySelector('[role="alert"]');
      message.hidden = false;
      message.textContent = error.message;
      return;
    }
    closeModal();
    toast(storage.ok ? 'Schedule preferences saved.' : 'Preferences saved for this session.', storage.ok ? 'success' : 'info');
  });
}

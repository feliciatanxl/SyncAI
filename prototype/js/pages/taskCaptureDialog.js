import { CATEGORIES, PRIORITIES } from '../data.js';
import { accessibleCase, visibleCases } from '../cases.js';
import { getState, storage, update } from '../state.js';
import { saveCapturedTask, taskAssignees, taskDateInput, taskDuration } from '../taskCapture.js';
import { suggestCategory } from '../taskIntelligence.js';
import { closeModal, html, openModal, toast } from '../ui.js';

const options = (items, selected) => items.map(([value, label]) => html`
  <option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>
`);

export function openTaskCapture({ task, caseId, onCreate } = {}) {
  const state = getState();
  const officers = taskAssignees(state, task);
  if (!officers.length) {
    toast('No eligible officers are available for assignment.', 'error');
    return;
  }
  const relatedCase = accessibleCase(state, task?.caseId ?? caseId);
  const fromCase = !task && !!caseId && !!relatedCase;
  const cases = visibleCases(state);
  const caseOfficer = officers.find((officer) => officer.id === relatedCase?.ownerId);
  const officerId = task?.ownerId ?? caseOfficer?.id ?? (officers.length === 1 ? officers[0].id : '');
  const schedulingType = task?.schedulingType || 'flexible';
  openModal(html`
    <h2 id="modal-title" class="modal-title">${task ? 'Edit task' : 'Create task'}</h2>
    <form id="capture-task-form" class="capture-form">
      <p class="capture-wide small muted">Dates and times use Singapore time (UTC+08:00).</p>
      <p class="capture-wide capture-error" role="alert" hidden></p>
      <label class="capture-wide">Task title
        <input name="title" value="${task?.title}" required maxlength="160" autofocus />
      </label>
      <label class="capture-wide">Task description
        <textarea name="description" rows="3" required maxlength="4000">${task?.description}</textarea>
      </label>
      ${fromCase ? html`
        <label class="capture-wide">Case
          <input value="${relatedCase.number} · ${relatedCase.title}" readonly />
          <input type="hidden" name="caseId" value="${relatedCase.id}" />
        </label>` : !task?.caseId || relatedCase ? html`
        <label class="capture-wide">Case (optional)
          <select name="caseId">
            <option value="">No case</option>
            ${options(cases.map((record) => [record.id, `${record.number} · ${record.title}`]), relatedCase?.id)}
          </select>
        </label>` : ''}
      <label>Task category
        <select name="category" required>
          <option value="">Select a category</option>
          ${options(CATEGORIES.map((value) => [value, value]), task?.category)}
        </select>
      </label>
      <label>Task priority
        <select name="priority" required>
          <option value="">Select a priority</option>
          ${options(PRIORITIES.map((value) => [value, value]), task?.priority)}
        </select>
      </label>
      <div class="capture-wide category-suggestion" hidden>
        <p class="small muted" role="status"></p>
        <button type="button" class="btn-secondary btn-sm" data-use-category>Use suggestion</button>
      </div>
      <label class="capture-wide">Tags (optional)
        <input name="tags" value="${task?.tags?.join(', ')}" maxlength="270" aria-describedby="task-tag-help" />
        <span id="task-tag-help" class="small muted">Separate up to eight tags with commas.</span>
      </label>
      <label>Assigned officer
        <select name="ownerId" required>
          <option value="">Select an officer</option>
          ${options(officers.map((officer) => [officer.id, officer.name]), officerId)}
        </select>
      </label>
      <label>Estimated duration (minutes)
        <input type="number" name="estimatedDurationMinutes" min="1" max="2147483647" step="1"
          value="${task ? taskDuration(task) : ''}" required />
      </label>
      <label>Due date and time
        <input type="datetime-local" name="due" value="${taskDateInput(task?.dueAt || task?.due)}" required />
      </label>
      <label>Scheduling type
        <select name="schedulingType">
          ${options([['flexible', 'Flexible'], ['fixed', 'Fixed']], schedulingType)}
        </select>
      </label>
      <label data-fixed-start ${schedulingType === 'fixed' ? '' : 'hidden'}>Fixed start date and time
        <input type="datetime-local" name="fixedStart" value="${taskDateInput(task?.fixedStartAt)}"
          ${schedulingType === 'fixed' ? 'required' : 'disabled'} />
      </label>
      <label class="capture-wide">Estate / Site / Block
        <input name="location" value="${task?.location}" maxlength="160" />
      </label>
      <label class="capture-wide">Additional remarks
        <textarea name="remarks" rows="2" maxlength="4000">${task?.remarks}</textarea>
      </label>
      <div class="capture-wide capture-checks">
        <label><input type="checkbox" name="safety" ${task?.safety ? 'checked' : ''} /> Resident safety risk</label>
        <label><input type="checkbox" name="statutory" ${task?.statutory ? 'checked' : ''} /> Statutory deadline</label>
      </div>
      <div class="modal-actions capture-wide">
        <button type="button" class="btn-secondary btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">${task ? 'Save changes' : 'Create task'}</button>
      </div>
    </form>
  `);

  const form = document.getElementById('capture-task-form');
  const suggestion = form.querySelector('.category-suggestion');
  const suggestionText = suggestion.querySelector('p');
  const useSuggestion = suggestion.querySelector('button');
  function refreshSuggestion() {
    const match = suggestCategory(form.elements.title.value, form.elements.description.value);
    suggestion.hidden = !match || match.category === form.elements.category.value;
    suggestionText.textContent = match ? `Simulated keyword suggestion: ${match.category} (matched “${match.keyword}”).` : '';
    useSuggestion.value = match?.category || '';
  }
  form.elements.title.addEventListener('input', refreshSuggestion);
  form.elements.description.addEventListener('input', refreshSuggestion);
  form.elements.category.addEventListener('change', refreshSuggestion);
  useSuggestion.addEventListener('click', () => {
    form.elements.category.value = useSuggestion.value;
    refreshSuggestion();
    form.elements.category.focus();
  });
  refreshSuggestion();
  const start = form.elements.fixedStart;
  form.elements.schedulingType.addEventListener('change', (event) => {
    const fixed = event.target.value === 'fixed';
    form.querySelector('[data-fixed-start]').hidden = !fixed;
    start.required = fixed;
    start.disabled = !fixed;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      update((state) => {
        saveCapturedTask(state, Object.fromEntries(new FormData(form)), task?.id);
        if (!task) onCreate?.();
      });
    } catch (error) {
      const message = form.querySelector('[role="alert"]');
      message.hidden = false;
      message.textContent = error.message;
      return;
    }
    closeModal();
    toast(storage.ok ? (task ? 'Task updated.' : 'Task created.') : 'Saved for this session. Browser storage is unavailable.',
      storage.ok ? 'success' : 'error');
  });
}

import { diseases, combinations, diseaseFor } from './catalog.js';
import { emptyRecord, recordFor, cloneState, createEntryId, today } from './model.js';
import { AGE_GROUPS, PLANS, includedDiseases, referenceFor, planNotes } from './plans.js';
import { vaccinationStatus, HISTORY_CREDIT } from './status.js';
import { $, modal, openModal, error, esc, btn, dateLabel } from './ui.js';

// Forms work on a copy; the controller persists it before showing success.
export function createForms({ getState, save }) {
  function entryDialog(kind = 'dose', id = '', entryId = '') {
    const illness = kind === 'illness';
    const collection = illness ? 'illnesses' : 'doses';
    const existing = recordFor(getState(), id)[collection].find((entry) => entry.id === entryId);
    const title = existing
      ? `Edit ${illness ? 'illness' : 'vaccination'}`
      : illness
        ? 'An illness, recorded.'
        : 'A little care, recorded.';
    openModal(
      title,
      `
      ${
        !existing
          ? `<div class="tabs entry-tabs">${[
              ['dose', 'Vaccination'],
              ['illness', 'Illness'],
            ]
              .map(
                ([type, label]) =>
                  `<button type="button" data-action="${type === 'dose' ? 'log' : 'illness'}" data-id="${id}" class="${kind === type ? 'active' : ''}" aria-pressed="${kind === type}">${label}</button>`,
              )
              .join('')}</div>`
          : ''
      }
      <p class="modal-intro">${illness ? 'Record when the illness started. Confirmation and recovery help distinguish supported history from an illness that still needs review.' : 'Add a date from your vaccination card. Combination vaccines create a separate entry for each disease.'}</p>
      <form id="entry-form" class="form-grid">
        <label>${illness ? 'Disease' : 'Vaccination'}<select name="disease" required ${existing ? 'disabled' : ''}>
          <option value="">Choose ${illness ? 'a disease' : 'a disease or combination'}</option>
          ${!illness ? `<optgroup label="Combination vaccines">${combinations.map((combo) => `<option value="combo:${combo.id}">${combo.name}</option>`).join('')}</optgroup>` : ''}
          <optgroup label="Diseases">${diseases.map((disease) => `<option value="${disease.id}" ${id === disease.id ? 'selected' : ''}>${disease.name}</option>`).join('')}</optgroup>
        </select></label>
        <label>${illness ? 'Illness start date' : 'Vaccination date'}<input name="date" type="date" min="1900-01-01" max="${today()}" required value="${existing?.date || today()}"></label>
        ${
          illness
            ? `
          <label>Duration in days <span class="small muted">Optional</span><input name="duration" type="number" min="1" max="3650" step="1" value="${existing?.duration ?? ''}" placeholder="Leave blank if unknown or ongoing"></label>
          <label class="check-field"><input name="confirmed" type="checkbox" ${existing?.confirmed ? 'checked' : ''}><span>Confirmed by a clinician or laboratory</span></label>
          <label class="check-field"><input name="recovered" type="checkbox" ${existing?.recovered ? 'checked' : ''}><span>I have recovered from this illness</span></label>
          <p id="illness-guidance" class="notice small"></p>`
            : `
          <label>Vaccine type / brand <span class="muted small">Optional</span><input name="type" maxlength="120" placeholder="e.g. Boostrix or MMR" value="${esc(existing?.type || '')}"></label>
          <small>Reference targets work automatically. Set a personal target or booster reminder in Edit plan.</small>`
        }
        <small>Adding a new entry outside your checklist makes this disease personally tracked.</small>
        <div class="modal-actions">${existing ? btn('delete', `Delete ${illness ? 'illness' : 'dose'}`, '', 'danger text', `data-id="${id}" data-entry="${entryId}" data-kind="${kind}"`) : ''}
          ${btn('close', 'Cancel')}<button class="btn primary" type="submit">Save ${illness ? 'illness' : 'vaccination'}</button></div>
      </form>`,
    );
    const form = $('#entry-form');
    if (illness) {
      const updateHint = () => {
        $('#illness-guidance').textContent = HISTORY_CREDIT.has(form.elements.disease.value)
          ? 'Confirmed, recovered history can satisfy the completion criterion for this disease. This log does not verify immunity.'
          : 'Illness history is kept, but does not replace vaccine doses for this disease. Review vaccination needs with your clinician.';
      };
      form.elements.disease.onchange = updateHint;
      updateHint();
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const selected = existing ? id : data.get('disease');
      const combo = !illness && combinations.find((item) => `combo:${item.id}` === selected);
      const next = cloneState(getState());
      for (const diseaseId of combo?.ids || [selected]) {
        const record = (next.records[diseaseId] ||= emptyRecord());
        const entry = { ...existing, id: existing?.id || createEntryId(), date: data.get('date') };
        if (illness)
          Object.assign(entry, {
            duration: data.get('duration') === '' ? null : Number(data.get('duration')),
            confirmed: data.has('confirmed'),
            recovered: data.has('recovered'),
          });
        else entry.type = data.get('type').trim() || (combo ? combo.name.split(' · ')[0] : '');
        const duplicate = record[collection].some(
          (item) =>
            item.id !== entryId &&
            item.date === entry.date &&
            (illness || item.type === entry.type),
        );
        if (duplicate) {
          error('This entry is already recorded. Edit the existing entry instead.');
          return;
        }
        if (existing)
          record[collection] = record[collection].map((item) =>
            item.id === entryId ? entry : item,
          );
        else {
          // Explicitly adding an excluded disease expresses a personal tracking choice.
          if (vaccinationStatus(next, diseaseId).kind === 'skip') record.plan = 'track';
          record[collection].push(entry);
        }
      }
      save(next, `${illness ? 'Illness' : 'Vaccination'} ${existing ? 'updated' : 'saved'}.`);
    };
  }

  function recordPlanDialog(id) {
    const record = recordFor(getState(), id);
    const reference = referenceFor(id, getState().settings);
    openModal(
      `Your ${diseaseFor(id).name} plan`,
      `
      <p class="modal-intro">${reference.note}</p>
      <form id="plan-form" class="form-grid">
        <label>Plan status<select name="plan">${[
          ['auto', 'Follow country / reference plan'],
          ['track', 'Track this vaccination personally'],
          ['skip', 'Not currently in my plan'],
          ['review', 'Needs review — not decided yet'],
        ]
          .map(
            ([value, label]) =>
              `<option value="${value}" ${record.plan === value ? 'selected' : ''}>${label}</option>`,
          )
          .join('')}</select></label>
        <label>Series dose target <span class="small muted">Optional</span><input name="target" type="number" min="1" max="20" step="1" placeholder="Automatic: ${reference.target}" value="${record.target ?? ''}">
          <small>Leave blank to follow the reference target (${reference.target}). Enter a clinician-agreed target to override it.</small></label>
        <label>Next review / dose date <span class="small muted">Optional</span><input type="date" name="nextDate" min="1900-01-01" value="${record.nextDate}">
          <small>Reminders use your date. Clear or update it after review; no notifications are sent.</small></label>
        <div class="modal-actions">${btn('close', 'Cancel')}<button class="btn primary" type="submit">Save plan</button></div>
      </form>`,
    );
    $('#plan-form').onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const next = cloneState(getState());
      next.records[id] = {
        ...record,
        plan: data.get('plan'),
        target: data.get('target') === '' ? null : Number(data.get('target')),
        nextDate: data.get('nextDate'),
      };
      save(next, 'Your personal plan has been updated.');
    };
  }

  function countryDialog(selected = getState().settings.plan) {
    const settings = getState().settings;
    openModal(
      'Your plan & age group',
      `
      <p class="modal-intro">Choose a starting checklist for your stage of life. Personal choices, targets and all health entries are preserved when switching.</p>
      <form id="country-form" class="form-grid">
        <label>Country plan<select name="country">${PLANS.map((plan) => `<option value="${plan.id}" ${selected === plan.id ? 'selected' : ''}>${plan.name}</option>`).join('')}</select></label>
        <label>Age group<select name="ageGroup">${AGE_GROUPS.map((group) => `<option value="${group.id}" ${settings.ageGroup === group.id ? 'selected' : ''}>${group.label}</option>`).join('')}</select></label>
        <div id="country-preview" class="country-preview"></div>
        <label>Appearance<select name="theme">${[
          ['system', 'Use device setting'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ]
          .map(
            ([value, label]) =>
              `<option value="${value}" ${settings.theme === value ? 'selected' : ''}>${label}</option>`,
          )
          .join('')}</select></label>
        <div class="modal-actions">${btn('close', 'Cancel')}<button class="btn primary" type="submit">Use this plan</button></div>
      </form>`,
    );
    const form = $('#country-form');
    const updatePreview = () => {
      const plan = form.elements.country.value;
      const age = form.elements.ageGroup.value;
      const included = includedDiseases(plan, age);
      const names = diseases
        .filter((disease) => included?.has(disease.id))
        .map((disease) => disease.name);
      $('#country-preview').innerHTML =
        `<div class="notice"><strong>${included ? `${included.size} diseases in this checklist` : 'Reference targets for all 34 diseases'}</strong>
        <p>${included ? names.join(', ') : 'Entries can complete without a country plan. No entries are automatically set aside.'}</p></div>
        <details class="plan-notes"><summary>Schedule details & eligibility</summary><ul class="small muted">${planNotes(
          plan,
          age,
        )
          .map((note) => `<li>${note}</li>`)
          .join('')}</ul></details>
        <a class="small" href="${PLANS.find((item) => item.id === plan).source}" target="_blank" rel="noopener noreferrer">Read the programme reference ↗</a>`;
    };
    form.elements.country.onchange = updatePreview;
    form.elements.ageGroup.onchange = updatePreview;
    updatePreview();
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const next = cloneState(getState());
      next.settings = {
        ...next.settings,
        plan: data.get('country'),
        ageGroup: data.get('ageGroup'),
        theme: data.get('theme'),
        welcomeDismissed: true,
      };
      save(next, 'Plan and age group updated. Personal choices were preserved.');
    };
  }

  function deleteDialog(id, entryId, kind) {
    const collection = kind === 'illness' ? 'illnesses' : 'doses';
    const entry = recordFor(getState(), id)[collection].find((item) => item.id === entryId);
    if (!entry) return;
    const label = kind === 'illness' ? 'illness' : 'dose';
    openModal(
      `Delete this ${label}?`,
      `<p class="modal-intro">Remove the ${dateLabel(entry.date)} ${label} entry for ${diseaseFor(id).name}?</p>
      <div class="modal-actions">${btn('close', `Keep ${label}`)}<button id="confirm-delete" class="btn danger">Delete ${label}</button></div>`,
    );
    $('#confirm-delete').onclick = () => {
      const next = cloneState(getState());
      next.records[id][collection] = next.records[id][collection].filter(
        (item) => item.id !== entryId,
      );
      save(next, `${label === 'dose' ? 'Dose' : 'Illness'} deleted.`);
    };
  }
  return { entryDialog, recordPlanDialog, countryDialog, deleteDialog };
}

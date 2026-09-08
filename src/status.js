import { diseases } from './catalog.js';
import { recordFor, today } from './model.js';
import { includedDiseases, referenceFor } from './plans.js';

// THL accepts confirmed disease history for MMR and varicella. This is not a
// generic "one infection = one dose" rule. Other diseases get history/review only.
export const HISTORY_CREDIT = new Set(['measles', 'mumps', 'rubella', 'varicella']);

export function vaccinationStatus(state, id, day = today()) {
  const record = recordFor(state, id);
  const reference = referenceFor(id, state.settings);
  const target = record.target ?? reference.target;
  const doseDates = new Set(record.doses.map((dose) => dose.date));
  const count = doseDates.size;
  const history = record.illnesses.find((illness) => illness.confirmed && illness.recovered);
  const included = includedDiseases(state.settings.plan, state.settings.ageGroup);
  const outside = included && !included.has(id);
  const result = { target, count, reference, evidence: 'doses', label: '', detail: '' };
  const finish = (kind, label, detail, evidence = result.evidence) => ({
    ...result,
    kind,
    label,
    detail,
    evidence,
  });

  if (record.plan === 'skip' || (record.plan === 'auto' && outside)) {
    return finish(
      'skip',
      'Not in your plan',
      record.plan === 'skip'
        ? 'Your personal choice'
        : 'Outside this country and age-group checklist',
    );
  }
  if (record.plan === 'review')
    return finish('review', 'Review your plan', 'You asked to review this vaccination.');
  if (record.nextDate && record.nextDate <= day)
    return finish('due', 'Reminder due', 'Your recorded review or dose date has arrived.');
  if (record.illnesses.some((illness) => !illness.recovered)) {
    return finish(
      'review',
      'Illness needs review',
      'An illness has no recovery recorded. Review it before relying on the status.',
      'illness',
    );
  }
  if (HISTORY_CREDIT.has(id) && history) {
    return finish(
      'complete',
      'Past infection recorded',
      'Confirmed, recovered disease history is recorded as evidence of protection.',
      'illness',
    );
  }
  if (count >= target) {
    return finish(
      'complete',
      'Series complete',
      'The reference dose count is met. Timing, product and boosters still need review.',
    );
  }
  if (HISTORY_CREDIT.has(id) && record.illnesses.length) {
    return finish(
      'review',
      'Confirm illness history',
      'Unconfirmed disease history does not automatically establish protection.',
      'illness',
    );
  }
  if (record.doses.length || record.illnesses.length || record.plan === 'track' || included) {
    const detail = record.illnesses.length
      ? 'Illness is recorded; it does not replace doses in this reference rule.'
      : `${count} of ${target} distinct dose dates recorded.`;
    return finish('progress', 'In progress', detail);
  }
  return finish(
    'review',
    'No entries yet',
    'Add doses to track the reference target, even without a country plan.',
  );
}

export function statusCounts(state) {
  const counts = { complete: 0, attention: 0, skip: 0 };
  for (const disease of diseases) {
    const { kind } = vaccinationStatus(state, disease.id);
    counts[kind === 'complete' || kind === 'skip' ? kind : 'attention']++;
  }
  return counts;
}

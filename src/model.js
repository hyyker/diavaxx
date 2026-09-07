import { ids } from './catalog.js';
// Preserve the original storage identifier so existing vaccination records remain accessible.
export const STORAGE_KEY = 'everwell.records.v1';
export const MAX_STATE_BYTES = 600000;
export const emptyState = () => ({ version: 1, records: {} });
export const emptyRecord = () => ({ plan: 'review', target: null, nextDate: '', doses: [] });
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
export function validateState(input) {
  const fail = () => { throw new Error('This is not a valid diavaxx backup (or it uses a newer format).'); };
  if (!input || input.version !== 1 || !input.records || typeof input.records !== 'object' || Array.isArray(input.records)) fail();
  const state = emptyState();
  let total = 0;
  const doseIds = new Set();
  for (const [id, r] of Object.entries(input.records)) {
    if (!ids.has(id) || !r || !['review', 'track', 'skip'].includes(r.plan)) fail();
    if (!(r.target === null || (Number.isInteger(r.target) && r.target >= 1 && r.target <= 20))) fail();
    if (r.plan === 'track' && r.target === null) fail();
    if (r.nextDate !== '' && !validDate(r.nextDate)) fail();
    if (!Array.isArray(r.doses)) fail();
    const doses = r.doses.map(d => {
      if (++total > 2000 || !d || typeof d.id !== 'string' || !/^[\w-]{1,80}$/.test(d.id) || doseIds.has(d.id) || !validDate(d.date) || d.date > today() || typeof d.type !== 'string' || d.type.length > 120) fail();
      doseIds.add(d.id);
      return { id: d.id, date: d.date, type: d.type };
    });
    state.records[id] = { plan: r.plan, target: r.target, nextDate: r.nextDate, doses };
  }
  if (new TextEncoder().encode(JSON.stringify(state)).length > MAX_STATE_BYTES) fail();
  return state;
}
export function status(record = emptyRecord(), day = today()) {
  if (record.plan === 'skip') return 'skip';
  if (record.plan === 'review') return 'review';
  if (record.nextDate && record.nextDate <= day) return 'due';
  if (record.doses.length < record.target) return 'progress';
  return 'complete';
}
export function doseCount(state) { return Object.values(state.records).reduce((n, r) => n + r.doses.length, 0); }
export function persist(storage, state) {
  const checked = validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(checked));
  return checked;
}

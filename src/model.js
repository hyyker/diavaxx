import { ids } from './catalog.js';
import { AGE_GROUPS, PLANS } from './plans.js';

// Keep the original storage key: an app update must not hide existing records.
export const STORAGE_KEY = 'everwell.records.v1';
export const SCHEMA_VERSION = 2;
// Reserve migration headroom above the original 600 KB record limit.
export const MAX_STATE_BYTES = 610000;
export const MAX_ENTRIES = 2000;
export const THEMES = ['system', 'light', 'dark'];
export const RECORD_MODES = ['auto', 'track', 'skip', 'review'];

export function emptySettings() {
  return { plan: 'none', ageGroup: 'adult', theme: 'system', welcomeDismissed: false };
}

export function emptyState() {
  return { version: SCHEMA_VERSION, settings: emptySettings(), records: {} };
}

export function emptyRecord() {
  return { plan: 'auto', target: null, nextDate: '', doses: [], illnesses: [] };
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01')
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function addDays(day, days) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function recordFor(state, id) {
  return state.records[id] || emptyRecord();
}

export function entryCounts(state) {
  return Object.values(state.records).reduce(
    (counts, record) => {
      counts.doses += record.doses.length;
      counts.illnesses += record.illnesses.length;
      return counts;
    },
    { doses: 0, illnesses: 0 },
  );
}

// 64 random bits make new IDs substantially smaller than the old UUID strings.
export function createEntryId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function fail(
  message = 'Invalid diavaxx record. Update the app if this backup uses a newer format.',
) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkKeys(object, allowed) {
  if (!isObject(object)) fail();
  if (Object.keys(object).some((key) => !allowed.includes(key))) {
    fail(
      'This record has unsupported fields. Update diavaxx before importing it; no data was changed.',
    );
  }
}

// Future optional features use this bounded JSON bag. Never interpret its contents as HTML.
function extensions(value, depth = 0) {
  if (depth > 8) fail('Backup extensions are nested too deeply.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => extensions(item, depth + 1));
  if (!isObject(value)) fail();
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
    result[key] = extensions(item, depth + 1);
  }
  return result;
}

function preserveExtensions(input, output) {
  if (Object.hasOwn(input, 'extensions')) {
    if (!isObject(input.extensions)) fail();
    output.extensions = extensions(input.extensions);
  }
  return output;
}

function checkSize(state, limit = MAX_STATE_BYTES) {
  if (new TextEncoder().encode(JSON.stringify(state)).length > limit) {
    fail(
      `The record exceeds the ${limit / 1000} KB limit. Export a backup before reducing its size.`,
    );
  }
  return state;
}

/** Validate the original schema separately so legacy checksums can be checked before migration. */
export function validateV1(input) {
  if (!input || input.version !== 1 || !isObject(input.records)) fail();
  checkKeys(input, ['version', 'records']);
  const state = { version: 1, records: {} };
  const seen = new Set();
  for (const [id, record] of Object.entries(input.records)) {
    if (!ids.has(id) || !record || !['review', 'track', 'skip'].includes(record.plan)) fail();
    checkKeys(record, ['plan', 'target', 'nextDate', 'doses']);
    checkTarget(record.target);
    if (record.plan === 'track' && record.target === null) fail();
    if (record.nextDate !== '' && !validDate(record.nextDate)) fail();
    if (!Array.isArray(record.doses)) fail();
    state.records[id] = {
      plan: record.plan,
      target: record.target,
      nextDate: record.nextDate,
      doses: record.doses.map((dose) => validateDose(dose, seen)),
    };
  }
  return checkSize(state, 600000);
}

export function migrateV1(input) {
  const old = validateV1(input);
  const state = emptyState();
  // V1 never saved which starter was chosen. Do not guess a country from its doses.
  // Undecided records become automatic; explicit targets and exclusions are preserved.
  for (const [id, record] of Object.entries(old.records)) {
    state.records[id] = {
      ...record,
      plan: record.plan === 'review' ? 'auto' : record.plan,
      illnesses: [],
    };
  }
  return checkSize(state);
}

function checkTarget(target) {
  if (!(target === null || (Number.isInteger(target) && target >= 1 && target <= 20))) fail();
}

function validateEntry(entry, seen) {
  if (
    !entry ||
    typeof entry.id !== 'string' ||
    !/^[\w-]{1,80}$/.test(entry.id) ||
    seen.has(entry.id)
  )
    fail();
  if (!validDate(entry.date) || entry.date > today())
    fail('Enter a valid date on or before today.');
  seen.add(entry.id);
  if (seen.size > MAX_ENTRIES)
    fail('The record can contain at most 2,000 vaccination and illness entries.');
}

function validateDose(dose, seen) {
  checkKeys(dose, ['id', 'date', 'type', 'extensions']);
  validateEntry(dose, seen);
  if (typeof dose.type !== 'string' || dose.type.length > 120) fail();
  return preserveExtensions(dose, { id: dose.id, date: dose.date, type: dose.type });
}

function validateIllness(illness, seen) {
  checkKeys(illness, ['id', 'date', 'duration', 'confirmed', 'recovered', 'extensions']);
  validateEntry(illness, seen);
  const { duration, confirmed, recovered } = illness;
  if (!(duration === null || (Number.isInteger(duration) && duration >= 1 && duration <= 3650))) {
    fail('Illness duration must be a whole number from 1 to 3,650 days, or left blank.');
  }
  if (duration !== null && addDays(illness.date, duration - 1) > today()) {
    fail('The illness duration extends into the future. Leave it blank for an ongoing illness.');
  }
  if (typeof confirmed !== 'boolean' || typeof recovered !== 'boolean') fail();
  return preserveExtensions(illness, {
    id: illness.id,
    date: illness.date,
    duration,
    confirmed,
    recovered,
  });
}

/** The single validation boundary for local writes, JSON imports, and transfer codes. */
export function validateState(input) {
  if (input?.version === 1) return migrateV1(input);
  if (input?.version !== SCHEMA_VERSION) fail();
  checkKeys(input, ['version', 'settings', 'records', 'extensions']);
  checkKeys(input.settings, ['plan', 'ageGroup', 'theme', 'welcomeDismissed', 'extensions']);
  if (!isObject(input.records)) fail();
  const { plan, ageGroup, theme, welcomeDismissed } = input.settings;
  if (!PLANS.some((item) => item.id === plan) || !AGE_GROUPS.some((item) => item.id === ageGroup))
    fail();
  if (!THEMES.includes(theme) || typeof welcomeDismissed !== 'boolean') fail();
  const state = emptyState();
  state.settings = preserveExtensions(input.settings, { plan, ageGroup, theme, welcomeDismissed });
  const seen = new Set();
  for (const [id, record] of Object.entries(input.records)) {
    if (!ids.has(id))
      fail(
        'This backup includes a disease this app does not recognise. Update diavaxx to import it.',
      );
    checkKeys(record, ['plan', 'target', 'nextDate', 'doses', 'illnesses', 'extensions']);
    if (!RECORD_MODES.includes(record.plan)) fail();
    checkTarget(record.target);
    if (record.nextDate !== '' && !validDate(record.nextDate)) fail();
    if (!Array.isArray(record.doses) || !Array.isArray(record.illnesses)) fail();
    state.records[id] = preserveExtensions(record, {
      plan: record.plan,
      target: record.target,
      nextDate: record.nextDate,
      doses: record.doses.map((dose) => validateDose(dose, seen)),
      illnesses: record.illnesses.map((illness) => validateIllness(illness, seen)),
    });
  }
  return checkSize(preserveExtensions(input, state));
}

export function persist(storage, state) {
  const checked = validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(checked));
  return checked;
}

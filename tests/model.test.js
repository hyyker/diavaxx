import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { zlibSync, strToU8 } from 'fflate';
import {
  emptyState,
  emptyRecord,
  validateState,
  validDate,
  persist,
  createEntryId,
  today,
  MAX_STATE_BYTES,
} from '../src/model.js';
import { vaccinationStatus } from '../src/status.js';
import { includedDiseases, referenceFor, AGE_GROUPS } from '../src/plans.js';
import { encode, decode, packState, unpackState, qrParts, PartCollector } from '../src/transfer.js';
import { diseases } from '../src/catalog.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const legacy = JSON.parse(readFileSync(new URL('./fixtures/v1-backup.json', import.meta.url)));
const dose = (id = 'dose', date = '2020-01-01') => ({ id, date, type: 'MMR · 你好 💉' });
const illness = (overrides = {}) => ({
  id: 'illness',
  date: '2019-02-01',
  duration: 7,
  confirmed: true,
  recovered: true,
  ...overrides,
});
function sample() {
  const state = emptyState();
  state.settings = { plan: 'germany', ageGroup: 'preteen', theme: 'dark', welcomeDismissed: true };
  state.records.measles = {
    ...emptyRecord(),
    doses: [dose('a'), dose('b', '2021-01-01')],
    illnesses: [illness()],
  };
  state.records.rabies = { ...emptyRecord(), plan: 'skip' };
  return state;
}
const kind = (state, id = 'measles') => vaccinationStatus(state, id).kind;

test('no-country automatic references complete one-, two- and three-dose courses', () => {
  const state = emptyState();
  for (const [id, target] of [
    ['yellow-fever', 1],
    ['measles', 2],
    ['tetanus', 3],
  ]) {
    state.records[id] = emptyRecord();
    for (let n = 0; n < target; n++) {
      assert.notEqual(kind(state, id), 'complete');
      state.records[id].doses.push(dose(`${id}${n}`, `2020-01-0${n + 1}`));
    }
    assert.equal(kind(state, id), 'complete');
  }
});
test('Finnish exclusions, German life stages and personal overrides are independent', () => {
  const state = sample();
  state.settings.plan = 'finland';
  for (const age of AGE_GROUPS) {
    state.settings.ageGroup = age.id;
    assert.equal(kind(state, 'ebola'), 'skip');
    assert.equal(kind(state, 'chikungunya'), 'skip');
  }
  state.records.ebola = { ...emptyRecord(), plan: 'track' };
  assert.equal(kind(state, 'ebola'), 'progress');
  const saved = structuredClone(state.records);
  state.settings.plan = 'germany';
  assert.deepEqual(state.records, saved);
  assert.equal(kind(state, 'rabies'), 'skip');
  assert.ok(includedDiseases('germany', 'infant').has('hepatitis-b'));
  assert.ok(includedDiseases('germany', 'infant').has('men-b'));
  assert.ok(!includedDiseases('germany', 'infant').has('rsv'));
  assert.ok(includedDiseases('germany', 'preteen').has('men-acwy'));
  assert.ok(!includedDiseases('germany', 'older65').has('covid-19'));
  assert.ok(includedDiseases('germany', 'older75').has('covid-19'));
  assert.ok(includedDiseases('germany', 'older75').has('rsv'));
  assert.ok(!includedDiseases('germany', 'adult').has('shingles'));
  assert.ok(includedDiseases('germany', 'older60').has('shingles'));
  assert.equal(referenceFor('pneumococcal', { plan: 'germany', ageGroup: 'infant' }).target, 3);
  assert.equal(referenceFor('rubella', { plan: 'finland', ageGroup: 'child' }).target, 2);
  assert.equal(referenceFor('rubella', { plan: 'none', ageGroup: 'adult' }).target, 1);
});
test('every catalogue entry and life stage has a usable reference', () => {
  for (const disease of diseases)
    for (const age of AGE_GROUPS) {
      const ref = referenceFor(disease.id, { plan: 'none', ageGroup: age.id });
      assert.ok(ref.target >= 1 && ref.target <= 20);
      assert.match(ref.source, /^https:\/\//);
      assert.ok(ref.note.length > 15);
    }
});
test('same-day duplicate dose dates cannot inflate completion', () => {
  const state = emptyState();
  state.records.measles = { ...emptyRecord(), doses: [dose('a'), dose('b')] };
  assert.equal(kind(state), 'progress');
  assert.equal(vaccinationStatus(state, 'measles').count, 1);
});
test('confirmed recovered MMR and varicella history can satisfy completion', () => {
  for (const id of ['measles', 'mumps', 'rubella', 'varicella']) {
    const state = emptyState();
    state.records[id] = { ...emptyRecord(), illnesses: [illness()] };
    assert.equal(kind(state, id), 'complete');
    assert.equal(vaccinationStatus(state, id).evidence, 'illness');
    state.records[id].illnesses[0].confirmed = false;
    assert.equal(kind(state, id), 'review');
    state.records[id].illnesses[0].confirmed = true;
    state.records[id].illnesses[0].recovered = false;
    assert.equal(kind(state, id), 'review');
    state.records[id].illnesses = [];
    assert.notEqual(kind(state, id), 'complete');
  }
});
test('other infections do not replace vaccines; reminders and exclusions take precedence', () => {
  const state = emptyState();
  for (const id of ['tetanus', 'covid-19', 'shingles', 'dengue', 'hepatitis-b']) {
    state.records[id] = { ...emptyRecord(), illnesses: [illness({ id })] };
    assert.equal(kind(state, id), 'progress');
  }
  state.records.measles = { ...emptyRecord(), illnesses: [illness()], nextDate: '2020-01-01' };
  assert.equal(kind(state), 'due');
  state.records.measles.plan = 'skip';
  assert.equal(kind(state), 'skip');
  state.records.measles.plan = 'review';
  assert.equal(kind(state), 'review');
});
test('calendar dates and illness durations reject impossible or future values', () => {
  for (const invalid of ['2025-02-29', '2026-04-31', '01/01/2020', '1899-12-31', null])
    assert.equal(validDate(invalid), false);
  assert.equal(validDate('2024-02-29'), true);
  for (const patch of [
    { date: '2999-01-01' },
    { date: today(), duration: 2 },
    { duration: 0 },
    { duration: 1.5 },
    { duration: 3651 },
    { confirmed: 'yes' },
    { recovered: null },
  ]) {
    const state = sample();
    Object.assign(state.records.measles.illnesses[0], patch);
    assert.throws(() => validateState(state));
  }
  const state = sample();
  state.records.measles.illnesses[0].duration = null;
  assert.deepEqual(validateState(state), state);
});
test('frozen V1 code and local JSON migrate without losing IDs, dates, types or overrides', () => {
  const migrated = validateState(legacy.state);
  assert.deepEqual(decode(legacy.code), migrated);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.records.measles.doses, legacy.state.records.measles.doses);
  assert.equal(migrated.records.rabies.plan, 'skip');
  assert.equal(migrated.records.tetanus.nextDate, '2030-01-01');
  const undecided = structuredClone(legacy.state);
  undecided.records.measles.plan = 'review';
  undecided.records.measles.target = null;
  assert.equal(kind(validateState(undecided)), 'complete');
  assert.throws(() => decode(legacy.code.slice(0, -3)));
});
test('V2 round-trips empty records, UUIDs, all settings, Unicode and extension bags', () => {
  const state = sample();
  state.records.chikungunya = emptyRecord(); // wire ID zero must survive trailing-default trimming
  state.records.measles.doses[0].id = legacy.state.records.measles.doses[0].id;
  const bag = { futureNote: '保護', flags: [1, false, null, { a: 'b' }] };
  for (const node of [
    state,
    state.settings,
    state.records.measles,
    state.records.measles.doses[0],
    state.records.measles.illnesses[0],
  ])
    node.extensions = bag;
  const code = encode(state);
  assert.match(code, /^DV2\./);
  assert.deepEqual(decode(code), state);
  assert.deepEqual(decode(`https://example.com/subpath/#transfer=${code}`), state);
  assert.deepEqual(decode(encode(emptyState())), emptyState());
  const first = emptyState();
  first.records.chikungunya = emptyRecord();
  assert.deepEqual(decode(encode(first)), first);
});
test('invalid, unknown, conflicting or corrupt data is rejected, never silently dropped', () => {
  const mutate = (fn) => {
    const state = sample();
    fn(state);
    assert.throws(() => validateState(state));
  };
  mutate((state) => (state.version = 3));
  mutate((state) => (state.records.unknown = emptyRecord()));
  mutate((state) => (state.records.measles.target = 0));
  mutate((state) => (state.settings.ageGroup = 'new-age'));
  mutate((state) => (state.settings.theme = 'bright'));
  mutate((state) => (state.records.measles.doses[0].type = 'x'.repeat(121)));
  mutate((state) => (state.records.measles.doses[0].id = 'illness'));
  mutate((state) => (state.newField = 'future'));
  mutate((state) => (state.extensions = JSON.parse('{"__proto__":{}}')));
  mutate((state) => (state.extensions = { big: 'x'.repeat(MAX_STATE_BYTES) }));
  const compact = packState(sample());
  compact.r[0][5][0][3] = 7;
  assert.throws(() => unpackState(compact));
  const invalidSettings = packState(sample());
  invalidSettings.s[0] = '';
  assert.throws(() => unpackState(invalidSettings));
  for (const code of [
    'not a backup',
    'DV3.abc',
    encode(sample()).slice(0, -4),
    encode(sample()) + 'abcd',
    encode(sample()).replace(/.$/, 'z'),
  ])
    assert.throws(() => decode(code));
  const bomb =
    'EV1.' + Buffer.from(zlibSync(strToU8(' '.repeat(MAX_STATE_BYTES + 1)))).toString('base64url');
  assert.throws(() => decode(bomb));
});
test('entry count bounds include both types and generated IDs validate', () => {
  const state = emptyState();
  state.records.measles = {
    ...emptyRecord(),
    doses: Array.from({ length: 2000 }, (_, n) => dose(`d${n}`)),
    illnesses: [illness()],
  };
  assert.throws(() => validateState(state), /2,000/);
  assert.match(createEntryId(), /^[\w-]{11}$/);
});
test('storage errors propagate; successful persistence stores canonical V2', () => {
  assert.throws(
    () =>
      persist(
        {
          setItem() {
            throw new Error('quota');
          },
        },
        sample(),
      ),
    /quota/,
  );
  const storage = {
    setItem(key, value) {
      this.value = value;
    },
  };
  persist(storage, legacy.state);
  assert.deepEqual(JSON.parse(storage.value), validateState(legacy.state));
});
test('multipart codes accept out-of-order/repeated parts and reject conflicting backups', async () => {
  const state = sample();
  state.records.measles.doses = Array.from({ length: 100 }, (_, n) =>
    dose(`dose${n}`, '2020-01-01'),
  );
  for (const entry of state.records.measles.doses) entry.type = randomBytes(60).toString('base64');
  const code = encode(state),
    parts = await qrParts(code),
    collector = new PartCollector();
  assert.ok(parts.length > 1);
  collector.add(parts.at(-1));
  collector.add(parts.at(-1));
  let result;
  for (const part of parts.toReversed()) result = collector.add(part);
  assert.deepEqual(decode(result.code), state);
  const other = new PartCollector();
  other.add(parts[0]);
  assert.throws(
    () => other.add(parts[1].replace(/DVQ2\.[^.]+/, 'DVQ2.000000000000')),
    /another backup/,
  );
  assert.throws(
    () => other.add(parts[0].slice(0, -1) + (parts[0].endsWith('a') ? 'b' : 'a')),
    /Conflicting/,
  );
  // V1 multipart framing still works, even for a manually partitioned short fixture.
  const split = Math.floor(legacy.code.length / 2),
    oldCollector = new PartCollector();
  oldCollector.add(`EVQ1.123456789abc.2.2.${legacy.code.slice(split)}`);
  assert.deepEqual(
    decode(oldCollector.add(`EVQ1.123456789abc.1.2.${legacy.code.slice(0, split)}`).code),
    validateState(legacy.state),
  );
});
test('large records above 150 KB survive compression and bounded decoding', () => {
  const state = emptyState();
  state.records.measles = {
    ...emptyRecord(),
    doses: Array.from({ length: 1900 }, (_, n) => ({
      id: `entry-${n}`,
      date: '2020-01-01',
      type: randomBytes(90).toString('base64'),
    })),
  };
  const code = encode(state);
  assert.ok(code.length > 150000);
  assert.deepEqual(decode(code), state);
});
test('six completed vaccinations compress substantially without changing the record', () => {
  const old = { version: 1, records: {} };
  for (const [i, id] of [
    'measles',
    'mumps',
    'rubella',
    'tetanus',
    'diphtheria',
    'polio',
  ].entries()) {
    old.records[id] = {
      plan: 'track',
      target: i < 3 ? 2 : 3,
      nextDate: '',
      doses: Array.from({ length: i < 3 ? 2 : 3 }, (_, n) => ({
        id: `${(i * 3 + n).toString(16).padStart(8, '0')}-5044-4f71-9e50-a0942d26d09b`,
        date: `202${n}-01-02`,
        type: i < 3 ? 'MMR' : 'DTaP-IPV',
      })),
    };
  }
  const oldCode =
    'EV1.' +
    Buffer.from(zlibSync(strToU8(JSON.stringify(old)), { level: 9 })).toString('base64url');
  const current = validateState(old),
    code = encode(current);
  assert.deepEqual(decode(code), current);
  assert.ok(code.length < oldCode.length * 0.8);
  console.log(
    `Six-course fixture: V1 ${oldCode.length} chars → V2 ${code.length} chars (${Math.round((1 - code.length / oldCode.length) * 100)}% shorter)`,
  );
});
test('generated QR pixels decode to the exact current payload', () => {
  const payload = `https://example.com/diavaxx/#transfer=${encode(sample())}`;
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const scale = 5,
    margin = 4,
    size = (qr.modules.size + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++)
      if (qr.modules.get(y, x)) {
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const p = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
            rgba[p] = rgba[p + 1] = rgba[p + 2] = 0;
          }
      }
  const scanned = jsQR(rgba, size, size);
  assert.equal(scanned.data, payload);
  assert.deepEqual(decode(scanned.data), sample());
});

test('a V1 backup at its size limit has room for migration metadata', () => {
  const old = {
    version: 1,
    records: {
      measles: {
        plan: 'review',
        target: null,
        nextDate: '',
        doses: Array.from({ length: 2000 }, (_, n) => ({
          id: `d${n}`,
          date: '2020-01-01',
          type: '',
        })),
      },
    },
  };
  let size = Buffer.byteLength(JSON.stringify(old));
  for (const entry of old.records.measles.doses) {
    const count = Math.min(120, Math.floor((600000 - size) / 3));
    entry.type = '界'.repeat(count);
    size += count * 3;
  }
  assert.ok(size > 599990 && size <= 600000);
  const migrated = validateState(old);
  assert.ok(Buffer.byteLength(JSON.stringify(migrated)) > 600000);
  assert.deepEqual(decode(encode(migrated)), migrated);
});

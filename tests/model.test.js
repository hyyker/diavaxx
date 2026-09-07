import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, emptyRecord, status, validateState, validDate, persist } from '../src/model.js';
import { encode, decode, qrParts, PartCollector } from '../src/transfer.js';
import { diseases } from '../src/catalog.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
const sample = () => ({ version: 1, records: {
  measles: { plan: 'track', target: 2, nextDate: '', doses: [{ id: 'a', date: '2004-02-29', type: 'MMR · 你好 💉' }, { id: 'b', date: '2005-03-01', type: '' }] },
  influenza: { plan: 'track', target: 1, nextDate: '2025-10-01', doses: [{ id: 'c', date: '2024-10-01', type: 'Flu' }] },
  rabies: { plan: 'skip', target: null, nextDate: '', doses: [] },
} });
test('status distinguishes missing plans, unfinished series, completion, reminders and opt-out', () => {
  assert.equal(status(), 'review');
  assert.equal(status({ ...emptyRecord(), plan: 'track', target: 3 }), 'progress');
  assert.equal(status(sample().records.measles), 'complete');
  assert.equal(status(sample().records.influenza, '2025-09-30'), 'complete');
  assert.equal(status(sample().records.influenza, '2025-10-01'), 'due');
  assert.equal(status({ ...sample().records.influenza, plan: 'skip' }), 'skip');
});
test('date validation rejects impossible dates and accepts leap days', () => {
  for (const invalid of ['2025-02-29', '2026-04-31', '01/01/2020', '1899-12-31', null]) assert.equal(validDate(invalid), false);
  assert.equal(validDate('2024-02-29'), true);
});
test('exact Unicode state survives code, transfer link, and JSON persistence', () => {
  const state = sample(), code = encode(state);
  assert.deepEqual(decode(code), state);
  assert.deepEqual(decode(`https://example.com/my-project/#transfer=${code}`), state);
  const fake = { setItem(key, value) { this.value = value; } };
  persist(fake, state); assert.deepEqual(JSON.parse(fake.value), state);
  assert.deepEqual(decode(encode(emptyState())), emptyState());
});
test('malformed, future, duplicate, unknown and oversized data are rejected', () => {
  const mutate = fn => { const state = sample(); fn(state); assert.throws(() => validateState(state)); };
  mutate(s => s.version = 2);
  mutate(s => s.records.__unknown = emptyRecord());
  mutate(s => s.records.measles.target = 0);
  mutate(s => s.records.measles.target = null);
  mutate(s => s.records.measles.doses[0].date = '2999-01-01');
  mutate(s => s.records.measles.doses[0].type = 'x'.repeat(121));
  mutate(s => s.records.measles.doses[0].id = 'b');
  assert.throws(() => decode('not a backup'));
  const code = encode(sample());
  assert.throws(() => decode(code.slice(0, -4)));
  assert.throws(() => decode(code + 'abcd'));
});
test('storage failures propagate instead of pretending to save', () => {
  assert.throws(() => persist({ setItem() { throw new Error('quota'); } }, sample()), /quota/);
});
test('multipart transfer handles out-of-order and repeated parts without dropping anything', async () => {
  const state = emptyState();
  for (const [i, disease] of diseases.entries()) state.records[disease.id] = { ...emptyRecord(), doses: Array.from({ length: 15 }, (_, n) => ({ id: `dose-${i}-${n}`, date: `2020-01-${String(n + 1).padStart(2, '0')}`, type: `Brand ${i} ${n} ${String(i * 77177 + n * 1329).repeat(5)}` })) };
  const code = encode(state), parts = await qrParts(code), collector = new PartCollector();
  assert.ok(parts.length > 1);
  collector.add(parts.at(-1)); collector.add(parts.at(-1));
  let result;
  for (const part of parts.toReversed()) result = collector.add(part);
  assert.deepEqual(decode(result.code), state);
  const other = new PartCollector(); other.add(parts[0]);
  assert.throws(() => other.add(parts[1].replace(/EVQ1\.[^.]+/, 'EVQ1.000000000000')), /different backup/);
});
test('generated QR matrix decodes to the exact importable payload', async () => {
  const code = encode(sample());
  const payload = `https://example.com/vaccine-website/#transfer=${code}`;
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const scale = 5, margin = 4, size = (qr.modules.size + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) if (qr.modules.get(y, x)) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const p = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = 0;
    }
  }
  const scanned = jsQR(rgba, size, size);
  assert.equal(scanned.data, payload);
  assert.deepEqual(decode(scanned.data), sample());
});
test('large accepted records round-trip above the old 150 KB transfer limit', async () => {
  const { randomBytes } = await import('node:crypto');
  const state = { version: 1, records: { measles: { ...emptyRecord(), doses: Array.from({ length: 1900 }, (_, n) => ({ id: `entry-${n}`, date: '2020-01-01', type: randomBytes(90).toString('base64') })) } } };
  const code = encode(state);
  assert.ok(code.length > 150000);
  assert.deepEqual(decode(code), state);
  const parts = await qrParts(code), collector = new PartCollector();
  let result;
  for (const part of parts) result = collector.add(part);
  assert.deepEqual(decode(result.code), state);
});

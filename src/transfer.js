import { zlibSync, Unzlib, strToU8, strFromU8 } from 'fflate';
import { validateState, validateV1, migrateV1, MAX_STATE_BYTES } from './model.js';

export const MAX_CODE_LENGTH = 850000;
const QR_CHUNK_LENGTH = 900;

// Wire IDs are append-only. Changing the display order must never change old codes.
const WIRE_DISEASES = [
  'chikungunya',
  'cholera',
  'covid-19',
  'dengue',
  'diphtheria',
  'ebola',
  'hepatitis-a',
  'hepatitis-b',
  'hepatitis-e',
  'hib',
  'hpv',
  'influenza',
  'japanese-encephalitis',
  'malaria',
  'measles',
  'men-acwy',
  'men-b',
  'men-c',
  'mumps',
  'pertussis',
  'pneumococcal',
  'polio',
  'rabies',
  'rsv',
  'rotavirus',
  'rubella',
  'shingles',
  'smallpox-mpox',
  'tetanus',
  'tbe',
  'tuberculosis',
  'typhoid',
  'varicella',
  'yellow-fever',
];
// Enum values are strings on the wire; adding or reordering a UI option is safe.
const EPOCH = Date.UTC(1900, 0, 1);
const dayNumber = (date) =>
  date ? Math.round((Date.parse(`${date}T00:00:00Z`) - EPOCH) / 86400000) + 1 : 0;
function dayString(value) {
  if (!Number.isInteger(value) || value < 0 || value > 3000000)
    throw new Error('Invalid encoded date.');
  return value === 0 ? '' : new Date(EPOCH + (value - 1) * 86400000).toISOString().slice(0, 10);
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function fromBase64(text) {
  return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (char) =>
    char.charCodeAt(0),
  );
}

// UUIDs remain exactly recoverable, but consume 23 characters instead of 36.
function packId(id) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) return id;
  return (
    '~' +
    toBase64(Uint8Array.from(id.replaceAll('-', '').match(/../g), (byte) => parseInt(byte, 16)))
  );
}
function unpackId(id) {
  if (typeof id !== 'string' || !id.startsWith('~')) return id;
  const bytes = fromBase64(id.slice(1));
  if (bytes.length !== 16) throw new Error('Invalid UUID.');
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function trimDefaults(row, minimum = 0) {
  while (row.length > minimum && (row.at(-1) === null || row.at(-1) === 0)) row.pop();
  return row;
}

/** Pack redundant keys, dates, vaccine names, and defaults before compression. */
export function packState(input) {
  const state = validateState(input);
  const types = [''];
  const typeIndex = (text) => {
    let index = types.indexOf(text);
    if (index === -1) {
      index = types.length;
      types.push(text);
    }
    return index;
  };
  const records = Object.entries(state.records).map(([id, record]) => {
    const doses = record.doses.map((dose) =>
      trimDefaults([
        packId(dose.id),
        dayNumber(dose.date),
        typeIndex(dose.type),
        dose.extensions ?? null,
      ]),
    );
    const illnesses = record.illnesses.map((illness) =>
      trimDefaults([
        packId(illness.id),
        dayNumber(illness.date),
        illness.duration,
        (illness.confirmed ? 1 : 0) | (illness.recovered ? 2 : 0),
        illness.extensions ?? null,
      ]),
    );
    return trimDefaults(
      [
        WIRE_DISEASES.indexOf(id),
        record.plan === 'auto' ? 0 : record.plan,
        record.target,
        dayNumber(record.nextDate),
        doses.length ? doses : null,
        illnesses.length ? illnesses : null,
        record.extensions ?? null,
      ],
      1,
    );
  });
  const { plan, ageGroup, theme, welcomeDismissed, extensions } = state.settings;
  const compact = {
    v: 2,
    s: trimDefaults([
      plan === 'none' ? 0 : plan,
      ageGroup === 'adult' ? 0 : ageGroup,
      theme === 'system' ? 0 : theme,
      welcomeDismissed ? 1 : 0,
      extensions ?? null,
    ]),
    t: types.slice(1),
    r: records,
  };
  if (state.extensions !== undefined) compact.x = state.extensions;
  return compact;
}

function requireArray(value, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error('Unsupported transfer fields.');
  return value;
}
function attachExtensions(object, extra) {
  if (extra !== undefined && extra !== null) object.extensions = extra;
  return object;
}

export function unpackState(compact) {
  if (
    !compact ||
    compact.v !== 2 ||
    Object.keys(compact).some((key) => !['v', 's', 't', 'r', 'x'].includes(key))
  ) {
    throw new Error('Unsupported compact format.');
  }
  const settings = requireArray(compact.s, 5);
  const types = ['', ...requireArray(compact.t, 2000)];
  if (types.some((type) => typeof type !== 'string' || type.length > 120))
    throw new Error('Invalid vaccine dictionary.');
  if (![undefined, 0, 1].includes(settings[3])) throw new Error('Invalid settings flag.');
  const state = {
    version: 2,
    settings: attachExtensions(
      {
        plan: settings[0] === 0 || settings[0] === undefined ? 'none' : settings[0],
        ageGroup: settings[1] === 0 || settings[1] === undefined ? 'adult' : settings[1],
        theme: settings[2] === 0 || settings[2] === undefined ? 'system' : settings[2],
        welcomeDismissed: settings[3] === 1,
      },
      settings[4],
    ),
    records: {},
  };
  for (const row of requireArray(compact.r, WIRE_DISEASES.length)) {
    requireArray(row, 7);
    if (!Number.isInteger(row[0]) || !WIRE_DISEASES[row[0]])
      throw new Error('Unknown disease wire ID.');
    const id = WIRE_DISEASES[row[0]];
    if (Object.hasOwn(state.records, id)) throw new Error('Duplicate disease.');
    const doses = requireArray(row[4] ?? [], 2000).map((dose) => {
      requireArray(dose, 4);
      const type = dose[2] ?? 0;
      if (!Number.isInteger(type) || type < 0 || type >= types.length)
        throw new Error('Invalid vaccine type.');
      return attachExtensions(
        { id: unpackId(dose[0]), date: dayString(dose[1]), type: types[type] },
        dose[3],
      );
    });
    const illnesses = requireArray(row[5] ?? [], 2000).map((illness) => {
      requireArray(illness, 5);
      const flags = illness[3] ?? 0;
      if (!Number.isInteger(flags) || flags < 0 || flags > 3)
        throw new Error('Unsupported illness flags.');
      return attachExtensions(
        {
          id: unpackId(illness[0]),
          date: dayString(illness[1]),
          duration: illness[2] ?? null,
          confirmed: Boolean(flags & 1),
          recovered: Boolean(flags & 2),
        },
        illness[4],
      );
    });
    state.records[id] = attachExtensions(
      {
        plan: row[1] === 0 || row[1] === undefined ? 'auto' : row[1],
        target: row[2] ?? null,
        nextDate: dayString(row[3] ?? 0),
        doses,
        illnesses,
      },
      row[6],
    );
  }
  return validateState(attachExtensions(state, compact.x));
}

// A checksum detects accidental corruption without depending on a particular
// compressor's output. It is not encryption or proof of who created a backup.
function checksum(bytes) {
  let hash = 0xffffffff;
  for (const byte of bytes) {
    hash ^= byte;
    for (let bit = 0; bit < 8; bit++) hash = (hash >>> 1) ^ (hash & 1 ? 0xedb88320 : 0);
  }
  return ((hash ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function encode(state) {
  const bytes = zlibSync(strToU8(JSON.stringify(packState(state))), { level: 9 });
  return `DV2.${toBase64(bytes)}.${checksum(bytes)}`;
}

export function extract(text) {
  text = text.trim();
  if (text.startsWith('https://') || text.startsWith('http://')) {
    text = new URLSearchParams(new URL(text).hash.slice(1)).get('transfer') || '';
  }
  return text;
}

function decompress(bytes) {
  const chunks = [];
  let size = 0;
  const stream = new Unzlib((chunk) => {
    size += chunk.length;
    if (size > MAX_STATE_BYTES) throw new Error('Decompressed backup is too large.');
    chunks.push(chunk);
  });
  for (let i = 0; i < bytes.length; i += 128) {
    stream.push(bytes.subarray(i, i + 128), i + 128 >= bytes.length);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(strFromU8(output));
}

export function decode(text) {
  const code = extract(text);
  if (code.length > MAX_CODE_LENGTH) throw new Error('This transfer is too large.');
  try {
    const current = /^DV2\.([A-Za-z0-9_-]+)\.([a-f0-9]{8})$/.exec(code);
    if (current) {
      const bytes = fromBase64(current[1]);
      if (checksum(bytes) !== current[2]) throw new Error('Checksum mismatch.');
      return unpackState(decompress(bytes));
    }
    if (/^EV1\.[A-Za-z0-9_-]+$/.test(code)) {
      const old = validateV1(decompress(fromBase64(code.slice(4))));
      const canonical = 'EV1.' + toBase64(zlibSync(strToU8(JSON.stringify(old)), { level: 9 }));
      if (canonical !== code) throw new Error('Damaged V1 backup.');
      return migrateV1(old);
    }
    throw new Error('Unsupported transfer version.');
  } catch {
    throw new Error(
      'This backup is damaged, too large, or uses an unsupported format. Try the full code or update diavaxx.',
    );
  }
}

export async function qrParts(code) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', strToU8(code)));
  const key = Array.from(hash.slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const chunks = code.match(new RegExp(`.{1,${QR_CHUNK_LENGTH}}`, 'g'));
  return chunks.length === 1
    ? [code]
    : chunks.map((chunk, index) => `DVQ2.${key}.${index + 1}.${chunks.length}.${chunk}`);
}

export class PartCollector {
  constructor() {
    this.key = '';
    this.parts = new Map();
    this.total = 0;
  }

  add(raw) {
    const value = extract(raw);
    if (/^(EV1|DV2)\./.test(value)) return { code: value };
    const match = /^(?:EVQ1|DVQ2)\.([a-f0-9]{12})\.(\d+)\.(\d+)\.([A-Za-z0-9_.-]+)$/.exec(value);
    if (!match) throw new Error('No diavaxx transfer found in this code.');
    const [, key, indexText, totalText, chunk] = match;
    const index = Number(indexText),
      total = Number(totalText);
    if (
      total < 2 ||
      total > Math.ceil(MAX_CODE_LENGTH / QR_CHUNK_LENGTH) ||
      index < 1 ||
      index > total ||
      chunk.length > QR_CHUNK_LENGTH
    ) {
      throw new Error('Invalid QR part.');
    }
    if (this.key && (key !== this.key || total !== this.total))
      throw new Error('This QR belongs to another backup. Reopen Import to start again.');
    if (this.parts.has(index) && this.parts.get(index) !== chunk)
      throw new Error('Conflicting copies of the same QR part.');
    this.key = key;
    this.total = total;
    this.parts.set(index, chunk);
    if (this.parts.size === total) {
      return {
        code: Array.from({ length: total }, (_, index) => this.parts.get(index + 1)).join(''),
      };
    }
    return {
      progress: `${this.parts.size} of ${total} QR codes received. Add the remaining codes.`,
    };
  }
}

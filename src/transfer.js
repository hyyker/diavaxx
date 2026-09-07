import { zlibSync, Unzlib, strToU8, strFromU8 } from 'fflate';
import { validateState, MAX_STATE_BYTES } from './model.js';
export const MAX_CODE_LENGTH = 850000;
export function encode(state) {
  const bytes = zlibSync(strToU8(JSON.stringify(validateState(state))), { level: 9 });
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return 'EV1.' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function extract(text) {
  text = text.trim();
  if (text.startsWith('https://') || text.startsWith('http://')) {
    const url = new URL(text);
    text = new URLSearchParams(url.hash.slice(1)).get('transfer') || '';
  }
  return text;
}
export function decode(text) {
  const code = extract(text);
  if (code.length > MAX_CODE_LENGTH || !/^EV1\.[A-Za-z0-9_-]+$/.test(code)) throw new Error('Invalid transfer code. Paste the complete Everwell code or transfer link.');
  try {
    const bytes = Uint8Array.from(atob(code.slice(4).replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const chunks = []; let size = 0;
    const stream = new Unzlib((chunk) => {
      size += chunk.length;
      if (size > MAX_STATE_BYTES) throw new Error('Too large');
      chunks.push(chunk);
    });
    for (let i = 0; i < bytes.length; i += 128) stream.push(bytes.subarray(i, i + 128), i + 128 >= bytes.length);
    const output = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    const state = validateState(JSON.parse(strFromU8(output)));
    // Re-encoding also detects corruption, including trailing bytes and checksum changes.
    if (encode(state) !== code) throw new Error('Corrupt or noncanonical code');
    return state;
  } catch { throw new Error('This backup is damaged, unsupported, or too large. Please export it again.'); }
}
export async function qrParts(code) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', strToU8(code)));
  const key = Array.from(hash.slice(0, 6), b => b.toString(16).padStart(2, '0')).join('');
  const chunks = code.match(/.{1,900}/g);
  return chunks.length === 1 ? [code] : chunks.map((chunk, i) => `EVQ1.${key}.${i + 1}.${chunks.length}.${chunk}`);
}
export class PartCollector {
  constructor() { this.key = ''; this.parts = new Map(); this.total = 0; }
  add(raw) {
    const value = extract(raw);
    if (value.startsWith('EV1.')) return { code: value };
    const match = /^EVQ1\.([a-f0-9]{12})\.(\d+)\.(\d+)\.([A-Za-z0-9_.-]+)$/.exec(value);
    if (!match) throw new Error('No Everwell transfer found in this code.');
    const [, key, indexText, totalText, chunk] = match;
    const index = Number(indexText), total = Number(totalText);
    if (total < 2 || total > Math.ceil(MAX_CODE_LENGTH / 900) || index < 1 || index > total || chunk.length > 900) throw new Error('Invalid QR part.');
    if (this.key && (key !== this.key || total !== this.total)) throw new Error('This QR belongs to a different backup. Close and reopen Transfer to start again.');
    this.key = key; this.total = total; this.parts.set(index, chunk);
    if (this.parts.size === total) return { code: Array.from({ length: total }, (_, i) => this.parts.get(i + 1)).join('') };
    return { progress: `${this.parts.size} of ${total} QR codes received. Add the remaining codes.` };
  }
}

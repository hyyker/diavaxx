import { icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const modal = $('#modal');
export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
export const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

// Only application-owned attributes go in `attributes`; escape user text first.
export function btn(action, text, symbol = '', className = '', attributes = '') {
  return `<button type="button" class="btn ${className}" data-action="${action}" ${attributes}>
    ${symbol ? icon(symbol) : ''}<span>${text}</span></button>`;
}

export function openModal(title, body) {
  // Async readers and camera sessions must stop when the dialog changes.
  modal.dispatchEvent(new Event('dialogchange'));
  modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>
    <button type="button" class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close')}</button>
    </div>${body}<div id="modal-error" class="inline-error" role="alert"></div>`;
  if (!modal.open) modal.showModal();
  $('[data-action="close"]', modal).focus({ preventScroll: true });
}

export function error(message) {
  if ($('#modal-error')) $('#modal-error').textContent = message;
}

let toastTimer;
export function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000);
}

export function download(content, name, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import './style.css';
import { applyTheme } from './theme.js';
import { STORAGE_KEY, emptyState, cloneState, validateState, persist, today } from './model.js';
import { shell, diseaseList } from './views.js';
import { createForms } from './forms.js';
import { createTransferUI } from './transfer-ui.js';
import { encode } from './transfer.js';
import { $, modal, error, toast, download } from './ui.js';

let state = emptyState();
let storageError = '';
let blocked = false;
const view = { page: 'overview', filter: 'all', search: '', openRows: new Set() };

function load(raw) {
  state = raw ? validateState(JSON.parse(raw)) : emptyState();
  blocked = false;
  storageError = '';
}
try {
  load(localStorage.getItem(STORAGE_KEY));
} catch {
  blocked = true;
  storageError =
    'Your saved record could not be read. It has not been overwritten. Download the saved data for recovery, or import a valid backup.';
}

function render() {
  applyTheme(state.settings.theme);
  $('#app').innerHTML = shell(state, view, storageError);
}

// Persist before updating the visible state; failed saves keep the form open.
function commit(next, { replace = false } = {}) {
  try {
    if (blocked && !replace) throw new Error('Recover or replace the unreadable saved data first.');
    state = persist(localStorage, next);
    blocked = false;
    storageError = '';
    return true;
  } catch (failure) {
    const message =
      failure.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export a backup before clearing space.'
        : failure.message;
    if (modal.open) error(`Could not save: ${message}`);
    else toast(`Could not save: ${message}`);
    return false;
  }
}
function save(next, message, options) {
  if (!commit(next, options)) return false;
  modal.close();
  render();
  toast(message);
  return true;
}
const context = { getState: () => state, isBlocked: () => blocked, save };
const forms = createForms(context);
const transfer = createTransferUI(context);

const actions = {
  page(button) {
    view.page = button.dataset.page;
    render();
    window.scrollTo(0, 0);
  },
  filter(button) {
    view.filter = button.dataset.filter;
    render();
  },
  'show-all'() {
    view.search = '';
    view.filter = 'all';
    render();
  },
  log(button) {
    forms.entryDialog('dose', button.dataset.id);
  },
  edit(button) {
    forms.entryDialog('dose', button.dataset.id, button.dataset.entry);
  },
  illness(button) {
    forms.entryDialog('illness', button.dataset.id);
  },
  'edit-illness'(button) {
    forms.entryDialog('illness', button.dataset.id, button.dataset.entry);
  },
  plan(button) {
    forms.recordPlanDialog(button.dataset.id);
  },
  country(button) {
    forms.countryDialog(button.dataset.country);
  },
  delete(button) {
    forms.deleteDialog(button.dataset.id, button.dataset.entry, button.dataset.kind);
  },
  close() {
    modal.close();
  },
  'dismiss-welcome'() {
    const next = cloneState(state);
    next.settings.welcomeDismissed = true;
    if (commit(next)) render();
  },
  theme() {
    const next = cloneState(state);
    next.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (commit(next)) render();
  },
  transfer() {
    return transfer.transferDialog();
  },
  'transfer-tab'(button) {
    return transfer.transferDialog(button.dataset.tab);
  },
  'preview-code'() {
    transfer.receive($('#import-code').value);
  },
  camera() {
    return transfer.startCamera();
  },
  async 'copy-code'() {
    try {
      await navigator.clipboard.writeText(encode(state));
      toast('Transfer code copied.');
    } catch {
      $('#export-code')?.select();
      error('Clipboard access is unavailable. Select and copy the code manually.');
    }
  },
  'download-code'() {
    if (blocked) {
      error('Saved data is unreadable. Use Download saved data for recovery.');
      return;
    }
    download(encode(state), `diavaxx-backup-${today()}.txt`);
  },
  'raw-backup'() {
    try {
      download(
        localStorage.getItem(STORAGE_KEY) || '',
        `diavaxx-recovery-${today()}.json`,
        'application/json',
      );
    } catch {
      toast('Browser storage cannot be accessed.');
    }
  },
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  try {
    await actions[button.dataset.action]?.(button);
  } catch (failure) {
    modal.open ? error(failure.message) : toast(failure.message);
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id !== 'search') return;
  view.search = event.target.value;
  $('#disease-groups').innerHTML = diseaseList(state, view);
});
document.addEventListener(
  'toggle',
  (event) => {
    const row = event.target;
    if (!row.matches?.('.disease') || !row.isConnected) return;
    row.open ? view.openRows.add(row.dataset.id) : view.openRows.delete(row.dataset.id);
  },
  true,
);

// Close stale forms when another tab changes the record, preventing lost updates.
window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage || (event.key !== STORAGE_KEY && event.key !== null))
    return;
  try {
    load(localStorage.getItem(STORAGE_KEY));
    toast('Record updated from another tab.');
  } catch {
    blocked = true;
    storageError = 'Another tab saved unreadable data. It has not been overwritten.';
  }
  modal.close();
  render();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !modal.open) render();
});
render();

// URL fragments never go to the server. Remove the health payload from the address
// bar immediately, then require the same preview/replace step as other imports.
const transferred = new URLSearchParams(location.hash.slice(1)).get('transfer');
if (transferred) {
  window.history.replaceState(null, '', location.pathname + location.search);
  transfer.transferDialog('import');
  $('#import-code').value = transferred;
  transfer.receive(transferred);
}

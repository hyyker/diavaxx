import './style.css';
import { diseases, combinations, adultTargets, guidance, WHO_SOURCE, WHO_SCHEDULES, FINLAND_SOURCE } from './catalog.js';
import { STORAGE_KEY, emptyState, emptyRecord, today, status, doseCount, validateState, persist } from './model.js';
import { encode, decode, qrParts, PartCollector, MAX_CODE_LENGTH } from './transfer.js';
import { icon } from './icons.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const diseaseFor = id => diseases.find(d => d.id === id);
const dateLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const labels = { complete: 'Series complete', progress: 'In progress', due: 'Reminder due', review: 'Review your plan', skip: 'Not in your plan' };
const symbols = { complete: 'check', progress: 'clock', due: 'alert', review: 'alert', skip: 'minus' };
let state = emptyState(), storageError = '', blocked = false, page = 'overview', filter = 'all', search = '', openRows = new Set();
let collector, cameraStream, cameraFrame, transferSession = 0, toastTimer;
const modal = $('#modal');
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) state = validateState(JSON.parse(stored));
} catch {
  storageError = 'Your saved record could not be read. It has not been overwritten. Export the saved data for recovery, or import a valid backup to replace it.';
  blocked = true;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4500); }
function commit(next, { replace = false } = {}) {
  if (blocked && !replace) { const message = 'Recover or replace the unreadable saved data first.'; modal.open ? error(message) : toast(message); return false; }
  try { state = persist(localStorage, next); blocked = false; storageError = ''; return true; }
  catch (e) { const message = `Could not save: ${e.name === 'QuotaExceededError' ? 'browser storage is full. Export a backup before clearing space.' : e.message}`; modal.open ? error(message) : toast(message); return false; }
}
function record(id) { return state.records[id] || emptyRecord(); }
function clone() { return JSON.parse(JSON.stringify(state)); }
function counts() { const c = { complete: 0, attention: 0, skip: 0 }; diseases.forEach(d => { const s = status(record(d.id)); c[s === 'complete' || s === 'skip' ? s : 'attention']++; }); return c; }
function btn(action, text, symbol, cls = '', data = '') { return `<button type="button" class="btn ${cls}" data-action="${action}" ${data}>${symbol ? icon(symbol) : ''}<span>${text}</span></button>`; }
function brand() { return `<a class="brand" href="./" aria-label="diavaxx home"><span class="brand-mark">${icon('plus')}</span><span class="brand-text">diavaxx<span class="brand-dot">.</span></span></a>`; }
function render() {
  const c = counts();
  $('#app').innerHTML = `
    <aside class="sidebar">${brand()}<p class="brand-caption">A little care. A clearer picture.</p>
      <p class="eyebrow nav-label">Your health, organised</p>
      <nav class="nav" aria-label="Main navigation">
        <button data-action="page" data-page="overview" class="${page === 'overview' ? 'active' : ''}" aria-label="Vaccination overview" ${page === 'overview' ? 'aria-current="page"' : ''}>${icon('grid')}<span>My vaccinations</span></button>
        <button data-action="page" data-page="history" class="${page === 'history' ? 'active' : ''}" aria-label="Vaccination history" ${page === 'history' ? 'aria-current="page"' : ''}>${icon('clock')}<span>Vaccination history</span></button>
        <div class="nav-separator"></div>
        <button data-action="transfer" aria-label="Transfer and backup">${icon('sync')}<span>Transfer & backup</span></button>
        <button data-action="page" data-page="guide" class="${page === 'guide' ? 'active' : ''}" aria-label="Guide and sources">${icon('book')}<span>Guide & sources</span></button>
      </nav>
      <div class="side-bottom"><div class="privacy-card">${icon('lock')}<strong>Just you. Just this browser.</strong><p>Your health records stay on your device. No account, no cloud, no tracking.</p></div><div class="side-foot"><span>Made for peace of mind</span><span>v1.0</span></div></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb">My health ${icon('chevron')} <strong>${page === 'overview' ? 'Vaccination overview' : page === 'history' ? 'Vaccination history' : 'Guide & sources'}</strong></div><div class="mobile-brand">${brand()}</div><div class="saved-indicator"><span></span>${blocked ? 'Storage needs attention' : 'Stored on this device'}</div></header>
      <main class="content" id="main"><div class="page-heading"><div><div class="eyebrow">Your personal health companion</div><h1>${page === 'overview' ? 'A clearer picture of your protection.' : page === 'history' ? 'Every dose, in one place.' : 'A little guidance goes a long way.'}</h1><p>${page === 'overview' ? 'Keep your vaccinations together. Know what comes next.' : page === 'history' ? 'Your recorded vaccination dates and vaccine details.' : 'Understand your record, your plan, and your privacy.'}</p></div><div class="heading-actions">${btn('transfer', 'Transfer', 'sync', '', 'aria-label="Transfer records"')}${btn('log', 'Log vaccination', 'plus', 'primary', 'aria-label="Log vaccination"')}</div></div>
      ${storageError ? `<div class="inline-error storage-warning">${esc(storageError)} ${btn('raw-backup', 'Download saved data', 'download')}</div>` : ''}
      ${page === 'overview' ? overview(c) : page === 'history' ? history() : guide()}
      <nav class="mobile-links" aria-label="Mobile navigation"><button data-action="page" data-page="overview" ${page === 'overview' ? 'aria-current="page"' : ''}>${icon('grid')}Overview</button><button data-action="page" data-page="history" ${page === 'history' ? 'aria-current="page"' : ''}>${icon('clock')}History</button><button data-action="transfer">${icon('sync')}Transfer</button><button data-action="page" data-page="guide" ${page === 'guide' ? 'aria-current="page"' : ''}>${icon('book')}Guide</button></nav>
      <footer class="footer"><span>A little organisation. A lifetime of care.</span><button data-action="page" data-page="guide">WHO disease list · Finnish programme reference ${icon('arrow')}</button></footer>
    </main></div>`;
  if (page === 'overview') renderList();
}
function overview(c) {
  const fresh = !Object.keys(state.records).length;
  return `${fresh ? `<section class="welcome"><div class="welcome-copy"><div class="eyebrow">A good place to start</div><h2>Your health has a history.<br>Give it a home.</h2><p>Start with your vaccination card and add your first dose. Or use our Finnish adult starter plan to organise what to review.</p>${btn('starter', 'Explore the Finnish starter plan', 'arrow')}</div><div class="welcome-art" aria-hidden="true">${icon('shield')}</div></section>` : ''}
    <section class="stats" aria-label="Vaccination summary">
      <button class="stat complete" data-action="filter" data-filter="complete"><span class="stat-label">${icon('circleCheck')}Complete</span><div class="stat-bottom"><span class="stat-number">${c.complete}</span><span class="stat-desc">dose targets met</span></div>${icon('arrow')}</button>
      <button class="stat attention" data-action="filter" data-filter="attention"><span class="stat-label">${icon('clock')}Needs attention</span><div class="stat-bottom"><span class="stat-number">${c.attention}</span><span class="stat-desc">to finish or review</span></div>${icon('arrow')}</button>
      <button class="stat skip" data-action="filter" data-filter="skip"><span class="stat-label">${icon('minus')}Not in plan</span><div class="stat-bottom"><span class="stat-number">${c.skip}</span><span class="stat-desc">set aside for now</span></div>${icon('arrow')}</button>
    </section><section aria-label="Your vaccinations"><div class="section-head"><h2>My vaccinations <span>${diseases.length}</span></h2><p>A small step today. A healthier tomorrow.</p></div>
    <div class="filters"><div class="tabs" aria-label="Filter vaccinations">${[['all', 'All vaccinations'], ['attention', 'Needs attention'], ['complete', 'Complete'], ['skip', 'Not in plan']].map(([id, name]) => `<button data-action="filter" data-filter="${id}" aria-pressed="${filter === id}" class="${filter === id ? 'active' : ''}">${name}</button>`).join('')}</div><label class="search">${icon('search')}<input type="search" id="search" placeholder="Search vaccinations…" aria-label="Search vaccinations" value="${esc(search)}"></label></div><div id="disease-groups"></div></section>
    <div class="footnote">${icon('shield')}<span>“Complete” means your recorded dose target is met, not verified immunity. Timing, age, vaccine product and boosters matter. Review your plan with a healthcare professional. <a href="${FINLAND_SOURCE}" target="_blank" rel="noopener noreferrer">Finnish reference ${icon('arrow')}</a></span></div>`;
}
function renderList() {
  const groups = { due: [], progress: [], review: [], complete: [], skip: [] };
  diseases.forEach(d => { const s = status(record(d.id)); if ((filter === 'all' || (filter === 'attention' ? !['complete', 'skip'].includes(s) : s === filter)) && `${d.name} ${d.category} ${d.aliases}`.toLowerCase().includes(search.toLowerCase().trim())) groups[s].push(d); });
  const titles = { due: 'Reminders due', progress: 'A little more to go', review: 'Ready for your review', complete: 'Completed series', skip: 'Not currently in your plan' };
  $('#disease-groups').innerHTML = Object.entries(groups).filter(([, ds]) => ds.length).map(([s, ds]) => `<section class="group"><h3 class="group-label ${s === 'complete' ? 'complete' : ['due', 'progress'].includes(s) ? 'attention' : ''}"><span class="dot"></span>${titles[s]}<span>${ds.length}</span></h3><div class="disease-list">${ds.map(row).join('')}</div></section>`).join('') || `<div class="empty">${icon(filter === 'complete' ? 'shield' : 'search')}<h3>${search ? 'No matching vaccinations' : filter === 'complete' ? 'Your completed series will appear here' : 'Nothing in this group yet'}</h3><p>${search ? 'Try a disease name, abbreviation, or vaccine family.' : 'Open a vaccination to add doses and set your personal plan.'}</p>${btn('show-all', 'See all vaccinations', 'arrow')}</div>`;
}
function row(d) {
  const r = record(d.id), s = status(r), n = r.doses.length;
  const latest = [...r.doses].sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<details class="disease" data-id="${d.id}" ${openRows.has(d.id) ? 'open' : ''}><summary><span class="status-icon ${s}">${icon(symbols[s])}</span><div><div class="disease-name">${d.name}</div><div class="disease-sub">${latest ? `Last recorded ${dateLabel(latest.date)}` : d.aliases && d.aliases.length < 35 ? d.aliases : d.category}</div></div><div class="dose-meter"><span>${n}${r.target ? ` of ${r.target}` : ''} dose${n === 1 && !r.target ? '' : 's'} recorded</span>${r.target ? `<span class="dose-bars">${Array.from({ length: Math.min(r.target, 8) }, (_, i) => `<i class="${i < n ? 'filled' : ''}"></i>`).join('')}</span>` : ''}</div><span class="badge ${s}">${labels[s]}</span>${icon('chevron', 'row-chevron')}</summary><div class="disease-body"><p class="guidance">${guidance[d.id] || 'Your vaccination needs and dose schedule depend on age, vaccine product, previous doses and individual circumstances. Set the plan agreed with your healthcare professional.'} <a href="${adultTargets[d.id] || d.id === 'influenza' ? FINLAND_SOURCE : WHO_SOURCE}" target="_blank" rel="noopener noreferrer">View reference ↗</a></p>${r.nextDate ? `<p class="due-note">${icon('calendar')} Next review / dose: ${dateLabel(r.nextDate)}${r.plan === 'skip' ? ' · reminders paused while outside your plan' : ''}</p>` : ''}<div class="record-tools">${btn('log', 'Add dose', 'plus', 'primary', `data-id="${d.id}"`)}${btn('plan', 'Edit plan', '', '', `data-id="${d.id}"`)}</div>${n ? `<div class="dose-history">${[...r.doses].sort((a, b) => a.date.localeCompare(b.date)).map((dose, i) => `<div class="dose-entry"><div><strong>Dose ${i + 1} · ${dateLabel(dose.date)}</strong><p>${esc(dose.type || 'Vaccine type not specified')}</p></div>${btn('edit', 'Edit', '', 'text', `data-id="${d.id}" data-dose="${dose.id}"`)}</div>`).join('')}</div>` : `<p class="small muted" style="margin-top:16px">No doses recorded yet. Add dates from your vaccination card.</p>`}</div></details>`;
}
function history() {
  const entries = diseases.flatMap(d => record(d.id).doses.map(dose => ({ ...dose, disease: d }))).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="section-head"><h2>Vaccination history <span>${entries.length}</span></h2><p>Combination vaccines appear under each disease.</p></div>${entries.length ? `<div class="history-list">${entries.map(e => `<div class="dose-entry"><div><strong>${e.disease.name}</strong><p>${dateLabel(e.date)} · ${esc(e.type || 'Type not specified')}</p></div>${btn('edit', 'Edit', '', 'text', `data-id="${e.disease.id}" data-dose="${e.id}"`)}</div>`).join('')}</div>` : `<div class="empty">${icon('book')}<h3>Your story starts with one dose.</h3><p>Have your vaccination card handy?<br>Add your first entry and we’ll keep it organised here.</p>${btn('log', 'Log a vaccination', 'plus', 'primary')}</div>`}`;
}
function guide() { return `<article class="prose"><h2>A record that belongs to you</h2><p>diavaxx is a personal vaccination log. Add dated doses, set an agreed series target, and record the next review or dose date. A combination entry is recorded for each covered disease; the history total counts disease entries, not injections.</p><h2>What the colours mean</h2><ul><li><strong>Complete:</strong> your dose target is met and no recorded reminder is overdue.</li><li><strong>Needs attention:</strong> a series is unfinished, a reminder is due, or your plan still needs review.</li><li><strong>Not in plan:</strong> you have set this vaccination aside for now. This does not mean it is medically unnecessary or legally optional for you.</li></ul><p>Counts do not assess minimum dose intervals, age eligibility, product compatibility, immunity after infection, or contraindications. A completed primary series may still need boosters. Reminders use dates you enter; this website does not send notifications.</p><h2>A Finnish starting point</h2><p>The optional adult starter plan tracks diphtheria, tetanus, pertussis, polio and the three MMR diseases. Other entries remain for review. Dose targets refer to a basic series; adult boosters need separate review dates. This is not a child schedule or an individual recommendation.</p>${btn('starter', 'Explore the starter plan', 'arrow', 'text')}<h2>Sources & scope</h2><p>Catalogue reviewed 7 September 2026. All categories under WHO’s “Available vaccines” are represented. Hepatitis and meningococcal vaccines are split into useful record categories; shingles is included from the reference app. Pipeline-only vaccines and non-vaccine prophylaxis are excluded.</p><ul><li><a href="${WHO_SOURCE}" target="_blank" rel="noopener noreferrer">WHO · vaccine-preventable diseases</a></li><li><a href="${FINLAND_SOURCE}" target="_blank" rel="noopener noreferrer">Rokotesuoja · Finnish national vaccination programme</a> — takes precedence for the Finnish starter plan.</li><li><a href="${WHO_SCHEDULES}" target="_blank" rel="noopener noreferrer">WHO · routine immunization summary tables</a></li></ul><h2>Private, with a practical backup</h2><p>Your record is saved in this browser’s local storage. There are no accounts, analytics, or health-data uploads. Anyone using this browser profile can see it. Clearing site data, changing browsers or devices, or using private browsing can make records unavailable. Storage is tied to this website’s address.</p><p>Transfer codes, QR images and backups contain your readable health information; they are not encrypted. Share only with people and devices you trust. Transfers replace the receiving record after a preview. Export both devices first if they have different changes.</p>${btn('transfer', 'Transfer & back up your record', 'sync', 'text')}</article>`; }
function openModal(title, body) {
  stopCamera(); transferSession++;
  modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('plus', 'close-icon')}</button></div>${body}<div id="modal-error" class="inline-error" role="alert"></div>`;
  $('.close-icon', modal).style.transform = 'rotate(45deg)';
  if (!modal.open) modal.showModal();
}
function error(message) { $('#modal-error').textContent = message; }
function logDialog(id = '', doseId = '') {
  const existing = doseId ? record(id).doses.find(d => d.id === doseId) : null;
  openModal(existing ? 'Edit vaccination' : 'A little care, recorded.', `<p class="modal-intro">${existing ? 'Update this disease entry. Other entries from a combination vaccine are separate.' : 'Add a date from your vaccination card. A combination vaccine can cover several diseases at once.'}</p><form id="dose-form" class="form-grid"><label>Vaccination<select name="disease" required ${existing ? 'disabled' : ''}><option value="">Choose a disease or combination</option><optgroup label="Combination vaccines">${combinations.map(c => `<option value="combo:${c.id}">${c.name}</option>`).join('')}</optgroup><optgroup label="Diseases">${diseases.map(d => `<option value="${d.id}" ${id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</optgroup></select></label><label>Vaccination date<input name="date" type="date" min="1900-01-01" max="${today()}" required value="${existing?.date || today()}"></label><label>Vaccine type / brand <span class="muted small">Optional</span><input name="type" maxlength="120" placeholder="e.g. Comirnaty, Boostrix, or MMR" value="${esc(existing?.type || '')}"></label><small>Adding a dose does not automatically decide your vaccination needs. Set a dose target in “Edit plan” to track completion.</small><div class="modal-actions">${existing ? btn('delete', 'Delete dose', '', 'danger', `data-id="${id}" data-dose="${doseId}"`) : ''}${btn('close', 'Cancel')}<button class="btn primary" type="submit">${icon('check')}${existing ? 'Save changes' : 'Save vaccination'}</button></div></form>`);
  $('#dose-form').onsubmit = e => {
    e.preventDefault(); const form = e.currentTarget, data = new FormData(form);
    const selected = existing ? id : data.get('disease');
    const combo = combinations.find(c => `combo:${c.id}` === selected), selectedIds = combo?.ids || [selected];
    const next = clone();
    for (const diseaseId of selectedIds) {
      const r = next.records[diseaseId] ||= emptyRecord();
      const dose = { id: existing?.id || crypto.randomUUID(), date: data.get('date'), type: data.get('type').trim() || (combo ? combo.name.split(' · ')[0] : '') };
      if (!existing && r.doses.some(d => d.date === dose.date && d.type === dose.type)) { error('This date and vaccine type are already recorded. Edit the existing entry instead.'); return; }
      if (existing) r.doses = r.doses.map(d => d.id === doseId ? dose : d); else { r.doses.push(dose); if (r.plan === 'skip') r.plan = 'review'; }
    }
    if (commit(next)) { modal.close(); render(); toast(existing ? 'Vaccination updated.' : `Saved ${selectedIds.length === 1 ? 'your vaccination' : `${selectedIds.length} disease entries`}.`); }
  };
}
function planDialog(id) {
  const d = diseaseFor(id), r = record(id);
  openModal(`Your ${d.name} plan`, `<p class="modal-intro">${guidance[id] || 'Use the dose target and review date agreed with your healthcare professional. Schedules differ by age, product and circumstances.'}</p><form id="plan-form" class="form-grid"><label>Plan status<select name="plan"><option value="review" ${r.plan === 'review' ? 'selected' : ''}>Needs review — not decided yet</option><option value="track" ${r.plan === 'track' ? 'selected' : ''}>Track this vaccination</option><option value="skip" ${r.plan === 'skip' ? 'selected' : ''}>Not currently in my plan</option></select></label><label>Series dose target<input name="target" type="number" min="1" max="20" step="1" placeholder="Enter your agreed target" value="${r.target ?? ''}"><small>Required when tracking. Includes all primary-series doses you are logging; may be more than three. Completing this count does not validate dose timing or immunity.</small></label><label>Next review / dose date <span class="muted small">Optional</span><input type="date" name="nextDate" min="1900-01-01" value="${r.nextDate}"><small>Enter a clinician-advised date. A due reminder appears in Needs attention until you update or clear it. No automatic notifications.</small></label><div class="modal-actions">${btn('close', 'Cancel')}<button class="btn primary" type="submit">Save plan</button></div></form>`);
  const form = $('#plan-form');
  const required = () => { form.elements.target.required = form.elements.plan.value === 'track'; };
  form.elements.plan.onchange = required; required();
  form.onsubmit = e => { e.preventDefault(); const data = new FormData(form), next = clone(); next.records[id] = { ...record(id), plan: data.get('plan'), target: data.get('target') === '' ? null : Number(data.get('target')), nextDate: data.get('nextDate') }; if (commit(next)) { modal.close(); render(); toast('Your plan has been updated.'); } };
}
function starterDialog() {
  openModal('A Finnish adult starting point', `<p class="modal-intro">Use a basic-series checklist for seven routine diseases. Confirm targets and booster dates for your own history. Existing plans and doses are preserved.</p><div class="notice"><strong>3-dose targets:</strong> diphtheria, tetanus, pertussis, polio.<br><strong>2-dose targets:</strong> measles, mumps, rubella.<br>Other diseases stay available for review. This does not decide which additional vaccines you need.</div><p class="small muted">The Finnish reference guides the selection and MMR target; the three-dose basic series follows WHO summary guidance. Adult boosters are separate. For children, individual risks, or a different series, edit the plan with a professional.</p><div class="modal-actions">${btn('close', 'Cancel')}${btn('apply-starter', 'Use starter plan', 'check', 'primary')}</div>`);
}
function download(content, name, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function stopCamera() { cancelAnimationFrame(cameraFrame); cameraStream?.getTracks().forEach(t => t.stop()); cameraStream = null; }
modal.addEventListener('close', () => { stopCamera(); transferSession++; });
function transferDialog(tab = 'export') {
  collector = new PartCollector();
  openModal('Your record, wherever you go.', `<p class="modal-intro">Move an exact copy between devices, without an account. Your code contains health information. Keep it private.</p><div class="tabs transfer-tabs"><button data-action="transfer-tab" data-tab="export" class="${tab === 'export' ? 'active' : ''}" aria-pressed="${tab === 'export'}">Export & back up</button><button data-action="transfer-tab" data-tab="import" class="${tab === 'import' ? 'active' : ''}" aria-pressed="${tab === 'import'}">Import a record</button></div><div id="transfer-content"></div>`);
  if (tab === 'export') showExport(); else showImport();
}
async function showExport() {
  const session = transferSession;
  if (blocked) { $('#transfer-content').innerHTML = `<p class="notice">The saved record is unreadable. Download the original data for recovery.</p>${btn('raw-backup', 'Download saved data', 'download')}`; return; }
  const code = encode(state), parts = await qrParts(code);
  if (session !== transferSession || !modal.open) return;
  let current = 0;
  $('#transfer-content').innerHTML = `<div class="qr-wrap"><canvas id="qr-canvas" role="img" aria-label="Vaccination transfer QR code"></canvas><div class="qr-controls"><button id="qr-prev" class="icon-btn" aria-label="Previous QR code">←</button><span id="qr-page"></span><button id="qr-next" class="icon-btn" aria-label="Next QR code">→</button></div></div><p class="small muted">${parts.length === 1 ? 'Scan with your phone camera to open this site and preview the import.' : 'On the receiving device, open Import and scan or upload every QR code. Parts can be scanned in any order.'}</p><label class="field">Or use your transfer code<textarea id="export-code" readonly spellcheck="false">${code}</textarea></label><div class="transfer-options">${btn('copy-code', 'Copy code', 'sync')}${btn('download-code', 'Save backup', 'download')}<button class="btn" id="save-qr">${icon('qr')}Save QR image</button></div><p class="small muted">${doseCount(state)} disease entries · ${Object.keys(state.records).length} saved plans · Full replacement on import</p>`;
  async function draw() {
    $('#qr-page').textContent = `QR ${current + 1} of ${parts.length}`;
    $('#qr-prev').disabled = current === 0; $('#qr-next').disabled = current === parts.length - 1;
    const url = new URL(location.href); url.hash = ''; url.search = ''; url.hash = `transfer=${parts[current]}`;
    try {
      const payload = parts.length === 1 ? url.href : parts[current];
      const modules = QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules.size + 8;
      const scale = Math.max(1, Math.floor(280 / modules));
      // Keep every QR module on whole display pixels; arbitrary CSS scaling can break scans.
      await QRCode.toCanvas($('#qr-canvas'), payload, { scale, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#203c31', light: '#ffffff' } });
    }
    catch { error('Could not draw this QR code. You can still copy the code or save the backup.'); }
  }
  $('#qr-prev').onclick = () => { current--; draw(); }; $('#qr-next').onclick = () => { current++; draw(); };
  $('#save-qr').onclick = () => { const a = document.createElement('a'); a.download = `diavaxx-qr-${current + 1}-of-${parts.length}.png`; a.href = $('#qr-canvas').toDataURL('image/png'); a.click(); };
  await draw();
}
function showImport() {
  $('#transfer-content').innerHTML = `<p class="small muted">Open Export on your other device, then paste its code, load a backup, or scan its QR code here.</p><label class="field">Transfer code or link<textarea id="import-code" placeholder="EV1.…" spellcheck="false"></textarea></label>${btn('preview-code', 'Preview import', 'arrow', 'primary')}<div class="transfer-options"><label class="btn file-btn">${icon('download')}Load backup<input type="file" id="backup-file" accept=".txt,.json,text/plain,application/json" aria-label="Load backup file"></label><label class="btn file-btn">${icon('qr')}Upload QR<input type="file" id="qr-file" accept="image/*" aria-label="Upload QR image"></label>${btn('camera', 'Scan QR', 'qr')}</div><div id="scan-area"></div><p id="scan-progress" class="small muted" role="status"></p><div id="import-preview"></div><div class="notice">Import replaces all records and plan settings on this device. You’ll see a preview before anything changes.</div>`;
  $('#backup-file').onchange = async e => {
    const session = transferSession;
    $('#import-preview').innerHTML = ''; error('');
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > MAX_CODE_LENGTH) throw new Error('This file is too large.');
      const raw = await file.text(); if (session !== transferSession) return;
      if (raw.trim().startsWith('{')) preview(validateState(JSON.parse(raw))); else receive(raw);
    } catch (e) { if (session === transferSession) error(e.message); }
  };
  $('#qr-file').onchange = async e => {
    const session = transferSession;
    $('#import-preview').innerHTML = ''; error('');
    try {
      const file = e.target.files[0]; if (!file) return; if (file.size > 15000000) throw new Error('Please choose an image smaller than 15 MB.');
      const url = URL.createObjectURL(file), img = new Image();
      try { img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
      if (session !== transferSession) return;
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), result = jsQR(pixels.data, pixels.width, pixels.height);
      if (!result) throw new Error('No readable QR code found. Try a clearer image or use the transfer code.');
      receive(result.data);
    } catch (e) { if (session === transferSession) error(e.message); }
  };
}
function receive(raw) {
  $('#import-preview').innerHTML = ''; error('');
  try { const result = collector.add(raw); if (result.code) { const incoming = decode(result.code); stopCamera(); preview(incoming); } else $('#scan-progress').textContent = result.progress; }
  catch (e) { error(e.message); }
}
function preview(incoming) {
  $('#import-preview').innerHTML = `<div class="notice"><strong>Ready to import</strong><br>${doseCount(incoming)} disease entries and ${Object.keys(incoming.records).length} saved plans.<br>This replaces ${doseCount(state)} current entries and ${Object.keys(state.records).length} plans.</div><div class="transfer-options">${btn('download-code', 'Back up current record', 'download')}<button id="confirm-import" class="btn primary">Replace with this record</button></div>`;
  $('#confirm-import').onclick = () => { if (commit(incoming, { replace: true })) { modal.close(); render(); toast('Your complete record has been imported.'); } };
}
async function startCamera() {
  if (cameraStream) { stopCamera(); $('#scan-area').innerHTML = ''; return; }
  const session = transferSession;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. Use HTTPS, upload a QR image, or paste the code.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (session !== transferSession || !modal.open) { stream.getTracks().forEach(t => t.stop()); return; }
    cameraStream = stream;
    $('#scan-area').innerHTML = '<video id="camera" autoplay muted playsinline></video><p class="small muted">Point the camera at the QR code. Tap Scan QR again to stop.</p>';
    const video = $('#camera'); video.srcObject = stream; await video.play();
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    let last = 0, lastCode = '';
    function scan(time) {
      if (!cameraStream || session !== transferSession) return;
      if (video.readyState >= 2 && time - last > 250) {
        last = time; const scale = Math.min(1, 1000 / video.videoWidth); canvas.width = video.videoWidth * scale; canvas.height = video.videoHeight * scale;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), result = jsQR(pixels.data, pixels.width, pixels.height);
        if (result && result.data !== lastCode) { lastCode = result.data; receive(result.data); }
      }
      if (cameraStream) cameraFrame = requestAnimationFrame(scan);
    }
    cameraFrame = requestAnimationFrame(scan);
  } catch (e) { if (session === transferSession) { stopCamera(); error(`${e.message} You can also upload a QR image or paste the code.`); } }
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const { action, id, dose } = b.dataset;
  if (action === 'page') { page = b.dataset.page; render(); window.scrollTo(0, 0); }
  if (action === 'filter') { filter = b.dataset.filter; render(); }
  if (action === 'show-all') { search = ''; filter = 'all'; render(); }
  if (action === 'log' || action === 'edit') logDialog(id, dose);
  if (action === 'plan') planDialog(id);
  if (action === 'close') modal.close();
  if (action === 'starter') starterDialog();
  if (action === 'apply-starter') {
    const next = clone();
    for (const [id, target] of Object.entries(adultTargets)) if (!next.records[id] || next.records[id].plan === 'review') next.records[id] = { ...record(id), plan: 'track', target: record(id).target ?? target };
    if (commit(next)) { modal.close(); page = 'overview'; filter = 'all'; search = ''; render(); toast('Starter plan added. Review your targets and booster dates.'); }
  }
  if (action === 'delete') openModal('Delete this dose?', `<p class="modal-intro">Remove the ${dateLabel(record(id).doses.find(d => d.id === dose).date)} entry for ${diseaseFor(id).name}? Other disease entries stay in your record.</p><div class="modal-actions">${btn('close', 'Keep dose')}${btn('confirm-delete', 'Delete dose', '', 'danger', `data-id="${id}" data-dose="${dose}"`)}</div>`);
  if (action === 'confirm-delete') { const next = clone(); next.records[id].doses = next.records[id].doses.filter(d => d.id !== dose); if (commit(next)) { modal.close(); render(); toast('Dose deleted.'); } }
  if (action === 'transfer' || action === 'transfer-tab') transferDialog(b.dataset.tab || 'export');
  if (action === 'copy-code') { try { await navigator.clipboard.writeText(encode(state)); toast('Transfer code copied.'); } catch { $('#export-code')?.select(); error('Clipboard access is unavailable. The code is selected; copy it manually.'); } }
  if (action === 'download-code') { if (blocked) { error('Saved data is unreadable. Use Download saved data for recovery.'); return; } download(encode(state), `diavaxx-backup-${today()}.txt`); }
  if (action === 'raw-backup') { try { download(localStorage.getItem(STORAGE_KEY) || '', `diavaxx-recovery-${today()}.json`, 'application/json'); } catch { toast('Browser storage cannot be accessed.'); } }
  if (action === 'preview-code') receive($('#import-code').value);
  if (action === 'camera') startCamera();
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') { search = e.target.value; renderList(); }
  if (e.target.id === 'import-code') { $('#import-preview').innerHTML = ''; error(''); }
});
document.addEventListener('toggle', e => { if (e.target.matches?.('.disease')) { if (!e.target.isConnected) return; if (e.target.open) openRows.add(e.target.dataset.id); else openRows.delete(e.target.dataset.id); } }, true);
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  try { state = e.newValue ? validateState(JSON.parse(e.newValue)) : emptyState(); blocked = false; storageError = ''; modal.close(); render(); toast('Record updated from another tab.'); }
  catch { blocked = true; storageError = 'Another tab saved unreadable data. Your saved data has not been overwritten.'; modal.close(); render(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); else if (!modal.open) render(); });
render();
const transferred = new URLSearchParams(location.hash.slice(1)).get('transfer');
if (transferred) { window.history.replaceState(null, '', location.pathname + location.search); transferDialog('import'); $('#import-code').value = transferred; receive(transferred); }

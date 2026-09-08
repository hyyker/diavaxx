import { diseases, SOURCES, SOURCE_REVIEW_DATE } from './catalog.js';
import { recordFor } from './model.js';
import { PLANS, ageLabel } from './plans.js';
import { vaccinationStatus, statusCounts } from './status.js';
import { btn, esc, dateLabel } from './ui.js';
import { icon } from './icons.js';

const symbols = {
  complete: 'check',
  progress: 'clock',
  due: 'alert',
  review: 'alert',
  skip: 'minus',
};
const pages = {
  overview: [
    'Vaccination overview',
    'A clearer picture of your protection.',
    'Keep your vaccinations together. Know what comes next.',
  ],
  history: [
    'Health history',
    'Every entry, in one place.',
    'Your vaccinations and illness history, together.',
  ],
  guide: [
    'Guide & sources',
    'A little guidance goes a long way.',
    'Understand your record, your plan, and your privacy.',
  ],
};
const filters = [
  ['all', 'All vaccinations'],
  ['attention', 'Needs attention'],
  ['complete', 'Complete'],
  ['skip', 'Not in plan'],
];

function brand() {
  return `<a class="brand" href="./" aria-label="diavaxx home"><span class="brand-mark">${icon('plus')}</span>
    <span class="brand-text">diavaxx<span class="brand-dot">.</span></span></a>`;
}

export function shell(state, view, storageError) {
  const [title, heading, intro] = pages[view.page];
  const country = PLANS.find((plan) => plan.id === state.settings.plan);
  const dark = document.documentElement.dataset.theme === 'dark';
  return `
    <aside class="sidebar">
      ${brand()}<p class="brand-caption">A little care. A clearer picture.</p>
      <p class="eyebrow nav-label">Your health, organised</p>
      <nav class="nav" aria-label="Main navigation">
        ${[
          ['overview', 'My vaccinations', 'grid'],
          ['history', 'Health history', 'clock'],
        ]
          .map(([page, label, symbol]) => navItem(page, label, symbol, view.page))
          .join('')}
        <div class="nav-separator"></div>
        <button data-action="country" aria-label="Plan and age group">${icon('calendar')}<span>Plan & age group</span></button>
        <button data-action="transfer" aria-label="Transfer and backup">${icon('sync')}<span>Transfer & backup</span></button>
        ${navItem('guide', 'Guide & sources', 'book', view.page)}
      </nav>
      <div class="side-bottom"><div class="privacy-card">${icon('lock')}<strong>Just you. Just this browser.</strong>
        <p>Your health records stay on your device. No account, no cloud, no tracking.</p></div>
        <div class="side-foot"><span>Made for peace of mind</span><span>v2.0</span></div></div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">My health ${icon('chevron')}<strong>${title}</strong></div>
        <div class="mobile-brand">${brand()}</div>
        <div class="topbar-tools"><div class="saved-indicator"><span></span>${storageError ? 'Storage needs attention' : 'Stored on this device'}</div>
          <button class="icon-btn theme-toggle" data-action="theme" aria-label="Toggle dark mode" aria-pressed="${dark}" title="Toggle dark mode">${icon(dark ? 'sun' : 'moon')}</button>
        </div>
      </header>
      <main class="content" id="main">
        <div class="page-heading"><div><div class="eyebrow">Your personal health companion</div><h1>${heading}</h1><p>${intro}</p></div>
          <div class="heading-actions">${btn('transfer', 'Transfer', 'sync', '', 'aria-label="Transfer records"')}${btn('log', 'Log vaccination', 'plus', 'primary', 'aria-label="Log vaccination"')}</div>
        </div>
        ${storageError ? `<div class="inline-error storage-warning">${esc(storageError)} ${btn('raw-backup', 'Download saved data', 'download')}</div>` : ''}
        <div class="plan-strip"><button data-action="country" aria-label="Change plan and age group">${icon('calendar')}
          <strong>${country.shortName}</strong><span>· ${ageLabel(state.settings.ageGroup)}</span>${icon('chevron')}</button>
          <span class="small muted">A checklist to review, at your pace.</span></div>
        ${view.page === 'overview' ? overview(state, view) : view.page === 'history' ? history(state) : guide()}
        <nav class="mobile-links" aria-label="Mobile navigation">
          ${[
            ['overview', 'Overview', 'grid'],
            ['history', 'History', 'clock'],
          ]
            .map(([page, label, symbol]) => navItem(page, label, symbol, view.page))
            .join('')}
          <button data-action="country">${icon('calendar')}Plan</button>
          ${navItem('guide', 'Guide', 'book', view.page)}
        </nav>
        <footer class="footer"><span>A little organisation. A lifetime of care.</span>
          <button data-action="page" data-page="guide">WHO · THL · German guidance ${icon('arrow')}</button></footer>
      </main>
    </div>`;
}

function navItem(page, label, symbol, current) {
  return `<button data-action="page" data-page="${page}" aria-label="${label}" class="${current === page ? 'active' : ''}"
    ${current === page ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></button>`;
}

function overview(state, view) {
  const counts = statusCounts(state);
  return `
    ${
      state.settings.plan === 'none' && !state.settings.welcomeDismissed
        ? `
      <section class="welcome">
        <button class="icon-btn welcome-dismiss" data-action="dismiss-welcome" aria-label="Dismiss starter plans">${icon('close')}</button>
        <div class="welcome-copy"><div class="eyebrow">A good place to start</div><h2>Your health has a history.<br>Give it a home.</h2>
          <p>Add dates from your vaccination card, or choose a country and age group to organise your checklist.</p>
          <div class="welcome-actions">${btn('country', 'Finnish starter plan', 'arrow', '', 'data-country="finland"')}${btn('country', 'German starter plan', 'arrow', '', 'data-country="germany"')}</div>
        </div><div class="welcome-art" aria-hidden="true">${icon('shield')}</div>
      </section>`
        : ''
    }
    <section class="stats" aria-label="Vaccination summary">
      ${[
        ['complete', 'Complete', 'circleCheck', 'reference criteria met'],
        ['attention', 'Needs attention', 'clock', 'to finish or review'],
        ['skip', 'Not in plan', 'minus', 'set aside for now'],
      ]
        .map(
          ([kind, label, symbol, detail]) => `
        <button class="stat ${kind}" data-action="filter" data-filter="${kind}"><span class="stat-label">${icon(symbol)}${label}</span>
          <div class="stat-bottom"><span class="stat-number">${counts[kind]}</span><span class="stat-desc">${detail}</span></div>${icon('arrow')}</button>`,
        )
        .join('')}
    </section>
    <section aria-label="Your vaccinations"><div class="section-head"><h2>My vaccinations <span>${diseases.length}</span></h2><p>A small step today. A healthier tomorrow.</p></div>
      <div class="filters"><div class="tabs" aria-label="Filter vaccinations">${filters
        .map(
          ([id, name]) => `
        <button data-action="filter" data-filter="${id}" aria-pressed="${view.filter === id}" class="${view.filter === id ? 'active' : ''}">${name}</button>`,
        )
        .join('')}</div>
        <label class="search">${icon('search')}<input type="search" id="search" placeholder="Search vaccinations…" aria-label="Search vaccinations" value="${esc(view.search)}"></label>
      </div><div id="disease-groups">${diseaseList(state, view)}</div>
    </section>
    <div class="footnote">${icon('shield')}<span>“Complete” means the reference dose count or a supported, confirmed illness history is recorded. It does not verify immunity or dose timing. Boosters and personal eligibility still need review.</span></div>`;
}

export function diseaseList(state, view) {
  // Insertion order controls the order of sections in the overview.
  const groups = { due: [], review: [], progress: [], complete: [], skip: [] };
  for (const disease of diseases) {
    const status = vaccinationStatus(state, disease.id).kind;
    const matchesFilter =
      view.filter === 'all' ||
      (view.filter === 'attention'
        ? !['complete', 'skip'].includes(status)
        : status === view.filter);
    const matchesSearch = `${disease.name} ${disease.category} ${disease.aliases}`
      .toLowerCase()
      .includes(view.search.toLowerCase().trim());
    if (matchesFilter && matchesSearch) groups[status].push(disease);
  }
  const titles = {
    due: 'Reminders due',
    review: 'Ready for your review',
    progress: 'A little more to go',
    complete: 'Completed records',
    skip: 'Not currently in your plan',
  };
  return (
    Object.entries(groups)
      .filter(([, items]) => items.length)
      .map(
        ([kind, items]) => `
    <section class="group"><h3 class="group-label ${kind === 'complete' ? 'complete' : ['due', 'progress'].includes(kind) ? 'attention' : ''}">
      <span class="dot"></span>${titles[kind]}<span>${items.length}</span></h3>
      <div class="disease-list">${items.map((disease) => row(state, disease, view.openRows.has(disease.id))).join('')}</div>
    </section>`,
      )
      .join('') ||
    `<div class="empty">${icon('search')}<h3>No records in this view</h3><p>Try another filter or disease name.</p>${btn('show-all', 'See all vaccinations', 'arrow')}</div>`
  );
}

function row(state, disease, open) {
  const record = recordFor(state, disease.id);
  const status = vaccinationStatus(state, disease.id);
  const entries = [...record.doses, ...record.illnesses].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return `<details class="disease" data-id="${disease.id}" ${open ? 'open' : ''}>
    <summary><span class="status-icon ${status.kind}">${icon(symbols[status.kind])}</span>
      <div><div class="disease-name">${disease.name}</div><div class="disease-sub">${entries[0] ? `Last recorded ${dateLabel(entries[0].date)}` : disease.category}</div></div>
      <div class="dose-meter"><span>${status.evidence === 'illness' && status.kind === 'complete' ? 'Illness history' : `${status.count} of ${status.target} dose dates`}</span>
        <span class="dose-bars">${Array.from({ length: Math.min(status.target, 8) }, (_, i) => `<i class="${i < status.count ? 'filled' : ''}"></i>`).join('')}</span></div>
      <span class="badge ${status.kind}">${status.label}</span>${icon('chevron', 'row-chevron')}
    </summary>
    <div class="disease-body"><p class="guidance"><strong>${record.target === null ? 'Reference' : 'Personal'} target: ${status.target} dose${status.target === 1 ? '' : 's'}.</strong>
      ${status.reference.note} <a href="${status.reference.source}" target="_blank" rel="noopener noreferrer">View reference ↗</a></p>
      <p class="status-detail small">${status.detail}</p>
      ${record.nextDate ? `<p class="due-note">${icon('calendar')}Next review / dose: ${dateLabel(record.nextDate)}${status.kind === 'skip' ? ' · reminder paused outside your plan' : ''}</p>` : ''}
      <div class="record-tools">${btn('log', 'Add dose', 'plus', 'primary', `data-id="${disease.id}"`)}${btn('illness', 'Add illness', '', '', `data-id="${disease.id}"`)}${btn('plan', 'Edit plan', '', '', `data-id="${disease.id}"`)}</div>
      ${entries.length ? `<div class="dose-history">${entries.map((entry) => entryRow(entry, disease.id)).join('')}</div>` : '<p class="small muted empty-record">No vaccinations or illnesses recorded yet.</p>'}
    </div></details>`;
}

export function illnessLabel(entry) {
  return `${entry.duration ? `${entry.duration} day${entry.duration === 1 ? '' : 's'} · ` : ''}${entry.confirmed ? 'Clinician / lab confirmed' : 'Not confirmed'} · ${entry.recovered ? 'Recovered' : 'Recovery not recorded'}`;
}

function entryRow(entry, diseaseId, heading = '') {
  const illness = Object.hasOwn(entry, 'confirmed');
  return `<div class="dose-entry"><div><strong>${heading || `${illness ? 'Illness' : 'Vaccination'} · ${dateLabel(entry.date)}`}</strong>
    <p>${heading ? `${dateLabel(entry.date)} · ${illness ? 'Illness' : 'Vaccination'} · ` : ''}${esc(illness ? illnessLabel(entry) : entry.type || 'Vaccine type not specified')}</p></div>
    ${btn(illness ? 'edit-illness' : 'edit', 'Edit', '', 'text', `data-id="${diseaseId}" data-entry="${esc(entry.id)}"`)}</div>`;
}

function history(state) {
  const entries = diseases
    .flatMap((disease) =>
      [...recordFor(state, disease.id).doses, ...recordFor(state, disease.id).illnesses].map(
        (entry) => ({ entry, disease }),
      ),
    )
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date));
  return `<div class="section-head"><h2>Health history <span>${entries.length}</span></h2><p>Combination vaccines appear under each disease.</p></div>
    ${
      entries.length
        ? `<div class="history-list">${entries.map(({ entry, disease }) => entryRow(entry, disease.id, disease.name)).join('')}</div>`
        : `
      <div class="empty">${icon('book')}<h3>Your story starts with one entry.</h3><p>Add a vaccination or an illness to your record.</p>
        <div class="welcome-actions">${btn('log', 'Log a vaccination', 'plus', 'primary')}${btn('illness', 'Log an illness')}</div></div>`
    }`;
}

function guide() {
  return `<article class="prose">
    <h2>A record that belongs to you</h2><p>diavaxx keeps dated vaccinations and illnesses in one browser. Combination vaccines create an entry for each disease, so totals count disease entries, not injections.</p>
    <h2>What the colours mean</h2><ul>
      <li><strong>Complete:</strong> the reference or personal dose count is met, or supported confirmed illness history is recorded, with no overdue reminder or unresolved illness.</li>
      <li><strong>Needs attention:</strong> a series is unfinished, a reminder is due, or a record needs review.</li>
      <li><strong>Not in plan:</strong> outside your selected country and age checklist, or personally set aside. This does not mean medically unnecessary.</li></ul>
    <p>Only distinct vaccination dates count toward the target. The app does not validate minimum intervals, exact age eligibility, product compatibility or contraindications. “Complete” is a record status, not verified immunity. Enter clinician-advised booster and review dates in Edit plan; reminders do not send notifications.</p>
    <h2>A plan for your stage of life</h2><p>Choose Finland, Germany, or no country plan, then your age group. These are broad checklists covering primary courses and later review, not a calendar of doses due today. Update your age group as you grow. Risk, travel, pregnancy and catch-up needs require individual review.</p>
    <p>Without a country plan, every disease has a named WHO or product reference count. There is no single universal schedule. Personal targets and explicit Track / Not in plan choices survive country changes. Adding a new entry to an excluded disease makes it personally tracked.</p>
    ${btn('country', 'Choose plan & age group', 'calendar', 'text')}
    <h2>Recording a past illness</h2><p>Log its start date and, optionally, duration in days. Mark whether a clinician or laboratory confirmed it and whether you recovered. Confirmed, recovered measles, mumps, rubella and varicella can satisfy the history criterion described by THL. Other infections do not automatically replace doses. An unconfirmed history needs review; an illness without recorded recovery keeps the status under review.</p>
    <p>Past COVID infections remain in your history without using the old three-contact rule. The July 2026 RKI update removed that general German baseline requirement and recommends routine seasonal vaccination from 75, plus vaccination for indicated risk groups.</p>
    <h2>Sources & scope</h2><p>Reviewed ${dateLabel(SOURCE_REVIEW_DATE)}. The WHO available-vaccine catalogue is represented; useful hepatitis and meningococcal categories are separate. Shingles is included. Pipeline vaccines and non-vaccine prophylaxis, including infant RSV antibodies, are excluded.</p>
    <ul>${[
      ['who', 'WHO · vaccine-preventable diseases'],
      ['schedules', 'WHO · routine immunization summary tables'],
      ['finland', 'THL · Finnish national programme'],
      ['germany', 'German Federal Ministry of Health · recommended vaccinations'],
      ['germanCovid', 'RKI · July 2026 COVID recommendation update'],
    ]
      .map(
        ([key, label]) =>
          `<li><a href="${SOURCES[key]}" target="_blank" rel="noopener noreferrer">${label}</a></li>`,
      )
      .join('')}</ul>
    <h2>Private, with a practical backup</h2><p>Your record stays in local browser storage. There are no accounts, analytics or health-data uploads. Anyone using this browser profile can see it. Clearing site data, private browsing, or changing the website address can make records unavailable.</p>
    <p>Transfer codes, QR images and backups contain readable health information and are not encrypted. Import previews an exact replacement, including illnesses, country, age group and preferences. Back up both devices before replacing differing records. Old V1 codes still import; V2 codes require this version or newer.</p>
    ${btn('transfer', 'Transfer & back up your record', 'sync', 'text')}
  </article>`;
}

# diavaxx 2 implementation plan

- [x] Replace the old Finnish source with THL; add the German BMG source and newer RKI corrections.
- [x] Model country and age-group selection separately from personal disease overrides.
- [x] Supply documented reference dose counts when no country is selected.
- [x] Add illness dates, optional duration, and confirmation; only credit supported disease histories.
- [x] Migrate V1 records and imports without deleting vaccination history.
- [x] Add compact V2 transfers, old-code import, extension fields, and bounded validation.
- [x] Add a persistent plan chooser, a dismissible welcome card, and light/dark/system appearance.
- [x] Separate rendering, forms, storage, and QR handling; format code and document contribution rules.
- [x] Test model boundaries, source-specific rules, old/new transfers, and desktop/mobile journeys.

Plans are life-stage checklists, not an exact clinical due-date engine. Missing vaccination dates cannot determine whether a dose was given at the correct age. Personal overrides and clinician-entered reminders take precedence. Illness history is not universally equivalent to a vaccine dose. Future incompatible data versions must fail visibly rather than silently lose records.

Validation completed: 17 core tests, 20 browser tests across desktop Chromium and iPhone 12-sized WebKit, production build, formatting check, and visual inspection in light/dark modes.

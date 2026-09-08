# diavaxx

An English-language vaccination and illness tracker for GitHub Pages. Records stay in the browser: no backend, accounts, analytics, remote fonts, or runtime CDN dependencies.

## Run locally

Use Node.js 22.12+ and npm:

```sh
npm ci
npm run dev
```

The development site and published website have separate browser storage.

```sh
npm test                 # Rules, validation, migrations, compression and QR round trips
npm run build            # Static output in dist/
npm run preview          # Preview the production build
npx playwright install chromium webkit
npm run test:e2e          # Desktop Chromium and iPhone 12-sized WebKit
npm run format:check      # Check readable, consistent source formatting
```

## Using diavaxx

- Open a disease to add, edit or delete vaccinations and illnesses. Vaccine type is optional. Illnesses have a start date, optional duration in days, and confirmation/recovery fields.
- **Log vaccination** includes an **Illness** tab and combination vaccines. A combination creates an independent entry for each disease; totals count disease entries, not injections.
- Choose **Finland**, **Germany**, or **No country plan** in **Plan & age group**. Age groups cover infancy through 75+. The welcome suggestions can be dismissed, and the plan remains accessible in the navigation and above the overview.
- Country checklists place excluded diseases in **Not in plan**. Personal Track, Review and Not in plan choices survive country changes. Adding a new entry to an excluded disease makes it personally tracked.
- Every disease has a documented reference dose count, including without a country plan. **Edit plan** can override the target (1–20) or add a review/booster date. Clear the target to return to the reference; choose **Follow country / reference plan** to remove a personal inclusion override.
- The header button toggles dark mode. **Appearance** in the plan dialog can restore the device setting. Appearance, age group and welcome dismissal are saved and transferred.

**Complete** means the reference/personal dose count or a supported illness-history criterion is met. Only distinct dose dates count. Overdue reminders and illnesses without recorded recovery require review. **Not in plan** means outside this checklist, not medically unnecessary.

These are broad life-stage checklists, **not an exact clinical scheduling engine**. Counts do not validate minimum intervals, age eligibility, product compatibility, contraindications or immunity. Primary courses may still need boosters. The app does not infer travel, pregnancy, occupation or medical risk. Review targets and reminder dates with a healthcare professional. Age groups and reminders must be updated manually; there are no notifications.

Confirmed, recovered **measles, mumps, rubella and varicella** histories can satisfy the documented history criterion. Other illnesses are recorded but do not automatically replace vaccine doses. Infant RSV antibodies are prophylaxis, not vaccinations.

## Sources

Reviewed **8 September 2026**. [Source notes and age-stage details](docs/sources.md) explain the assumptions behind the counts.

- [WHO disease catalogue](https://www.who.int/teams/immunization-vaccines-and-biologicals/diseases) defines the available-vaccine scope: 34 record categories, splitting hepatitis and meningococcal vaccines and including shingles.
- [WHO summary tables](https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables) supply common primary-course references. There is no universal count applicable to every product and person.
- [THL Finnish programme](https://thl.fi/nakemyksemme/korkeasta-rokotuskattavuudesta-on-pidettava-huolta/kansallinen-rokotusohjelma-mita-rokotteita-eri-ikaisille-suositellaan-) replaces the previous Finnish source.
- [German Federal Ministry of Health](https://www.bundesgesundheitsministerium.de/themen/praevention/impfungen/schutzimpfungen) supplies German programme context.
- [RKI July 2026 COVID update](https://edoc.rki.de/handle/176904/13784.2) supersedes the older German overview's general three-contact rule. Routine seasonal vaccination is included from 75; risk-based recommendations below that age require individual review.

## Backup and transfer

Export provides a compressed code, text backup and QR image(s). Import accepts a code/link, text backup, JSON state, camera scan, or QR image. It validates and previews an **exact replacement** before saving. There is no automatic merge; export both devices before replacing differing records.

V2 uses compact fields, vaccine-name dictionaries, packed dates/IDs, zlib compression and an integrity checksum. **Original V1 codes and local records still import**, preserving vaccination IDs, dates, types, personal targets and reminders. V1 did not store the selected country; migration therefore leaves the country unselected. V1 undecided records use the new automatic reference targets. The first successful edit saves the migrated schema.

The format supports optional extension fields for future features. Unknown incompatible versions or fields are rejected visibly rather than silently discarded. The old app cannot read new codes. See the [transfer format](docs/transfer-format.md) for wire details and migration guarantees.

Records support up to 2,000 total vaccination/illness entries, 120 characters per vaccine type, and 610 KB serialized UTF-8 (including migration headroom above V1’s 600 KB limit). Large backups split into numbered QR parts; scan all parts in any order. A single QR is a link with data in the URL fragment, which is not sent in HTTP requests. The app removes that fragment before previewing.

**Backups and local storage are not encrypted.** Anyone with the code or access to this browser profile can read the record. Clearing site data, using private browsing, or moving to a different address/browser may make records unavailable. Export regularly. Unreadable stored data is preserved for recovery; failed saves are reported. Cross-tab updates close stale forms.

## Publish to GitHub Pages

For an existing installation, push the changes to `main`; the existing workflow builds and deploys them. No backend or GitHub configuration changes are required for V2.

For a new installation:

1. Create a GitHub repository and push this project to its `main` branch.
2. Set **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Run **Actions → Deploy to GitHub Pages** if the first push happened before Pages was enabled.

The workflow tests the rules, builds the app and publishes `dist/`. The relative Vite base supports `username.github.io/repository/` and custom domains. Do not deploy the unbuilt source with “Deploy from a branch.”

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the source map and testing conventions. The app uses plain JavaScript and small modules. Runtime dependencies are `fflate`, `qrcode` and `jsqr`; QR generation and scanning load when needed. Vite is the build tool, Prettier formats source, and Playwright exercises browser flows.

Camera access requires HTTPS or localhost. Automated iPhone-sized WebKit testing complements, but does not replace, checks on a physical phone.

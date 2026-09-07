# diavaxx

A responsive, English-language vaccination tracker for GitHub Pages. All records stay in the browser. No backend, accounts, analytics, remote fonts, or runtime CDN dependencies.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS) and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Local development and the published website have separate browser storage.

```sh
npm test                 # Record validation, status logic, transfer and QR round-trips
npm run build            # Static output in dist/
npm run preview          # Preview the production build
npx playwright install chromium webkit
npm run test:e2e          # Desktop Chromium and iPhone 12 viewport in WebKit
```

## Publish to GitHub Pages

1. Create an empty repository on your GitHub account.
2. In this project, connect it and push:

   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. In the GitHub repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
4. Open **Actions → Deploy to GitHub Pages → Run workflow** if the initial push happened before Pages was configured.
5. The workflow tests and builds the app, then publishes `dist/`. The deployment provides the website URL.

The relative Vite base supports both `username.github.io` and `username.github.io/repository/`, as well as a custom domain. The app uses no server routes. Do not choose “Deploy from a branch” for the source files; the workflow publishes the built files.

## Using the tracker

- Open a disease to add, edit or delete dated doses. Vaccine type/brand is optional.
- The global **Log vaccination** button also offers combination vaccines. Each covered disease gets its own entry; later edits affect only the selected disease. Totals count disease entries, not injections.
- **Edit plan** sets a dose target (1–20), next review/dose date, and whether to track, review or set aside a disease.
- **Complete** means the recorded count meets the chosen series target with no due reminder. **Needs attention** includes unfinished series, due reminders and undecided plans. **Not in plan** is the user's choice, not a medical or legal determination.
- New records start undecided. An optional Finnish adult starter checklist sets seven basic-series targets; it preserves existing explicit plans and doses. Other diseases stay available for review.
- Dates are interpreted as local calendar dates. Future vaccinations and invalid dates are rejected. A next review date may be past or future. Reminders must be updated or cleared manually and are shown only while the website is open.

## Disease and schedule sources

Reviewed **7 September 2026**:

- [WHO: Available vaccines](https://www.who.int/teams/immunization-vaccines-and-biologicals/diseases) supplies the complete disease-category scope. Hepatitis is split into A, B and E; meningococcal vaccines into ACWY, B and C. Smallpox/mpox remain grouped. Shingles is an additional category from the user’s reference app. There are 34 entries.
- [Rokotesuoja: Finnish national programme](https://www.rokotesuoja.fi/miksi-rokottautua/kansallinen-rokotusohjelma) takes precedence for the Finnish adult selection, MMR targets and booster context.
- [WHO summary tables](https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables), particularly [Table 3](https://www.who.int/publications/m/item/table-3-recommendations-for-interrupted-or-delayed-routine-immunization-summary-of-who-position-papers), support the DTP basic series and the three-dose IPV option.

The app is a record and personal-plan tracker, not a clinical schedule engine. It does not infer age, exposure, pregnancy, contraindications, dose spacing, vaccine interchangeability, previous infection or immunity. There is deliberately no single universal dose count for every vaccine: many depend on product, age and previous doses. Primary-series completion is not lifelong protection. Confirm dose targets and booster dates with a healthcare professional. In particular, the adult starter is not a childhood schedule.

No pipeline-only diseases or non-vaccine prophylaxis entries (e.g. rhesus prophylaxis) are included. The dataset is static: review `src/catalog.js` when source recommendations change.

## Backup and transfer

**Export & back up** provides a transfer string, downloadable text backup and downloadable QR image(s). **Import a record** accepts the string/link, text backup, JSON state, camera scan, or QR screenshot/photo. Import validates and previews the data before replacing the receiving record. Export both devices before choosing which should replace the other; there is no automatic merge.

The `EV1.` format is a validated version-1 JSON state, compressed with zlib and encoded as URL-safe Base64. It includes every dose ID, date, type, target, plan status and reminder. It is **not encrypted**. Treat backups and QR codes as private health records. Decoding is local, and malformed or oversized input is rejected. A record supports up to 2,000 disease-dose entries, a 120-character vaccine type, and 600 KB of serialized UTF-8 data. Export and import share compatible size limits.

One QR uses a link to this website with data in the URL fragment (`#transfer=…`), which is not sent in HTTP requests. The app removes the fragment from the address bar before previewing. For longer records, `EVQ1.` splits the code into numbered 900-character chunks with a shared transfer identifier. Scan or upload all parts using the app's import screen, in any order. The full text backup remains available regardless of QR count.

Clearing browser/site data, moving to another URL, using a different browser or private browsing may make records unavailable. Local storage is not encrypted, and other people using the same browser profile can see it. Export regularly. Storage failures are surfaced; unreadable existing records are preserved for recovery rather than silently overwritten. Updates from another tab refresh the UI and close stale edit dialogs.

## Structure

- `src/app.js`: views, forms, local persistence, QR camera/image UI.
- `src/model.js`: schema validation and deterministic status logic.
- `src/catalog.js`: disease catalogue, combinations, source links and starter targets.
- `src/transfer.js`: bounded decoding, compression and multipart transfer.
- `src/style.css`: responsive styles; system fonts.
- `src/icons.js`: small inline SVG icon set.
- `tests/`: core tests and end-to-end browser flows.
- `.github/workflows/deploy.yml`: GitHub Pages deployment.

Runtime dependencies are limited to `fflate` (compression), `qrcode` (generation), and `jsqr` (cross-browser camera/image decoding). Vite builds the static bundle; Playwright is used only for testing. Camera access requires HTTPS or localhost. iPhone-sized WebKit is tested, but emulation is not a substitute for physical-device testing.

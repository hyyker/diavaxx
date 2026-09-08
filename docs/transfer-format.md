# Transfer format and compatibility

All encoding, decoding and QR work happens locally. This is a backup format, not encryption or authentication. Import always validates, previews and asks the receiving user to replace their record.

## Versions

| Input                              | Current app behavior                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Schema-1 local JSON or `EV1.` code | Validate the original structure, preserve vaccination data, migrate to schema 2 |
| Legacy `EVQ1.` QR parts            | Collect, then decode/migrate the reconstructed V1 code                          |
| Schema-2 JSON or `DV2.` code       | Validate and restore exactly                                                    |
| `DVQ2.` QR parts                   | Collect, then decode the reconstructed V2 code                                  |
| Unknown incompatible version/field | Show an error and keep the existing record                                      |

V1 did not persist country, age, theme or illness history. Migration starts with no country, adult reference targets, system appearance and an undismissed welcome. V1 `review` becomes automatic; explicit `track`, `skip`, targets and reminders remain. No vaccination ID, date or type is changed. The storage key remains `everwell.records.v1` so renamed/upgraded builds still find existing records. The first successful user edit persists V2; simply loading the page does not rewrite a V1 record.

Old applications cannot import V2. Compatibility means new versions keep reading earlier backups. Optional `extensions` bags at the state, settings, record, vaccination and illness levels provide space for future features; current edits and transfers preserve these bounded JSON objects without interpreting them. New required semantics need an explicit version and migration, not silent truncation.

## V2 envelope

```text
DV2.<base64url(zlib(compact JSON))>.<CRC32>
```

The checksum is eight lowercase hexadecimal digits over the compressed bytes. It detects accidental corruption independent of the compressor's exact output. It is not a signature. Base64 is URL-safe and omits padding.

The compact JSON has these fields:

```js
{
  v: 2,
  s: [country, ageGroup, theme, welcomeDismissed, settingsExtensions],
  t: [/* shared nonempty vaccine type strings */],
  r: [/* disease record rows */],
  x: {/* optional state extensions */}
}
```

Default settings use `0` (`none`, `adult`, `system`, false). Nondefault enum values are strings, so reordering UI choices cannot change their meaning. Dismissal is `0` or `1`. Trailing defaults are omitted. The default vaccine type has dictionary index `0`; entries in `t` start at index `1`.

Each record row is:

```text
[diseaseWireId, mode, target, reminderDay, vaccinationRows, illnessRows, extensions]
```

`mode` is `0` for automatic or the string `track`, `skip`, or `review`. An automatic target is `null`; the absent reminder is `0`. Empty collections/extensions use `null`. Trailing default fields are omitted, but the disease ID always remains, including ID zero. The disease wire table is explicitly append-only in `src/transfer.js`: never reorder or reuse entries.

Vaccination rows are `[id, day, vaccineTypeIndex, extensions]`.

Illness rows are `[id, startDay, durationOrNull, flags, extensions]`. Flag bit 0 is clinician/lab confirmation; bit 1 is recovered. Missing flags mean neither. No flag implies verified immunity.

Dates are days since 1900-01-01 **plus one**, leaving zero for absent optional dates. Dates are calendar values independent of timezone. A lowercase UUID is packed as `~` plus base64url of its 16 bytes; decoding restores the exact original UUID. Other valid IDs remain unchanged. New app entries use eleven-character IDs from 64 random bits.

## QR framing

A code of at most 900 characters uses a single QR linking to the site with `#transfer=<code>`. Fragments are not sent in HTTP requests, and the app removes them from the address bar before previewing.

Longer codes use chunks of at most 900 characters:

```text
DVQ2.<transferId>.<oneBasedPart>.<totalParts>.<chunk>
```

`transferId` is the first six bytes of SHA-256 of the entire code, written as twelve hex digits. Parts can arrive in any order. Identical repeats are harmless; conflicting duplicates or mixed identifiers/totals are rejected. Reconstructed data still passes envelope and schema validation. Opening Import afresh starts a new collection.

QRs use error correction M and a four-module white margin. The canvas renders at an integer pixel scale to preserve crisp modules; its white background is retained in dark mode. The full text backup is available regardless of the number of QRs.

## Validation and limits

- At most 2,000 combined vaccination and illness entries; IDs must be globally unique.
- At most 120 characters per vaccine type and 1–20 for a custom target.
- Vaccination and illness start dates must be valid and no later than today.
- Optional illness duration is 1–3,650 whole days and cannot extend into the future.
- The 610 KB state limit leaves room to migrate a V1 record at its original 600 KB maximum. State and decompression limits are bounded in `src/model.js`; transfer input is limited to 850,000 characters. JSON extensions have a maximum nesting depth of eight and reject prototype-related keys.
- V1 compressed output is checked against its original canonical encoding before migration. V2 uses CRC32 instead, allowing future implementations to use a different compatible compressor.

The frozen V1 fixture in `tests/fixtures/v1-backup.json` was created by the original encoder. Tests cover it separately from current round trips. Compression comparisons use synthetic six-course records; savings depend on vaccine text, dates, IDs and repeated content, so they are not a guaranteed percentage.

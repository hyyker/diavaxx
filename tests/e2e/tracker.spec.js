import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { encode, decode } from '../../src/transfer.js';
import { emptyState, emptyRecord, STORAGE_KEY, validateState } from '../../src/model.js';

const legacy = JSON.parse(readFileSync(new URL('../fixtures/v1-backup.json', import.meta.url)));
async function saved(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}
async function seed(page, state) {
  await page.goto('/');
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: STORAGE_KEY,
    state,
  });
  await page.reload();
}
async function close(page) {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}
async function openImport(page) {
  await page.getByRole('button', { name: 'Transfer records', exact: true }).click();
  await page.getByRole('button', { name: 'Import a record', exact: true }).click();
}
async function setCountry(page, country, age) {
  await page.getByRole('button', { name: 'Change plan and age group' }).click();
  await page.getByRole('combobox', { name: 'Country plan', exact: true }).selectOption(country);
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption(age);
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
}
async function addDose(page, disease, date) {
  await page.getByRole('button', { name: 'Log vaccination', exact: true }).click();
  await page.getByRole('combobox', { name: 'Vaccination', exact: true }).selectOption(disease);
  await page.getByLabel('Vaccination date', { exact: true }).fill(date);
  await page.getByRole('button', { name: 'Save vaccination', exact: true }).click();
}

test('starter exclusions, age choices, switching and keyboard editing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Finnish starter plan', exact: true }).click();
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption('infant');
  await expect(page.locator('#country-preview')).toContainText('Rotavirus');
  await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect(page.locator('details[data-id="ebola"] .badge')).toHaveText('Not in your plan');
  await expect(page.locator('details[data-id="chikungunya"] .badge')).toHaveText(
    'Not in your plan',
  );
  await expect(page.locator('.welcome')).toHaveCount(0);
  const summary = page.locator('details[data-id="polio"] summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details[data-id="polio"] .disease-body')).toBeVisible();
  await page
    .locator('details[data-id="polio"]')
    .getByRole('button', { name: 'Edit plan', exact: true })
    .click();
  await page.getByLabel('Series dose target').fill('4');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await setCountry(page, 'germany', 'older75');
  await expect(page.locator('details[data-id="covid-19"] .badge')).toHaveText('In progress');
  expect((await saved(page)).records.polio.target).toBe(4);
  await setCountry(page, 'germany', 'older65');
  await expect(page.locator('details[data-id="covid-19"] .badge')).toHaveText('Not in your plan');
  expect(errors).toEqual([]);
});

test('no-plan completion, dose editing and deletion update the overview', async ({ page }) => {
  await page.goto('/');
  await addDose(page, 'measles', '2020-01-01');
  await expect(page.locator('details[data-id="measles"] .badge')).toHaveText('In progress');
  await addDose(page, 'measles', '2021-01-01');
  await expect(page.locator('details[data-id="measles"] .badge')).toHaveText('Series complete');
  const row = page.locator('details[data-id="measles"]');
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Vaccine type / brand').fill('MMR · Ä');
  await page.getByRole('button', { name: 'Save vaccination', exact: true }).click();
  await row.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('button', { name: 'Delete dose', exact: true }).click();
  await page.getByRole('button', { name: 'Delete dose', exact: true }).click();
  await expect(row.locator('.badge')).toHaveText('In progress');
  expect((await saved(page)).records.measles.doses).toHaveLength(1);
});

test('illness dates, duration, confirmation, edit and deletion persist and change status', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('details[data-id="varicella"] summary').click();
  await page
    .locator('details[data-id="varicella"]')
    .getByRole('button', { name: 'Add illness' })
    .click();
  await page.getByLabel('Illness start date').fill('2018-02-01');
  await page.getByLabel('Duration in days').fill('8');
  await page.getByLabel('Confirmed by a clinician or laboratory').check();
  await page.getByLabel('I have recovered from this illness').check();
  await page.getByRole('button', { name: 'Save illness', exact: true }).click();
  const row = page.locator('details[data-id="varicella"]');
  await expect(row.locator('.badge')).toHaveText('Past infection recorded');
  await expect(row).toContainText('8 days');
  await page.reload();
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Confirmed by a clinician or laboratory').uncheck();
  await page.getByRole('button', { name: 'Save illness', exact: true }).click();
  await expect(row.locator('.badge')).toHaveText('Confirm illness history');
  expect((await saved(page)).records.varicella.illnesses[0]).toMatchObject({
    date: '2018-02-01',
    duration: 8,
    confirmed: false,
    recovered: true,
  });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Delete illness', exact: true }).click();
  await page.getByRole('button', { name: 'Delete illness', exact: true }).click();
  await expect(row.locator('.badge')).toHaveText('No entries yet');
});

test('combination vaccine, Unicode search and exact QR import including illness and preferences', async ({
  page,
  browser,
}) => {
  const state = emptyState();
  state.settings = { plan: 'germany', ageGroup: 'preteen', theme: 'dark', welcomeDismissed: true };
  state.records.varicella = {
    ...emptyRecord(),
    illnesses: [
      { id: 'illness', date: '2010-03-01', duration: 6, confirmed: true, recovered: true },
    ],
  };
  await seed(page, state);
  await addDose(page, 'combo:mmr', '2020-04-01');
  await page.getByRole('searchbox').fill('German');
  await expect(page.locator('details.disease')).toHaveCount(1);
  await expect(page.locator('details.disease')).toContainText('Rubella');
  await page.getByRole('button', { name: 'Transfer records', exact: true }).click();
  await expect(page.locator('#qr-canvas')).toBeVisible();
  const code = await page.locator('#export-code').inputValue();
  const original = await saved(page);
  expect(decode(code)).toEqual(original);
  const qr = await page.locator('#qr-canvas').screenshot();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto('/');
  await openImport(other);
  await other
    .getByLabel('Upload QR image')
    .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: qr });
  await expect(other.getByText('Ready to import', { exact: true })).toBeVisible();
  await expect(other.locator('#import-preview')).toContainText('1 illness entries');
  await other.getByRole('button', { name: 'Replace with this record' }).click();
  expect(await saved(other)).toEqual(original);
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await context.close();
});

test('V1 local records and old codes upgrade safely; malformed imports preserve data', async ({
  page,
}) => {
  await seed(page, legacy.state);
  await expect(page.locator('details[data-id="measles"] .badge')).toHaveText('Series complete');
  // Migration is initially read-only; a user change persists the upgraded record.
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  expect((await saved(page)).version).toBe(2);
  await openImport(page);
  await page.getByLabel('Transfer code or link').fill(legacy.code);
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('button', { name: 'Replace with this record' }).click();
  expect(await saved(page)).toEqual(validateState(legacy.state));
  await openImport(page);
  await page.getByLabel('Transfer code or link').fill('invalid');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.locator('#modal-error')).not.toBeEmpty();
  expect(await saved(page)).toEqual(validateState(legacy.state));
  await page.getByLabel('Transfer code or link').fill(encode(emptyState()));
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('button', { name: 'Replace with this record' }).click();
  expect(await saved(page)).toEqual(emptyState());
});

test('welcome dismissal and appearance persist, respond to the device, and fit the viewport', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dismiss starter plans' }).click();
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await page.reload();
  await expect(page.locator('.welcome')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Change plan and age group' }).click();
  await page.getByLabel('Appearance').selectOption('system');
  await page.getByRole('button', { name: 'Use this plan' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Log vaccination', exact: true }).click();
  expect(
    await page.locator('#modal').evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test('unreadable storage remains untouched until explicit replacement', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.storage-warning')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken');
  await openImport(page);
  await page.getByLabel('Load backup file').setInputFiles({
    name: 'record.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(emptyState())),
  });
  await page.getByRole('button', { name: 'Replace with this record' }).click();
  expect(await saved(page)).toEqual(emptyState());
});

test('quota failure keeps the form open and cross-tab changes close stale edits', async ({
  page,
  context,
}) => {
  await seed(page, emptyState());
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Log vaccination', exact: true }).click();
  await page.getByRole('combobox', { name: 'Vaccination', exact: true }).selectOption('measles');
  await page.getByRole('button', { name: 'Save vaccination', exact: true }).click();
  await expect(page.locator('#modal-error')).toContainText('storage is full');
  expect(await saved(page)).toEqual(emptyState());
  await page.reload();
  await page.getByRole('button', { name: 'Log vaccination', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  expect((await saved(page)).settings.theme).toEqual((await saved(other)).settings.theme);
  await other.close();
});

test('a slow file read cannot replace a newer import preview', async ({ page }) => {
  await page.goto('/');
  await openImport(page);
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      return new Promise((resolve) => {
        window.finishFileRead = async () => resolve(await read.call(this));
      });
    };
  });
  await page
    .getByLabel('Load backup file')
    .setInputFiles({ name: 'slow.txt', mimeType: 'text/plain', buffer: Buffer.from(legacy.code) });
  await expect.poll(() => page.evaluate(() => typeof window.finishFileRead)).toBe('function');
  await page.getByLabel('Transfer code or link').fill(encode(emptyState()));
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.evaluate(() => window.finishFileRead());
  await expect(page.locator('#import-preview')).toContainText('0 vaccination entries');
  await page.getByRole('button', { name: 'Replace with this record' }).click();
  expect(await saved(page)).toEqual(emptyState());
});

test('closing the dialog cancels a pending camera request when it resolves', async ({ page }) => {
  await page.goto('/');
  await openImport(page);
  await page.evaluate(() => {
    window.stoppedTracks = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          new Promise((resolve) => {
            window.resolveCamera = () =>
              resolve({
                getTracks: () => [
                  {
                    stop() {
                      window.stoppedTracks++;
                    },
                  },
                ],
              });
          }),
      },
    });
  });
  await page.getByRole('button', { name: 'Scan QR', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof window.resolveCamera)).toBe('function');
  await close(page);
  await page.evaluate(() => window.resolveCamera());
  await expect.poll(() => page.evaluate(() => window.stoppedTracks)).toBe(1);
  await expect(page.locator('#modal')).not.toBeVisible();
});

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { cspViolations, watchViolations, installNetwork } from './helpers';

test('actual PNG symbols recover the exact receipt offline under the strict CSP', async ({ page, context }) => {
  test.setTimeout(120_000);
  const errors = await watchViolations(page);
  const original = Buffer.from(archivalReceiptFixture());
  await page.goto('/Unaltered/#verify');
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({ name: 'archive.ots', mimeType: 'application/octet-stream', buffer: original });
  await page.locator('.archival-import summary').click();
  await expect(page.locator('.archival-import input[value="auto"]')).toBeChecked();
  await page.locator('.archival-import input[value="H"]').check();
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  await expect(page.locator('.archival-preview')).toBeVisible();
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('not independently verified');
  await expect(page.locator('.unaltered-archival-sheet')).toContainText('Offline recovery specification');
  const buttons = page.locator('.archival-toolbar button').filter({ hasText: /Save QR .*PNG/ });
  expect(await buttons.count()).toBeGreaterThan(1);
  const images: { name: string; mimeType: string; buffer: Buffer }[] = [];
  for (let i = 0; i < await buttons.count(); i++) {
    const [download] = await Promise.all([page.waitForEvent('download'), buttons.nth(i).click()]);
    images.push({ name: download.suggestedFilename(), mimeType: 'image/png', buffer: readFileSync((await download.path())!) });
  }
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('nav')).not.toBeVisible();
  await expect(page.locator('.unaltered-archival-symbol canvas').first()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Close certificate preview' }).click();
  await context.setOffline(true);
  await page.getByLabel('Choose QR images or binary frame files').setInputFiles(images.reverse());
  await page.getByRole('button', { name: 'Recover receipt from QR images' }).click();
  const link = page.getByRole('link', { name: 'Download recovered .ots receipt' });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const [recovered] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(readFileSync((await recovered.path())!)).toEqual(original);
  // A second import must invalidate the previous download and report an incomplete proof.
  await page.getByLabel('Choose QR images or binary frame files').setInputFiles([images[0]!]);
  await expect(link).toHaveCount(0);
  await page.getByRole('button', { name: 'Recover receipt from QR images' }).click();
  await expect(page.locator('.archival-recovery')).toContainText('Recovery failed.', { timeout: 60_000 });
  await expect(link).toHaveCount(0);
  expect(await cspViolations(page)).toEqual([]);
  expect(errors.list).toEqual([]);
});

test('Stamp offers the certificate after a receipt and handles a second selection without reload', async ({ page, context }) => {
  await installNetwork(context);
  await page.goto('/index.html#stamp');
  const file = { name: 'repeat.txt', mimeType: 'text/plain', buffer: Buffer.from('repeat qualification') };
  await page.locator('#stamp-file').setInputFiles(file);
  await page.getByLabel(/I understand and want to continue/).check();
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preview QR certificate', exact: true })).toBeVisible();
  await page.locator('#stamp-file').setInputFiles(file);
  await expect(page.locator('.item')).toHaveCount(2);
  await expect(page.locator('.item').nth(1).locator('.digest')).toBeVisible();
});

test('a language switch re-renders exactly one translated set of QR archive tools', async ({ page }) => {
  await page.goto('/index.html#settings');
  await page.getByRole('radio', { name: 'Español', exact: true }).check();
  await page.getByRole('radio', { name: 'English', exact: true }).check();
  await page.getByRole('radio', { name: 'Español', exact: true }).check();
  await page.goto('/index.html#verify');
  await expect(page.locator('.archival-import')).toHaveCount(1);
  await expect(page.locator('.archival-recovery')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Cancelar escaneo QR', exact: true })).toBeDisabled();
});

// Regression: WebKit sizes a plain file input at ~34 average characters plus its button, so the certificate
// input overflowed a 320 CSS px viewport (document 363 px). Force that intrinsic width in any engine.
test('QR archive file inputs stay inside a 320 CSS px column at WebKit intrinsic width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/index.html#verify');
  await page.locator('.archival-import input[type=file], .archival-recovery input[type=file]')
    .evaluateAll(inputs => { for (const input of inputs) (input as HTMLElement).style.setProperty('width', '347px'); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

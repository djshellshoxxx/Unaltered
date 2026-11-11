import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installNetwork } from './helpers';

test('unreadable pending upgrade offers keyboard-accessible reference guidance without claiming verification', async ({ page, context }) => {
  const chain = await installNetwork(context);
  await page.goto('/index.html#verify');
  await page.setInputFiles('#upgrade-receipt', { name: 'receipt-$(untrusted).ots', mimeType: 'application/octet-stream',
    buffer: readFileSync('tests/fixtures/ots/pending.ots') });
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  const fallback = page.locator('.reference-upgrade');
  await expect(fallback.locator('summary')).toBeVisible();
  await fallback.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(fallback.locator('pre')).toBeVisible();
  await expect(fallback.locator('pre')).toHaveText('ots upgrade receipt.ots');
  await expect(fallback).toContainText('network access');
  await expect(fallback).toContainText('backup');
  await expect(fallback).toContainText('own Bitcoin node (L2)');
  await expect(page.locator('.result-VERIFIED')).toHaveCount(0);
  await expect(page.locator('.upgrade-result a[download]')).toHaveCount(0);
  const lookups = chain.timestampGets.length;
  expect(lookups).toBeGreaterThan(0);
  await page.locator('#nav-settings').click();
  await page.getByRole('radio', { name: 'Español', exact: true }).check();
  await page.locator('#nav-verify').click();
  await expect(fallback.locator('summary')).toHaveText('Actualizar con el cliente de referencia');
  await fallback.locator('summary').click();
  await expect(fallback.locator('pre')).toHaveText('ots upgrade receipt.ots');
  expect(chain.timestampGets).toHaveLength(lookups);
  await expect(page.locator('.result-VERIFIED')).toHaveCount(0);
});

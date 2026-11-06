import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('keyboard cancellation restores upgrade action focus and discards a late calendar reply', async ({ page, context }) => {
  const receipt = readFileSync('tests/fixtures/ots/pending.ots');
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requests: string[] = [];
  let settled = 0;
  await context.route('**/timestamp/**', async (route) => {
    requests.push(new URL(route.request().url()).hostname);
    await held;
    await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'Pending' }).catch(() => {});
    settled++;
  });
  try {
    await page.goto('/index.html#verify');
    await page.setInputFiles('#upgrade-receipt', { name: 'pending.ots', mimeType: 'application/octet-stream', buffer: receipt });
    await page.locator('#upgrade-run').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#upgrade-cancel')).toBeFocused();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect(page.locator('#upgrade-run')).toBeDisabled();
    await page.keyboard.press('Enter');
    await expect(page.locator('#upgrade-run')).toBeFocused();
    await expect(page.locator('#upgrade-run')).toBeEnabled();
    await expect(page.locator('#upgrade-cancel')).toHaveCount(0);
    release();
    await expect.poll(() => settled).toBe(requests.length);
    await expect(page.locator('.upgrade-result')).toBeEmpty();
    await expect(page.locator('.upgrade-result a[download]')).toHaveCount(0);
  } finally {
    release();
  }
});

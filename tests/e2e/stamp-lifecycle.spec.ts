import { expect, test } from '@playwright/test';

// A hash worker that never answers keeps the item busy, so the item's own Cancel can be exercised deterministically.
test('cancelling a file while it is being fingerprinted settles the item instead of leaving it working', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await page.evaluate(() => {
    const record = { terminated: 0 };
    (window as unknown as { __workers: typeof record }).__workers = record;
    window.Worker = class {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      postMessage(): void {}
      terminate(): void {
        record.terminated++;
      }
    } as unknown as typeof Worker;
  });
  await page.setInputFiles('#stamp-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('held fingerprint') });
  const item = page.locator('.item');
  await expect(item.locator('progress')).toBeVisible();
  await item.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(item.locator('[role=alert]')).toHaveText('Cancelled. Remove this file, or add it again to start over.');
  await expect(item.locator('progress')).toHaveCount(0);
  await expect(item.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await expect(page.locator('.stamp .actions, #stamp .actions').getByText('Remove files marked with a problem to continue.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __workers: { terminated: number } }).__workers.terminated)).toBe(1);

  await item.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.item')).toHaveCount(0);
});

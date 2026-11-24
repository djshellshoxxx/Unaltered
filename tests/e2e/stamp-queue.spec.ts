import { expect, test } from '@playwright/test';

test('Stamp limits active workers, skips a cancelled queued file, and releases workers on removal', async ({ page }) => {
  await page.goto('/index.html#stamp');
  await page.evaluate(() => {
    const record = { active: 0, peak: 0, started: [] as string[], terminated: 0 };
    (window as unknown as { __stampWorkers: typeof record }).__stampWorkers = record;
    window.Worker = class {
      onmessage: ((event: { data: { type: string } }) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      private stopped = false;
      constructor() {
        record.active++;
        record.peak = Math.max(record.peak, record.active);
      }
      postMessage(message: { blob: File }): void {
        record.started.push(message.blob.name);
        this.onmessage?.({ data: { type: 'ready' } });
      }
      terminate(): void {
        if (this.stopped) return;
        this.stopped = true;
        record.active--;
        record.terminated++;
      }
    } as unknown as typeof Worker;
  });
  const state = () => page.evaluate(() => (window as unknown as { __stampWorkers: {
    active: number; peak: number; started: string[]; terminated: number;
  } }).__stampWorkers);
  await page.setInputFiles('#stamp-file', Array.from({ length: 4 }, (_, i) => ({
    name: `queued-${i}.txt`, mimeType: 'text/plain', buffer: Buffer.from('held fingerprint'),
  })));
  await expect(page.locator('.item')).toHaveCount(4);
  await expect.poll(async () => (await state()).started).toEqual(['queued-0.txt', 'queued-1.txt']);
  const waiting = page.locator('.item').nth(2);
  await expect(waiting).toContainText('Waiting to process your file');
  await waiting.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(waiting.getByRole('alert')).toContainText('Cancelled.');
  await page.locator('.item').first().getByRole('button', { name: 'Remove', exact: true }).click();
  await expect.poll(async () => (await state()).started).toEqual(['queued-0.txt', 'queued-1.txt', 'queued-3.txt']);
  for (let count = 3; count > 0; count--) {
    await page.locator('.item').first().getByRole('button', { name: 'Remove', exact: true }).click();
  }
  await expect(page.locator('.item')).toHaveCount(0);
  expect(await state()).toEqual({
    active: 0, peak: 2, started: ['queued-0.txt', 'queued-1.txt', 'queued-3.txt'], terminated: 3,
  });
});

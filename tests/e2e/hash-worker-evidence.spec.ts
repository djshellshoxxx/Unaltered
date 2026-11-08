import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { installHashWorkerEvidence, requireHashWorkerCompletion } from './hash-worker-evidence';

const bytes = Buffer.from('Unaltered synthetic worker acceptance fixture.');
const expected = { bytes: bytes.length, hex: createHash('sha256').update(bytes).digest('hex') };

async function hashFixture(page: Page): Promise<void> {
  await page.goto('/index.html#stamp');
  await Promise.all([
    page.waitForEvent('worker'),
    page.setInputFiles('#stamp-file', { name: 'worker-evidence.txt', mimeType: 'text/plain', buffer: bytes }),
  ]);
  await expect(page.locator('.item .digest')).toBeVisible();
  expect((await page.locator('.item .digest').textContent())?.replace(/ /g, '')).toBe(expected.hex);
  expect(await page.locator('.item .error').allTextContents()).toEqual([]);
}

/** The app starts its hash worker from a blob: URL of the source inlined in main.js; start it from `body` instead. */
async function replaceWorkerSource(page: Page, body: string): Promise<void> {
  await page.addInitScript((source) => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource): string =>
      create(obj instanceof Blob && obj.type === 'text/javascript' ? new Blob([source], { type: 'text/javascript' }) : obj);
  }, body);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installHashWorkerEvidence);
});

test('accepts a real hash worker completion with matching input, byte count and digest', async ({ page }) => {
  await hashFixture(page);
  await requireHashWorkerCompletion(page, expected);
});

test('rejects worker creation followed by fallback even when the UI digest is correct', async ({ page }) => {
  await replaceWorkerSource(page, "self.onmessage = () => self.postMessage({ type: 'error' });");
  await hashFixture(page);
  await expect(requireHashWorkerCompletion(page, expected)).rejects.toThrow('Expected one successful hash worker completion');
});

test('rejects a worker completion with the correct digest but a wrong byte count', async ({ page }) => {
  await replaceWorkerSource(page, `self.onmessage = ({ data }) => self.postMessage({ type: 'done',
    digest: new Uint8Array(${JSON.stringify(Array.from(Buffer.from(expected.hex, 'hex')))}),
    bytes: data.blob.size - 1, cross: 'skipped' });`);
  await hashFixture(page);
  await expect(requireHashWorkerCompletion(page, expected)).rejects.toThrow('Expected one successful hash worker completion');
});

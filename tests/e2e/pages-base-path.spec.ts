import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { groupHex } from '../../src/core/bytes';
import { installHashWorkerEvidence, requireHashWorkerCompletion } from './hash-worker-evidence';

test('downloaded offline app matches the offered checksum and reopens without a connection', async ({ page, context }, testInfo) => {
  await page.goto('/Unaltered/');
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download the offline app' }).click();
  const download = await pending;
  const saved = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(saved);
  const digest = createHash('sha256').update(await readFile(saved)).digest('hex');
  const sumsHref = await page.getByRole('link', { name: 'Download SHA-256 checksums' }).getAttribute('href');
  const sums = await page.request.get(new URL(sumsHref!, page.url()).href);
  expect(sums.ok()).toBe(true);
  expect(await sums.text()).toBe(`${digest}  ${download.suggestedFilename()}\n`);

  await context.setOffline(true);
  await page.goto(pathToFileURL(saved).href);
  const bytes = Buffer.from('offline copy from Pages');
  await page.setInputFiles('#stamp-file', { name: 'offline.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(page.locator('.item .digest')).toHaveText(groupHex(createHash('sha256').update(bytes).digest('hex')));
  await expect(page.getByRole('link', { name: 'Download the offline app' })).toHaveCount(0);
});

test('Pages project path loads assets and hashes offline with a real worker', async ({ page, context }) => {
  const bytes = Buffer.from('Synthetic GitHub Pages base-path acceptance fixture.');
  const expected = { bytes: bytes.length, hex: createHash('sha256').update(bytes).digest('hex') };
  const requested: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    // Blob worker URLs retain the page origin but are not HTTP asset paths under the project prefix.
    if (url.protocol === 'http:' && url.origin === 'http://127.0.0.1:4173') requested.push(url.pathname);
  });
  await page.addInitScript(installHashWorkerEvidence);
  const response = await page.goto('/Unaltered/');
  expect(response?.headers()['content-type']).toContain('text/html');
  await expect(page.locator('#stamp-file')).toBeVisible();
  await expect(page.locator('script[src]')).toHaveAttribute('src', './main.js');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', './styles.css');
  expect(requested).toContain('/Unaltered/main.js');
  expect(requested).toContain('/Unaltered/styles.css');
  expect(requested.every((path) => path.startsWith('/Unaltered/'))).toBe(true);
  await context.setOffline(true);
  await page.setInputFiles('#stamp-file', { name: 'pages.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(page.locator('.item .digest')).toBeVisible();
  expect((await page.locator('.item .digest').textContent())?.replace(/ /g, '')).toBe(expected.hex);
  await requireHashWorkerCompletion(page, expected);
  await page.locator('#nav-verify').click();
  await expect(page).toHaveURL(/\/Unaltered\/#verify$/);
  await expect(page.locator('#verify-file')).toBeVisible();
  await page.locator('#nav-stamp').click();
  await expect(page).toHaveURL(/\/Unaltered\/#stamp$/);
  await expect(page.locator('.item .digest')).toBeVisible();
  expect(requested.every((path) => path.startsWith('/Unaltered/'))).toBe(true);
});

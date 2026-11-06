import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { installHashWorkerEvidence, requireHashWorkerCompletion } from './hash-worker-evidence';

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

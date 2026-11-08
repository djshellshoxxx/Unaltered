import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { groupHex } from '../../src/core/bytes';
import { chunk } from '../helpers/images';
import { cspViolations, watchViolations } from './helpers';

function image(depth: number, color: number, samples: number[], pixels: number[]): Buffer {
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, depth, color, 0, 0, 0])),
    chunk('tRNS', Uint8Array.from(samples)),
    chunk('IDAT', deflateSync(Buffer.from([0, ...pixels]))),
    chunk('IEND'),
  ]);
}

function dataOf(bytes: Buffer, type: string): Buffer {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === type) return bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
  }
  throw new Error(`Missing test chunk ${type}`);
}

test('emitted application clears ignored PNG transparency bytes and fingerprints its actual download', async ({ page }) => {
  const violations = await watchViolations(page);
  const original = image(8, 2, [83, 11, 69, 22, 67, 33], [11, 22, 33]);
  await page.goto('/Unaltered/index.html#stamp');
  await page.setInputFiles('#stamp-file', { name: 'pixels.png', mimeType: 'image/png', buffer: original });
  const link = page.getByRole('link', { name: /Download cleaned copy/ });
  await expect(link).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create receipt', exact: true })).toBeDisabled();
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const cleaned = readFileSync((await download.path())!);
  expect(dataOf(cleaned, 'tRNS')).toEqual(Buffer.from([0, 11, 0, 22, 0, 33]));
  expect(dataOf(cleaned, 'IDAT')).toEqual(dataOf(original, 'IDAT'));
  await expect(page.locator('.digest')).toHaveText(groupHex(createHash('sha256').update(cleaned).digest('hex')));
  await expect(page.getByRole('button', { name: 'Create receipt', exact: true })).toBeEnabled();
  const pixels = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, cleaned.toString('base64'));
  expect(pixels).toEqual([0, 0, 0, 0]);
  expect(violations.list).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

for (const depth of [1, 2, 4]) {
  test(`emitted application refuses ambiguous grayscale${depth} cleanup without implying the user disabled it`, async ({ page }) => {
    const original = image(depth, 0, [255, 255], [(2 ** depth - 1) << (8 - depth)]);
    await page.goto('/Unaltered/index.html#stamp');
    await page.setInputFiles('#stamp-file', { name: 'ambiguous.png', mimeType: 'image/png', buffer: original });
    await expect(page.locator('.digest')).toHaveText(groupHex(createHash('sha256').update(original).digest('hex')));
    await expect(page.getByLabel(/Remove hidden data/)).toBeChecked();
    await expect(page.locator('.item .notice.warn')).toContainText('We could not safely clean this file.');
    await expect(page.locator('.item .notice.warn')).not.toContainText('You turned off cleaning');
    await expect(page.getByRole('link', { name: /Download cleaned copy/ })).toHaveCount(0);
    const create = page.getByRole('button', { name: 'Create receipt', exact: true });
    await expect(create).toBeDisabled();
    await page.getByLabel(/I understand and want to continue/).check();
    await expect(create).toBeEnabled();
  });
}

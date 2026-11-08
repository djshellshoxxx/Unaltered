import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { decodeRasterFrames } from '../../src/core/archive/qr-decode';
import { recoverReceiptFrames } from '../../src/core/archive/frames';
import { cspViolations, watchViolations } from '../e2e/helpers';

function ppm(bytes: Buffer): { data: Uint8ClampedArray; width: number; height: number } {
  let offset = 0;
  const token = (): string => {
    while (bytes[offset] === 32 || bytes[offset] === 10 || bytes[offset] === 13 || bytes[offset] === 9) offset++;
    if (bytes[offset] === 35) { while (offset < bytes.length && bytes[offset] !== 10) offset++; return token(); }
    const begin = offset;
    while (offset < bytes.length && ![9, 10, 13, 32].includes(bytes[offset]!)) offset++;
    return bytes.toString('ascii', begin, offset);
  };
  if (token() !== 'P6') throw new Error('Expected binary RGB PPM');
  const width = Number(token()); const height = Number(token());
  if (token() !== '255') throw new Error('Expected 8-bit pixels');
  if (bytes[offset] === 13 && bytes[offset + 1] === 10) offset += 2; else offset++;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width * height > 16_000_000 ||
      bytes.length - offset !== width * height * 3) throw new Error('Invalid PPM raster');
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let pixel = 0; pixel < width * height; pixel++) data.set(bytes.subarray(offset + pixel * 3, offset + pixel * 3 + 3), pixel * 4);
  return { data, width, height };
}

for (const paper of ['a4', 'letter'] as const) {
  test(`browser PDF ${paper} is readable as scanned pages and reconstructs exact OTS bytes`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const errors = await watchViolations(page);
    const directory = resolve('test-results/qr-qualification', paper); mkdirSync(directory, { recursive: true });
    const original = Buffer.from(archivalReceiptFixture(3000));
    writeFileSync(resolve(directory, 'original.ots'), original);
    await page.goto('/Unaltered/#verify');
    await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({ name: 'qualification.ots', mimeType: 'application/octet-stream', buffer: original });
    await page.locator('.archival-import summary').click();
    await page.locator('.archival-import input[value="H"]').check();
    await page.locator(`.archival-import input[value="${paper}"]`).check();
    await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
    await expect(page.locator('.archival-preview')).toBeVisible();
    const expectedPages = await page.locator('.archival-page').count();
    expect(expectedPages).toBeGreaterThan(2);
    const pdf = resolve(directory, 'certificate.pdf');
    await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
    expect(Number(/^Pages:\s+(\d+)/m.exec(info)?.[1])).toBe(expectedPages);
    execFileSync('pdftoppm', ['-r', '150', pdf, resolve(directory, 'page')]);
    const frames: Uint8Array[] = [];
    for (const file of readdirSync(directory).filter(name => name.endsWith('.ppm')).sort()) {
      const image = ppm(readFileSync(resolve(directory, file)));
      frames.push(...decodeRasterFrames(image.data, image.width, image.height));
    }
    expect(await recoverReceiptFrames(frames.reverse())).toEqual(new Uint8Array(original));
    // Feed actual PDF-rasterized PNG pages, not retained matrix/frame data, back through the app worker.
    execFileSync('pdftoppm', ['-r', '150', '-png', pdf, resolve(directory, 'scan')]);
    const scans = readdirSync(directory).filter(name => name.endsWith('.png')).sort().reverse().map(name => resolve(directory, name));
    await page.getByRole('button', { name: 'Close certificate preview' }).click();
    await context.setOffline(true);
    await page.getByLabel('Choose QR images or binary frame files').setInputFiles(scans);
    await page.getByRole('button', { name: 'Recover receipt from QR images' }).click();
    const recovered = page.getByRole('link', { name: 'Download recovered .ots receipt' });
    await expect(recovered).toBeVisible({ timeout: 120_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), recovered.click()]);
    expect(readFileSync((await download.path())!)).toEqual(original);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors.list).toEqual([]);
  });
}

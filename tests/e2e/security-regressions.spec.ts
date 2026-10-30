import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { serializeProof } from '../../src/core/ots/codec';
import { cleanWav } from '../../src/core/strip/audio';
import { installNetwork } from './helpers';

async function trackUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const live = new Map<string, number>();
    (window as unknown as { __liveDownloads: Map<string, number> }).__liveDownloads = live;
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); live.set(url, blob instanceof Blob ? blob.size : 0); return url; };
    URL.revokeObjectURL = (url) => { live.delete(url); revoke(url); };
  });
}
const liveCount = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __liveDownloads: Map<string, number> }).__liveDownloads.size);

test('an unverified Bitcoin attestation is never displayed as verified confirmation', async ({ page, context }) => {
  let requests = 0;
  await context.route('https://**', (route) => { requests++; return route.abort(); });
  const digest = new Uint8Array(32);
  const receipt = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'bitcoin', height: 1 }] } });
  await page.goto('/index.html#verify');
  await page.setInputFiles('#upgrade-receipt', { name: 'unverified.ots', mimeType: 'application/octet-stream', buffer: Buffer.from(receipt) });
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await expect(page.locator('.upgrade-result')).toContainText('Bitcoin timestamp data');
  await expect(page.locator('.upgrade-result')).toContainText('Use Verify with the original file');
  await expect(page.locator('.upgrade-result')).not.toContainText('confirmed in Bitcoin');
  await expect(page.locator('.upgrade-result .notice.ok, .result-VERIFIED')).toHaveCount(0);
  expect(requests).toBe(0);
});

test('cleaned downloads survive relabeling and release all URLs when files are removed', async ({ page }) => {
  await trackUrls(page);
  await page.goto('/index.html#stamp');
  const samples = Buffer.alloc(256 * 1024, 0x5a);
  const format = Buffer.alloc(24);
  format.write('fmt '); format.writeUInt32LE(16, 4); format.writeUInt16LE(1, 8); format.writeUInt16LE(1, 10);
  format.writeUInt32LE(8000, 12); format.writeUInt32LE(8000, 16); format.writeUInt16LE(1, 20); format.writeUInt16LE(8, 22);
  const metadataBody = Buffer.from('INFOIARTSYNTHETIC-SECRET');
  const metadata = Buffer.alloc(8 + metadataBody.length + (metadataBody.length & 1));
  metadata.write('LIST'); metadata.writeUInt32LE(metadataBody.length, 4); metadataBody.copy(metadata, 8);
  const data = Buffer.alloc(8 + samples.length);
  data.write('data'); data.writeUInt32LE(samples.length, 4); samples.copy(data, 8);
  const wavBody = Buffer.concat([Buffer.from('WAVE'), format, metadata, data]);
  const wav = Buffer.alloc(8 + wavBody.length);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wavBody.copy(wav, 8);
  const cleaned = cleanWav(new Uint8Array(wav));
  expect(cleaned.kind).toBe('cleaned');
  if (cleaned.kind !== 'cleaned') throw new Error('Expected synthetic WAV to clean.');
  const cleanedBytes = Buffer.from(cleaned.output);
  expect(wav.includes(Buffer.from('SYNTHETIC-SECRET'))).toBe(true);
  expect(cleanedBytes.includes(Buffer.from('SYNTHETIC-SECRET'))).toBe(false);
  expect(cleanedBytes).not.toEqual(wav);
  for (let i = 0; i < 3; i++) {
    await page.setInputFiles('#stamp-file', { name: 'synthetic.wav', mimeType: 'audio/wav', buffer: wav });
    const item = page.locator('.item');
    await expect(item.locator('.digest')).toBeVisible();
    const link = item.locator('a[download$=".wav"]');
    const href = await link.getAttribute('href');
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(readFileSync((await download.path())!)).toEqual(cleanedBytes);
    await expect(link).toHaveAttribute('href', href!);
    expect(await liveCount(page)).toBe(1);
    if (i === 0) {
      await page.locator('#nav-settings').click();
      await page.getByRole('radio', { name: 'Español', exact: true }).check();
      await page.locator('#nav-stamp').click();
      await expect(link).toHaveAttribute('href', href!);
      expect(await liveCount(page)).toBe(1);
      const [relabeledDownload] = await Promise.all([page.waitForEvent('download'), link.click()]);
      expect(readFileSync((await relabeledDownload.path())!)).toEqual(cleanedBytes);
      await expect(link).toHaveAttribute('href', href!);
      expect(await liveCount(page)).toBe(1);
    }
    await item.locator('.item-head button').click();
    await expect(item).toHaveCount(0);
    expect(await liveCount(page)).toBe(0);
  }
});

test('replacing an upgrade receipt revokes the previous download', async ({ page, context }) => {
  await installNetwork(context, { confirm: true });
  await trackUrls(page);
  await page.goto('/index.html#verify');
  const digest = new Uint8Array(32);
  const pending = serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } });
  await page.setInputFiles('#upgrade-receipt', { name: 'pending.ots', mimeType: 'application/octet-stream', buffer: Buffer.from(pending) });
  await page.getByRole('button', { name: 'Check for confirmation', exact: true }).click();
  await expect(page.locator('.upgrade-result a[download]')).toBeVisible();
  expect(await liveCount(page)).toBe(1);
  await page.setInputFiles('#upgrade-receipt', { name: 'different.ots', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
  await expect(page.locator('.upgrade-result')).toBeEmpty();
  expect(await liveCount(page)).toBe(0);
});

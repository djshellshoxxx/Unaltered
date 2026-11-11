import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { encodeArchivalQr } from '../../src/core/archive/qr-encode';
import { QR_SCAN_TIMEOUT_MS } from '../../src/core/archive/qr-scan';
import '../../src/core/archive/qr-scan.worker';
import { printCertificate } from './qr-cert';
import { fade, readPpm, rotateRaster, synthPage } from './qr-synth';

/**
 * Regressions found by the distortion corpus (docs/evidence/qr-robustness-20261111.json): zxing-cpp recovered every
 * symbol while the in-app scan worker missed some. Each case drives the real worker message handler with pixels,
 * exactly as qr-scan.ts posts them. No Python is needed; the rotated case uses Chromium's PDF and pdftoppm (both
 * already required by the PDF qualification).
 */
type Raster = { data: Uint8ClampedArray; width: number; height: number };
const scope = globalThis as unknown as { onmessage: (event: { data: unknown }) => void; postMessage: (value: unknown) => void };
function workerScan(image: Raster): { indices: number[]; ms: number } {
  let reply: { ok: boolean; frames?: Uint8Array[] } | undefined;
  const previous = scope.postMessage;
  scope.postMessage = value => { reply = value as typeof reply; };
  const started = Date.now();
  try { scope.onmessage({ data: { data: image.data.slice(), width: image.width, height: image.height } }); } finally { scope.postMessage = previous; }
  const ms = Date.now() - started;
  expect(reply?.ok).toBe(true);
  return { indices: reply!.frames!.map(f => new DataView(f.buffer, f.byteOffset, f.byteLength).getUint32(28)).sort((a, b) => a - b), ms };
}

test('low-contrast (faded ink) symbols are recovered by the scan worker', async () => {
  test.setTimeout(240_000);
  const { symbols } = await encodeArchivalQr(archivalReceiptFixture(3000));
  const page = symbols.slice(2, 6);
  const expected = page.map(s => s.index);
  for (const [ink, paper] of [[192, 255], [160, 210]] as const) {
    const scan = workerScan(synthPage(page, { dpi: 150, ink, paper }));
    expect({ ink, paper, indices: scan.indices }).toEqual({ ink, paper, indices: expected });
    expect(scan.ms).toBeLessThan(QR_SCAN_TIMEOUT_MS);
  }
});

test('skewed scans of a real Chromium-printed page are recovered by the scan worker', async ({ page }) => {
  test.setTimeout(300_000);
  const directory = resolve('test-results/qr-scan-robust'); mkdirSync(directory, { recursive: true });
  const pdf = resolve(directory, 'certificate.pdf');
  const printed = await printCertificate(page, archivalReceiptFixture(3000), 'auto', 'a4', pdf);
  execFileSync('pdftoppm', ['-r', '150', '-f', '2', '-l', '2', pdf, resolve(directory, 'page')]);
  const raster = readPpm(readFileSync(resolve(directory, readdirSync(directory).find(name => name.endsWith('.ppm'))!)));
  const expected = printed.labels.filter(label => label.index >= 2 && label.index < 6).map(label => label.index);
  expect(expected.length).toBeGreaterThanOrEqual(2);
  expect(workerScan(raster).indices).toEqual(expected);
  for (const degrees of [-6, -5, -4, 6]) {
    const scan = workerScan(rotateRaster(raster, degrees));
    expect({ degrees, indices: scan.indices }).toEqual({ degrees, indices: expected });
    expect(scan.ms).toBeLessThan(QR_SCAN_TIMEOUT_MS);
  }
  expect(workerScan(fade(raster, 160, 210)).indices).toEqual(expected);
});

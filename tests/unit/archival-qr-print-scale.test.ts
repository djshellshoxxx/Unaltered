import { describe, expect, it } from 'vitest';
import { decodeRasterFrames } from '../../src/core/archive/qr-decode';
import { encodeArchivalQr, type ArchivalQrSymbol } from '../../src/core/archive/qr-encode';
import { planArchivalQr } from '../../src/core/archive/qr-plan';
import { recoverReceiptFrames } from '../../src/core/archive/frames';
import { archivalReceiptFixture } from '../helpers/archival-receipt';

/** Renders a 72 mm symbol as a scanner would at `dpi`: non-integer pixels per module, 3x3 supersampled edges. */
function scan(symbol: ArchivalQrSymbol, dpi: number): { data: Uint8ClampedArray; width: number; height: number } {
  const px = 72 / 25.4 * dpi / (symbol.modules + 8);
  const margin = 24;
  const width = Math.round((symbol.modules + 8) * px) + 2 * margin;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    let light = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const mx = Math.floor((x - margin + (sx + .5) / 3) / px) - 4;
      const my = Math.floor((y - margin + (sy + .5) / 3) / px) - 4;
      const dark = mx >= 0 && my >= 0 && mx < symbol.modules && my < symbol.modules && symbol.matrix[my * symbol.modules + mx] === 1;
      if (!dark) light++;
    }
    const at = (y * width + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = Math.round(light * 255 / 9);
  }
  return { data, width, height: width };
}

describe('printed archival QR survives real print/scan scales', () => {
  // Regression: the planner chose V38 (0.41 mm modules); jsQR then misjudged the grid at non-integer
  // scales and a Chromium A4/Letter PDF rasterized at 150 DPI recovered no receipt.
  it('caps automatic plans at modules large enough for scanned recovery', () => {
    for (const bytes of [200, 3000, 12000]) for (const preference of ['auto', 'L', 'H'] as const) {
      const plan = planArchivalQr(bytes, { preference });
      expect(plan.moduleSizeMm).toBeGreaterThanOrEqual(0.62);
    }
  });
  it.each([141, 150, 163, 187, 203, 229, 300])('recovers exact receipt bytes from a %i DPI scan', async dpi => {
    const receipt = archivalReceiptFixture(3000);
    const { symbols, plan } = await encodeArchivalQr(receipt, { preference: 'H' });
    expect(plan.version).toBeGreaterThanOrEqual(20); // exercise the largest permitted symbols
    const frames = symbols.flatMap(symbol => { const image = scan(symbol, dpi); return decodeRasterFrames(image.data, image.width, image.height); });
    expect(frames).toHaveLength(symbols.length);
    expect(await recoverReceiptFrames(frames)).toEqual(receipt);
  }, 60_000);
  // Regression: fixed half/quadrant/third windows cut through symbols placed below a page header.
  it('finds four off-centre symbols on one A4-sized 150 DPI page', async () => {
    const { symbols } = await encodeArchivalQr(archivalReceiptFixture(3000), { preference: 'H' });
    expect(symbols.length).toBeGreaterThanOrEqual(4);
    const width = 1240; const height = 1754;
    const page = new Uint8ClampedArray(width * height * 4).fill(255);
    const tiles = symbols.slice(0, 4).map(symbol => scan(symbol, 150));
    // Offsets measured from a Chromium A4 PDF continuation page rasterized at 150 DPI, with label-like text below.
    tiles.forEach((tile, n) => {
      const ox = 60 + (n % 2) * 573; const oy = 180 + Math.floor(n / 2) * 620;
      for (let line = 0; line < 3; line++) for (let x = ox; x < ox + 500; x += 9)
        for (let dy = 0; dy < 10; dy++) for (let dx = 0; dx < 5; dx++) page.fill(0, (((oy + tile.height + 12 + line * 22 + dy) * width) + x + dx) * 4, (((oy + tile.height + 12 + line * 22 + dy) * width) + x + dx) * 4 + 3);
      for (let row = 0; row < tile.height; row++)
        page.set(tile.data.subarray(row * tile.width * 4, (row + 1) * tile.width * 4), ((oy + row) * width + ox) * 4);
    });
    expect(decodeRasterFrames(page, width, height)).toEqual(symbols.slice(0, 4).map(symbol => symbol.frame));
  }, 60_000);
});

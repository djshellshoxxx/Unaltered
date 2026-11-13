import type { ArchivalQrSymbol } from '../../src/core/archive/qr-encode';

/** Synthetic "photographed page": 72 mm symbols (4-module quiet zone included, as printed) placed on a page at
 * `dpi`, rotated by `degrees` about the page centre, 3x3 supersampled, with ink/paper grey levels.
 * Pure TypeScript and deterministic, so scan-pipeline regressions run without Python or a browser. */
export interface SynthOptions { dpi: number; degrees?: number; ink?: number; paper?: number; columns?: number; pageMm?: [number, number] }
export function synthPage(symbols: readonly ArchivalQrSymbol[], options: SynthOptions):
  { data: Uint8ClampedArray; width: number; height: number } {
  const { dpi, degrees = 0, ink = 0, paper = 255, columns = 2, pageMm = [210, 297] } = options;
  const pxPerMm = dpi / 25.4;
  const width = Math.round(pageMm[0] * pxPerMm); const height = Math.round(pageMm[1] * pxPerMm);
  const placed = symbols.map((symbol, i) => ({ symbol,
    x: (18 + (i % columns) * 90) * pxPerMm, y: (40 + Math.floor(i / columns) * 110) * pxPerMm,
    module: 72 * pxPerMm / (symbol.modules + 8) }));
  const a = -degrees * Math.PI / 180; const cos = Math.cos(a); const sin = Math.sin(a);
  const cx = width / 2; const cy = height / 2;
  const data = new Uint8ClampedArray(width * height * 4);
  const dark = (px: number, py: number): boolean => {
    // Inverse-rotate the sample point back onto the unrotated page.
    const dx = px - cx; const dy = py - cy;
    const ux = cos * dx - sin * dy + cx; const uy = sin * dx + cos * dy + cy;
    for (const p of placed) {
      const mx = Math.floor((ux - p.x) / p.module) - 4; const my = Math.floor((uy - p.y) / p.module) - 4;
      if (mx >= -4 && my >= -4 && mx < p.symbol.modules + 4 && my < p.symbol.modules + 4)
        return mx >= 0 && my >= 0 && mx < p.symbol.modules && my < p.symbol.modules && p.symbol.matrix[my * p.symbol.modules + mx] === 1;
    }
    return false;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let n = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) if (dark(x + (sx + .5) / 3, y + (sy + .5) / 3)) n++;
    const v = Math.round(paper + (ink - paper) * n / 9); const at = (y * width + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = v; data[at + 3] = 255;
  }
  return { data, width, height };
}

type Raster = { data: Uint8ClampedArray; width: number; height: number };

/** Bilinear rotation of an RGBA raster about its centre (same size, white fill): a skewed scan of a real page. */
export function rotateRaster(image: Raster, degrees: number): Raster {
  const { data, width: w, height: h } = image;
  const out = new Uint8ClampedArray(w * h * 4).fill(255);
  const a = degrees * Math.PI / 180; const c = Math.cos(a); const s = Math.sin(a);
  const cx = (w - 1) / 2; const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = c * (x - cx) + s * (y - cy) + cx; const sy = -s * (x - cx) + c * (y - cy) + cy;
    const x0 = Math.floor(sx); const y0 = Math.floor(sy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue;
    const fx = sx - x0; const fy = sy - y0; const o = (y * w + x) * 4; const i = (y0 * w + x0) * 4;
    for (let ch = 0; ch < 3; ch++) out[o + ch] = (data[i + ch]! * (1 - fx) + data[i + 4 + ch]! * fx) * (1 - fy) +
      (data[i + w * 4 + ch]! * (1 - fx) + data[i + w * 4 + 4 + ch]! * fx) * fy;
  }
  return { data: out, width: w, height: h };
}

/** Binary RGB PPM (pdftoppm default output) to RGBA. */
export function readPpm(bytes: Buffer): Raster {
  let offset = 0;
  const token = (): string => {
    while ([9, 10, 13, 32].includes(bytes[offset]!)) offset++;
    const begin = offset;
    while (offset < bytes.length && ![9, 10, 13, 32].includes(bytes[offset]!)) offset++;
    return bytes.toString('ascii', begin, offset);
  };
  if (token() !== 'P6') throw new Error('Expected binary RGB PPM');
  const width = Number(token()); const height = Number(token());
  if (token() !== '255') throw new Error('Expected 8-bit pixels');
  offset++;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || bytes.length - offset !== width * height * 3) throw new Error('Invalid PPM');
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let p = 0; p < width * height; p++) data.set(bytes.subarray(offset + p * 3, offset + p * 3 + 3), p * 4);
  return { data, width, height };
}

/** Remaps grey levels as a faded print or a low-contrast photo would: black becomes `ink`, white becomes `paper`. */
export function fade(image: Raster, ink: number, paper: number): Raster {
  const data = image.data.slice();
  for (let i = 0; i < data.length; i += 4) for (let ch = 0; ch < 3; ch++) data[i + ch] = Math.round(ink + (paper - ink) * data[i + ch]! / 255);
  return { data, width: image.width, height: image.height };
}

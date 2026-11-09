import jsQR from 'jsqr';

import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE, MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';
export { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE, MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';
const MAGIC = [85, 79, 84, 83, 81, 82, 48, 49] as const;
type Region = { x: number; y: number; w: number; h: number };

type Located = { binaryData: number[]; location: { topLeftCorner: Point; topRightCorner: Point; bottomLeftCorner: Point; bottomRightCorner: Point } };
type Point = { x: number; y: number };
/** Area-average downscale. Gives jsQR a different sampling phase without inventing pixels. */
function downscale(src: Uint8ClampedArray, w: number, h: number, factor: number): { data: Uint8ClampedArray; w: number; h: number } {
  const ow = Math.max(1, Math.floor(w * factor)); const oh = Math.max(1, Math.floor(h * factor));
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const y0 = Math.floor(y / factor); const y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) / factor)));
    for (let x = 0; x < ow; x++) {
      const x0 = Math.floor(x / factor); const x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) / factor)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * w + sx) * 4; r += src[i]!; g += src[i + 1]!; b += src[i + 2]!; n++;
      }
      const o = (y * ow + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { data: out, w: ow, h: oh };
}
/** jsQR estimates the module grid from finder patterns; at some non-integer print/scan scales that estimate
 * is wrong for large versions. Retrying at other sampling scales recovers those symbols. Corners are mapped back.
 */
const RETRY_SCALES = [0.8, 0.65] as const;
function locate(data: Uint8ClampedArray, w: number, h: number): Located | null {
  const direct = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
  if (direct) return direct;
  for (const factor of RETRY_SCALES) {
    const small = downscale(data, w, h, factor);
    if (small.w < 21 || small.h < 21) continue;
    const qr = jsQR(small.data, small.w, small.h, { inversionAttempts: 'attemptBoth' });
    if (!qr) continue;
    const back = (p: Point): Point => ({ x: p.x / factor, y: p.y / factor });
    const l = qr.location;
    return { binaryData: qr.binaryData, location: { topLeftCorner: back(l.topLeftCorner), topRightCorner: back(l.topRightCorner),
      bottomLeftCorner: back(l.bottomLeftCorner), bottomRightCorner: back(l.bottomRightCorner) } };
  }
  return null;
}

/** Finds QR-like areas on a scanned page: connected cells of mixed dark/light ink whose bounding box is roughly
 * square. Text lines are thin and are rejected by shape. Fixed windows can cut through symbols that are not
 * centred on the page; these candidates follow the actual print layout. Bounded: at most 64 candidates.
 */
function symbolCandidates(px: Uint8ClampedArray, width: number, height: number): Region[] {
  const cell = Math.max(4, Math.round(Math.min(width, height) / 160));
  const cw = Math.ceil(width / cell); const ch = Math.ceil(height / cell);
  const mixed = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let dark = 0; let n = 0;
    for (let y = cy * cell; y < Math.min(height, (cy + 1) * cell); y += 2) for (let x = cx * cell; x < Math.min(width, (cx + 1) * cell); x += 2) {
      const i = (y * width + x) * 4; if (px[i]! + px[i + 1]! + px[i + 2]! < 384) dark++; n++;
    }
    const f = dark / n; if (f >= .12 && f <= .88) mixed[cy * cw + cx] = 1;
  }
  const seen = new Uint8Array(cw * ch); const out: Region[] = []; const stack: number[] = [];
  for (let start = 0; start < mixed.length; start++) {
    if (!mixed[start] || seen[start]) continue;
    let x0 = cw, y0 = ch, x1 = 0, y1 = 0, count = 0;
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const at = stack.pop()!; const x = at % cw; const y = (at - x) / cw; count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const next = ny * cw + nx; if (mixed[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
      }
    }
    const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
    // QR symbols fill most of their box; require a plausible size and near-square shape.
    if (bw * cell < 42 || bh * cell < 42 || bw > bh * 1.4 || bh > bw * 1.4 || count < bw * bh * .6) continue;
    const pad = Math.ceil(Math.max(bw, bh) * cell * .08);
    const rx = Math.max(0, x0 * cell - pad); const ry = Math.max(0, y0 * cell - pad);
    out.push({ x: rx, y: ry, w: Math.min(width, (x1 + 1) * cell + pad) - rx, h: Math.min(height, (y1 + 1) * cell + pad) - ry });
    if (out.length >= MAX_QR_SYMBOLS_PER_IMAGE) break;
  }
  return out;
}

/** Independent pixel decoder. Raw bytes are retained; no decoded URL or text is ever executed.
 * The UI runs this in a bounded, cancellable local worker. Images are not modified in place.
 */
export function decodeRasterFrames(data: Uint8ClampedArray, width: number, height: number): Uint8Array[] {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 21 || height < 21 ||
      width > MAX_QR_IMAGE_SIDE || height > MAX_QR_IMAGE_SIDE || width * height > MAX_QR_IMAGE_PIXELS ||
      data.length !== width * height * 4) throw new Error('Unsupported QR image dimensions');
  const pixels = data.slice();
  const frames: Uint8Array[] = [];
  // Candidate symbols first (dense square ink blobs), then the whole image and fixed fallback windows.
  const regions: Region[] = [...symbolCandidates(pixels, width, height), { x: 0, y: 0, w: width, h: height }];
  // A single-code locator can confuse finder patterns belonging to neighbouring symbols.
  // Search exact halves/quadrants, then overlapping windows for codes straddling those cuts.
  for (const grid of [2, 3]) for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
    const x0 = Math.floor(x * width / grid); const y0 = Math.floor(y * height / grid);
    regions.push({ x: x0, y: y0, w: Math.floor((x + 1) * width / grid) - x0, h: Math.floor((y + 1) * height / grid) - y0 });
  }
  regions.splice(1, 0,
    { x: 0, y: 0, w: Math.floor(width / 2), h: height },
    { x: Math.floor(width / 2), y: 0, w: width - Math.floor(width / 2), h: height },
    { x: 0, y: 0, w: width, h: Math.floor(height / 2) },
    { x: 0, y: Math.floor(height / 2), w: width, h: height - Math.floor(height / 2) });
  for (const fy of [0, .25]) for (const fx of [0, .25]) {
    regions.push({ x: Math.floor(fx * width), y: Math.floor(fy * height), w: Math.floor(width * .75), h: Math.floor(height * .75) });
  }
  let found = 0;
  for (const region of regions) {
    if (region.w < 21 || region.h < 21) continue;
    for (;;) {
      // Cleared/blank regions need no expensive locator pass.
      let ink = false;
      for (let y = region.y; y < region.y + region.h && !ink; y += 3) {
        for (let x = region.x; x < region.x + region.w; x += 3) {
          const i = (y * width + x) * 4;
          if (pixels[i]! < 245 || pixels[i + 1]! < 245 || pixels[i + 2]! < 245) { ink = true; break; }
        }
      }
      if (!ink) break;
      const cropped = new Uint8ClampedArray(region.w * region.h * 4);
      for (let row = 0; row < region.h; row++) {
        const start = ((region.y + row) * width + region.x) * 4;
        cropped.set(pixels.subarray(start, start + region.w * 4), row * region.w * 4);
      }
      const qr = locate(cropped, region.w, region.h);
      if (!qr) break;
      if (++found > MAX_QR_SYMBOLS_PER_IMAGE) throw new Error('Too many QR symbols in one image');
      if (MAGIC.every((byte, i) => qr.binaryData[i] === byte)) {
        if (qr.binaryData.length <= 80 || qr.binaryData.length > 2953) throw new Error('Invalid archival QR payload length');
        frames.push(Uint8Array.from(qr.binaryData));
      }
      const corners = [qr.location.topLeftCorner, qr.location.topRightCorner, qr.location.bottomLeftCorner, qr.location.bottomRightCorner];
      if (corners.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('Invalid QR position');
      const x0 = Math.max(0, region.x + Math.floor(Math.min(...corners.map(point => point.x))) - 2);
      const y0 = Math.max(0, region.y + Math.floor(Math.min(...corners.map(point => point.y))) - 2);
      const x1 = Math.min(width, region.x + Math.ceil(Math.max(...corners.map(point => point.x))) + 2);
      const y1 = Math.min(height, region.y + Math.ceil(Math.max(...corners.map(point => point.y))) + 2);
      if (x1 <= x0 || y1 <= y0) throw new Error('Invalid QR position');
      for (let y = y0; y < y1; y++) pixels.fill(255, (y * width + x0) * 4, (y * width + x1) * 4);
    }
  }
  return frames.sort((a, b) => new DataView(a.buffer, a.byteOffset, a.byteLength).getUint32(28) - new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(28));
}

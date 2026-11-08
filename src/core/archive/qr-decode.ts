import jsQR from 'jsqr';

import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE, MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';
export { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE, MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';
const MAGIC = [85, 79, 84, 83, 81, 82, 48, 49] as const;
type Region = { x: number; y: number; w: number; h: number };

/** Independent pixel decoder. Raw bytes are retained; no decoded URL or text is ever executed.
 * The UI runs this in a bounded, cancellable local worker. Images are not modified in place.
 */
export function decodeRasterFrames(data: Uint8ClampedArray, width: number, height: number): Uint8Array[] {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 21 || height < 21 ||
      width > MAX_QR_IMAGE_SIDE || height > MAX_QR_IMAGE_SIDE || width * height > MAX_QR_IMAGE_PIXELS ||
      data.length !== width * height * 4) throw new Error('Unsupported QR image dimensions');
  const pixels = data.slice();
  const frames: Uint8Array[] = [];
  const regions: Region[] = [{ x: 0, y: 0, w: width, h: height }];
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
      const qr = jsQR(cropped, region.w, region.h, { inversionAttempts: 'attemptBoth' });
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

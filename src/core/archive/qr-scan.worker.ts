import { decodeRasterFrames, symbolCandidates } from './qr-decode';
import { MAX_QR_SYMBOLS_PER_IMAGE } from './qr-limits';

type Raster = { data: Uint8ClampedArray; width: number; height: number };

/** Extra decode passes start only while the worker stays well inside the caller's 120 s deadline (QR_SCAN_TIMEOUT_MS).
 * A pass is started only if, judged by the first pass, it would finish before this budget. */
export const QR_RETRY_BUDGET_MS = 60_000;
/** Small deskew rotations. jsQR's module sampling misses some symbols photographed a few degrees off-axis that an
 * independent decoder (zxing-cpp) reads; resampling the page at a slightly different angle recovers them. */
const RETRY_DEGREES = [-2, 2, -4, 4] as const;
/** Faded ink or a grey photo: a luminance range this narrow is stretched to full range before decoding. */
const NARROW_RANGE = 200;

/** Luminance 1st/99th percentiles. Low-contrast images are linearly stretched; normal scans are returned untouched. */
function normalizeContrast(image: Raster): Raster {
  const { data } = image;
  const histogram = new Uint32Array(256);
  const step = Math.max(1, Math.floor(data.length / 4 / 1_000_000));
  let samples = 0;
  for (let p = 0; p < data.length; p += 4 * step) { histogram[(data[p]! * 77 + data[p + 1]! * 150 + data[p + 2]! * 29) >> 8]!++; samples++; }
  const level = (fraction: number): number => {
    let seen = 0;
    for (let v = 0; v < 256; v++) { seen += histogram[v]!; if (seen >= samples * fraction) return v; }
    return 255;
  };
  const lo = level(0.01); const hi = level(0.99);
  if (hi - lo >= NARROW_RANGE || hi - lo < 16) return image;
  const map = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) map[v] = Math.round((v - lo) * 255 / (hi - lo));
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0; p < data.length; p += 4) {
    out[p] = map[data[p]!]!; out[p + 1] = map[data[p + 1]!]!; out[p + 2] = map[data[p + 2]!]!; out[p + 3] = 255;
  }
  return { data: out, width: image.width, height: image.height };
}

/** Bilinear rotation about the centre, same dimensions (so image limits still hold), white outside the source. */
function rotate(image: Raster, degrees: number): Raster {
  const { data, width: w, height: h } = image;
  const out = new Uint8ClampedArray(data.length).fill(255);
  const a = degrees * Math.PI / 180; const c = Math.cos(a); const s = Math.sin(a);
  const cx = (w - 1) / 2; const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = c * (x - cx) + s * (y - cy) + cx; const sy = -s * (x - cx) + c * (y - cy) + cy;
      const x0 = Math.floor(sx); const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue;
      const fx = sx - x0; const fy = sy - y0; const i = (y0 * w + x0) * 4; const o = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        out[o + ch] = (data[i + ch]! * (1 - fx) + data[i + 4 + ch]! * fx) * (1 - fy) +
          (data[i + w * 4 + ch]! * (1 - fx) + data[i + w * 4 + 4 + ch]! * fx) * fy;
      }
    }
  }
  return { data: out, width: w, height: h };
}

const u32 = (frame: Uint8Array, offset: number): number => new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(offset);
const key = (frame: Uint8Array): string => Array.from(frame).join(',');

/** Printed certificates put frames 0-1 on the cover and four per continuation page (qr-print.ts). A page whose
 * frames cover only part of such a group is missing a symbol. This only decides whether to spend retry time;
 * every frame is still validated by reassembly checksums. */
function missingSymbols(frames: readonly Uint8Array[]): boolean {
  const byProof = new Map<string, Set<number>>();
  for (const frame of frames) {
    const id = Array.from(frame.subarray(12, 28), b => b.toString(16).padStart(2, '0')).join('') + ':' + u32(frame, 32);
    let set = byProof.get(id);
    if (!set) byProof.set(id, set = new Set());
    set.add(u32(frame, 28));
  }
  for (const [id, indices] of byProof) {
    const total = Number(id.split(':')[1]);
    for (const index of indices) {
      const first = index < 2 ? 0 : 2 + 4 * Math.floor((index - 2) / 4);
      const last = Math.min(total - 1, index < 2 ? 1 : first + 3);
      for (let i = first; i <= last; i++) if (!indices.has(i)) return true;
    }
  }
  return false;
}

/** The worker's decode: one normal pass; if a printed page evidently lost a symbol (or shows a QR-like area but no
 * frame), a few time-bounded deskew passes. Frames are de-duplicated by exact bytes. */
export function scanFrames(input: Raster, now: () => number = () => Date.now()): Uint8Array[] {
  const started = now();
  const image = normalizeContrast(input);
  const frames = decodeRasterFrames(image.data, image.width, image.height);
  const firstPass = now() - started;
  const seen = new Set(frames.map(key));
  if (!(frames.length ? missingSymbols(frames) : symbolCandidates(image.data, image.width, image.height, 'retry').length)) return frames;
  for (const degrees of RETRY_DEGREES) {
    if (now() - started + firstPass * 1.5 > QR_RETRY_BUDGET_MS) break;
    let more: Uint8Array[];
    try { const turned = rotate(image, degrees); more = decodeRasterFrames(turned.data, turned.width, turned.height); } catch { break; }
    for (const frame of more) {
      if (seen.has(key(frame))) continue;
      seen.add(key(frame)); frames.push(frame);
      if (frames.length > MAX_QR_SYMBOLS_PER_IMAGE) throw new Error('Too many QR symbols in one image');
    }
    if (frames.length && !missingSymbols(frames)) break;
  }
  return frames.sort((a, b) => u32(a, 28) - u32(b, 28));
}

const ctx = globalThis as unknown as {
  onmessage: ((event: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => void) | null;
  postMessage(value: unknown): void;
};
ctx.onmessage = event => {
  try {
    const { data, width, height } = event.data;
    if (!(data instanceof Uint8ClampedArray)) throw new Error('Invalid pixels');
    ctx.postMessage({ ok: true, frames: scanFrames({ data, width, height }) });
  } catch {
    ctx.postMessage({ ok: false });
  }
};

// PNG allowlist rewriter (SPEC 8.2).
import { concatParts } from '../bytes';

export type PngResult =
  | { kind: 'cleaned'; output: Uint8Array; removed: string[] }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'rejected'; reason: string };

const SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const rej = (reason: string): PngResult => ({ kind: 'rejected', reason });

let table: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of data) c = table[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const typeName = (b: Uint8Array, o: number): string => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB']);
const MAX_REMOVAL_SUMMARY_LABELS = 64;
const REMOVAL_SUMMARY_OVERFLOW = 'Additional metadata chunks';
const DEPTHS: Readonly<Record<number, readonly number[]>> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

// IHDR constraints from PNG 11.2.2. Checking the container never decompresses IDAT or allocates by image dimensions.
function validHeader(input: Uint8Array, dv: DataView, data: number): boolean {
  const width = dv.getUint32(data);
  const height = dv.getUint32(data + 4);
  return width > 0 && width <= 0x7fffffff && height > 0 && height <= 0x7fffffff
    && (DEPTHS[input[data + 9]!] ?? []).includes(input[data + 8]!)
    && input[data + 10] === 0 && input[data + 11] === 0 && input[data + 12]! <= 1;
}

/** PNG3 11.3.1.1: decoders mask sample bits above the IHDR depth, so those ignored bits must not survive cleaning. */
function normalizeTransparency(chunk: Uint8Array, bitDepth: number): Uint8Array | null {
  if (bitDepth === 16) return null;
  const normalized = chunk.slice();
  const fields = new DataView(normalized.buffer);
  const mask = 2 ** bitDepth - 1;
  let changed = false;
  for (let offset = 8; offset < normalized.length - 4; offset += 2) {
    const value = fields.getUint16(offset);
    const sample = value & mask;
    if (value !== sample) {
      fields.setUint16(offset, sample);
      changed = true;
    }
  }
  if (!changed) return null;
  fields.setUint32(normalized.length - 4, crc32(normalized.subarray(4, normalized.length - 4)));
  return normalized;
}

export function cleanPng(input: Uint8Array): PngResult {
  const n = input.length;
  if (n < 8 + 25 || !SIG.every((v, i) => input[i] === v)) return rej('Not a PNG file.');
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const out: Uint8Array[] = [SIG];
  const removed: string[] = [];
  const removedSet = new Set<string>();
  const note = (s: string): void => {
    if (removedSet.has(s)) return;
    if (removed.length < MAX_REMOVAL_SUMMARY_LABELS) {
      removedSet.add(s);
      removed.push(s);
    } else if (!removedSet.has(REMOVAL_SUMMARY_OVERFLOW)) {
      // Attacker-controlled chunk types cannot grow the retained summary past 65 labels.
      removedSet.add(REMOVAL_SUMMARY_OVERFLOW);
      removed.push(REMOVAL_SUMMARY_OVERFLOW);
    }
  };
  let pos = 8;
  let first = true;
  let sawIdat = false;
  let idatEnded = false;
  let sawEnd = false;
  let sawPlte = false;
  let sawTrns = false;
  let sawSrgb = false;
  let colorType = -1;
  let bitDepth = 0;
  let paletteEntries = 0;
  while (pos < n && !sawEnd) {
    if (pos + 12 > n) return rej('The PNG ends unexpectedly.');
    const len = dv.getUint32(pos);
    if (len > 0x7fffffff || pos + 12 + len > n) return rej('A PNG chunk has an invalid length.');
    const type = typeName(input, pos + 4);
    if (!/^[A-Za-z]{4}$/.test(type)) return rej('A PNG chunk has an invalid name.');
    const crcStored = dv.getUint32(pos + 8 + len);
    if (crc32(input.subarray(pos + 4, pos + 8 + len)) !== crcStored) return rej('A PNG chunk failed its integrity check.');
    if (first && type !== 'IHDR') return rej('The PNG does not start with a header chunk.');
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return { kind: 'unsupported', reason: 'Animated PNG files cannot be cleaned safely.' };
    let chunk = input.subarray(pos, pos + 12 + len);
    if (KEEP.has(type)) {
      if (type === 'IHDR') {
        if (!first || len !== 13 || !validHeader(input, dv, pos + 8)) return rej('Invalid PNG header chunk.');
        bitDepth = input[pos + 8 + 8]!;
        colorType = input[pos + 8 + 9]!;
      } else if (first) {
        return rej('Invalid PNG chunk order.');
      }
      if (type === 'sRGB') {
        if (len !== 1 || sawSrgb || input[pos + 8]! > 3) return rej('Invalid sRGB chunk.');
        sawSrgb = true;
      }
      // Kept bytes a decoder ignores would survive cleaning unseen, so PLTE/tRNS must fit the IHDR colour type exactly.
      if (type === 'PLTE') {
        if (sawIdat || sawPlte || sawTrns || len % 3 !== 0 || len === 0 || len > 768) return rej('Invalid PNG palette.');
        if (colorType === 0 || colorType === 4 || (colorType === 3 && len / 3 > 2 ** bitDepth)) return rej('Invalid PNG palette.');
        sawPlte = true;
        paletteEntries = len / 3;
      }
      if (type === 'tRNS') {
        // Greyscale/truecolour tRNS has one fixed size; indexed tRNS follows PLTE and covers no more entries than it.
        const ok = colorType === 3 ? len > 0 && len <= paletteEntries : len === (colorType === 0 ? 2 : colorType === 2 ? 6 : -1);
        if (sawIdat || sawTrns || !ok) return rej('Invalid PNG transparency chunk.');
        if (colorType !== 3) {
          const normalized = normalizeTransparency(chunk, bitDepth);
          if (normalized) {
            chunk = normalized;
            note('Unused transparency sample bits (tRNS)');
          }
        }
        sawTrns = true;
      }
      if (type === 'sRGB' && (sawIdat || sawPlte)) return rej('Invalid PNG chunk order.');
      if (type === 'IDAT') {
        if (colorType === 3 && !sawPlte) return rej('Indexed PNG image data requires a palette.');
        if (idatEnded) return rej('PNG image data is not contiguous.');
        sawIdat = true;
      } else if (sawIdat) {
        idatEnded = true;
      }
      if (type === 'IEND') {
        if (len !== 0) return rej('Invalid PNG end chunk.');
        sawEnd = true;
      }
      out.push(chunk);
    } else {
      // Critical (uppercase first letter) unknown chunk: we cannot know whether dropping changes decoding.
      if ((input[pos + 4]! & 0x20) === 0) return rej('The PNG contains an unknown required chunk.');
      if (sawIdat) idatEnded = true;
      note(
        type === 'eXIf' ? 'Camera data (EXIF)'
        : type === 'tEXt' || type === 'zTXt' || type === 'iTXt' ? 'Text data (may include XMP)'
        : type === 'tIME' ? 'Modification time'
        : type === 'iCCP' ? 'Colour profile'
        : `Other data (${type})`,
      );
    }
    first = false;
    pos += 12 + len;
  }
  if (!sawEnd) return rej('The PNG is truncated (no end chunk).');
  if (!sawIdat) return rej('The PNG contains no image data.');
  if (pos < n) note(`Hidden data after the end of the image (${n - pos} bytes)`);
  const output = concatParts(out);
  const bad = selfCheckPng(output);
  if (bad) return rej(`Internal self-check failed: ${bad}`);
  return { kind: 'cleaned', output, removed };
}

export function selfCheckPng(b: Uint8Array): string | null {
  if (b.length < 8 || !SIG.every((v, i) => b[i] === v)) return 'missing signature';
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  while (pos < b.length) {
    if (pos + 12 > b.length) return 'truncated';
    const len = dv.getUint32(pos);
    if (len > 0x7fffffff || len > b.length - pos - 12) return 'invalid chunk length';
    const type = typeName(b, pos + 4);
    if (!KEEP.has(type)) return `forbidden chunk ${type}`;
    if (crc32(b.subarray(pos + 4, pos + 8 + len)) !== dv.getUint32(pos + 8 + len)) return 'bad crc';
    pos += 12 + len;
    if (type === 'IEND') return pos === b.length ? null : 'data after IEND';
  }
  return 'no IEND';
}

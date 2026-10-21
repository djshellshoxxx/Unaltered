// PNG allowlist rewriter (SPEC 8.2).
import { concat } from '../bytes';

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

export function cleanPng(input: Uint8Array): PngResult {
  const n = input.length;
  if (n < 8 + 25 || !SIG.every((v, i) => input[i] === v)) return rej('Not a PNG file.');
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const out: Uint8Array[] = [SIG];
  const removed: string[] = [];
  const note = (s: string): void => {
    if (!removed.includes(s)) removed.push(s);
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
    const chunk = input.subarray(pos, pos + 12 + len);
    if (KEEP.has(type)) {
      if (type === 'IHDR') {
        if (!first || len !== 13) return rej('Invalid PNG header chunk.');
        colorType = input[pos + 8 + 9]!;
      } else if (first) {
        return rej('Invalid PNG chunk order.');
      }
      if (type === 'sRGB') {
        if (len !== 1 || sawSrgb) return rej('Invalid sRGB chunk.');
        sawSrgb = true;
      }
      if (type === 'PLTE') {
        if (sawIdat || sawPlte || len % 3 !== 0 || len === 0 || len > 768) return rej('Invalid PNG palette.');
        sawPlte = true;
      }
      if (type === 'tRNS') {
        const max = colorType === 0 ? 2 : colorType === 2 ? 6 : colorType === 3 ? 256 : 0;
        if (sawIdat || sawTrns || len === 0 || len > max) return rej('Invalid PNG transparency chunk.');
        sawTrns = true;
      }
      if (type === 'sRGB' && (sawIdat || sawPlte)) return rej('Invalid PNG chunk order.');
      if (type === 'IDAT') {
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
  const output = concat(...out);
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
    const type = typeName(b, pos + 4);
    if (!KEEP.has(type)) return `forbidden chunk ${type}`;
    if (crc32(b.subarray(pos + 4, pos + 8 + len)) !== dv.getUint32(pos + 8 + len)) return 'bad crc';
    pos += 12 + len;
    if (type === 'IEND') return pos === b.length ? null : 'data after IEND';
  }
  return 'no IEND';
}

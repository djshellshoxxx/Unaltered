// JPEG allowlist rewriter (SPEC 8.1). Re-emits only known-safe structure; drops everything else.
import { concat } from '../bytes';

export type JpegResult =
  | { kind: 'cleaned'; output: Uint8Array; removed: string[]; orientation?: number }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'rejected'; reason: string };

const rej = (reason: string): JpegResult => ({ kind: 'rejected', reason });
const uns = (reason: string): JpegResult => ({ kind: 'unsupported', reason });

const isSof = (m: number): boolean => (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7);
const isArithOrHier = (m: number): boolean => (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf) || m === 0xc8 || m === 0xcc || m === 0xdc || m === 0xde || m === 0xdf;
const isRst = (m: number): boolean => m >= 0xd0 && m <= 0xd7;

const ascii = (b: Uint8Array, off: number, s: string): boolean => off + s.length <= b.length && [...s].every((c, i) => b[off + i] === c.charCodeAt(0));

/** Read EXIF orientation and GPS presence from an APP1 Exif payload (best-effort, bounds-checked, read-only). */
function inspectExif(p: Uint8Array): { orientation?: number; gps: boolean } {
  // p starts at "Exif\0\0"
  const t = p.subarray(6);
  if (t.length < 8) return { gps: false };
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return { gps: false };
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o: number): number => dv.getUint16(o, le);
  const u32 = (o: number): number => dv.getUint32(o, le);
  if (u16(2) !== 42) return { gps: false };
  const ifd = u32(4);
  if (ifd + 2 > t.length) return { gps: false };
  const n = Math.min(u16(ifd), 512);
  let orientation: number | undefined;
  let gps = false;
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) break;
    const tag = u16(e);
    if (tag === 0x0112) orientation = u16(e + 8);
    if (tag === 0x8825) gps = true;
  }
  return orientation === undefined ? { gps } : { orientation, gps };
}

interface Seg {
  marker: number;
  start: number; // index of 0xFF
  payloadStart: number;
  end: number; // exclusive
}

export function cleanJpeg(input: Uint8Array): JpegResult {
  const n = input.length;
  if (n < 4 || input[0] !== 0xff || input[1] !== 0xd8) return rej('Not a JPEG file.');
  const out: Uint8Array[] = [Uint8Array.of(0xff, 0xd8)];
  const removed: string[] = [];
  let orientation: number | undefined;
  let sawSof = false;
  let sawSos = false;
  let sawEoi = false;
  let sawDqt = false;
  let pos = 2;
  const note = (s: string): void => {
    if (!removed.includes(s)) removed.push(s);
  };

  while (pos < n) {
    // Find next marker: 0xFF followed by non-0x00, non-0xFF. Fill bytes (0xFF) may precede.
    if (input[pos] !== 0xff) return rej('Unexpected data between JPEG segments.');
    let p = pos;
    while (p < n && input[p] === 0xff) p++;
    if (p >= n) return rej('The JPEG ends unexpectedly.');
    const marker = input[p]!;
    if (marker === 0x00) return rej('Invalid JPEG marker.');
    const segStart = p - 1;

    if (marker === 0xd9) {
      sawEoi = true;
      out.push(Uint8Array.of(0xff, 0xd9));
      if (p + 1 < n) note(`Hidden data after the end of the image (${n - (p + 1)} bytes)`);
      break;
    }
    if (marker === 0xd8) return rej('Unexpected start-of-image marker.');
    if (isRst(marker) || marker === 0x01) {
      // Standalone markers outside entropy data are not valid in a sane file.
      return rej('Unexpected marker in JPEG header.');
    }
    if (p + 2 >= n) return rej('The JPEG ends unexpectedly.');
    const len = (input[p + 1]! << 8) | input[p + 2]!;
    if (len < 2 || p + 1 + len > n) return rej('A JPEG segment has an invalid length.');
    const seg: Seg = { marker, start: segStart, payloadStart: p + 3, end: p + 1 + len };
    const payload = input.subarray(seg.payloadStart, seg.end);

    if (isArithOrHier(marker)) return uns('This kind of JPEG (arithmetic or hierarchical coding) cannot be cleaned safely.');

    if (marker >= 0xe0 && marker <= 0xef) {
      // APPn
      if (marker === 0xe0 && payload.length >= 14 && ascii(payload, 0, 'JFIF\0')) {
        // Canonical JFIF header: version, units, density; embedded thumbnail removed.
        const hdr = Uint8Array.of(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, payload[5]!, payload[6]!, payload[7]!, payload[8]!, payload[9]!, payload[10]!, payload[11]!, 0x00, 0x00);
        if (payload[12] !== 0 || payload[13] !== 0) note('Embedded JFIF thumbnail');
        if (!sawSos && !sawSof) out.push(hdr.subarray(0, 18));
      } else if (marker === 0xee && payload.length === 12 && ascii(payload, 0, 'Adobe')) {
        out.push(input.subarray(seg.start, seg.end));
      } else if (marker === 0xe1 && ascii(payload, 0, 'Exif\0\0')) {
        const info = inspectExif(payload);
        if (info.orientation !== undefined) orientation = info.orientation;
        note(info.gps ? 'Camera data (EXIF), including GPS location' : 'Camera data (EXIF)');
      } else if (marker === 0xe1 && ascii(payload, 0, 'http://ns.adobe.com/xap/1.0/\0')) {
        note('Editing data (XMP)');
      } else if (marker === 0xe2) {
        note('Colour profile / multi-picture data (APP2)');
      } else if (marker === 0xed) {
        note('Photoshop / IPTC data (APP13)');
      } else {
        note(`Other application data (APP${marker - 0xe0})`);
      }
      pos = seg.end;
      continue;
    }
    if (marker === 0xfe) {
      note('Comment');
      pos = seg.end;
      continue;
    }
    if (marker === 0xdb) {
      sawDqt = true;
      out.push(input.subarray(seg.start, seg.end));
      pos = seg.end;
      continue;
    }
    if (marker === 0xc4 || marker === 0xdd) {
      out.push(input.subarray(seg.start, seg.end));
      pos = seg.end;
      continue;
    }
    if (isSof(marker)) {
      if (sawSof) return rej('Multiple frame headers in a JPEG.');
      if (payload.length < 6) return rej('A JPEG frame header is too short.');
      const height = (payload[1]! << 8) | payload[2]!;
      if (height === 0) return uns('This JPEG defines its height later (DNL) and cannot be cleaned safely.');
      sawSof = true;
      out.push(input.subarray(seg.start, seg.end));
      pos = seg.end;
      continue;
    }
    if (marker === 0xda) {
      if (!sawSof || !sawDqt) return rej('A JPEG scan appeared before its frame header.');
      sawSos = true;
      out.push(input.subarray(seg.start, seg.end));
      // Entropy-coded data until the next real marker.
      let q = seg.end;
      for (;;) {
        if (q >= n) return rej('The JPEG ends unexpectedly.');
        if (input[q] === 0xff) {
          let r = q + 1;
          while (r < n && input[r] === 0xff) r++;
          if (r >= n) return rej('The JPEG ends unexpectedly.');
          const m = input[r]!;
          if (m === 0x00 || isRst(m)) {
            q = r + 1;
            continue;
          }
          break;
        }
        q++;
      }
      out.push(input.subarray(seg.end, q));
      pos = q;
      continue;
    }
    // Any other (reserved JPGn, TEM, unknown) marker: drop.
    note('Other unrecognised data');
    pos = seg.end;
  }

  if (!sawEoi) return rej('The JPEG is truncated (no end marker).');
  if (!sawSos) return rej('The JPEG contains no image data.');
  const output = concat(...out);
  const check = selfCheckJpeg(output);
  if (check) return rej(`Internal self-check failed: ${check}`);
  return orientation === undefined ? { kind: 'cleaned', output, removed } : { kind: 'cleaned', output, removed, orientation };
}

/** Re-parse the output and assert only allowlisted markers remain and nothing follows EOI. Returns an error string or null. */
export function selfCheckJpeg(b: Uint8Array): string | null {
  const n = b.length;
  if (n < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 'missing SOI';
  let pos = 2;
  while (pos < n) {
    if (b[pos] !== 0xff) return 'bad marker alignment';
    const m = b[pos + 1]!;
    if (m === 0xd9) return pos + 2 === n ? null : 'data after EOI';
    const len = (b[pos + 2]! << 8) | b[pos + 3]!;
    const ok = m === 0xdb || m === 0xc4 || m === 0xdd || isSof(m) || m === 0xda || m === 0xe0 || m === 0xee;
    if (!ok) return `forbidden marker 0x${m.toString(16)}`;
    if (m === 0xe0 && len !== 16) return 'JFIF with thumbnail';
    if (m === 0xe0 && (b[pos + 16] !== 0 || b[pos + 17] !== 0)) return 'JFIF thumbnail dimensions';
    pos += 2 + len;
    if (m === 0xda) {
      for (;;) {
        if (pos >= n) return 'truncated scan';
        if (b[pos] === 0xff) {
          const nx = b[pos + 1]!;
          if (nx === 0x00 || isRst(nx)) {
            pos += 2;
            continue;
          }
          break;
        }
        pos++;
      }
    }
  }
  return 'no EOI';
}

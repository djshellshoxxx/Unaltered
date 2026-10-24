// Synthetic image builders for strip tests. Contents are fabricated; never real photos (OPSEC 1.5).
import { concat } from '../../src/core/bytes';
import { crc32 } from '../../src/core/strip/png';

const seg = (marker: number, payload: Uint8Array): Uint8Array => concat(Uint8Array.of(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff), payload);
const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

export function exifPayload(opts: { orientation?: number; gps?: boolean } = {}): Uint8Array {
  // Little-endian TIFF with IFD0 entries: Orientation (0x0112) and/or GPS pointer (0x8825)
  const entries: [number, number][] = [];
  if (opts.orientation !== undefined) entries.push([0x0112, opts.orientation]);
  if (opts.gps) entries.push([0x8825, 0x40]);
  const tiff = new Uint8Array(8 + 2 + entries.length * 12 + 4 + 64);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00]);
  dv.setUint32(4, 8, true);
  dv.setUint16(8, entries.length, true);
  entries.forEach(([tag, val], i) => {
    const o = 10 + i * 12;
    dv.setUint16(o, tag, true);
    dv.setUint16(o + 2, 3, true);
    dv.setUint32(o + 4, 1, true);
    dv.setUint16(o + 8, val, true);
  });
  tiff.set(ascii('SECRET-GPS-LOCATION'), tiff.length - 40);
  return concat(ascii('Exif\0\0'), tiff);
}

export interface JpegOpts {
  exif?: { orientation?: number; gps?: boolean };
  xmp?: boolean;
  icc?: boolean;
  iptc?: boolean;
  comment?: string;
  jfifThumb?: boolean;
  trailing?: Uint8Array;
  noEoi?: boolean;
  noSos?: boolean;
  appFirst?: boolean;
  extraApp?: boolean;
  adobe?: boolean;
  arithmetic?: boolean;
}

export function makeJpeg(o: JpegOpts = {}): Uint8Array {
  const jfif = o.jfifThumb
    ? concat(ascii('JFIF\0'), Uint8Array.of(1, 1, 1, 0, 72, 0, 72, 2, 2), new Uint8Array(12).fill(0x55))
    : concat(ascii('JFIF\0'), Uint8Array.of(1, 1, 1, 0, 72, 0, 72, 0, 0));
  const parts: Uint8Array[] = [Uint8Array.of(0xff, 0xd8), seg(0xe0, jfif)];
  if (o.exif) parts.push(seg(0xe1, exifPayload(o.exif)));
  if (o.xmp) parts.push(seg(0xe1, concat(ascii('http://ns.adobe.com/xap/1.0/\0'), ascii('<x:xmpmeta>SECRET-XMP</x:xmpmeta>'))));
  if (o.icc) parts.push(seg(0xe2, concat(ascii('ICC_PROFILE\0'), new Uint8Array(30))));
  if (o.iptc) parts.push(seg(0xed, concat(ascii('Photoshop 3.0\0'), ascii('8BIM SECRET-IPTC'))));
  if (o.extraApp) parts.push(seg(0xeb, ascii('VENDOR-SECRET')));
  if (o.adobe) parts.push(seg(0xee, concat(ascii('Adobe'), Uint8Array.of(0, 100, 0, 0, 0, 0, 1))));
  if (o.comment) parts.push(seg(0xfe, ascii(o.comment)));
  parts.push(seg(0xdb, concat(Uint8Array.of(0), new Uint8Array(64).fill(8))));
  parts.push(seg(o.arithmetic ? 0xc9 : 0xc0, Uint8Array.of(8, 0, 8, 0, 8, 1, 1, 0x11, 0)));
  parts.push(seg(0xc4, concat(Uint8Array.of(0, 1), new Uint8Array(15), Uint8Array.of(0))));
  if (!o.noSos) {
    parts.push(seg(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0)));
    parts.push(Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0x00, 0xff, 0xd1, 0x78));
  }
  if (!o.noEoi) parts.push(Uint8Array.of(0xff, 0xd9));
  if (o.trailing) parts.push(o.trailing);
  return concat(...parts);
}

const be32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
export function chunk(type: string, data: Uint8Array = new Uint8Array(0), badCrc = false): Uint8Array {
  const t = ascii(type);
  const crc = crc32(concat(t, data)) ^ (badCrc ? 1 : 0);
  return concat(be32(data.length), t, data, be32(crc >>> 0));
}

export interface PngOpts {
  text?: boolean;
  exif?: boolean;
  time?: boolean;
  icc?: boolean;
  srgb?: boolean;
  phys?: boolean;
  trailing?: Uint8Array;
  badCrc?: boolean;
  apng?: boolean;
  unknownCritical?: boolean;
  private?: boolean;
  noIend?: boolean;
  splitIdat?: boolean;
}

export function makePng(o: PngOpts = {}): Uint8Array {
  const sig = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const ihdr = concat(be32(1), be32(1), Uint8Array.of(8, 2, 0, 0, 0));
  const parts: Uint8Array[] = [sig, chunk('IHDR', ihdr)];
  if (o.srgb) parts.push(chunk('sRGB', Uint8Array.of(0)));
  if (o.icc) parts.push(chunk('iCCP', concat(ascii('p\0\0'), new Uint8Array(10))));
  if (o.phys) parts.push(chunk('pHYs', new Uint8Array(9)));
  if (o.text) parts.push(chunk('tEXt', ascii('Author\0SECRET-AUTHOR')), chunk('iTXt', ascii('XML:com.adobe.xmp\0\0\0\0\0SECRET-XMP')));
  if (o.exif) parts.push(chunk('eXIf', exifPayload({ gps: true }).subarray(6)));
  if (o.time) parts.push(chunk('tIME', new Uint8Array(7)));
  if (o.private) parts.push(chunk('prVt', ascii('SECRET-PRIVATE')));
  if (o.unknownCritical) parts.push(chunk('ZZZZ', ascii('x')));
  if (o.apng) parts.push(chunk('acTL', new Uint8Array(8)));
  const raw = Uint8Array.of(0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01);
  if (o.splitIdat) parts.push(chunk('IDAT', raw.subarray(0, 6), o.badCrc), chunk('tEXt', ascii('mid\0x')), chunk('IDAT', raw.subarray(6)));
  else parts.push(chunk('IDAT', raw, o.badCrc));
  if (!o.noIend) parts.push(chunk('IEND'));
  if (o.trailing) parts.push(o.trailing);
  return concat(...parts);
}

export const contains = (hay: Uint8Array, needle: string): boolean => new TextDecoder('latin1').decode(hay).includes(needle);

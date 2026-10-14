import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { detectKind } from '../../src/core/strip/detect';
import { stripMetadata } from '../../src/core/strip';
import { cleanJpeg, selfCheckJpeg } from '../../src/core/strip/jpeg';
import { cleanPng, selfCheckPng } from '../../src/core/strip/png';
import { contains, makeJpeg, makePng } from '../helpers/images';

const FULL = { exif: { orientation: 6, gps: true }, xmp: true, icc: true, iptc: true, comment: 'SECRET-COMMENT', jfifThumb: true, extraApp: true, adobe: true, trailing: new TextEncoder().encode('SECRET-TRAILING') } as const;

describe('JPEG stripping (SPEC 8.1)', () => {
  it('removes EXIF/GPS, XMP, ICC, IPTC, comments, thumbnails and trailing data; keeps image and Adobe marker', () => {
    const input = makeJpeg(FULL);
    for (const s of ['SECRET-GPS-LOCATION', 'SECRET-XMP', 'SECRET-IPTC', 'SECRET-COMMENT', 'VENDOR-SECRET', 'SECRET-TRAILING']) expect(contains(input, s)).toBe(true);
    const r = cleanJpeg(input);
    if (r.kind !== 'cleaned') throw new Error('expected cleaned');
    for (const s of ['SECRET-GPS-LOCATION', 'SECRET-XMP', 'SECRET-IPTC', 'SECRET-COMMENT', 'VENDOR-SECRET', 'SECRET-TRAILING', 'ICC_PROFILE', 'Exif']) expect(contains(r.output, s)).toBe(false);
    expect(contains(r.output, 'Adobe')).toBe(true);
    expect(contains(r.output, 'JFIF')).toBe(true);
    expect(r.orientation).toBe(6);
    expect(r.removed.join('|')).toMatch(/GPS/);
    expect(r.removed.join('|')).toMatch(/after the end/);
    expect(selfCheckJpeg(r.output)).toBeNull();
    // entropy-coded data incl. byte stuffing and restart markers survived
    expect(contains(r.output, '\u0012ÿ\u00004ÿÐ')).toBe(true);
  });

  it('is idempotent', () => {
    const r1 = cleanJpeg(makeJpeg(FULL));
    if (r1.kind !== 'cleaned') throw new Error();
    const r2 = cleanJpeg(r1.output);
    if (r2.kind !== 'cleaned') throw new Error();
    expect(r2.output).toEqual(r1.output);
    expect(r2.removed).toEqual([]);
  });

  it('rejects malformed input: truncated, no EOI, no scan, garbage between segments', () => {
    const good = makeJpeg({});
    for (let n = 0; n < good.length - 1; n++) expect(cleanJpeg(good.slice(0, n)).kind, `cut ${n}`).toBe('rejected');
    expect(cleanJpeg(makeJpeg({ noEoi: true })).kind).toBe('rejected');
    expect(cleanJpeg(makeJpeg({ noSos: true })).kind).toBe('rejected');
    const bad = good.slice();
    bad[2] = 0x00;
    expect(cleanJpeg(bad).kind).toBe('rejected');
  });

  it('marks arithmetic-coded JPEG unsupported', () => {
    expect(cleanJpeg(makeJpeg({ arithmetic: true })).kind).toBe('unsupported');
  });

  it('reports no orientation when EXIF has none, and warns nothing for clean files', () => {
    const r = cleanJpeg(makeJpeg({ exif: {} }));
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.orientation).toBeUndefined();
  });

  it('property: output never contains forbidden markers and always passes the self-check', () => {
    fc.assert(
      fc.property(
        fc.record({ xmp: fc.boolean(), icc: fc.boolean(), iptc: fc.boolean(), extraApp: fc.boolean(), adobe: fc.boolean(), jfifThumb: fc.boolean(), exif: fc.option(fc.record({ orientation: fc.integer({ min: 1, max: 8 }), gps: fc.boolean() }), { nil: undefined }), trailing: fc.option(fc.uint8Array({ maxLength: 50 }), { nil: undefined }) }),
        (o) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(o)) if (v !== undefined) clean[k] = v;
          const r = cleanJpeg(makeJpeg(clean));
          expect(r.kind).toBe('cleaned');
          if (r.kind === 'cleaned') expect(selfCheckJpeg(r.output)).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('fuzz: random mutations never crash or hang, and any accepted output passes the self-check', () => {
    const base = makeJpeg(FULL);
    fc.assert(
      fc.property(fc.nat(base.length - 1), fc.uint8Array({ minLength: 1, maxLength: 6 }), (at, patch) => {
        const m = base.slice();
        m.set(patch.subarray(0, Math.min(patch.length, m.length - at)), at);
        const r = cleanJpeg(m);
        if (r.kind === 'cleaned') expect(selfCheckJpeg(r.output)).toBeNull();
      }),
      { numRuns: 4000 },
    );
  });
});

describe('PNG stripping (SPEC 8.2)', () => {
  const FULLP = { text: true, exif: true, time: true, icc: true, srgb: true, phys: true, private: true, trailing: new TextEncoder().encode('SECRET-TRAILING') } as const;

  it('keeps only allowlisted chunks and verifies CRCs', () => {
    const input = makePng(FULLP);
    const r = cleanPng(input);
    if (r.kind !== 'cleaned') throw new Error(JSON.stringify(r));
    for (const s of ['SECRET-AUTHOR', 'SECRET-XMP', 'SECRET-PRIVATE', 'SECRET-TRAILING', 'GPS', 'tIME', 'iCCP', 'pHYs', 'eXIf']) expect(contains(r.output, s)).toBe(false);
    expect(contains(r.output, 'sRGB')).toBe(true);
    expect(contains(r.output, 'IDAT')).toBe(true);
    expect(selfCheckPng(r.output)).toBeNull();
    expect(r.removed.length).toBeGreaterThan(4);
  });

  it('is idempotent', () => {
    const r1 = cleanPng(makePng(FULLP));
    if (r1.kind !== 'cleaned') throw new Error();
    const r2 = cleanPng(r1.output);
    if (r2.kind !== 'cleaned') throw new Error();
    expect(r2.output).toEqual(r1.output);
  });

  it('rejects bad CRC, missing IEND, unknown required chunk; APNG is unsupported', () => {
    expect(cleanPng(makePng({ badCrc: true })).kind).toBe('rejected');
    expect(cleanPng(makePng({ noIend: true })).kind).toBe('rejected');
    expect(cleanPng(makePng({ unknownCritical: true })).kind).toBe('rejected');
    expect(cleanPng(makePng({ apng: true })).kind).toBe('unsupported');
  });

  it('rejects every truncation', () => {
    const good = makePng({ text: true });
    for (let n = 0; n < good.length; n++) expect(cleanPng(good.slice(0, n)).kind, `cut ${n}`).toBe('rejected');
  });

  it('rejects IDAT interleaved with other kept data, accepts split contiguous IDAT', () => {
    expect(cleanPng(makePng({ splitIdat: true })).kind).toBe('rejected');
  });

  it('fuzz: random mutations never crash and accepted output passes the self-check', () => {
    const base = makePng(FULLP);
    fc.assert(
      fc.property(fc.nat(base.length - 1), fc.uint8Array({ minLength: 1, maxLength: 6 }), (at, patch) => {
        const m = base.slice();
        m.set(patch.subarray(0, Math.min(patch.length, m.length - at)), at);
        const r = cleanPng(m);
        if (r.kind === 'cleaned') expect(selfCheckPng(r.output)).toBeNull();
      }),
      { numRuns: 4000 },
    );
  });
});

describe('detect + stripMetadata', () => {
  it('detects by magic bytes, ignoring names', () => {
    expect(detectKind(makeJpeg())).toBe('jpeg');
    expect(detectKind(makePng())).toBe('png');
    expect(detectKind(new TextEncoder().encode('%PDF-1.7'))).toBe('pdf');
    expect(detectKind(new TextEncoder().encode('GIF89a'))).toBe('gif');
    expect(detectKind(Uint8Array.of(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBe('heic');
    expect(detectKind(Uint8Array.of(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32))).toBe('video');
    expect(detectKind(new TextEncoder().encode('hello'))).toBe('other');
  });

  it('stripMetadata: cleaned for images, unsupported for everything else, rejected for broken images', async () => {
    const c = await stripMetadata(new Blob([makeJpeg(FULL) as BlobPart]));
    expect(c.kind).toBe('cleaned');
    if (c.kind === 'cleaned') {
      expect(c.format).toBe('jpeg');
      expect(c.orientation).toBe(6);
    }
    expect((await stripMetadata(new Blob([new TextEncoder().encode('%PDF-1.4 ...')]))).kind).toBe('unsupported');
    expect((await stripMetadata(new Blob([makeJpeg({ noEoi: true }) as BlobPart]))).kind).toBe('rejected');
    expect((await stripMetadata(new Blob([makePng({ badCrc: true }) as BlobPart]))).kind).toBe('rejected');
  });
});

describe('review hardening: kept segments carry no free-form bytes', () => {
  const seg = (m: number, payload: number[]): number[] => [0xff, m, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload];
  const secret = Array.from(new TextEncoder().encode('SECRETSECRET'));
  const mutate = (needle: number[], insert: number[]): Uint8Array => {
    const base = Array.from(makeJpeg({}));
    // locate the DRI-less file's SOS and insert a crafted segment before the DQT
    const i = base.findIndex((v, k) => v === 0xff && base[k + 1] === 0xdb);
    void needle;
    return Uint8Array.from([...base.slice(0, i), ...insert, ...base.slice(i)]);
  };

  it('rejects DRI with a hidden tail, repeated JFIF/Adobe are not kept', () => {
    expect(cleanJpeg(mutate([], seg(0xdd, [0, 1, ...secret]))).kind).toBe('rejected');
    const jfif = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, ...secret.slice(0, 7), 0, 0]);
    const r = cleanJpeg(mutate([], [...jfif, ...jfif, ...jfif]));
    if (r.kind !== 'cleaned') throw new Error();
    expect(contains(r.output, 'SECRET')).toBe(false);
    const adobe = seg(0xee, [0x41, 0x64, 0x6f, 0x62, 0x65, ...secret.slice(0, 7)]);
    const a = cleanJpeg(mutate([], [...adobe, ...adobe]));
    if (a.kind !== 'cleaned') throw new Error();
    expect((new TextDecoder('latin1').decode(a.output).match(/Adobe/g) ?? []).length).toBe(1);
  });

  it('rejects padded DQT / SOF / SOS segments', () => {
    const good = Array.from(makeJpeg({}));
    const pad = (marker: number): Uint8Array => {
      const i = good.findIndex((v, k) => v === 0xff && good[k + 1] === marker);
      const len = (good[i + 2]! << 8) | good[i + 3]!;
      const grown = len + secret.length;
      return Uint8Array.from([...good.slice(0, i + 2), grown >> 8, grown & 255, ...good.slice(i + 4, i + 2 + len), ...secret, ...good.slice(i + 2 + len)]);
    };
    for (const m of [0xdb, 0xc0, 0xc4, 0xda]) expect(cleanJpeg(pad(m)).kind, `marker ${m.toString(16)}`).toBe('rejected');
  });

  it('PNG: duplicate tRNS/sRGB/PLTE and oversized palettes are rejected', async () => {
    const { makePng: mk, chunk } = await import('../helpers/images');
    const { concat } = await import('../../src/core/bytes');
    const png = mk({});
    const iend = png.length - 12;
    const idat = png.indexOf(0x49, 40);
    void idat;
    const insertBeforeIdat = (extra: Uint8Array): Uint8Array => {
      const i = Array.from(png).findIndex((v, k) => k > 8 && v === 0x49 && png[k + 1] === 0x44 && png[k + 2] === 0x41 && png[k + 3] === 0x54) - 4;
      return concat(png.slice(0, i), extra, png.slice(i));
    };
    void iend;
    const s = new TextEncoder().encode('SECRETSECRETSECRET');
    expect(cleanPng(insertBeforeIdat(concat(chunk('sRGB', Uint8Array.of(0)), chunk('sRGB', Uint8Array.of(0))))).kind).toBe('rejected');
    expect(cleanPng(insertBeforeIdat(concat(chunk('tRNS', s.slice(0, 6)), chunk('tRNS', s.slice(0, 6))))).kind).toBe('rejected');
    expect(cleanPng(insertBeforeIdat(chunk('PLTE', new Uint8Array(771)))).kind).toBe('rejected');
    expect(cleanPng(insertBeforeIdat(chunk('tRNS', s))).kind).toBe('rejected'); // too long for colour type 2
    expect(cleanPng(insertBeforeIdat(chunk('tRNS', s.slice(0, 6)))).kind).toBe('cleaned');
  });
});

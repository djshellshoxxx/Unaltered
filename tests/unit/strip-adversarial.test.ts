// Adversarial parser review 2026-11-04: each block reproduces a defect on 583aca4 and guards its fix.
import { describe, expect, it } from 'vitest';
import { concat, toHex } from '../../src/core/bytes';
import { stripMetadata } from '../../src/core/strip';
import { cleanMp3, cleanWav, selfCheckAudio } from '../../src/core/strip/audio';
import { cleanJpeg } from '../../src/core/strip/jpeg';
import { cleanPng } from '../../src/core/strip/png';
import { apeTag, FRAME, makeWav } from '../helpers/audio';
import { chunk, contains, makeJpeg } from '../helpers/images';

const frame = (fill: number): number[] => {
  const f = [...FRAME];
  f.fill(fill, 4);
  return f;
};

describe('MP3: an APEv2 footer cannot claim complete audio frames as tag bytes', () => {
  const [a, b] = [frame(0x11), frame(0x22)];

  it('rejects a footer size that reaches back over the last audio frame', () => {
    const tag = apeTag([['Artist', 'SECRET-APE']], false);
    const input = Uint8Array.from([...a, ...b, ...tag]);
    const dv = new DataView(input.buffer);
    // Without a header the inflated "items" region would begin exactly at frame b.
    dv.setUint32(input.length - 20, dv.getUint32(input.length - 20, true) + b.length, true);
    const r = cleanMp3(input);
    expect(r.kind === 'cleaned' ? [...r.output] : r.kind).toBe('rejected');
  });

  it('rejects a header flag when no APE header is where the footer says', () => {
    const tag = apeTag([['Artist', 'SECRET-APE']], false);
    const input = Uint8Array.from([...a, ...b, ...tag]);
    const dv = new DataView(input.buffer);
    // The flag adds 32 header bytes; together with the adjusted size the tag would start at frame b.
    dv.setUint32(input.length - 20, dv.getUint32(input.length - 20, true) + b.length - 32, true);
    dv.setUint32(input.length - 12, 0x80000000, true);
    const r = cleanMp3(input);
    expect(r.kind === 'cleaned' ? [...r.output] : r.kind).toBe('rejected');
  });

  it('still removes well-formed APE tags with and without a header', () => {
    for (const header of [true, false]) {
      const r = cleanMp3(Uint8Array.from([...a, ...b, ...apeTag([['Artist', 'SECRET-APE'], ['Cover Art (Front)', '\x01\x02']], header)]));
      if (r.kind !== 'cleaned') throw new Error(`header=${header}: ${JSON.stringify(r)}`);
      expect([...r.output]).toEqual([...a, ...b]);
      expect(r.removed).toEqual(['APEv2 tag']);
    }
  });
});

describe('PNG: PLTE/tRNS bytes that the colour type cannot use are refused, not kept', () => {
  const be32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const sig = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const idat = Uint8Array.of(0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01);
  const png = (bitDepth: number, colorType: number, ...beforeIdat: Uint8Array[]): Uint8Array =>
    concat(sig, chunk('IHDR', concat(be32(1), be32(1), Uint8Array.of(bitDepth, colorType, 0, 0, 0))), ...beforeIdat, chunk('IDAT', idat), chunk('IEND'));
  const secret = (n: number): Uint8Array => new TextEncoder().encode('SECRET-'.repeat(40)).subarray(0, n);

  it('rejects ignored palette or transparency bytes', () => {
    for (const [label, input] of [
      ['PLTE in a greyscale image', png(8, 0, chunk('PLTE', secret(45)))],
      ['PLTE in a greyscale+alpha image', png(8, 4, chunk('PLTE', secret(45)))],
      ['more palette entries than a 1-bit index addresses', png(1, 3, chunk('PLTE', secret(45)))],
      ['indexed tRNS before PLTE', png(8, 3, chunk('tRNS', secret(20)), chunk('PLTE', secret(6)))],
      ['indexed tRNS longer than the palette', png(8, 3, chunk('PLTE', secret(6)), chunk('tRNS', secret(20)))],
      ['greyscale tRNS of the wrong size', png(8, 0, chunk('tRNS', secret(1)))],
    ] as const) {
      const r = cleanPng(input);
      expect(r.kind === 'cleaned' ? `cleaned, secret kept: ${contains(r.output, 'SECRET')}` : r.kind, label).toBe('rejected');
    }
  });

  it('keeps valid palettes and transparency', () => {
    for (const input of [
      png(8, 3, chunk('PLTE', secret(6)), chunk('tRNS', secret(2))),
      png(1, 3, chunk('PLTE', secret(6))),
      png(8, 2, chunk('PLTE', secret(6)), chunk('tRNS', secret(6))), // suggested palette for truecolour is allowed
      png(16, 0, chunk('tRNS', secret(2))),
    ]) expect(cleanPng(input).kind).toBe('cleaned');
  });
});

describe('JPEG: removing bytes from the JFIF header is reported', () => {
  it('lists extra JFIF bytes instead of reporting that nothing was found', () => {
    const base = Array.from(makeJpeg());
    const tail = Array.from(new TextEncoder().encode('SECRET-JFIF-TAIL'));
    // APP0 "JFIF\0" + 9 header bytes with a 0x0 thumbnail, followed by bytes the canonical header does not keep.
    const app0 = [0xff, 0xe0, 0, 16 + tail.length, ...base.slice(6, 20), ...tail];
    const r = cleanJpeg(Uint8Array.from([0xff, 0xd8, ...app0, ...base.slice(20)]));
    if (r.kind !== 'cleaned') throw new Error(JSON.stringify(r));
    expect(contains(r.output, 'SECRET')).toBe(false);
    expect(r.removed).not.toEqual([]);
    const plain = cleanJpeg(makeJpeg());
    expect(plain.kind === 'cleaned' && plain.removed).toEqual([]);
  });
});

describe('WAV: rewritten pad bytes are reported', () => {
  it('lists non-zero chunk padding that cleaning replaced with zero', () => {
    const input = makeWav({ oddPad: 5 });
    input[input.length - 1] = 0x7f;
    const r = cleanWav(input);
    if (r.kind !== 'cleaned') throw new Error(JSON.stringify(r));
    expect(r.output.at(-1)).toBe(0);
    expect(r.removed).not.toEqual([]);
    const zero = cleanWav(makeWav({ oddPad: 5 }));
    expect(zero.kind === 'cleaned' && zero.removed).toEqual([]);
  });
});

describe('WAV: an upper-case "ID3 " chunk is labelled as an ID3 tag', () => {
  it('names both id3 chunk spellings found in the wild', () => {
    for (const id of ['id3 ', 'ID3 ']) {
      const base = makeWav();
      const extra = Uint8Array.from([...id].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 0x49, 0x44, 0x33, 0x03]));
      const input = concat(base.subarray(0, 36), extra, base.subarray(36)); // after the RIFF header and fmt chunk
      new DataView(input.buffer).setUint32(4, input.length - 8, true);
      const r = cleanWav(input);
      expect(r.kind === 'cleaned' && r.removed, id).toEqual(['ID3 tag']);
    }
  });
});

describe('MP3: an APEv2 tag with a wrong item count is still removed', () => {
  // Writers get the count wrong; mutagen and TagLib stop at the end of the items instead of failing.
  // The bounds come from the items filling the space before the footer, not from the count.
  const [a, b] = [frame(0x11), frame(0x22)];
  const tagged = (header: boolean): Uint8Array => Uint8Array.from([...a, ...b, ...apeTag([['Artist', 'SECRET-A'], ['Title', 'SECRET-T']], header)]);
  const itemsStart = (input: Uint8Array): number => input.length - new DataView(input.buffer).getUint32(input.length - 20, true);

  it('removes the tag when the stored count is one too high or one too low', () => {
    const outcomes: string[] = [];
    for (const header of [true, false]) {
      for (const count of [3, 1]) {
        const input = tagged(header);
        const dv = new DataView(input.buffer);
        dv.setUint32(input.length - 16, count, true); // footer item count
        if (header) dv.setUint32(itemsStart(input) - 32 + 16, count, true); // header item count
        const r = cleanMp3(input);
        const ok = r.kind === 'cleaned' && contains(r.output, 'SECRET') === false && r.output.length === a.length + b.length && r.removed.join() === 'APEv2 tag';
        outcomes.push(`header=${header} count=${count}: ${ok ? 'removed' : JSON.stringify(r.kind === 'cleaned' ? r.removed : r)}`);
      }
    }
    expect(outcomes).toEqual(['header=true count=3: removed', 'header=true count=1: removed', 'header=false count=3: removed', 'header=false count=1: removed']);
  });

  it('still rejects items that do not fill the space before the footer, whatever the count', () => {
    for (const header of [true, false]) {
      const input = tagged(header);
      const dv = new DataView(input.buffer);
      const first = itemsStart(input);
      dv.setUint32(first, dv.getUint32(first, true) + 1, true); // the first value claims one byte of the next item
      expect(cleanMp3(input).kind, `header=${header}`).toBe('rejected');
    }
  });
});

describe('WAV: kept chunks keep only the fields a decoder reads', () => {
  // fmt/fact/smpl/inst/cue are copied, so bytes past their defined fields would survive cleaning unseen.
  const enc = (t: string): number[] => [...t].map((c) => c.charCodeAt(0));
  const u16 = (n: number): number[] => [n & 255, (n >> 8) & 255];
  const u32 = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const riff = (id: string, body: readonly number[]): number[] => [...enc(id), ...u32(body.length), ...body, ...(body.length & 1 ? [0] : [])];
  const wav = (...chunks: number[][]): Uint8Array => {
    const body = [...enc('WAVE'), ...chunks.flat()];
    return Uint8Array.from([...enc('RIFF'), ...u32(body.length), ...body]);
  };
  const PCM_FIELDS = [1, 0, 1, 0, ...u32(44100), ...u32(88200), 2, 0, 16, 0];
  const FMT = riff('fmt ', PCM_FIELDS);
  const DATA = riff('data', [1, 2, 3, 4, 5, 6, 7, 8]);
  const SECRET = enc('SECRET-Recorded by Jane Doe, iPhone 15, 51.5N 0.12W');
  const CUE_POINT = [...u32(1), ...u32(0), ...enc('data'), ...u32(0), ...u32(0), ...u32(0)];
  const LOOP = [...u32(0), ...u32(0), ...u32(0), ...u32(7), ...u32(0), ...u32(0)];
  const smplHead = (loops: number, samplerData: number, maker: readonly number[] = new Array<number>(8).fill(0)): number[] =>
    [...maker, ...u32(22675), ...u32(60), ...u32(0), ...u32(0), ...u32(0), ...u32(loops), ...u32(samplerData)];
  const extensible = (cbSize: number, extra: readonly number[]): number[] =>
    [0xfe, 0xff, 1, 0, ...u32(44100), ...u32(88200), 2, 0, 16, 0, ...u16(cbSize), 16, 0, ...u32(4), 1, 0, 0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71, ...extra];

  async function outcome(input: Uint8Array): Promise<string> {
    const r = cleanWav(input);
    if (r.kind !== 'cleaned') return r.kind;
    const s = await stripMetadata(new Blob([input as BlobPart]));
    const stripped = s.kind === 'cleaned' ? new Uint8Array(await s.output.arrayBuffer()) : null;
    if (contains(r.output, 'SECRET') || !stripped || contains(stripped, 'SECRET')) return 'secret kept';
    if (r.removed.length === 0 || (s.kind === 'cleaned' && s.removed.length === 0)) return 'not reported';
    if (selfCheckAudio('wav', r.output) !== null) return 'unstable';
    return [...r.output.slice(-8)].join() === '1,2,3,4,5,6,7,8' ? 'removed' : 'samples changed';
  }
  async function outcomes(cases: readonly (readonly [string, Uint8Array])[]): Promise<string[]> {
    return Promise.all(cases.map(async ([label, input]) => `${label}: ${await outcome(input)}`));
  }

  it('removes and reports text appended to fmt, fact, smpl, inst and cue', async () => {
    const cases = [
      ['fmt tail', wav(riff('fmt ', [...PCM_FIELDS, ...SECRET]), DATA)],
      ['fact tail', wav(FMT, riff('fact', [...u32(4), ...SECRET]), DATA)],
      ['smpl sampler data', wav(FMT, riff('smpl', [...smplHead(0, SECRET.length), ...SECRET]), DATA)],
      ['smpl maker and product', wav(FMT, riff('smpl', smplHead(0, 0, enc('SECRET-X'))), DATA)],
      ['inst tail', wav(FMT, riff('inst', [60, 0, 0, 0, 127, 1, 127, ...SECRET]), DATA)],
      ['cue tail', wav(FMT, riff('cue ', [...u32(1), ...CUE_POINT, ...SECRET]), DATA)],
    ] as const;
    expect(await outcomes(cases)).toEqual(cases.map(([label]) => `${label}: removed`));
  });

  it('closes the same channel in format extensions, after smpl loops and in chunks a decoder skips', async () => {
    const cases = [
      ['PCM fmt with an extension', wav(riff('fmt ', [...PCM_FIELDS, ...u16(SECRET.length), ...SECRET]), DATA)],
      ['extensible PCM fmt past its 22 extension bytes', wav(riff('fmt ', extensible(22 + SECRET.length, SECRET)), DATA)],
      ['codec fmt past cbSize', wav(riff('fmt ', [0x11, 0, 1, 0, ...u32(44100), ...u32(22311), 0, 2, 4, 0, ...u16(2), ...u16(1017), ...SECRET]), DATA)],
      ['smpl tail after the loops', wav(FMT, riff('smpl', [...smplHead(1, 0), ...LOOP, ...SECRET]), DATA)],
      ['second cue chunk', wav(FMT, riff('cue ', [...u32(1), ...CUE_POINT]), riff('cue ', [...u32(2), ...SECRET.slice(0, 48)]), DATA)],
      ['cue points that do not fit', wav(FMT, riff('cue ', [...u32(1000), ...SECRET]), DATA)],
      ['fact shorter than its field', wav(FMT, riff('fact', enc('SEC')), DATA)],
    ] as const;
    expect(await outcomes(cases)).toEqual(cases.map(([label]) => `${label}: removed`));
  });

  it('drops zero bytes after the fields without reporting hidden data', () => {
    const r = cleanWav(wav(riff('fmt ', [...PCM_FIELDS, 0, 0, 0, 0]), riff('fact', [...u32(4), 0, 0]), DATA));
    const expected = wav(riff('fmt ', [...PCM_FIELDS, 0, 0]), riff('fact', u32(4)), DATA);
    expect(r.kind === 'cleaned' && { removed: r.removed, output: toHex(r.output) }).toEqual({ removed: [], output: toHex(expected) });
  });

  it('refuses XMA, whose format chunk has no cbSize to bound its fields', () => {
    const r = cleanWav(wav(riff('fmt ', [0x65, 0x01, 16, 0, ...u16(0), ...u16(0), 0, 1, 0, 0, ...new Array<number>(32).fill(7), ...SECRET]), DATA));
    expect(r.kind).toBe('unsupported');
  });

  it('keeps a valid chunk that follows a malformed one of the same kind', () => {
    const r = cleanWav(wav(FMT, riff('smpl', [1, 2, 3]), riff('smpl', [...smplHead(1, 0), ...LOOP]), DATA));
    const expected = wav(FMT, riff('smpl', [...smplHead(1, 0), ...LOOP]), DATA);
    expect(r.kind === 'cleaned' && { removed: r.removed, output: toHex(r.output) }).toEqual({ removed: ['malformed chunk (smpl)'], output: toHex(expected) });
  });

  it('keeps well-formed chunks byte for byte', () => {
    for (const [label, input] of [
      ['PCM fmt with an empty extension', wav(riff('fmt ', [...PCM_FIELDS, 0, 0]), DATA)],
      ['extensible PCM fmt', wav(riff('fmt ', extensible(22, [])), DATA)],
      ['IMA ADPCM fmt with its extension', wav(riff('fmt ', [0x11, 0, 1, 0, ...u32(44100), ...u32(22311), 0, 2, 4, 0, ...u16(2), ...u16(1017)]), riff('fact', u32(1017)), DATA)],
      ['smpl with a loop, inst and cue', wav(FMT, riff('smpl', [...smplHead(1, 0), ...LOOP]), riff('inst', [60, 0, 0, 0, 127, 1, 127]), riff('cue ', [...u32(1), ...CUE_POINT]), DATA)],
    ] as const) {
      const r = cleanWav(input);
      expect(r.kind === 'cleaned' && { removed: r.removed, same: [...r.output].join() === [...input].join() }, label).toEqual({ removed: [], same: true });
    }
  });
});

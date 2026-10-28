import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cleanMp3, cleanWav, selfCheckAudio } from '../../src/core/strip/audio';
import { detectKind } from '../../src/core/strip/detect';
import { stripMetadata } from '../../src/core/strip';
import { contains } from '../helpers/images';
import { FRAME, makeMp3, makeWav, PCM } from '../helpers/audio';

describe('WAV stripping', () => {
  it('removes LIST/bext/iXML and trailing data, keeps fmt, smpl and the samples', () => {
    const input = makeWav({ extra: true, trailing: 'SECRET-TRAILING' });
    for (const s of ['SECRET-ARTIST', 'SECRET-ORIGINATOR', 'SECRET-IXML', 'SECRET-TRAILING']) expect(contains(input, s)).toBe(true);
    const r = cleanWav(input);
    if (r.kind !== 'cleaned') throw new Error('expected cleaned');
    for (const s of ['SECRET-ARTIST', 'SECRET-ORIGINATOR', 'SECRET-IXML', 'SECRET-TRAILING', 'LIST', 'bext']) expect(contains(r.output, s)).toBe(false);
    expect(contains(r.output, 'smpl')).toBe(true);
    expect([...r.output.slice(-8)]).toEqual(PCM);
    expect(new DataView(r.output.buffer).getUint32(4, true)).toBe(r.output.length - 8);
    expect(selfCheckAudio('wav', r.output)).toBeNull();
  });
  it('is idempotent and byte-stable for an already clean file', () => {
    const clean = makeWav();
    const r = cleanWav(clean);
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.removed).toEqual([]);
    expect([...r.output]).toEqual([...clean]);
  });
  it('replaces odd-length chunk pad bytes with zero', () => {
    const input = makeWav({ oddPad: 5 });
    input[input.length - 1] = 0x7f;
    const r = cleanWav(input);
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.output.length % 2).toBe(0);
    expect(r.output.at(-1)).toBe(0);
    expect([...r.output.slice(-6, -1)]).toEqual(PCM.slice(0, 5));
  });
  it('rejects malformed input and refuses RF64', () => {
    const w = makeWav();
    expect(cleanWav(w.slice(0, 20)).kind).toBe('rejected');
    expect(cleanWav(Uint8Array.from([...'RIFF\0\0\0\0WAVE'].map((c) => c.charCodeAt(0)))).kind).toBe('rejected');
    const bad = w.slice();
    bad[16] = 0xff; // fmt chunk length overflows
    expect(cleanWav(bad).kind).toBe('rejected');
    const rf = w.slice();
    rf.set([...'RF64'].map((c) => c.charCodeAt(0)), 0);
    expect(cleanWav(rf).kind).toBe('unsupported');
  });
  it('rejects a RIFF container that claims bytes missing from the file', () => {
    const w = makeWav();
    new DataView(w.buffer).setUint32(4, w.length + 100, true);
    expect(cleanWav(w).kind).toBe('rejected');
  });
  it('rejects a partial chunk header inside the declared RIFF container', () => {
    const w = makeWav({ trailing: 'abc' });
    new DataView(w.buffer).setUint32(4, w.length - 8, true);
    expect(cleanWav(w).kind).toBe('rejected');
  });
  it('rejects a missing required chunk pad byte', () => {
    const w = makeWav({ oddPad: 5 }).slice(0, -1);
    new DataView(w.buffer).setUint32(4, w.length - 8, true);
    expect(cleanWav(w).kind).toBe('rejected');
  });
  it('rejects every truncation of an untagged WAV', () => {
    const input = makeWav();
    for (let n = 0; n < input.length; n++) expect(cleanWav(input.slice(0, n)).kind, `cut ${n}`).toBe('rejected');
  });
  it('handles many tiny WAV chunks without exhausting the JavaScript argument stack', () => {
    const base = makeWav();
    const count = 130_000;
    const fact = Uint8Array.of(0x66, 0x61, 0x63, 0x74, 4, 0, 0, 0, 4, 0, 0, 0);
    const input = new Uint8Array(base.length + count * fact.length);
    input.set(base.subarray(0, 36)); // RIFF header and fmt chunk
    for (let i = 0; i < count; i++) input.set(fact, 36 + i * fact.length);
    input.set(base.subarray(36), 36 + count * fact.length);
    new DataView(input.buffer).setUint32(4, input.length - 8, true);
    const result = cleanWav(input);
    expect(['cleaned', 'rejected']).toContain(result.kind);
    if (result.kind === 'cleaned') expect(selfCheckAudio('wav', result.output)).toBeNull();
  });
});

describe('MP3 stripping', () => {
  it('removes ID3v2, APEv2 and ID3v1 and leaves exactly the audio frames', () => {
    const input = makeMp3({ id3v2: true, ape: true, id3v1: true });
    for (const s of ['SECRET-TITLE', 'SECRET-APE-ITEM', 'SECRET-V1']) expect(contains(input, s)).toBe(true);
    const r = cleanMp3(input);
    if (r.kind !== 'cleaned') throw new Error('expected cleaned');
    expect([...r.output]).toEqual([...FRAME, ...FRAME]);
    expect(r.removed).toHaveLength(3);
  });
  it('passes a tag-free file through unchanged', () => {
    const r = cleanMp3(makeMp3());
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.removed).toEqual([]);
    expect(r.output.length).toBe(FRAME.length * 2);
  });
  it('preserves mixed MPEG versions and padding using declared frame lengths', () => {
    // Fixed standard Layer III header/length pairs; payload bytes include false sync words.
    const frames = [[0xfb, 0x90, 417], [0xfb, 0x92, 418], [0xf3, 0x80, 208], [0xe3, 0x80, 417]].map(([version, rate, length]) => {
      const frame = new Uint8Array(length!).fill(0xff);
      frame.set([0xff, version!, rate!, 0]);
      return frame;
    });
    const r = cleanMp3(makeMp3({ id3v2: true, ape: true, id3v1: true, frames }));
    expect(r.kind).toBe('cleaned');
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.output).toEqual(Uint8Array.from(frames.flatMap((frame) => [...frame])));
  });
  it('accepts eight leading ID3 tags and rejects a ninth', () => {
    const tag = [73, 68, 51, 3, 0, 0, 0, 0, 0, 0];
    expect(cleanMp3(Uint8Array.from([...Array.from({ length: 8 }, () => tag).flat(), ...FRAME])).kind).toBe('cleaned');
    expect(cleanMp3(Uint8Array.from([...Array.from({ length: 9 }, () => tag).flat(), ...FRAME])).kind).toBe('rejected');
  });
  it('rejects truncated audio frames rather than declaring them cleaned', () => {
    expect(cleanMp3(makeMp3().slice(0, -1)).kind).toBe('rejected');
  });
  it('rejects unrecognised bytes after the audio frames', () => {
    const input = Uint8Array.from([...makeMp3(), ...new TextEncoder().encode('SECRET-TRAILER')]);
    expect(cleanMp3(input).kind).toBe('rejected');
  });
  it('rejects reserved MPEG bitrates and sample rates', () => {
    for (const header of [0xf0, 0x9c]) {
      const input = makeMp3();
      input[2] = header;
      expect(cleanMp3(input).kind).toBe('rejected');
    }
  });
  it('refuses free-format MP3 instead of guessing frame boundaries', () => {
    const input = makeMp3();
    input[2] = 0;
    expect(cleanMp3(input).kind).toBe('unsupported');
  });
  it('rejects unknown ID3 versions instead of guessing their tag layout', () => {
    const input = makeMp3({ id3v2: true });
    input[3] = 5;
    expect(cleanMp3(input).kind).toBe('rejected');
  });
  it('rejects the footer flag on ID3v2.3 where that flag is reserved', () => {
    const tagged = makeMp3({ id3v2: true });
    const tagEnd = tagged.length - FRAME.length * 2;
    const input = Uint8Array.from([...tagged.slice(0, tagEnd), ...new Array<number>(10).fill(0), ...tagged.slice(tagEnd)]);
    input[5] = 0x10;
    expect(cleanMp3(input).kind).toBe('rejected');
  });
  it('checks ID3v2.4 footers instead of silently dropping ten arbitrary bytes', () => {
    const header = [73, 68, 51, 4, 0, 0x10, 0, 0, 0, 0];
    const footer = [51, 68, 73, 4, 0, 0x10, 0, 0, 0, 0];
    expect(cleanMp3(Uint8Array.from([...header, ...footer, ...FRAME])).kind).toBe('cleaned');
    expect(cleanMp3(Uint8Array.from([...header, ...new Array<number>(10).fill(0), ...FRAME])).kind).toBe('rejected');
  });
  it('self-check rejects incomplete frames and bytes outside the audio frames', () => {
    expect(selfCheckAudio('mp3', makeMp3().slice(0, -1))).not.toBeNull();
    expect(selfCheckAudio('mp3', makeMp3({ id3v1: true }))).not.toBeNull();
  });
  it('rejects a truncated tag, non-MP3 data, and an oversized APE length', () => {
    expect(cleanMp3(makeMp3({ id3v2: true }).slice(0, 12)).kind).toBe('rejected');
    expect(cleanMp3(Uint8Array.from([1, 2, 3, 4, 5])).kind).toBe('rejected');
    const ape = makeMp3({ ape: true });
    new DataView(ape.buffer).setUint32(ape.length - 20, 0xfffff, true);
    expect(cleanMp3(ape).kind).toBe('rejected');
  });
  it('keeps tag-like bytes inside the final audio frame as audio', () => {
    const enc = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
    const id3v1Like = Uint8Array.from(FRAME);
    id3v1Like.set(enc('TAG'), FRAME.length - 128);
    // An APEv2-like footer whose declared size is exactly the last frame would otherwise drop that frame.
    const apeLike = Uint8Array.from(FRAME);
    apeLike.set([...enc('APETAGEX'), 0xd0, 7, 0, 0, FRAME.length & 255, FRAME.length >> 8, 0, 0], FRAME.length - 32);
    for (const last of [id3v1Like, apeLike]) {
      const audio = Uint8Array.from([...FRAME, ...last]);
      const bare = cleanMp3(audio);
      expect(bare.kind).toBe('cleaned');
      if (bare.kind !== 'cleaned') throw new Error();
      expect(bare.output).toEqual(audio);
      expect(bare.removed).toEqual([]);
      const tagged = cleanMp3(makeMp3({ id3v2: true, id3v1: true, frames: [Uint8Array.from(FRAME), last] }));
      expect(tagged.kind).toBe('cleaned');
      if (tagged.kind !== 'cleaned') throw new Error();
      expect(tagged.output).toEqual(audio);
      expect(cleanMp3(tagged.output)).toEqual({ kind: 'cleaned', output: audio, removed: [] });
    }
  });
  it('rejects an APE length that consumes every audio frame', () => {
    const input = makeMp3({ ape: true });
    // The footer declares a header, so its stored size excludes those 32 bytes.
    new DataView(input.buffer).setUint32(input.length - 20, input.length - 32, true);
    expect(cleanMp3(input).kind).toBe('rejected');
  });
});

describe('bounded deterministic audio properties (synthetic containers)', () => {
  const seed = 20261024;
  it('preserves varied WAV samples and MP3 frame bytes through cleaning twice', () => {
    fc.assert(fc.property(
      fc.uint8Array({ minLength: 2, maxLength: 256 }).filter((samples) => samples.length % 2 === 0),
      fc.uint8Array({ minLength: 413, maxLength: 413 }),
      fc.record({ id3v2: fc.boolean(), ape: fc.boolean(), id3v1: fc.boolean() }),
      (samples, payload, tags) => {
        const frame = Uint8Array.from([0xff, 0xfb, 0x90, 0, ...payload]);
        for (const [cleaner, input] of [
          [cleanWav, makeWav({ extra: true, trailing: 'SECRET', samples })],
          [cleanMp3, makeMp3({ ...tags, frames: [frame, frame] })],
        ] as const) {
          const before = input.slice();
          const first = cleaner(input);
          expect(first.kind).toBe('cleaned');
          if (first.kind !== 'cleaned') throw new Error();
          expect(input).toEqual(before);
          if (cleaner === cleanWav) {
            expect(first.output.slice(-samples.length)).toEqual(samples);
          } else expect(first.output).toEqual(Uint8Array.from([...frame, ...frame]));
          const second = cleaner(first.output);
          expect(second.kind).toBe('cleaned');
          if (second.kind !== 'cleaned') throw new Error();
          expect(second.output).toEqual(first.output);
          expect(second.removed).toEqual([]);
        }
      },
    ), { seed, numRuns: 200 });
  });

  for (const [format, clean, base] of [
    ['wav', cleanWav, makeWav({ extra: true, trailing: 'SECRET' })],
    ['mp3', cleanMp3, makeMp3({ id3v2: true, ape: true, id3v1: true })],
  ] as const) {
    it(`${format}: mutations return a result and accepted output validates and is stable`, () => {
      fc.assert(fc.property(fc.nat(base.length - 1), fc.uint8Array({ minLength: 1, maxLength: 8 }), (at, patch) => {
        const input = base.slice();
        input.set(patch.subarray(0, input.length - at), at);
        const before = input.slice();
        const result = clean(input);
        expect(input).toEqual(before);
        expect(['cleaned', 'rejected', 'unsupported']).toContain(result.kind);
        if (result.kind === 'cleaned') {
          expect(selfCheckAudio(format, result.output)).toBeNull();
          const again = clean(result.output);
          expect(again.kind).toBe('cleaned');
          if (again.kind !== 'cleaned') throw new Error();
          expect(again.output).toEqual(result.output);
          expect(again.removed).toEqual([]);
        }
      }), { seed, numRuns: 1000 });
    });
  }
});

describe('audio detection and dispatch', () => {
  it('detects WAV and MP3 by magic bytes', () => {
    expect(detectKind(makeWav())).toBe('wav');
    expect(detectKind(makeMp3({ id3v2: true }))).toBe('mp3');
    expect(detectKind(makeMp3())).toBe('mp3');
  });
  it('stripMetadata returns a cleaned Blob with the audio MIME type', async () => {
    const out = await stripMetadata(new Blob([makeWav({ extra: true }) as BlobPart]));
    expect(out.kind).toBe('cleaned');
    if (out.kind === 'cleaned') {
      expect(out.format).toBe('wav');
      expect(out.output.type).toBe('audio/wav');
    }
  });
});

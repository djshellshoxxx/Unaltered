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
    const r = cleanWav(makeWav({ oddPad: 5 }));
    if (r.kind !== 'cleaned') throw new Error();
    expect(r.output.length % 2).toBe(0);
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

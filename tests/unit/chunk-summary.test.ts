import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { cleanWav } from '../../src/core/strip/audio';
import { cleanPng } from '../../src/core/strip/png';
import { chunk, makePng } from '../helpers/images';
import { makeWav } from '../helpers/audio';

const UNKNOWN_COUNT = 2_000;
const idFor = (index: number): string => `X${index.toString(36).padStart(3, '0')}`;
const pngTypeFor = (index: number): string => {
  let suffix = '';
  for (let n = index; n > 0; n = Math.floor(n / 26)) suffix = String.fromCharCode(97 + (n % 26)) + suffix;
  return `a${suffix.padStart(3, 'a')}`;
};

function wavWithUnknownChunks(ids: string[]): Uint8Array {
  const base = makeWav();
  const metadata = concat(...ids.map((id) => concat(
    Uint8Array.from([...id].map((char) => char.charCodeAt(0))),
    Uint8Array.of(0, 0, 0, 0),
  )));
  const input = concat(base.subarray(0, 36), metadata, base.subarray(36));
  new DataView(input.buffer, input.byteOffset, input.byteLength).setUint32(4, input.length - 8, true);
  return input;
}

function pngWithUnknownChunks(types: string[]): Uint8Array {
  const base = makePng();
  const metadata = concat(...types.map((type) => chunk(type)));
  return concat(base.subarray(0, 33), metadata, base.subarray(33));
}

describe('bounded metadata removal summaries', () => {
  it('bounds distinct WAV chunk labels and preserves clean audio bytes', () => {
    const ids = Array.from({ length: UNKNOWN_COUNT }, (_, index) => idFor(index));
    ids.splice(1, 0, ids[0]!); // Repeated unknown names remain deduplicated.
    const result = cleanWav(wavWithUnknownChunks(ids));
    const baseline = cleanWav(makeWav());
    expect(result.kind).toBe('cleaned');
    expect(baseline.kind).toBe('cleaned');
    if (result.kind !== 'cleaned' || baseline.kind !== 'cleaned') throw new Error('Expected valid synthetic WAV.');
    expect(result.removed).toHaveLength(65);
    expect(result.removed.slice(0, 3)).toEqual(['unknown chunk (X000)', 'unknown chunk (X001)', 'unknown chunk (X002)']);
    expect(result.removed.at(-1)).toBe('Additional metadata chunks');
    expect(new Set(result.removed).size).toBe(result.removed.length);
    expect(result.output).toEqual(baseline.output);
  });

  it('bounds distinct PNG chunk labels and preserves clean image bytes', () => {
    const types = Array.from({ length: UNKNOWN_COUNT }, (_, index) => pngTypeFor(index));
    types.splice(1, 0, types[0]!);
    const result = cleanPng(pngWithUnknownChunks(types));
    const baseline = cleanPng(makePng());
    expect(result.kind).toBe('cleaned');
    expect(baseline.kind).toBe('cleaned');
    if (result.kind !== 'cleaned' || baseline.kind !== 'cleaned') throw new Error('Expected valid synthetic PNG.');
    expect(result.removed).toHaveLength(65);
    expect(result.removed.slice(0, 3)).toEqual(['Other data (aaaa)', 'Other data (aaab)', 'Other data (aaac)']);
    expect(result.removed.at(-1)).toBe('Additional metadata chunks');
    expect(new Set(result.removed).size).toBe(result.removed.length);
    expect(result.output).toEqual(baseline.output);
  });

  it('retains known normal-file wording and deduplicates repeated known chunks', () => {
    const base = makeWav();
    const list = Uint8Array.from([...new TextEncoder().encode('LIST'), 0, 0, 0, 0]);
    const input = concat(base.subarray(0, 36), list, list, base.subarray(36));
    new DataView(input.buffer, input.byteOffset, input.byteLength).setUint32(4, input.length - 8, true);
    const result = cleanWav(input);
    expect(result.kind).toBe('cleaned');
    if (result.kind === 'cleaned') expect(result.removed).toEqual(['text tags (LIST)']);

    const png = cleanPng(makePng({ exif: true, text: true }));
    expect(png.kind).toBe('cleaned');
    if (png.kind === 'cleaned') {
      expect(png.removed).toContain('Camera data (EXIF)');
      expect(png.removed).toContain('Text data (may include XMP)');
    }
  });
});

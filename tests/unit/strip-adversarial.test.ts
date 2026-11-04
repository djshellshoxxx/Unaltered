// Adversarial parser review 2026-11-04: each block reproduces a defect on 583aca4 and guards its fix.
import { describe, expect, it } from 'vitest';
import { cleanMp3 } from '../../src/core/strip/audio';
import { apeTag, FRAME } from '../helpers/audio';

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

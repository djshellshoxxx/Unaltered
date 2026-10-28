import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as codec from '../../src/core/ots/codec';
import { UnalteredError } from '../../src/core/errors';
import { runCase, seedCases, TARGETS } from '../fuzz/targets';

const proof = (name: string): Uint8Array => new Uint8Array(readFileSync(join('tests/fixtures/ots', name)));

describe('parser fuzz targets', () => {
  const seeds = seedCases([
    proof('pending.ots'),
    proof('confirmed.ots'),
    proof('batch0.ots'),
    proof('litecoin.ots'),
  ]);

  it('exposes the four intended parser targets and both valid and hostile seeds', () => {
    expect(TARGETS).toEqual(['proof', 'timestamp', 'jpeg', 'png']);
    for (const target of TARGETS) {
      const targetSeeds = seeds.filter((seed) => seed.target === target);
      expect(targetSeeds.length, target).toBeGreaterThan(0);
      expect(targetSeeds.some((seed) => runCase(target, seed.bytes) === 'accepted'), `${target} accepted seed`).toBe(true);
      expect(targetSeeds.some((seed) => runCase(target, seed.bytes) === 'rejected'), `${target} rejected seed`).toBe(true);
      expect(new Set(targetSeeds.map((seed) => seed.label)).size).toBe(targetSeeds.length);
    }
  });

  it('reports fixture outcomes without hiding unsupported or malformed inputs', () => {
    const outcomeByLabel = new Map(seeds.map((seed) => [seed.label, runCase(seed.target, seed.bytes)]));
    expect(outcomeByLabel.get('proof-0-input')).toBe('accepted');
    expect(outcomeByLabel.get('proof-0-truncated')).toBe('rejected');
    expect(outcomeByLabel.get('timestamp-0-valid')).toBe('accepted');
    expect(outcomeByLabel.get('timestamp-0-unknown-tag')).toBe('rejected');
    expect(outcomeByLabel.get('jpeg-metadata-valid')).toBe('accepted');
    expect(outcomeByLabel.get('jpeg-truncated')).toBe('rejected');
    expect(outcomeByLabel.get('jpeg-unsupported-arithmetic')).toBe('rejected');
    expect(outcomeByLabel.get('png-metadata-valid')).toBe('accepted');
    expect(outcomeByLabel.get('png-bad-crc')).toBe('rejected');
    expect(outcomeByLabel.get('png-unsupported-apng')).toBe('rejected');
  });

  it('keeps unsupported proof inputs as seeds without deriving timestamp bodies', () => {
    expect(seeds.some((seed) => seed.label === 'proof-3-input' && seed.target === 'proof')).toBe(true);
    expect(runCase('proof', seeds.find((seed) => seed.label === 'proof-3-input')!.bytes)).toBe('rejected');
    expect(seeds.some((seed) => seed.label.startsWith('timestamp-3-'))).toBe(false);
  });

  it('surfaces typed serializer failures after a proof has parsed', () => {
    const failure = new UnalteredError('PROOF_MALFORMED', 'oracle fault');
    const serializer = vi.spyOn(codec, 'serializeProof').mockImplementation(() => { throw failure; });
    try {
      expect(() => runCase('proof', proof('confirmed.ots'))).toThrow(failure);
    } finally {
      serializer.mockRestore();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { parseHash } from '../../src/ui/router';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe('router hostile input (FR-11)', () => {
  it('handles multi-megabyte fragments quickly and without a match', () => {
    const t0 = Date.now();
    expect(parseHash('#' + '&'.repeat(3_000_000))).toEqual({ view: 'stamp', h: null });
    expect(parseHash('#h=' + 'a'.repeat(3_000_000))).toEqual({ view: 'stamp', h: null });
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('rejects near-misses of a fingerprint', () => {
    for (const bad of [`h=${A}0`, `h=${A.slice(1)}`, `h=${A}%0a`, `h=${'g'.repeat(64)}`, `H=${A}`, `h =${A}`, `h=${A} `]) expect(parseHash(`#${bad}`).h, bad).toBeNull();
  });
  it('does not pick one of two conflicting fingerprints', () => {
    expect(parseHash(`#h=${A}&h=${B}`).h).toBeNull();
    expect(parseHash(`#h=${A}&h=${A.toUpperCase()}`).h).toBe(A);
  });
  it('ignores prototype-ish tokens', () => {
    expect(parseHash('#__proto__&constructor').view).toBe('stamp');
  });
});

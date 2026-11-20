import { describe, expect, it, vi } from 'vitest';
import { stampBatch, type StampConfig } from '../../src/core/ots/calendar';
import { parseProof } from '../../src/core/ots/codec';
import { calendar, routerFetch } from '../helpers/chain';

const ALICE = 'https://alice.btc.calendar.opentimestamps.org';
const digests = (count: number): Uint8Array[] => Array.from({ length: count }, (_, i) => new Uint8Array(32).fill(i));
const config = (): StampConfig => ({
  calendars: [ALICE], minAccepted: 1,
  randomBytes: vi.fn((n: number) => new Uint8Array(n)),
  net: { fetchImpl: vi.fn(routerFetch(calendar(new URL(ALICE).host))) },
});

describe('stamp batch resource bound', () => {
  it('rejects more than 50 files before nonce generation or calendar access', async () => {
    const cfg = config();
    await expect(stampBatch(digests(51), cfg)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
    expect(cfg.randomBytes).not.toHaveBeenCalled();
    expect(cfg.net!.fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts the 50-file boundary and preserves the input-to-receipt association', async () => {
    const selected = digests(50);
    const cfg = config();
    const result = await stampBatch(selected, cfg);
    expect(result.proofs).toHaveLength(50);
    expect(result.proofs.map((proof) => parseProof(proof).digest)).toEqual(selected);
    expect(cfg.net!.fetchImpl).toHaveBeenCalledOnce();
  });
});

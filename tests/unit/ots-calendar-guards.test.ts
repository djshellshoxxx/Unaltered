// FR-4: a stamp succeeds only when at least M distinct calendars accept (M configurable, never below 1).
// Synthetic calendars only; no network.
import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MIN_CALENDARS } from '../../src/core/net/allowlist';
import { calendarsOf, stampBatch, type StampConfig } from '../../src/core/ots/calendar';
import { calendar, routerFetch, type Handler } from '../helpers/chain';

const digest = sha256(new TextEncoder().encode('calendar guards fixture'));
const ALICE = 'https://alice.btc.calendar.opentimestamps.org';
const BOB = 'https://bob.btc.calendar.opentimestamps.org';
const FINNEY = 'https://finney.calendar.eternitywall.com';
const CAL = [ALICE, BOB, FINNEY];
const hostOf = (u: string): string => new URL(u).host;

const cfgWith = (fetchImpl: typeof fetch, over: Partial<StampConfig> = {}): StampConfig => ({
  calendars: CAL,
  minAccepted: 2,
  net: { fetchImpl },
  randomBytes: (n) => new Uint8Array(n).fill(7),
  ...over,
});

/** Calendars in `up` accept; every other default calendar answers 503. Counts POSTs per host. */
function calendarsUp(up: readonly string[], posts: Map<string, number> = new Map()): typeof fetch {
  const handlers: Handler[] = CAL.map((u) => {
    const h = calendar(hostOf(u), up.includes(u) ? {} : { status: 503 });
    return (url, init) => {
      if (url.host === hostOf(u) && url.pathname === '/digest') posts.set(url.host, (posts.get(url.host) ?? 0) + 1);
      return h(url, init);
    };
  });
  return routerFetch(...handlers);
}

describe('stampBatch counts each calendar once (FR-4)', () => {
  for (const twin of [`${ALICE}/`, `${ALICE}//`, 'https://ALICE.btc.calendar.opentimestamps.org', 'https://Alice.Btc.Calendar.OpenTimestamps.org/']) {
    it(`refuses M=2 when only alice accepts and is listed again as ${twin}`, async () => {
      const f = calendarsUp([ALICE]);
      const r = stampBatch([digest], cfgWith(f, { calendars: [ALICE, twin], minAccepted: 2 }));
      await expect(r).rejects.toMatchObject({ code: 'NET_FAILED' });
    });
  }

  it('contacts a calendar listed twice only once and still succeeds with two distinct calendars', async () => {
    const posts = new Map<string, number>();
    const f = calendarsUp([ALICE, BOB], posts);
    const r = await stampBatch([digest], cfgWith(f, { calendars: [ALICE, `${ALICE}/`, 'https://ALICE.btc.calendar.opentimestamps.org', BOB], minAccepted: 2 }));
    expect(posts.get(hostOf(ALICE))).toBe(1);
    expect(posts.get(hostOf(BOB))).toBe(1);
    expect(r.calendars.map((c) => c.url)).toEqual([ALICE, BOB]);
    expect(r.calendars.every((c) => c.ok)).toBe(true);
  });

  it('reports one entry per distinct calendar when the duplicates fail', async () => {
    const f = calendarsUp([ALICE]);
    const err = await stampBatch([digest], cfgWith(f, { calendars: [ALICE, `${ALICE}/`, BOB, `${BOB}/`], minAccepted: 2 })).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'NET_FAILED' });
    expect(calendarsOf(err)?.map((c) => [c.url, c.ok])).toEqual([
      [ALICE, true],
      [BOB, false],
    ]);
  });
});

describe('stampBatch acceptance minimum cannot be switched off (FR-4)', () => {
  for (const minAccepted of [Number.NaN, undefined as unknown as number, 'two' as unknown as number]) {
    it(`fails closed when no calendar accepts and minAccepted is ${String(minAccepted)}`, async () => {
      const r = stampBatch([digest], cfgWith(calendarsUp([]), { minAccepted }));
      await expect(r).rejects.toMatchObject({ code: 'NET_FAILED' });
    });

    it(`falls back to the default of ${DEFAULT_MIN_CALENDARS} when minAccepted is ${String(minAccepted)}`, async () => {
      await expect(stampBatch([digest], cfgWith(calendarsUp([ALICE]), { minAccepted }))).rejects.toMatchObject({ code: 'NET_FAILED' });
      await expect(stampBatch([digest], cfgWith(calendarsUp([ALICE, BOB]), { minAccepted }))).resolves.toBeDefined();
    });
  }

  for (const minAccepted of [0, -1, Number.NEGATIVE_INFINITY, 0.5]) {
    it(`never drops below one accepting calendar when minAccepted is ${String(minAccepted)}`, async () => {
      await expect(stampBatch([digest], cfgWith(calendarsUp([]), { minAccepted }))).rejects.toMatchObject({ code: 'NET_FAILED' });
      await expect(stampBatch([digest], cfgWith(calendarsUp([ALICE]), { minAccepted }))).resolves.toBeDefined();
    });
  }

  it('rounds a fractional minimum up', async () => {
    await expect(stampBatch([digest], cfgWith(calendarsUp([ALICE]), { minAccepted: 1.5 }))).rejects.toMatchObject({ code: 'NET_FAILED' });
    await expect(stampBatch([digest], cfgWith(calendarsUp([ALICE, BOB]), { minAccepted: 1.5 }))).resolves.toBeDefined();
  });
});

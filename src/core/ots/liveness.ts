// Calendar liveness canary (ADR-014, risk R1). A browser cannot read a calendar's pending `404` because it carries no
// Access-Control-Allow-Origin, so an unreadable pending lookup looks exactly like an outage. A completed commitment is
// answered with `200` and `Access-Control-Allow-Origin: *`, which the browser can read. Asking each calendar for one
// fixed, public, long-confirmed commitment therefore separates "this calendar is reachable from this browser" from
// "this calendar is unreachable or blocked". The answer is a hint about the calendar only: it never changes a receipt,
// is never merged into one, and never says that the user's receipt is pending or confirmed.
import { fromHex } from '../bytes';
import { UnalteredError } from '../errors';
import { netFetch, type NetPolicy } from '../net/fetch';
import { collectAttestations, parseTimestampBody } from './codec';

/**
 * reachable: the canary reply was read and parsed as the recorded completed timestamp.
 * unreachable: the canary could not be read either (transport failure, CORS block or timeout).
 * unknown: no canary is recorded for this calendar, or the reply was readable but not the expected timestamp.
 */
export type CalendarLiveness = 'reachable' | 'unreachable' | 'unknown';

export interface LivenessCanary {
  /** Calendar base URL, exactly as in DEFAULT_CALENDARS. */
  readonly base: string;
  /** Lowercase hex commitment this calendar has answered with a complete, browser-readable timestamp. */
  readonly commitment: string;
  /** Bitcoin block height of the attestation in that recorded reply. */
  readonly height: number;
}

// Public commitments from upstream example receipts (LGPL-3.0-or-later; only these hex strings are used, no file or
// receipt contents). Each is the pending commitment that calendar itself issued, so another calendar does not know it.
// Evidence: docs/evidence/r1-targets-20261105.json (Bob, Finney; Alice commitment in initialSameCommitmentProbe) and
// docs/evidence/browser-20261105-network.json (Alice confirmed upgrade: browser GET 200, ACAO *). tests/unit/
// ots-upgrade-liveness.test.ts binds this table to that evidence.
export const LIVENESS_CANARIES: readonly LivenessCanary[] = [
  {
    // opentimestamps-client examples/incomplete.txt.ots (sha256 95673f28…), the R1_ACCEPTANCE.md receipt.
    base: 'https://alice.btc.calendar.opentimestamps.org',
    commitment: '57cfa5c46716df9bd9e83595bce439c58108d8fcc1678f30d4c6731c3f1fa6c79ed712c66fb1ac8d4e4eb0e7',
    height: 428648,
  },
  {
    // opentimestamps-client examples/two-calendars.txt.ots (sha256 1f0fe002…), Bob branch.
    base: 'https://bob.btc.calendar.opentimestamps.org',
    commitment: '57d4651676e9ac3b3b57c1584828ea5162979c96483a03c87c69a1b8614d1cbaf387e0f5647b90ea1b270a97',
    height: 429355,
  },
  {
    // javascript-opentimestamps examples/osdsp.txt.ots (sha256 080ccfea…), Finney branch.
    base: 'https://finney.calendar.eternitywall.com',
    commitment: '5affdc4e9ca8db900367fd8d74967d67d57dbad0f3cdc715d217dfd5d07a4dbb1eacec03384e62331c930912',
    height: 523367,
  },
];

const ACCEPT = { Accept: 'application/vnd.opentimestamps.v1' };

function sameBase(a: string, b: string): boolean {
  try {
    return new URL(a).href.replace(/\/+$/, '') === new URL(b).href.replace(/\/+$/, '');
  } catch {
    return false;
  }
}

/** The recorded canary for a calendar base URL, if the evidence supports one. */
export function canaryFor(base: string): LivenessCanary | undefined {
  return LIVENESS_CANARIES.find((c) => sameBase(c.base, base));
}

export interface LivenessConfig {
  net?: Partial<NetPolicy> | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * One canary lookup through the same allowlisted, bounded transport and parser as an upgrade. Fails closed: anything
 * but the recorded completed timestamp is `unknown`. Throws only UnalteredError('ABORTED') on cancellation.
 */
export async function probeLiveness(base: string, cfg: LivenessConfig = {}): Promise<CalendarLiveness> {
  const canary = canaryFor(base);
  if (!canary) return 'unknown';
  let res;
  try {
    res = await netFetch(`${canary.base}/timestamp/${canary.commitment}`, { headers: ACCEPT, signal: cfg.signal }, cfg.net);
  } catch (e) {
    if (e instanceof UnalteredError && e.code === 'ABORTED') throw e;
    if (e instanceof UnalteredError && (e.code === 'NET_FAILED' || e.code === 'NET_TIMEOUT')) return 'unreachable';
    return 'unknown';
  }
  if (res.status !== 200) return 'unknown';
  try {
    const tree = parseTimestampBody(res.bytes, fromHex(canary.commitment));
    const anchored = collectAttestations(tree).some((l) => l.attestation.kind === 'bitcoin' && l.attestation.height === canary.height);
    return anchored ? 'reachable' : 'unknown';
  } catch {
    return 'unknown';
  }
}

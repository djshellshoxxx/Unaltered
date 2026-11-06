// Research-only candidates from the pinned official client/website sources in the adjacent evidence record.
// This does not extend the application's network allowlist or CSP.
import { collectAttestations, parseTimestampBody } from '../src/core/ots/codec';
import { toHex } from '../src/core/bytes';

export const RESEARCH_CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
  'https://ots.btc.catallaxy.com',
] as const;

export function pendingRequests(body: Uint8Array, submitted: Uint8Array): { origin: string; commitmentHex: string }[] {
  const leaves = collectAttestations(parseTimestampBody(body, submitted));
  const pending = leaves.filter((leaf) => leaf.attestation.kind === 'pending');
  if (pending.length === 0 || pending.length > 4) throw new Error('Submission needs between one and four pending attestations.');
  const unique = new Map<string, { origin: string; commitmentHex: string }>();
  for (const leaf of pending) {
    if (leaf.attestation.kind !== 'pending') continue;
    const url = new URL(leaf.attestation.uri);
    if (!(RESEARCH_CALENDARS as readonly string[]).includes(url.origin)
      || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || (url.pathname !== '' && url.pathname !== '/')) throw new Error('Pending calendar is outside the documented research policy.');
    const commitmentHex = toHex(leaf.node.msg);
    unique.set(`${url.origin}/${commitmentHex}`, { origin: url.origin, commitmentHex });
  }
  return [...unique.values()];
}

export function classifyReply(status: number, bytes: Uint8Array, commitment: Uint8Array): string {
  if (status === 404) return 'READABLE_404';
  if (status !== 200) return 'HTTP_ERROR';
  try {
    const attestations = collectAttestations(parseTimestampBody(bytes, commitment));
    if (attestations.some((leaf) => leaf.attestation.kind === 'bitcoin')) return 'BITCOIN_DATA_UNVERIFIED';
    return attestations.some((leaf) => leaf.attestation.kind === 'pending') ? 'READABLE_PENDING_TREE' : 'INVALID_REPLY';
  } catch {
    return 'INVALID_REPLY';
  }
}

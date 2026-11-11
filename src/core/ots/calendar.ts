// Calendar client: stamp (FR-4, FR-10) and upgrade (FR-6). Follows otsclient/cmds.py and
// opentimestamps/calendar.py: per-file 16-byte nonce, sha256(digest||nonce), merkle tree over files,
// POST <cal>/digest, GET <cal>/timestamp/<hex commitment>.
import { toHex } from '../bytes';
import { UnalteredError, safeMessage } from '../errors';
import { DEFAULT_CALENDARS, DEFAULT_MIN_CALENDARS } from '../net/allowlist';
import { netFetch, type NetPolicy } from '../net/fetch';
import { collectAttestations, mergeTree, mergeTrees, parseProof, parseTimestampBody, serializeProof, type Leaf } from './codec';
import { applyOp } from './ops';
import type { DetachedProof, Op, ProofStatus, TsNode } from './types';

export interface StampConfig {
  /** Calendar base URLs. Every host must also be on the network allowlist. */
  calendars: readonly string[];
  /** Minimum number of calendars that must accept (never below 1; NaN or non-numeric means DEFAULT_MIN_CALENDARS). */
  minAccepted: number;
  net?: Partial<NetPolicy>;
  signal?: AbortSignal | undefined;
  /** Test seam; production uses crypto.getRandomValues. */
  randomBytes?: (n: number) => Uint8Array;
}

export const defaultStampConfig = (): StampConfig => ({ calendars: DEFAULT_CALENDARS, minAccepted: DEFAULT_MIN_CALENDARS });

export interface CalendarResult {
  url: string;
  ok: boolean;
  error?: string;
  /**
   * Upgrade only: the browser could not read the calendar's reply. A cross-origin 404 for a pending lookup has no
   * Access-Control-Allow-Origin, so it is indistinguishable here from an outage. Not a confirmation either way.
   */
  unreadable?: boolean;
}

export interface StampResult {
  ots: Uint8Array;
  calendars: CalendarResult[];
}

export interface BatchStampResult {
  proofs: Uint8Array[];
  calendars: CalendarResult[];
}

const ACCEPT = { Accept: 'application/vnd.opentimestamps.v1' };

function normBase(u: string): string {
  try {
    // URL identity folds host/scheme case and the default HTTPS port, while retaining the selected path.
    // Network policy still rejects credentials, insecure schemes and non-default ports before any request.
    return new URL(u).href.replace(/\/+$/, '');
  } catch {
    return u.replace(/\/+$/, '');
  }
}

/**
 * Identity for counting accepting calendars (FR-4): the host, as for the explorer quorum, so a trailing slash or a
 * change of case cannot make one calendar count twice. An unparseable entry keeps its own identity and fails at fetch.
 */
function calendarId(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return `raw:${normBase(u)}`;
  }
}

function nonce16(cfg: StampConfig): Uint8Array {
  if (cfg.randomBytes) return cfg.randomBytes(16);
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** catsha256 from python-opentimestamps: both children converge on one shared sha256 node. */
function catSha256(left: TsNode, right: TsNode): TsNode {
  const leftAppend = sha256Child(left, { kind: 'append', arg: right.msg });
  const rightPrepend = sha256Child(right, { kind: 'prepend', arg: left.msg });
  const shared = sha256Child(leftAppend, { kind: 'sha256' });
  rightPrepend.children.push({ op: { kind: 'sha256' }, node: shared });
  return shared;
}

function sha256Child(parent: TsNode, op: Op): TsNode {
  const node: TsNode = { msg: applyOp(op, parent.msg), attestations: [], children: [] };
  parent.children.push({ op, node });
  return node;
}

function merkleTip(leaves: TsNode[]): TsNode {
  let level = leaves;
  while (level.length > 1) {
    const next: TsNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = level[i + 1];
      next.push(r ? catSha256(l, r) : l);
    }
    level = next;
  }
  return level[0]!;
}

export async function stampBatch(digests: Uint8Array[], cfg: StampConfig): Promise<BatchStampResult> {
  if (digests.length === 0) throw new UnalteredError('INPUT_INVALID', 'Nothing to stamp.');
  if (digests.some((d) => d.length !== 32)) throw new UnalteredError('INPUT_INVALID', 'A fingerprint has the wrong length.');
  if (cfg.calendars.length === 0) throw new UnalteredError('INPUT_INVALID', 'No calendar servers are selected.');
  // FR-4: never below one, rounded up. NaN would make `accepted < need` always false, so it falls back to the default M.
  const asked = Math.ceil(Number(cfg.minAccepted));
  const need = Number.isNaN(asked) ? DEFAULT_MIN_CALENDARS : Math.max(1, asked);

  const roots: TsNode[] = digests.map((d) => ({ msg: d, attestations: [], children: [] }));
  const leaves = roots.map((root) => {
    const n = sha256Child(root, { kind: 'append', arg: nonce16(cfg) });
    return sha256Child(n, { kind: 'sha256' });
  });
  const tip = merkleTip(leaves);

  const distinct = new Map<string, string>();
  for (const c of cfg.calendars) if (!distinct.has(calendarId(c))) distinct.set(calendarId(c), normBase(c));

  const results: CalendarResult[] = await Promise.all(
    [...distinct.values()].map(async (b): Promise<CalendarResult> => {
      try {
        const res = await netFetch(`${b}/digest`, { method: 'POST', body: tip.msg, headers: ACCEPT, signal: cfg.signal }, cfg.net);
        if (res.status !== 200) throw new UnalteredError('NET_HTTP', `The server answered with status ${res.status}.`);
        const ts = parseTimestampBody(res.bytes, tip.msg);
        if (ts.attestations.length === 0 && ts.children.length === 0) throw new UnalteredError('PROOF_MALFORMED', 'The server sent an empty answer.');
        mergeTree(tip, ts, () => {
          roots.forEach((root, i) => serializeProof({ digest: digests[i]!, root }));
        });
        return { url: b, ok: true };
      } catch (e) {
        if (e instanceof UnalteredError && e.code === 'ABORTED') throw e;
        return { url: b, ok: false, error: safeMessage(e) };
      }
    }),
  );
  const accepted = results.filter((r) => r.ok).length;
  if (accepted < need) {
    const err = new UnalteredError('NET_FAILED', `Only ${accepted} of the ${need} required calendar servers accepted the fingerprint.`);
    (err as UnalteredError & { calendars?: CalendarResult[] }).calendars = results;
    throw err;
  }
  const proofs = roots.map((root, i) => serializeProof({ digest: digests[i]!, root }));
  return { proofs, calendars: results };
}

export async function stamp(digest: Uint8Array, cfg: StampConfig): Promise<StampResult> {
  const r = await stampBatch([digest], cfg);
  return { ots: r.proofs[0]!, calendars: r.calendars };
}

export function calendarsOf(err: unknown): CalendarResult[] | undefined {
  return (err as { calendars?: CalendarResult[] } | null)?.calendars;
}

export function proofStatus(proof: DetachedProof): ProofStatus {
  return collectAttestations(proof.root).some((l) => l.attestation.kind === 'bitcoin') ? 'bitcoin-confirmed' : 'pending';
}

export interface UpgradeResult {
  ots: Uint8Array;
  changed: boolean;
  status: ProofStatus;
  /** Pending calendars that are not on the allowlist and so were not contacted. */
  unknownCalendars: string[];
  calendars: CalendarResult[];
}

export async function upgrade(ots: Uint8Array, cfg: StampConfig): Promise<UpgradeResult> {
  const proof = parseProof(ots);
  const allowed = new Set(cfg.calendars.map(normBase));
  // Share transport for equal lookups while retaining every target node and equivalent URI spelling.
  const pendings = new Map<string, { base: string; msg: Uint8Array; leaves: Leaf[] }>();
  for (const l of collectAttestations(proof.root)) {
    if (l.attestation.kind !== 'pending') continue;
    const base = normBase(l.attestation.uri);
    const key = `${base} ${toHex(l.node.msg)}`;
    const group = pendings.get(key);
    if (group) group.leaves.push(l);
    else pendings.set(key, { base, msg: l.node.msg, leaves: [l] });
  }
  const unknown = new Set<string>();
  const calendars: CalendarResult[] = [];

  await Promise.all(
    [...pendings.values()].map(async ({ base, msg, leaves }) => {
      if (!allowed.has(base)) {
        unknown.add(base);
        return;
      }
      try {
        const res = await netFetch(`${base}/timestamp/${toHex(msg)}`, { headers: ACCEPT, signal: cfg.signal }, cfg.net);
        if (res.status === 404) {
          calendars.push({ url: base, ok: true, error: 'Not yet confirmed.' });
          return;
        }
        if (res.status !== 200) throw new UnalteredError('NET_HTTP', `The server answered with status ${res.status}.`);
        const ts = parseTimestampBody(res.bytes, msg);
        const got = collectAttestations(ts);
        if (got.length === 0) throw new UnalteredError('PROOF_MALFORMED', 'The server sent an empty answer.');
        const nodes = [...new Set(leaves.map((l) => l.node))];
        mergeTrees(nodes.map((node) => [node, ts] as const), () => {
          for (const { node, attestation } of leaves) {
            if (attestation.kind !== 'pending') continue;
            const sameOnly = got.every((g) => g.attestation.kind === 'pending' && g.attestation.uri === attestation.uri);
            if (!sameOnly) node.attestations = node.attestations.filter((a) => a !== attestation);
          }
          serializeProof(proof); // Includes the whole original proof, not only this pending commitment.
        });
        calendars.push({ url: base, ok: true });
      } catch (e) {
        if (e instanceof UnalteredError && e.code === 'ABORTED') throw e;
        const unreadable = e instanceof UnalteredError && e.code === 'NET_FAILED';
        calendars.push(unreadable ? { url: base, ok: false, error: safeMessage(e), unreadable } : { url: base, ok: false, error: safeMessage(e) });
      }
    }),
  );

  // Compare against the canonical re-serialisation of the input so a receipt written by another tool with a different
  // (but equivalent) ordering is not reported as changed.
  const before = toHex(serializeProof(parseProof(ots)));
  const out = serializeProof(proof);
  const changed = toHex(out) !== before;
  return { ots: out, changed, status: proofStatus(proof), unknownCalendars: [...unknown], calendars };
}


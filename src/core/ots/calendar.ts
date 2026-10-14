// Calendar client: stamp (FR-4, FR-10) and upgrade (FR-6). Follows otsclient/cmds.py and
// opentimestamps/calendar.py: per-file 16-byte nonce, sha256(digest||nonce), merkle tree over files,
// POST <cal>/digest, GET <cal>/timestamp/<hex commitment>.
import { toHex } from '../bytes';
import { UnalteredError, safeMessage } from '../errors';
import { DEFAULT_CALENDARS, DEFAULT_MIN_CALENDARS } from '../net/allowlist';
import { netFetch, type NetPolicy } from '../net/fetch';
import { collectAttestations, mergeTree, parseProof, parseTimestampBody, serializeProof } from './codec';
import { applyOp } from './ops';
import type { DetachedProof, Op, ProofStatus, TsNode } from './types';

export interface StampConfig {
  /** Calendar base URLs. Every host must also be on the network allowlist. */
  calendars: readonly string[];
  /** Minimum number of calendars that must accept (never below 1). */
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
  return u.replace(/\/+$/, '');
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
  const need = Math.max(1, cfg.minAccepted);

  const roots: TsNode[] = digests.map((d) => ({ msg: d, attestations: [], children: [] }));
  const leaves = roots.map((root) => {
    const n = sha256Child(root, { kind: 'append', arg: nonce16(cfg) });
    return sha256Child(n, { kind: 'sha256' });
  });
  const tip = merkleTip(leaves);

  const results: CalendarResult[] = await Promise.all(
    cfg.calendars.map(async (base): Promise<CalendarResult> => {
      const b = normBase(base);
      try {
        const res = await netFetch(`${b}/digest`, { method: 'POST', body: tip.msg, headers: ACCEPT, signal: cfg.signal }, cfg.net);
        if (res.status !== 200) throw new UnalteredError('NET_HTTP', `The server answered with status ${res.status}.`);
        const ts = parseTimestampBody(res.bytes, tip.msg);
        if (ts.attestations.length === 0 && ts.children.length === 0) throw new UnalteredError('PROOF_MALFORMED', 'The server sent an empty answer.');
        mergeTree(tip, ts);
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
  const seenPending = new Set<string>();
  const pendings = collectAttestations(proof.root).filter((l) => {
    if (l.attestation.kind !== 'pending') return false;
    const key = `${normBase(l.attestation.uri)} ${toHex(l.node.msg)}`;
    if (seenPending.has(key)) return false;
    seenPending.add(key);
    return true;
  });
  const unknown = new Set<string>();
  const calendars: CalendarResult[] = [];

  await Promise.all(
    pendings.map(async ({ node, attestation }) => {
      if (attestation.kind !== 'pending') return;
      const base = normBase(attestation.uri);
      if (!allowed.has(base)) {
        unknown.add(base);
        return;
      }
      try {
        const res = await netFetch(`${base}/timestamp/${toHex(node.msg)}`, { headers: ACCEPT, signal: cfg.signal }, cfg.net);
        if (res.status === 404) {
          calendars.push({ url: base, ok: true, error: 'Not yet confirmed.' });
          return;
        }
        if (res.status !== 200) throw new UnalteredError('NET_HTTP', `The server answered with status ${res.status}.`);
        const ts = parseTimestampBody(res.bytes, node.msg);
        const got = collectAttestations(ts);
        if (got.length === 0) throw new UnalteredError('PROOF_MALFORMED', 'The server sent an empty answer.');
        const sameOnly = got.every((g) => g.attestation.kind === 'pending' && g.attestation.uri === attestation.uri);
        mergeTree(node, ts);
        if (!sameOnly) node.attestations = node.attestations.filter((a) => a !== attestation);
        calendars.push({ url: base, ok: true });
      } catch (e) {
        if (e instanceof UnalteredError && e.code === 'ABORTED') throw e;
        calendars.push({ url: base, ok: false, error: safeMessage(e) });
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


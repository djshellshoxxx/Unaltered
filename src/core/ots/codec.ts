// Parse / serialise OpenTimestamps `.ots` files. Treats all input as hostile (SPEC section 6, SR-9):
// size cap, node cap, depth cap, iterative traversal, bounds-checked lengths, unknown tags rejected.
import { compareBytes, concat, concatParts, equalBytes, Reader, toHex, writeVaruint } from '../bytes';
import { UnalteredError } from '../errors';
import { applyOp, compareOps, opTag } from './ops';
import {
  ATT_BITCOIN,
  ATT_PENDING,
  ATTS_KNOWN_UNSUPPORTED,
  HEADER_MAGIC,
  LIMITS,
  MAJOR_VERSION,
  TAG_ATTESTATION,
  TAG_MORE,
  TAG_SHA256,
  TAGS_KNOWN_UNSUPPORTED,
  type Attestation,
  type DetachedProof,
  type Op,
  type TsNode,
} from './types';

const malformed = (m: string): never => {
  throw new UnalteredError('PROOF_MALFORMED', m);
};

function readOp(r: Reader, tag: number): Op {
  if (tag === TAG_SHA256) return { kind: 'sha256' };
  if (tag === 0xf0 || tag === 0xf1) {
    const arg = r.varbytes(LIMITS.maxOpArg, 1);
    return { kind: tag === 0xf0 ? 'append' : 'prepend', arg: arg.slice() };
  }
  if (TAGS_KNOWN_UNSUPPORTED.has(tag)) {
    throw new UnalteredError('PROOF_UNSUPPORTED', 'This receipt uses an operation this version does not support.');
  }
  return malformed('The receipt contains an unknown operation.');
}

function readAttestation(r: Reader): Attestation {
  const tag = r.bytes(8);
  const payload = new Reader(r.varbytes(LIMITS.maxAttPayload), 'PROOF_MALFORMED');
  if (equalBytes(tag, ATT_BITCOIN)) {
    const height = payload.varuint();
    if (!payload.eof()) malformed('Trailing data in an attestation.');
    return { kind: 'bitcoin', height };
  }
  if (equalBytes(tag, ATT_PENDING)) {
    const raw = payload.varbytes(LIMITS.maxUri);
    if (!payload.eof()) malformed('Trailing data in an attestation.');
    // Mirrors python PendingAttestation.check_uri: restricted charset keeps URIs inert.
    let uri: string;
    try {
      uri = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    } catch {
      return malformed('The receipt names an invalid calendar address.');
    }
    if (!/^[a-zA-Z0-9.\-_/:]+$/.test(uri)) malformed('The receipt names an invalid calendar address.');
    return { kind: 'pending', uri };
  }
  for (const k of ATTS_KNOWN_UNSUPPORTED) {
    if (equalBytes(tag, k.tag)) throw new UnalteredError('PROOF_UNSUPPORTED', `This receipt contains a ${k.name} attestation, which this version does not support.`);
  }
  return malformed('The receipt contains an unknown attestation type.');
}

/** Parse a timestamp tree (no file header) whose root message is `rootMsg`. Reads to the end of `r`'s current subtree. */
export function readTimestampTree(r: Reader, rootMsg: Uint8Array): TsNode {
  const root: TsNode = { msg: rootMsg, attestations: [], children: [] };
  interface Frame {
    node: TsNode;
    lastItem: boolean;
  }
  const stack: Frame[] = [{ node: root, lastItem: false }];
  let nodes = 1;
  let attestations = 0;
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    let tag = r.u8();
    let last = true;
    if (tag === TAG_MORE) {
      last = false;
      tag = r.u8();
    }
    if (tag === TAG_ATTESTATION) {
      if (++attestations > LIMITS.maxAttestations) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt contains too many attestations.');
      frame.node.attestations.push(readAttestation(r));
      let complete = last;
      while (complete) {
        stack.pop();
        if (stack.length === 0) break;
        complete = stack[stack.length - 1]!.lastItem;
      }
    } else {
      const op = readOp(r, tag);
      let msg: Uint8Array;
      try {
        msg = applyOp(op, frame.node.msg);
      } catch (e) {
        if (e instanceof UnalteredError) throw e;
        return malformed('Invalid operation in the receipt.');
      }
      if (++nodes > LIMITS.maxNodes) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt is too complex.');
      if (stack.length >= LIMITS.maxDepth) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt is nested too deeply.');
      const child: TsNode = { msg, attestations: [], children: [] };
      frame.node.children.push({ op, node: child });
      frame.lastItem = last;
      stack.push({ node: child, lastItem: false });
    }
  }
  return root;
}

/** Parse a bare timestamp body as returned by a calendar. Rejects trailing bytes. */
export function parseTimestampBody(bytes: Uint8Array, rootMsg: Uint8Array): TsNode {
  if (bytes.length > LIMITS.maxInputBytes) throw new UnalteredError('PROOF_TOO_LARGE', 'The data is too large.');
  const r = new Reader(bytes);
  const node = readTimestampTree(r, rootMsg);
  if (!r.eof()) malformed('Unexpected data after the end of the receipt.');
  return node;
}

export function parseProof(bytes: Uint8Array): DetachedProof {
  if (bytes.length > LIMITS.maxInputBytes) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt file is too large.');
  const r = new Reader(bytes);
  const magic = r.bytes(HEADER_MAGIC.length);
  if (!equalBytes(magic, HEADER_MAGIC)) malformed('This is not an OpenTimestamps receipt.');
  const version = r.varuint();
  if (version !== MAJOR_VERSION) throw new UnalteredError('PROOF_UNSUPPORTED', 'This receipt version is not supported.');
  const hashTag = r.u8();
  if (hashTag !== TAG_SHA256) {
    if (TAGS_KNOWN_UNSUPPORTED.has(hashTag)) throw new UnalteredError('PROOF_UNSUPPORTED', 'This receipt uses a fingerprint type other than SHA-256, which is not supported.');
    malformed('The receipt has an unknown fingerprint type.');
  }
  const digest = r.bytes(32).slice();
  const root = readTimestampTree(r, digest);
  if (!r.eof()) malformed('Unexpected data after the end of the receipt.');
  return { digest, root };
}

function attestationBytes(a: Attestation): Uint8Array {
  if (a.kind === 'bitcoin') {
    const p = Uint8Array.from(writeVaruint(a.height));
    return concat(ATT_BITCOIN, Uint8Array.from(writeVaruint(p.length)), p);
  }
  const uri = new TextEncoder().encode(a.uri);
  const inner = concat(Uint8Array.from(writeVaruint(uri.length)), uri);
  return concat(ATT_PENDING, Uint8Array.from(writeVaruint(inner.length)), inner);
}

function compareAtt(a: Attestation, b: Attestation): number {
  return compareBytes(attestationBytes(a), attestationBytes(b));
}

function opBytes(op: Op): Uint8Array {
  if (op.kind === 'sha256') return Uint8Array.from([opTag(op)]);
  return concat(Uint8Array.from([opTag(op)]), Uint8Array.from(writeVaruint(op.arg.length)), op.arg);
}

/** Canonical serialisation, matching the reference implementation's ordering. Iterative. */
export function serializeTree(root: TsNode): Uint8Array {
  const out: Uint8Array[] = [];
  type Work = { node: TsNode; depth: number } | Uint8Array;
  const work: Work[] = [{ node: root, depth: 1 }];
  let nodes = 0;
  let attestations = 0;
  let bytes = 0;
  // Depth-first: process by popping; push in reverse so that emission order is correct.
  while (work.length > 0) {
    const item = work.pop()!;
    if (item instanceof Uint8Array) {
      bytes += item.length;
      if (bytes > LIMITS.maxInputBytes) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt file is too large.');
      out.push(item);
      continue;
    }
    if (++nodes > LIMITS.maxNodes) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt is too complex.');
    if (item.depth > LIMITS.maxDepth) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt is nested too deeply.');
    attestations += item.node.attestations.length;
    if (attestations > LIMITS.maxAttestations) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt contains too many attestations.');
    const atts = [...item.node.attestations].sort(compareAtt);
    const kids = [...item.node.children].sort((a, b) => compareOps(a.op, b.op));
    const total = atts.length + kids.length;
    if (total === 0) throw new UnalteredError('PROOF_MALFORMED', 'Cannot serialise an empty timestamp.');
    const seq: Work[] = [];
    let i = 0;
    for (const a of atts) {
      i++;
      if (i < total) seq.push(Uint8Array.from([TAG_MORE]));
      seq.push(Uint8Array.from([TAG_ATTESTATION]), attestationBytes(a));
    }
    for (const k of kids) {
      i++;
      if (i < total) seq.push(Uint8Array.from([TAG_MORE]));
      seq.push(opBytes(k.op), { node: k.node, depth: item.depth + 1 });
    }
    for (let j = seq.length - 1; j >= 0; j--) work.push(seq[j]!);
  }
  return concatParts(out);
}

export function serializeProof(p: DetachedProof): Uint8Array {
  const version = Uint8Array.from(writeVaruint(MAJOR_VERSION));
  const tree = serializeTree(p.root);
  if (HEADER_MAGIC.length + version.length + 1 + p.digest.length + tree.length > LIMITS.maxInputBytes) {
    throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt file is too large.');
  }
  return concat(HEADER_MAGIC, version, Uint8Array.from([TAG_SHA256]), p.digest, tree);
}

function attKey(a: Attestation): string {
  return a.kind === 'bitcoin' ? `b${a.height}` : `p${a.uri}`;
}

function opKey(op: Op): string {
  return op.kind === 'sha256' ? 's' : `${op.kind[0]}${toHex(op.arg)}`;
}

/** Merge `from` into `into` (same message). Mirrors Timestamp.merge. Iterative; indexed so cost is linear. */
export function mergeTree(into: TsNode, from: TsNode, validate?: () => void): void {
  if (!equalBytes(into.msg, from.msg)) throw new UnalteredError('PROOF_MALFORMED', 'Cannot combine receipts for different data.');
  const work: [TsNode, TsNode][] = [[into, from]];
  let steps = 0;
  // Record touched arrays so aggregate rejection cannot poison the previously valid proof.
  const snapshots = new Map<TsNode, { atts: Attestation[]; attLength: number; children: TsNode['children']; childLength: number }>();
  try {
    while (work.length > 0) {
      const [a, b] = work.pop()!;
      if (++steps > LIMITS.maxNodes * 2) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt is too complex.');
      if (!snapshots.has(a)) snapshots.set(a, { atts: a.attestations, attLength: a.attestations.length, children: a.children, childLength: a.children.length });
      const have = new Set(a.attestations.map(attKey));
      for (const att of b.attestations) {
        const k = attKey(att);
        if (!have.has(k)) {
          have.add(k);
          a.attestations.push(att);
        }
      }
      const kids = new Map(a.children.map((c) => [opKey(c.op), c]));
      for (const kid of b.children) {
        const existing = kids.get(opKey(kid.op));
        if (existing) {
          if (existing.node !== kid.node) work.push([existing.node, kid.node]);
        } else {
          a.children.push(kid);
          kids.set(opKey(kid.op), kid);
        }
      }
    }
    validate?.();
  } catch (error) {
    for (const [node, original] of snapshots) {
      node.attestations = original.atts;
      node.attestations.length = original.attLength;
      node.children = original.children;
      node.children.length = original.childLength;
    }
    throw error;
  }
}

export interface Leaf {
  node: TsNode;
  attestation: Attestation;
}

/** All attestations with the node (and so the commitment) they hang from. Iterative, visits shared nodes once. */
export function collectAttestations(root: TsNode): Leaf[] {
  const out: Leaf[] = [];
  const seen = new Set<TsNode>();
  const work: TsNode[] = [root];
  while (work.length > 0) {
    const n = work.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const a of n.attestations) out.push({ node: n, attestation: a });
    for (const k of n.children) work.push(k.node);
  }
  return out;
}

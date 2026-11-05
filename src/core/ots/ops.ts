import { sha256 } from '@noble/hashes/sha2.js';
import { compareBytes, concat } from '../bytes';
import { UnalteredError } from '../errors';
import { LIMITS, TAG_APPEND, TAG_PREPEND, TAG_SHA256, type Op } from './types';

export function applyOp(op: Op, msg: Uint8Array): Uint8Array {
  let out: Uint8Array;
  switch (op.kind) {
    case 'sha256':
      out = sha256(msg);
      break;
    case 'append':
      out = concat(msg, op.arg);
      break;
    case 'prepend':
      out = concat(op.arg, msg);
      break;
  }
  if (out.length > LIMITS.maxMsg) throw new UnalteredError('PROOF_MALFORMED', 'The receipt contains an oversized value.');
  return out;
}

export function opTag(op: Op): number {
  switch (op?.kind) {
    case 'sha256': return TAG_SHA256;
    case 'append': return TAG_APPEND;
    case 'prepend': return TAG_PREPEND;
    default: throw new UnalteredError('PROOF_MALFORMED', 'The receipt contains an unknown operation.');
  }
}

/** Ordering used by the reference serializer: by tag, then by argument. */
export function compareOps(a: Op, b: Op): number {
  const d = opTag(a) - opTag(b);
  if (d !== 0) return d;
  if (a.kind === 'sha256' || b.kind === 'sha256') return 0;
  return compareBytes(a.arg, (b as { arg: Uint8Array }).arg);
}

export function opsEqual(a: Op, b: Op): boolean {
  return compareOps(a, b) === 0;
}

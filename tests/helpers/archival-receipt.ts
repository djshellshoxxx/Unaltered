import { sha256 } from '@noble/hashes/sha2.js';
import { concat } from '../../src/core/bytes';
import { serializeProof } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';

/** A standard pending .ots fixture with arbitrary binary values and a real operation chain. */
export function archivalReceiptFixture(payloadBytes = 1800): Uint8Array {
  const digest = sha256(new TextEncoder().encode('Unaltered QR qualification document'));
  const root: TsNode = { msg: digest, attestations: [], children: [] };
  let node = root;
  for (let offset = 0; offset < payloadBytes; offset += 512) {
    const arg = Uint8Array.from({ length: Math.min(512, payloadBytes - offset) }, (_, i) => (offset + i * 31) & 255);
    const append: TsNode = { msg: concat(node.msg, arg), attestations: [], children: [] };
    const hashed: TsNode = { msg: sha256(append.msg), attestations: [], children: [] };
    node.children.push({ op: { kind: 'append', arg }, node: append });
    append.children.push({ op: { kind: 'sha256' }, node: hashed });
    node = hashed;
  }
  node.attestations.push({ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' });
  return serializeProof({ digest, root });
}

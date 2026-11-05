import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { defaultStampConfig, upgrade } from '../../src/core/ots/calendar';
import { collectAttestations, mergeTrees, parseProof, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { applyOp } from '../../src/core/ots/ops';
import { LIMITS, type Attestation, type TsNode } from '../../src/core/ots/types';

const ALICE = 'https://alice.btc.calendar.opentimestamps.org';
const digest = new Uint8Array(32);
const pending: Attestation = { kind: 'pending', uri: ALICE };
const bitcoin: Attestation = { kind: 'bitcoin', height: 800_000 };
const referencePython = process.env.UNALTERED_PYTHON;

// These distinct, valid operation paths converge on the same 33-byte commitment.
function convergingReceipt(rootAttestations: Attestation[] = []): Uint8Array {
  const children = (['append', 'prepend'] as const).map((kind) => {
    const op = { kind, arg: Uint8Array.of(0) };
    return { op, node: { msg: applyOp(op, digest), children: [], attestations: [{ ...pending }] } };
  });
  return serializeProof({ digest, root: { msg: digest, attestations: rootAttestations, children } });
}

function reply(attestations: Attestation[]): Uint8Array {
  return serializeTree({ msg: new Uint8Array(33), children: [], attestations });
}

describe('upgrade fans one calendar lookup out to every matching pending attestation', () => {
  it('upgrades both converging branches with one request and leaves no stale lookup for the next upgrade', async () => {
    let requests = 0;
    const commitment = new Uint8Array(33);
    const op = { kind: 'sha256' } as const;
    const confirmation = serializeTree({ msg: commitment, attestations: [], children: [{
      op, node: { msg: applyOp(op, commitment), children: [], attestations: [bitcoin] },
    }] });
    const fetchImpl = (async () => { requests++; return new Response(Uint8Array.from(confirmation)); }) as typeof fetch;
    const cfg = { ...defaultStampConfig(), net: { fetchImpl } };
    const result = await upgrade(convergingReceipt(), cfg);
    expect(requests).toBe(1);
    expect(result.calendars).toEqual([{ url: ALICE, ok: true }]);
    expect(result.changed).toBe(true);
    expect(collectAttestations(parseProof(result.ots).root).map((leaf) => leaf.attestation)).toEqual([bitcoin, bitcoin]);
    expect((await upgrade(result.ots, cfg)).changed).toBe(false);
    expect(requests).toBe(1);
  });

  it('checks every transaction root before mutating any earlier matching root', () => {
    const first: TsNode = { msg: digest, children: [], attestations: [pending] };
    const second: TsNode = { msg: digest, children: [], attestations: [pending] };
    const valid: TsNode = { msg: digest, children: [], attestations: [bitcoin] };
    const mismatch: TsNode = { ...valid, msg: new Uint8Array(32).fill(1) };
    const before = serializeTree(first);
    let validations = 0;
    expect(() => mergeTrees([[first, valid], [second, mismatch]], () => { validations++; }))
      .toThrowError(/different data/i);
    expect(serializeTree(first)).toEqual(before);
    expect(validations).toBe(0);
  });

  it.skipIf(!referencePython)('the qualified reference reads both upgraded branches without pending attestations', async () => {
    const fetchImpl = (async () => new Response(Uint8Array.from(reply([bitcoin])))) as typeof fetch;
    const result = await upgrade(convergingReceipt(), { ...defaultStampConfig(), net: { fetchImpl } });
    const script = `import sys,json,importlib.metadata
from opentimestamps.core.serialize import BytesDeserializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile
from opentimestamps.core.notary import BitcoinBlockHeaderAttestation,PendingAttestation
proof = DetachedTimestampFile.deserialize(BytesDeserializationContext(sys.stdin.buffer.read()))
attestations = list(proof.timestamp.all_attestations())
print(json.dumps({"version": importlib.metadata.version("opentimestamps"), "heights": sorted(a.height for _,a in attestations if isinstance(a,BitcoinBlockHeaderAttestation)), "pending": sum(isinstance(a,PendingAttestation) for _,a in attestations)}))`;
    const report = JSON.parse(execFileSync(referencePython!, ['-I', '-c', script], { input: result.ots, encoding: 'utf8' })) as {
      version: string; heights: number[]; pending: number;
    };
    expect(['0.4.5', '0.5.0']).toContain(report.version);
    expect(report.heights).toEqual([800_000, 800_000]);
    expect(report.pending).toBe(0);
  });

  it('satisfies equivalent URI spellings on one node with one request', async () => {
    const alias: Attestation = { kind: 'pending', uri: 'https://ALICE.BTC.CALENDAR.OPENTIMESTAMPS.ORG:443/' };
    const root: TsNode = { msg: digest, children: [], attestations: [pending, alias] };
    let requests = 0;
    const fetchImpl = (async () => { requests++; return new Response(Uint8Array.from(reply([bitcoin]))); }) as typeof fetch;
    const result = await upgrade(serializeProof({ digest, root }), { ...defaultStampConfig(), net: { fetchImpl } });
    expect(requests).toBe(1);
    expect(result.calendars).toEqual([{ url: ALICE, ok: true }]);
    expect(collectAttestations(parseProof(result.ots).root).map((leaf) => leaf.attestation)).toEqual([bitcoin]);
  });

  it('rolls every matching branch back when their combined confirmation exceeds the receipt budget', async () => {
    const rootAttestations: Attestation[] = Array.from({ length: LIMITS.maxAttestations - 3 }, (_, height) => ({ kind: 'bitcoin', height }));
    const original = convergingReceipt(rootAttestations);
    let requests = 0;
    const fetchImpl = (async () => { requests++; return new Response(Uint8Array.from(reply([bitcoin, { kind: 'bitcoin', height: 800_001 }]))); }) as typeof fetch;
    const result = await upgrade(original, { ...defaultStampConfig(), net: { fetchImpl } });
    expect(requests).toBe(1);
    expect(result.calendars).toHaveLength(1);
    expect(result.calendars[0]!.ok).toBe(false);
    expect(result.ots).toEqual(original);
    expect(result.changed).toBe(false);
  });

  it('retains every pending branch when the deduplicated reply is still pending', async () => {
    const original = convergingReceipt();
    let requests = 0;
    const fetchImpl = (async () => { requests++; return new Response(Uint8Array.from(reply([pending]))); }) as typeof fetch;
    const result = await upgrade(original, { ...defaultStampConfig(), net: { fetchImpl } });
    expect(requests).toBe(1);
    expect(result.ots).toEqual(original);
    expect(result.changed).toBe(false);
    expect(result.status).toBe('pending');
  });

  it('propagates cancellation of the shared request without changing the supplied receipt', async () => {
    const original = convergingReceipt();
    const before = Uint8Array.from(original);
    const controller = new AbortController();
    let requests = 0;
    const fetchImpl = (async (_input: unknown, init: RequestInit) => {
      requests++;
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new Error('private transport detail')), { once: true });
      });
    }) as typeof fetch;
    const operation = upgrade(original, { ...defaultStampConfig(), signal: controller.signal, net: { fetchImpl } });
    controller.abort();
    await expect(operation).rejects.toMatchObject({ code: 'ABORTED', message: 'Cancelled.' });
    expect(requests).toBe(1);
    expect(original).toEqual(before);
  });
});

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { serializeProof } from '../../src/core/ots/codec';
import { toHex } from '../../src/core/bytes';
import { makeHeader } from '../helpers/chain';

it('verifies offline using bounded header evidence and reports only supplied-header trust', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unaltered-offline-'));
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
  try {
    const file = join(dir, 'file.txt'); const ots = `${file}.ots`; const hdr = join(dir, 'header.hex');
    const digest = new Uint8Array(createHash('sha256').update('abc').digest());
    const h = makeHeader(digest);
    const expectedHash = createHash('sha256').update(createHash('sha256').update(h.raw).digest()).digest().reverse().toString('hex');
    expect(h.hashHex).toBe(expectedHash);
    await writeFile(file, 'abc');
    await writeFile(ots, serializeProof({ digest, root: { msg: digest, attestations: [{ kind: 'bitcoin', height: 42 }], children: [] } }));
    await writeFile(hdr, toHex(h.raw) + '\r\n');
    let out = ''; let err = '';
    const io = { out: (s: string) => { out += s; }, err: (s: string) => { err += s; } };
    expect(await run(['verify-offline', file, ots, '42', h.hashHex, hdr], io)).toBe(0);
    expect(err).toBe('');
    expect(out).toContain('MATCHED_TRUSTED_HEADER');
    expect(out).toContain('USER_SUPPLIED_HEADER');
    expect(out).toContain('Chain membership and height remain trusted inputs');
    expect(out).not.toContain('VERIFIED');
    expect(out).not.toContain('level L2');
    expect(fetch).not.toHaveBeenCalled();

    const valid = await readFile(ots);
    const scenarios = [
      { code: 2, proof: serializeProof({ digest, root: { msg: digest, children: [],
        attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }] } }) },
      { code: 3, proof: serializeProof({ digest: new Uint8Array(32), root: { msg: new Uint8Array(32), children: [],
        attestations: [{ kind: 'bitcoin', height: 42 }] } }) },
      { code: 4, proof: valid.subarray(0, valid.length - 1) },
      { code: 6, proof: serializeProof({ digest, root: { msg: digest, children: [], attestations: [{ kind: 'bitcoin', height: 43 }] } }) },
    ];
    for (const scenario of scenarios) {
      await writeFile(ots, scenario.proof); out = ''; err = '';
      expect(await run(['verify-offline', file, ots, '42', h.hashHex, hdr], io)).toBe(scenario.code);
      expect(err).toBe(''); expect(out).not.toContain('VERIFIED');
    }
    await writeFile(ots, valid);
    const wrong = makeHeader(new Uint8Array(32));
    await writeFile(hdr, toHex(wrong.raw));
    expect(await run(['verify-offline', file, ots, '42', wrong.hashHex, hdr], io)).toBe(5);
    await writeFile(hdr, toHex(h.raw));

    out = ''; err = '';
    expect(await run(['verify-offline', join(dir, 'not-present'), ots, '42', '0'.repeat(64), hdr], io)).toBe(7);
    expect(out).toBe(''); expect(err).toBe('error: invalid trusted header evidence\n');
    await writeFile(hdr, '0'.repeat(4000));
    expect(await run(['verify-offline', file, ots, '42', h.hashHex, hdr], io)).toBe(7);
    out = ''; err = '';
    expect(await run(['verify-offline', file, ots, '--help', h.hashHex, hdr], io)).toBe(1);
    expect(out).toBe('');
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); await rm(dir, { recursive: true, force: true }); }
});

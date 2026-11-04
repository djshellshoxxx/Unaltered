import { describe, expect, it } from 'vitest';
import { toHex } from '../../src/core/bytes';
import { defaultStampConfig, upgrade } from '../../src/core/ots/calendar';
import { collectAttestations, parseProof, serializeProof } from '../../src/core/ots/codec';
import { calendar, routerFetch } from '../helpers/chain';

const ALICE = 'https://alice.btc.calendar.opentimestamps.org';
const UPPER = 'https://ALICE.BTC.CALENDAR.OPENTIMESTAMPS.ORG';
const digest = new Uint8Array(32).fill(0x31);
const pending = (uri: string): Uint8Array => serializeProof({
  digest,
  root: { msg: digest, children: [], attestations: [{ kind: 'pending', uri }] },
});

describe('calendar endpoint canonicalization during upgrade', () => {
  for (const [uri, selected] of [
    [UPPER, ALICE],
    [ALICE, UPPER],
    [`${UPPER}:443/`, ALICE],
  ]) {
    it(`upgrades the selected HTTPS calendar when receipt=${uri} and selection=${selected}`, async () => {
      let requests = 0;
      const backend = calendar(new URL(ALICE).host, { upgrades: new Map([[toHex(digest), {
        msg: digest, children: [], attestations: [{ kind: 'bitcoin', height: 800_000 }],
      }]]) });
      const fetchImpl = routerFetch((url, init) => { requests++; return backend(url, init); });
      const result = await upgrade(pending(uri!), { ...defaultStampConfig(), calendars: [selected!], net: { fetchImpl } });
      expect(requests).toBe(1);
      expect(result.unknownCalendars).toEqual([]);
      expect(result.status).toBe('bitcoin-confirmed');
      expect(collectAttestations(parseProof(result.ots).root).map((leaf) => leaf.attestation)).toEqual([{ kind: 'bitcoin', height: 800_000 }]);
    });
  }

  for (const uri of ['http://alice.btc.calendar.opentimestamps.org', `${ALICE}/unselected`, 'https://alice.btc.calendar.opentimestamps.org.evil.example']) {
    it(`does not treat a different scheme, path or host as selected: ${uri}`, async () => {
      let requests = 0;
      const result = await upgrade(pending(uri), { ...defaultStampConfig(), calendars: [ALICE], net: {
        fetchImpl: routerFetch(() => { requests++; throw new Error('Unexpected network request'); }),
      } });
      expect(requests).toBe(0);
      expect(result.changed).toBe(false);
      expect(result.status).toBe('pending');
      expect(result.unknownCalendars).toEqual([uri]);
    });
  }

  for (const uri of ['http://alice.btc.calendar.opentimestamps.org', `${ALICE}:8443`, 'not-an-address']) {
    it(`still blocks an explicitly selected invalid or disallowed network address: ${uri}`, async () => {
      let requests = 0;
      const result = await upgrade(pending(uri), { ...defaultStampConfig(), calendars: [uri], net: {
        fetchImpl: routerFetch(() => { requests++; throw new Error('Unexpected network request'); }),
      } });
      expect(requests).toBe(0);
      expect(result.status).toBe('pending');
      expect(result.changed).toBe(false);
      expect(result.calendars).toHaveLength(1);
      expect(result.calendars[0]!.ok).toBe(false);
    });
  }

  it('rejects credential-bearing receipt addresses before any network request', async () => {
    let requests = 0;
    const uri = `https://user:pass${'@'}alice.btc.calendar.opentimestamps.org`;
    await expect(upgrade(pending(uri), { ...defaultStampConfig(), calendars: [uri], net: {
      fetchImpl: routerFetch(() => { requests++; throw new Error('Unexpected network request'); }),
    } })).rejects.toMatchObject({ code: 'PROOF_MALFORMED' });
    expect(requests).toBe(0);
  });
});

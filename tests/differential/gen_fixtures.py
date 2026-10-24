#!/usr/bin/env python3
"""Generate SYNTHETIC reference fixtures with python-opentimestamps (dev-only, never shipped).

Usage: python3 tests/differential/gen_fixtures.py tests/fixtures/ots
No real files, calendars or personal data are involved: everything is derived from fixed strings.
"""
import hashlib, json, os, sys
from opentimestamps.core.notary import BitcoinBlockHeaderAttestation, PendingAttestation
from opentimestamps.core.op import OpAppend, OpPrepend, OpSHA256
from opentimestamps.core.serialize import BytesSerializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile, Timestamp, make_merkle_tree

out = sys.argv[1]
os.makedirs(out, exist_ok=True)


def save(name, dts):
    ctx = BytesSerializationContext()
    dts.serialize(ctx)
    with open(os.path.join(out, name), 'wb') as f:
        f.write(ctx.getbytes())


def leaf_with_nonce(ts, nonce):
    return ts.ops.add(OpAppend(nonce)).ops.add(OpSHA256())


meta = {}

# 1. single file, pending on alice
d = hashlib.sha256(b'hello unaltered').digest()
dts = DetachedTimestampFile(OpSHA256(), Timestamp(d))
leaf = leaf_with_nonce(dts.timestamp, bytes(range(16)))
leaf.attestations.add(PendingAttestation('https://alice.btc.calendar.opentimestamps.org'))
save('pending.ots', dts)
meta['pending.ots'] = {'digest': d.hex(), 'commitment': leaf.msg.hex(), 'pending': ['https://alice.btc.calendar.opentimestamps.org'], 'bitcoin': []}

# 2. single file, confirmed: pending(alice)+pending(bob) path ends with calendar ops then a bitcoin attestation
d = hashlib.sha256(b'hello unaltered').digest()
dts = DetachedTimestampFile(OpSHA256(), Timestamp(d))
leaf = leaf_with_nonce(dts.timestamp, bytes(range(16)))
step = leaf.ops.add(OpPrepend(b'\x01' * 8)).ops.add(OpAppend(b'\x02' * 4)).ops.add(OpSHA256())
step.attestations.add(BitcoinBlockHeaderAttestation(358391))
bob = leaf.ops.add(OpAppend(b'\x03' * 12)).ops.add(OpSHA256())
bob.attestations.add(PendingAttestation('https://bob.btc.calendar.opentimestamps.org'))
save('confirmed.ots', dts)
meta['confirmed.ots'] = {'digest': d.hex(), 'commitment': step.msg.hex(), 'pending': ['https://bob.btc.calendar.opentimestamps.org'], 'bitcoin': [{'height': 358391, 'commitment': step.msg.hex()}]}

# 3. batch: three files share one merkle tip
digs = [hashlib.sha256(f'file-{i}'.encode()).digest() for i in range(3)]
stamps = []
leaves = []
for i, dg in enumerate(digs):
    t = DetachedTimestampFile(OpSHA256(), Timestamp(dg))
    stamps.append(t)
    leaves.append(leaf_with_nonce(t.timestamp, bytes([i]) * 16))
tip = make_merkle_tree(leaves)
tip.attestations.add(PendingAttestation('https://finney.calendar.eternitywall.com'))
for i, t in enumerate(stamps):
    save(f'batch{i}.ots', t)
meta['batch'] = {'digests': [x.hex() for x in digs], 'tip': tip.msg.hex(), 'pending': ['https://finney.calendar.eternitywall.com']}

# 4. unsupported attestation (litecoin)  -- parse must fail closed
from opentimestamps.core.notary import LitecoinBlockHeaderAttestation
d = hashlib.sha256(b'lite').digest()
dts = DetachedTimestampFile(OpSHA256(), Timestamp(d))
dts.timestamp.attestations.add(LitecoinBlockHeaderAttestation(5))
save('litecoin.ots', dts)

with open(os.path.join(out, 'expected.json'), 'w') as f:
    json.dump(meta, f, indent=2, sort_keys=True)
print('ok')

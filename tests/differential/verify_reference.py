#!/usr/bin/env python3
"""Independent R1 check with the REFERENCE implementation (python-opentimestamps), not this project's code.

Usage: verify_reference.py <file> <receipt.ots> <block-header-hex-from-a-source-you-choose>

Checks that the receipt's file digest is SHA-256 of <file>, then lets the reference library verify each Bitcoin
attestation against the 80-byte header you supply (from your own node: `bitcoin-cli getblockheader <hash> false`,
or a source independent of the app's explorers). Prints JSON; exit 0 only if an attestation verifies.
"""
import hashlib, json, sys
from bitcoin.core import CBlockHeader
from opentimestamps.core.notary import BitcoinBlockHeaderAttestation, PendingAttestation
from opentimestamps.core.op import OpSHA256
from opentimestamps.core.serialize import BytesDeserializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile

path, receipt, header_hex = sys.argv[1:4]
with open(receipt, 'rb') as f:
    dts = DetachedTimestampFile.deserialize(BytesDeserializationContext(f.read()))
if not isinstance(dts.file_hash_op, OpSHA256):
    sys.exit('receipt does not use SHA-256')
h = hashlib.sha256()
with open(path, 'rb') as f:
    for chunk in iter(lambda: f.read(1 << 20), b''):
        h.update(chunk)
header = CBlockHeader.deserialize(bytes.fromhex(header_hex.strip()))
out = {'digestMatches': h.digest() == dts.file_digest, 'headerHash': header.GetHash()[::-1].hex(), 'bitcoin': [], 'pending': 0}
for msg, att in dts.timestamp.all_attestations():
    if isinstance(att, PendingAttestation):
        out['pending'] += 1
    elif isinstance(att, BitcoinBlockHeaderAttestation):
        try:
            out['bitcoin'].append({'height': att.height, 'verifiedTime': att.verify_against_blockheader(msg, header)})
        except Exception as e:  # The reference raises VerificationError on a Merkle-root mismatch.
            out['bitcoin'].append({'height': att.height, 'error': type(e).__name__})
out['ok'] = out['digestMatches'] and any('verifiedTime' in b for b in out['bitcoin'])
print(json.dumps(out, sort_keys=True))
sys.exit(0 if out['ok'] else 1)

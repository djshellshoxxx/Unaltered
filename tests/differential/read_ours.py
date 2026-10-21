#!/usr/bin/env python3
"""Read .ots files with the REFERENCE implementation and print a JSON summary (used by differential tests)."""
import json, sys
from opentimestamps.core.notary import BitcoinBlockHeaderAttestation, PendingAttestation
from opentimestamps.core.serialize import BytesDeserializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile

res = {}
for path in sys.argv[1:]:
    data = open(path, 'rb').read()
    dts = DetachedTimestampFile.deserialize(BytesDeserializationContext(data))
    atts = []
    for msg, att in dts.timestamp.all_attestations():
        if isinstance(att, PendingAttestation):
            atts.append({'type': 'pending', 'uri': att.uri, 'commitment': msg.hex()})
        elif isinstance(att, BitcoinBlockHeaderAttestation):
            atts.append({'type': 'bitcoin', 'height': att.height, 'commitment': msg.hex()})
    res[path] = {'digest': dts.file_digest.hex(), 'attestations': sorted(atts, key=lambda a: json.dumps(a, sort_keys=True))}
print(json.dumps(res, sort_keys=True))

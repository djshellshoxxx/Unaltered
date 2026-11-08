# UNALTERED-OTS-QR/1 — archival proof transport (draft implementation)

Status: **Phase 1 prototype; not a published interoperability standard.** This framing carries a standard OpenTimestamps `.ots` receipt in QR byte-mode payloads. It does not modify the `.ots` format. Neither a QR symbol nor a certificate independently proves a timestamp without verification.

## Binary frame (80-byte fixed header)

All integers are unsigned, big-endian. All offsets below are zero-based byte offsets.

| Offset | Size | Field | Rule |
|---|---:|---|---|
| 0 | 8 | magic | ASCII `UOTSQR01` |
| 8 | 1 | version | exactly 1 |
| 9 | 1 | flags | exactly 0 in v1 |
| 10 | 1 | compression | 0 = none; future values rejected |
| 11 | 1 | reserved | 0 |
| 12 | 16 | proof ID | first 16 bytes of SHA-256(UTF-8 `UNALTERED-OTS-QR/1` + NUL + original receipt bytes) |
| 28 | 4 | frame index | zero-based, less than total |
| 32 | 4 | frame count | 1–4096 |
| 36 | 4 | original byte length | 1–16,777,216 |
| 40 | 4 | encoded byte length | equal to original length in v1 |
| 44 | 32 | receipt SHA-256 | hash of complete original receipt bytes |
| 76 | 4 | payload byte length | equals actual trailing byte count |
| 80 | variable | payload | contiguous slice of original receipt |

For v1, frames must partition the original bytes into nonempty, ordered, contiguous slices. Every frame in a set repeats identical metadata other than index and payload length. Reassembly sorts by index, rejects missing indices and conflicting duplicates, verifies lengths, then recomputes both receipt SHA-256 and domain-separated proof ID. Identical duplicate frames may be ignored.

No arbitrary text, URL, filename, signature or original file is embedded. QR symbols use ISO/IEC 18004 Model 2 **byte mode**; the frame bytes are not base64 or Unicode text. QR version, error correction and mask are properties of each symbol, not fields of this transport. The printed certificate must record their actual values. QR rendering and scanning are not implemented in Phase 1.

## Resource bounds

The initial implementation caps original receipts at 16 MiB and frame count at 4096. These are application limits, not QR-standard limits. The eventual QR optimizer must impose tighter printable symbol and page budgets before encoding. All input lengths, version bytes, indices, repeated metadata and checksums are validated before export.

## Independent recovery

1. Decode each QR as raw binary bytes using a QR Model 2 byte-mode decoder.
2. Parse the header above; group by the 16-byte proof ID and confirm repeated metadata matches.
3. Order frames by zero-based index; reject missing or conflicting frames.
4. Concatenate payloads; verify byte length and SHA-256 against the full 32-byte digest in the header.
5. Recompute the domain-separated proof ID and compare its first 16 bytes.
6. Save the exact recovered bytes as `.ots`; verify with the OpenTimestamps reference client against the original file.

A printed QR's metadata label is **not** sufficient to recover missing or damaged data. Keep duplicate prints and the original digital receipt. The source file is required to prove correspondence with the receipt.

## Future versioning

Compression (for example, deterministic DEFLATE), QR selection, pagination, PDF creation and offline image scanning are subsequent phases. They must not reinterpret compression=0 frames. Any incompatible framing change requires a new version. The final specification must include independent golden vectors and third-party decoder verification before a production release.

## Independent reference decoder

`scripts/recover-archival-qr.py` reconstructs a standard receipt from raw QR byte-mode payload files without using Unaltered's TypeScript implementation or any third-party Python packages.

Example (after extracting raw QR payload bytes to files):

```sh
python3 scripts/recover-archival-qr.py frame-000.bin frame-001.bin -o recovered.ots
python3 -m unittest discover -s tests/archival -p 'test_*.py'
```

The reference script does not decode QR images, does not verify the Bitcoin timestamp, and does not replace an independent OpenTimestamps client. Before release, create cross-language golden vectors from the TypeScript encoder and verify that the Python decoder reconstructs them byte-for-byte; the current Python tests construct frames independently.

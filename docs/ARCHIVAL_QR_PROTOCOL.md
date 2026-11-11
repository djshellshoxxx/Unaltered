# UNALTERED-OTS-QR/1 — archival proof transport (draft implementation)

Status: **Experimental Unaltered transport; not an OpenTimestamps interoperability standard.** This framing carries a standard OpenTimestamps `.ots` receipt in QR byte-mode payloads. It does not modify the `.ots` format. Neither a QR symbol nor a certificate independently proves a timestamp without verification.

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

No arbitrary text, URL, filename, signature or original file is embedded. QR symbols use ISO/IEC 18004 Model 2 **byte mode**; the frame bytes are not base64 or Unicode text. QR version, error correction and mask are properties of each symbol, not fields of this transport. The printed certificate must record their actual values. The framing is independent of the renderer and scanner; the integration status is documented below.

## Resource bounds

The initial implementation caps original receipts at 16 MiB and frame count at 4096. These are application limits, not QR-standard limits. The print interface imposes the tighter symbol and page budgets documented below. All input lengths, version bytes, indices, repeated metadata and checksums are validated before export.

## Independent recovery

1. Decode each QR as raw binary bytes using a QR Model 2 byte-mode decoder.
2. Parse the header above; group by the 16-byte proof ID and confirm repeated metadata matches.
3. Order frames by zero-based index; reject missing or conflicting frames.
4. Concatenate payloads; verify byte length and SHA-256 against the full 32-byte digest in the header.
5. Recompute the domain-separated proof ID and compare its first 16 bytes.
6. Save the exact recovered bytes as `.ots`; verify with the OpenTimestamps reference client against the original file.

A printed QR's metadata label is **not** sufficient to recover missing or damaged data. Keep duplicate prints and the original digital receipt. The source file is required to prove correspondence with the receipt.

## Future versioning

Compression remains unsupported. Future compression extensions must not reinterpret compression=0 frames. QR selection, pagination, browser PDF output and local image scanning are implemented in the integration described below. Any incompatible framing change requires a new version. The final specification must include independent golden vectors and third-party decoder verification before a production release. Both now exist (see "Independent golden vectors and third-party decoding" below); the production gate additionally needs the human print-and-photograph evidence listed there.

## Independent reference decoder

`scripts/recover-archival-qr.py` reconstructs a standard receipt from raw QR byte-mode payload files without using Unaltered's TypeScript implementation or any third-party Python packages.

Example (after extracting raw QR payload bytes to files):

```sh
python3 scripts/recover-archival-qr.py frame-000.bin frame-001.bin -o recovered.ots
python3 -m unittest discover -s tests/archival -p 'test_*.py'
```

The reference script does not decode QR images, does not verify the Bitcoin timestamp, and does not replace an independent OpenTimestamps client. The shared golden vector is tested by both TypeScript and Python; the Python tests also construct frames independently. Image decoding and Bitcoin verification are separate checks.

## Integration and image recovery (2026-11-08)

The protocol bytes above are unchanged. The current integration renders actual QR Model 2 symbols and can decode local PNG/JPEG scan images using the independent jsQR decoder. It retains the decoder's raw binary payload rather than converting it through text. A recoverable frame set is reassembled and checksum-checked, then parsed as a standard OpenTimestamps receipt before the browser offers a download. This operation does not verify Bitcoin confirmation.

The printer plans across QR versions 1–40 but requires at least 0.62 mm modules (at most version 22 in a 72 mm symbol: V22 gives 72/113 = 0.637 mm, V23 gives 72/117 = 0.615 mm; corrected 2026-11-11 from "version 23", confirmed by zxing-cpp reading V22 as the largest printed version), because larger versions were not reliably recovered from Chromium PDFs rasterized at 150 DPI. Automatic correction is the default; an explicit L/M/Q/H selection is never downgraded. The actual renderer uses 72 mm symbols including four-module quiet zones, two symbols on the cover and four on continuation pages. A mandatory, self-contained recovery-specification appendix is included in the final page count. At most 64 symbols are generated by this UI. Receipts outside that practical resource limit remain downloadable as digital .ots files, without truncation.

Image limits: PNG/JPEG, 12 MiB per file, 64 input files and 64 MiB combined, no more than 6000 pixels per side or 16 million pixels. Dimensions are inspected before native image decoding. QR recognition runs in a dedicated local worker with a 120-second per-image deadline and termination on cancellation. The default no-third-party-request and strict-CSP rules remain unchanged. Unknown QR payloads are ignored, never opened as URLs. Missing or conflicting frames and mixed receipts are rejected. Pages without QR data, such as the technical appendix, may be included in a scan set.

The browser's Print / Save as PDF path is provided rather than a remote PDF service. Its certificate is explicitly unverified, even when the receipt contains a Bitcoin attestation; a live or independently trusted verification is a different operation. The original document is not in the QR codes.

Automated qualification covers all four correction levels, rotations, multiple QR symbols, exact binary equality, integrity failures, and browser PDF → raster image → independent decoder → original .ots reconstruction for A4 and US Letter. See the `Archival QR print and scan qualification` workflow for per-commit evidence. A configured test is not evidence it passed, and PDF raster tests are not a substitute for a physical printer/camera test.

## Independent golden vectors and third-party decoding (2026-11-11)

These two production prerequisites from "Future versioning" are now met for the transport bytes and for decoding of
the app's own printed PDFs. Protocol bytes and the print layout are unchanged.

**Golden vectors, second set.** `tests/archival/golden-v2.json` is built by `tests/archival/make_golden_v2.py`, which
uses only the Python standard library and writes every header field from the table at the top of this document. It
does not import the TypeScript encoder or `scripts/recover-archival-qr.py`. The set has 7 accept vectors (the smallest
legal frame of 81 bytes, all 256 byte values, a short last frame, an exact 2953-byte 40-L frame, one byte over it,
NUL/CR/LF/invalid UTF-8 payloads and an OTS-like receipt) and 18 reject vectors, each one named violation of this
text (missing frame, conflicting duplicate, flipped payload bit, magic, version, flags, compression, reserved byte,
index equal to count, count 0 and 4097, encoded length differing, payload-length mismatch, empty payload, a 2954-byte
frame, mixed certificates, proof-identifier mismatch and original-length mismatch).

- Python: `python3 -m unittest discover -s tests/archival -p 'test_*.py'`. The committed JSON must equal the generator
  output byte for byte; the reference recoverer must return every accept receipt in any order (with duplicates) and
  reject every reject vector. A second, separate Python construction (`make_frames`) must emit the same frames.
- TypeScript: `tests/qualification/qr-golden-v2.spec.ts` (Playwright runner, no browser). `encodeReceiptFrames`
  must reproduce the Python frames byte for byte and `recoverReceiptFrames` must accept/reject the same sets.

**Third-party decoder.** `tests/qualification/qr-independent.spec.ts` prints certificates through the real UI with
Chromium's PDF backend, rasterises them with `pdftoppm` at 150 DPI and decodes every symbol with zxing-cpp 3.1.1
(Apache-2.0, independent of jsQR) via `tests/archival/zxing_qr.py`. The raw byte-mode payloads go to the Python
reference recoverer, and the result must equal the original `.ots` byte for byte. zxing's own reading of each
symbol's version, error-correction level and mask must also equal the label printed under it. Cases: three receipt
sizes (325, 3145 and 12,217 bytes) at each of L, M, Q and H on A4, automatic correction on A4 and US Letter, and
12,217 bytes at H on US Letter (15 certificates, 1 to 35 symbols, QR versions 13 to 22, all eight masks seen).
It is opt-in and skips with a setup message unless the hash-pinned test packages in `tests/archival/requirements.txt`
are installed and `UNALTERED_QR_PYTHON` points at that interpreter.

**Distortion corpus.** `tests/archival/qr_distort.py` produces seeded camera-like variants of printed pages and
`tests/qualification/qr-robustness.spec.ts` (opt-in, `UNALTERED_QR_ROBUSTNESS=1`) measures in-app and zxing-cpp
recovery for each one. Results, the scan-worker change they led to, and what still needs human evidence are in
`docs/QR_INTEGRATION_VALIDATION.md` and `docs/evidence/qr-robustness-20261111.json`. Images are regenerated on demand
and never committed.

Still required before calling the transport production-qualified: printing on real printers and paper, and capture
with real phone cameras and flatbed scanners, by people, recorded as evidence. Synthetic distortions approximate these
conditions but are not a substitute for them.

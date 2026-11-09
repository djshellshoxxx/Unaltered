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

Compression remains unsupported. Future compression extensions must not reinterpret compression=0 frames. QR selection, pagination, browser PDF output and local image scanning are implemented in the integration described below. Any incompatible framing change requires a new version. The final specification must include independent golden vectors and third-party decoder verification before a production release.

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

The printer plans across QR versions 1–40 but requires at least 0.62 mm modules (at most version 23 in a 72 mm symbol), because larger versions were not reliably recovered from Chromium PDFs rasterized at 150 DPI. Automatic correction is the default; an explicit L/M/Q/H selection is never downgraded. The actual renderer uses 72 mm symbols including four-module quiet zones, two symbols on the cover and four on continuation pages. A mandatory, self-contained recovery-specification appendix is included in the final page count. At most 64 symbols are generated by this UI. Receipts outside that practical resource limit remain downloadable as digital .ots files, without truncation.

Image limits: PNG/JPEG, 12 MiB per file, 64 input files and 64 MiB combined, no more than 6000 pixels per side or 16 million pixels. Dimensions are inspected before native image decoding. QR recognition runs in a dedicated local worker with a 45-second per-image deadline and termination on cancellation. The default no-third-party-request and strict-CSP rules remain unchanged. Unknown QR payloads are ignored, never opened as URLs. Missing or conflicting frames and mixed receipts are rejected. Pages without QR data, such as the technical appendix, may be included in a scan set.

The browser's Print / Save as PDF path is provided rather than a remote PDF service. Its certificate is explicitly unverified, even when the receipt contains a Bitcoin attestation; a live or independently trusted verification is a different operation. The original document is not in the QR codes.

Automated qualification covers all four correction levels, rotations, multiple QR symbols, exact binary equality, integrity failures, and browser PDF → raster image → independent decoder → original .ots reconstruction for A4 and US Letter. See the `Archival QR print and scan qualification` workflow for per-commit evidence. A configured test is not evidence it passed, and PDF raster tests are not a substitute for a physical printer/camera test.

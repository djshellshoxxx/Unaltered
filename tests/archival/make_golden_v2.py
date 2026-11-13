#!/usr/bin/env python3
"""Build the second UNALTERED-OTS-QR/1 golden vector set from the protocol text alone (Python stdlib only).

Usage: python3 -I tests/archival/make_golden_v2.py > tests/archival/golden-v2.json

This generator imports nothing from Unaltered: not the TypeScript encoder and not
scripts/recover-archival-qr.py. Every header field is written field by field from the
table in docs/ARCHIVAL_QR_PROTOCOL.md ("Binary frame (80-byte fixed header)"):

  offset size field
  0      8    magic "UOTSQR01"
  8      1    version = 1
  9      1    flags = 0
  10     1    compression = 0
  11     1    reserved = 0
  12     16   first 16 bytes of SHA-256("UNALTERED-OTS-QR/1" || 0x00 || receipt)
  28     4    zero-based frame index        (unsigned big-endian)
  32     4    frame count, 1..4096
  36     4    original byte length, 1..16 MiB
  40     4    encoded byte length (= original in v1)
  44     32   SHA-256(receipt)
  76     4    payload byte length (= trailing byte count)
  80     ...  contiguous payload slice

`accept` vectors list the exact frames an encoder must emit for a receipt and a maximum frame
size (the QR symbol's byte capacity), in index order. `reject` vectors are frame sets that a
recoverer must refuse, each derived from a valid set by one named violation of the text.
Receipt bytes are synthetic; no real receipt or personal data is used.
"""
import hashlib
import json
import sys

DOMAIN_TEXT = "UNALTERED-OTS-QR/1"


def be32(value: int) -> bytes:
    if not 0 <= value < 2 ** 32:
        raise ValueError("u32 out of range")
    return value.to_bytes(4, "big")


def header(receipt: bytes, index: int, count: int, payload_length: int) -> bytes:
    fields = [
        "UOTSQR01".encode("ascii"),          # 0..7   magic
        bytes([1]),                          # 8      version
        bytes([0]),                          # 9      flags
        bytes([0]),                          # 10     compression
        bytes([0]),                          # 11     reserved
        hashlib.sha256(DOMAIN_TEXT.encode("utf-8") + b"\x00" + receipt).digest()[0:16],  # 12..27
        be32(index),                         # 28..31
        be32(count),                         # 32..35
        be32(len(receipt)),                  # 36..39 original length
        be32(len(receipt)),                  # 40..43 encoded length
        hashlib.sha256(receipt).digest(),    # 44..75
        be32(payload_length),                # 76..79
    ]
    out = b"".join(fields)
    assert len(out) == 80
    return out


def frames_for(receipt: bytes, max_frame_bytes: int) -> list[bytes]:
    """Greedy contiguous partition: every frame but the last carries max_frame_bytes - 80 payload bytes."""
    room = max_frame_bytes - 80
    if room < 1:
        raise ValueError("frame capacity leaves no payload room")
    slices = []
    start = 0
    while start < len(receipt):
        slices.append(receipt[start:start + room])
        start += room
    return [header(receipt, i, len(slices), len(part)) + part for i, part in enumerate(slices)]


def synthetic(length: int, label: str) -> bytes:
    """Deterministic pseudo-random bytes: SHA-256 counter stream keyed by a public label."""
    out = bytearray()
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(f"golden-v2/{label}/{counter}".encode()).digest()
        counter += 1
    return bytes(out[:length])


def patch(frame: bytes, offset: int, data: bytes) -> bytes:
    return frame[:offset] + data + frame[offset + len(data):]


def build() -> dict:
    accept = []

    def add(name: str, receipt: bytes, max_frame_bytes: int, note: str) -> list[bytes]:
        frames = frames_for(receipt, max_frame_bytes)
        accept.append({"name": name, "note": note, "max_frame_bytes": max_frame_bytes,
                       "receipt_hex": receipt.hex(), "receipt_sha256": hashlib.sha256(receipt).hexdigest(),
                       "frames_hex": [f.hex() for f in frames]})
        return frames

    add("one-byte-minimum-frame", b"\x00", 81, "Smallest legal frame: 80-byte header plus one payload byte.")
    add("all-byte-values", bytes(range(256)), 144, "Every byte value 0x00..0xff, 64-byte slices, 4 frames.")
    add("short-last-frame", synthetic(1000, "short-last"), 439,
        "QR 22-H byte capacity (439); 2 full slices of 359 bytes then 282.")
    add("exact-fit-v40-l", synthetic(2953 - 80, "v40l"), 2953,
        "Largest QR byte capacity (40-L, 2953); exactly one full frame.")
    add("one-byte-overflow-v40-l", synthetic(2953 - 80 + 1, "v40l+1"), 2953,
        "One byte over a full 40-L frame: second frame carries a 1-byte payload.")
    add("nul-and-high-bytes", b"\x00\x00\xff\x80\x7f\x0a\x0d\x00\xc3\x28" * 30, 120,
        "NUL, CR/LF and invalid UTF-8 sequences must survive byte mode untouched.")
    base_receipt = (b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94\x01\x08"
                    + synthetic(500, "ots-like"))
    base = add("ots-like-receipt", base_receipt, 251, "OTS magic prefix with synthetic body; QR 11-M byte capacity (251).")
    n = len(base_receipt)

    reject = []

    def bad(name: str, frames: list[bytes], rule: str) -> None:
        reject.append({"name": name, "rule": rule, "frames_hex": [f.hex() for f in frames]})

    f = base
    other = frames_for(synthetic(n, "other"), 251)
    bad("missing-frame", [f[0], f[2]], "Every index below the frame count must be present.")
    bad("conflicting-duplicate", [*f, patch(f[1], 80, bytes([f[1][80] ^ 1]))],
        "Duplicate indices must carry identical payloads.")
    bad("payload-bit-flip", [f[0], patch(f[1], len(f[1]) - 1, bytes([f[1][-1] ^ 0x40])), *f[2:]],
        "Reassembled bytes must match the SHA-256 in the header.")
    bad("magic", [patch(f[0], 0, b"UOTSQR02"), *f[1:]], "Magic must be ASCII UOTSQR01.")
    bad("version-2", [patch(f[0], 8, b"\x02"), *f[1:]], "Version must be exactly 1.")
    bad("flags-set", [patch(f[0], 9, b"\x01"), *f[1:]], "Flags must be 0 in v1.")
    bad("compression-1", [patch(f[0], 10, b"\x01"), *f[1:]], "Compression values other than 0 are rejected.")
    bad("reserved-set", [patch(f[0], 11, b"\x01"), *f[1:]], "Reserved byte must be 0.")
    bad("index-equals-count", [*f[:-1], patch(f[-1], 28, be32(len(f)))], "Frame index must be less than the count.")
    bad("count-zero", [patch(x, 32, be32(0)) for x in f], "Frame count must be 1..4096.")
    bad("count-over-limit", [patch(x, 32, be32(4097)) for x in f], "Frame count must be 1..4096.")
    bad("encoded-differs", [patch(x, 40, be32(n + 1)) for x in f],
        "Encoded length must equal original length in v1.")
    bad("payload-length-mismatch", [patch(f[0], 76, be32(len(f[0]) - 80 - 1)), *f[1:]],
        "Payload length must equal the actual trailing byte count.")
    bad("empty-payload", [patch(f[0][:80], 76, be32(0)), *f[1:]], "Payloads are nonempty.")
    bad("frame-over-2953", [header(synthetic(2874, "big"), 0, 1, 2874) + synthetic(2874, "big")],
        "A frame cannot exceed the largest QR byte capacity (2953 bytes).")
    bad("mixed-certificates", [f[0], other[1], *f[2:]], "Frames of different proofs must not be combined.")
    bad("proof-id-mismatch", [patch(x, 12, bytes(16)) for x in f],
        "The 16-byte proof identifier must match the recomputed domain-separated hash.")
    bad("original-length-mismatch", [patch(patch(x, 36, be32(n - 1)), 40, be32(n - 1)) for x in f],
        "Reassembled byte count must equal the declared original and encoded length.")

    return {
        "protocol": "UNALTERED-OTS-QR/1",
        "set": "golden-v2",
        "generator": "tests/archival/make_golden_v2.py (Python stdlib, built from docs/ARCHIVAL_QR_PROTOCOL.md)",
        "accept": accept,
        "reject": reject,
    }


if __name__ == "__main__":
    json.dump(build(), sys.stdout, indent=1)
    sys.stdout.write("\n")

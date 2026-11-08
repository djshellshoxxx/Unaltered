#!/usr/bin/env python3
"""Independent UNALTERED-OTS-QR/1 frame reassembler (Python stdlib only).

Usage: python3 scripts/recover-archival-qr.py frame-000.bin frame-001.bin -o receipt.ots
Input files must contain raw *decoded QR byte-mode payloads*, not QR images.
No Unaltered TypeScript code is imported. This is a reference recovery utility,
not a QR image scanner or OpenTimestamps proof verifier.
"""
import argparse
import hashlib
from pathlib import Path
import struct

MAGIC = b"UOTSQR01"
DOMAIN = b"UNALTERED-OTS-QR/1\x00"
HEADER = 80
MAX_BYTES = 16 * 1024 * 1024
MAX_FRAMES = 4096


def recover(frames: list[bytes]) -> bytes:
    if not 1 <= len(frames) <= MAX_FRAMES:
        raise ValueError("Invalid frame count")
    parts: dict[int, bytes] = {}
    expected = None
    for frame in frames:
        if len(frame) <= HEADER or frame[:8] != MAGIC:
            raise ValueError("Invalid frame header or empty payload")
        if frame[8:12] != b"\x01\x00\x00\x00":
            raise ValueError("Unsupported protocol version, flags or compression")
        index, count, original, encoded = struct.unpack_from(">IIII", frame, 28)
        (payload_length,) = struct.unpack_from(">I", frame, 76)
        if not (1 <= count <= MAX_FRAMES and index < count and
                1 <= original <= MAX_BYTES and encoded == original and
                payload_length == len(frame) - HEADER):
            raise ValueError("Invalid lengths or indices")
        metadata = (frame[12:28], count, original, frame[44:76])
        if expected is None:
            expected = metadata
        elif metadata != expected:
            raise ValueError("Conflicting receipt metadata")
        payload = frame[HEADER:]
        if index in parts and parts[index] != payload:
            raise ValueError("Conflicting duplicate")
        parts[index] = payload
    assert expected is not None
    proof_id, count, original, digest = expected
    if len(parts) != count:
        raise ValueError("Missing frames")
    receipt = b"".join(parts[i] for i in range(count))
    if len(receipt) != original:
        raise ValueError("Invalid reassembled length")
    if hashlib.sha256(receipt).digest() != digest:
        raise ValueError("Receipt checksum mismatch")
    if hashlib.sha256(DOMAIN + receipt).digest()[:16] != proof_id:
        raise ValueError("Proof identifier mismatch")
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", nargs="+", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    if len(args.frames) > MAX_FRAMES:
        parser.error("Too many input frames")
    frames = []
    for path in args.frames:
        if path.stat().st_size > 3033:
            parser.error(f"Frame too large: {path}")
        frames.append(path.read_bytes())
    receipt = recover(frames)
    args.output.write_bytes(receipt)
    print(f"Recovered {len(receipt)} bytes; SHA-256: {hashlib.sha256(receipt).hexdigest()}")


if __name__ == "__main__":
    main()

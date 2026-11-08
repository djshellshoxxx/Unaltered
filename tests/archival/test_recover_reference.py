"""Tests for the independent archival QR recovery reference implementation."""
import hashlib
import importlib.util
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("archival_recovery", ROOT / "scripts/recover-archival-qr.py")
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def make_frames(receipt: bytes, chunk_size: int = 53) -> list[bytes]:
    digest = hashlib.sha256(receipt).digest()
    proof_id = hashlib.sha256(b"UNALTERED-OTS-QR/1\x00" + receipt).digest()[:16]
    parts = [receipt[i:i + chunk_size] for i in range(0, len(receipt), chunk_size)]
    frames = []
    for index, part in enumerate(parts):
        header = bytearray(80)
        header[:8] = b"UOTSQR01"
        header[8] = 1
        header[12:28] = proof_id
        struct.pack_into(">IIII", header, 28, index, len(parts), len(receipt), len(receipt))
        header[44:76] = digest
        struct.pack_into(">I", header, 76, len(part))
        frames.append(bytes(header) + part)
    return frames


class RecoveryTests(unittest.TestCase):
    def test_roundtrip_and_reordering(self):
        for length in (1, 80, 200, 1000):
            receipt = bytes((i * 31 + 7) % 256 for i in range(length))
            self.assertEqual(module.recover(make_frames(receipt)[::-1]), receipt)

    def test_corruption_and_missing_frames(self):
        frames = make_frames(bytes(range(200)))
        with self.assertRaises(ValueError):
            module.recover(frames[1:])
        corrupted = frames.copy()
        corrupted[0] = corrupted[0][:-1] + bytes([corrupted[0][-1] ^ 1])
        with self.assertRaises(ValueError):
            module.recover(corrupted)

    def test_invalid_version_and_duplicate(self):
        frames = make_frames(bytes(range(100)))
        broken = bytearray(frames[0])
        broken[8] = 2
        with self.assertRaises(ValueError):
            module.recover([bytes(broken), *frames[1:]])
        self.assertEqual(module.recover([frames[0], frames[0], *frames[1:]]), bytes(range(100)))


if __name__ == "__main__":
    unittest.main()

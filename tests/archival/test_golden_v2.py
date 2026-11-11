"""Second, independently constructed golden vector set (golden-v2.json), checked on the Python side.

The TypeScript side of the same vectors is tests/qualification/qr-golden-v2.spec.ts.
Python stdlib only: this test always runs, no optional packages needed.
"""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "tests/archival/golden-v2.json"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


reference = load("archival_recovery_v2", ROOT / "scripts/recover-archival-qr.py")
generator = load("archival_golden_v2", ROOT / "tests/archival/make_golden_v2.py")
v1_tests = load("archival_reference_tests", ROOT / "tests/archival/test_recover_reference.py")


class GoldenV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(VECTORS.read_text())

    def test_committed_file_is_exactly_what_the_spec_generator_builds(self):
        self.assertEqual(json.dumps(generator.build(), indent=1) + "\n", VECTORS.read_text())

    def test_vector_set_covers_boundaries(self):
        self.assertGreaterEqual(len(self.data["accept"]), 7)
        self.assertGreaterEqual(len(self.data["reject"]), 18)
        sizes = {len(bytes.fromhex(h)) for v in self.data["accept"] for h in v["frames_hex"]}
        self.assertIn(81, sizes)    # smallest legal frame
        self.assertIn(2953, sizes)  # largest QR byte-mode capacity

    def test_reference_recovers_every_accept_vector_in_any_order(self):
        for vector in self.data["accept"]:
            with self.subTest(vector["name"]):
                frames = [bytes.fromhex(h) for h in vector["frames_hex"]]
                receipt = bytes.fromhex(vector["receipt_hex"])
                self.assertEqual(reference.recover(frames), receipt)
                self.assertEqual(reference.recover(frames[::-1]), receipt)
                self.assertEqual(reference.recover([*frames, frames[0]]), receipt)  # identical duplicate ignored

    def test_two_independent_python_constructions_agree(self):
        # make_frames in test_recover_reference.py is a separate struct-based construction.
        for vector in self.data["accept"]:
            with self.subTest(vector["name"]):
                receipt = bytes.fromhex(vector["receipt_hex"])
                expected = [bytes.fromhex(h) for h in vector["frames_hex"]]
                self.assertEqual(v1_tests.make_frames(receipt, vector["max_frame_bytes"] - 80), expected)

    def test_reference_rejects_every_reject_vector(self):
        for vector in self.data["reject"]:
            with self.subTest(vector["name"]):
                with self.assertRaises(ValueError):
                    reference.recover([bytes.fromhex(h) for h in vector["frames_hex"]])


if __name__ == "__main__":
    unittest.main()

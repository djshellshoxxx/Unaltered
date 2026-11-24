"""Run the recovered Ubuntu automation guards offline in ordinary toolkit CI.

These suites use synthetic repositories and metadata. They never run the cloud
workflow, contact an API, publish a patch, or enable the admission-policy helper.
"""
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(sys.platform == "linux", "guards are for the Ubuntu-only workflow")
class CloudGuardTests(unittest.TestCase):
    def run_suite(self, filename):
        result = subprocess.run([sys.executable, "-I", str(ROOT / ".github/scripts" / filename)],
                                cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_scope_boundary(self):
        self.run_suite("test_cloud_scope_guard.py")

    def test_unwired_admission_policy(self):
        self.run_suite("test_cloud_run_policy.py")


if __name__ == "__main__":
    unittest.main()

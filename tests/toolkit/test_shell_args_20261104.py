"""Offline argument-validation regressions for bundled toolkit shell scripts."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
START_SERVER = ROOT / 'skills/brainstorming/scripts/start-server.sh'
SEARCH = ROOT / 'skills/paper-search/scripts/search.sh'


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash'), 'needs bash')
class StartServerArgsTests(unittest.TestCase):
    def test_option_missing_its_value_fails_instead_of_looping(self):
        for option in ('--project-dir', '--host', '--url-host', '--idle-timeout-minutes'):
            with self.subTest(option=option):
                try:
                    result = subprocess.run(['bash', str(START_SERVER), option],
                                            capture_output=True, text=True, timeout=10)
                except subprocess.TimeoutExpired:
                    self.fail(f'{option} without a value hangs')
                self.assertEqual(result.returncode, 1)
                self.assertIn('requires a value', result.stdout)


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash') and shutil.which('jq'), 'needs bash and jq')
class SearchArgsTests(unittest.TestCase):
    def test_limit_and_page_cannot_execute_commands(self):
        with tempfile.TemporaryDirectory() as temp:
            marker = Path(temp) / 'pwned'
            payload = f'a[$(touch {marker})]'
            bindir = Path(temp) / 'bin'
            bindir.mkdir()
            (bindir / 'curl').write_text('#!/bin/sh\necho "{}"\n')
            (bindir / 'curl').chmod(0o755)
            env = {**os.environ, 'PATH': f'{bindir}:{os.environ["PATH"]}'}
            for args in (['q', '10', 'relevance', payload], ['q', payload]):
                result = subprocess.run(['bash', str(SEARCH), *args], capture_output=True,
                                        text=True, timeout=20, env=env)
                self.assertFalse(marker.exists(), 'argument was evaluated as shell arithmetic')
                self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()

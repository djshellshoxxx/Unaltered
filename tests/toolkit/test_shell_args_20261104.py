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
    # `a` is unset inside search.sh, so under `set -u` bash aborts with "a: unbound variable" before it expands the
    # subscript: that payload alone passes even with no validation at all. The other names are set when the script
    # reaches its arithmetic, so evaluating them runs the command substitution.
    ARRAY_NAMES = ('a', 'QUERY', 'LIMIT', 'PATH', 'BASH_VERSINFO')
    LIVE_NAMES = ARRAY_NAMES[1:]

    def _stub_env(self, temp, response='{}'):
        bindir = Path(temp) / 'bin'
        bindir.mkdir()
        calls = Path(temp) / 'curl-calls'
        body = Path(temp) / 'response.json'
        body.write_text(response)
        (bindir / 'curl').write_text(f'#!/bin/sh\nprintf "%s\\n" "$*" >> "{calls}"\ncat "{body}"\n')
        (bindir / 'curl').chmod(0o755)
        return {**os.environ, 'PATH': f'{bindir}:{os.environ["PATH"]}'}, calls

    def test_payloads_run_commands_when_evaluated_as_arithmetic(self):
        # Canary for the test below: under the script's own shell options these payloads are live, so a missing
        # marker there means the script refused them, not that bash happened to abort first.
        snippet = 'set -euo pipefail; QUERY=q; LIMIT=10; PAGE="$1"; : $(( (PAGE - 1) * LIMIT ))'
        with tempfile.TemporaryDirectory() as temp:
            for name in self.LIVE_NAMES:
                with self.subTest(name=name):
                    marker = Path(temp) / f'live-{name}'
                    subprocess.run(['bash', '-c', snippet, '_', f'{name}[$(touch {marker})]'],
                                   capture_output=True, text=True, timeout=10)
                    self.assertTrue(marker.exists(), f'{name}[...] no longer executes in bash arithmetic')

    def test_limit_and_page_cannot_execute_commands(self):
        with tempfile.TemporaryDirectory() as temp:
            env, calls = self._stub_env(temp)
            for name in self.ARRAY_NAMES:
                marker = Path(temp) / f'pwned-{name}'
                payload = f'{name}[$(touch {marker})]'
                for args in (['q', '10', 'relevance', payload], ['q', payload]):
                    with self.subTest(name=name, position=len(args)):
                        result = subprocess.run(['bash', str(SEARCH), *args], capture_output=True,
                                                text=True, timeout=20, env=env)
                        self.assertFalse(marker.exists(), 'argument was evaluated as shell arithmetic')
                        self.assertNotEqual(result.returncode, 0)
                        # The refusal must come from validation, not from `set -u` aborting on an unset name.
                        self.assertNotIn('unbound variable', result.stderr)
                        self.assertIn('positive integer', result.stderr)
            self.assertFalse(calls.exists(), 'curl ran with an unvalidated limit or page')

    def test_limit_and_page_must_be_plain_positive_integers(self):
        with tempfile.TemporaryDirectory() as temp:
            env, calls = self._stub_env(temp)
            for bad in ('0', '-1', '08', '1.5', '1e3', ' 10', '10 ', '10&sort=x', '0x10', '1+1', '1234567890'):
                for args in (['q', '10', 'relevance', bad], ['q', bad]):
                    with self.subTest(value=bad, position=len(args)):
                        result = subprocess.run(['bash', str(SEARCH), *args], capture_output=True,
                                                text=True, timeout=20, env=env)
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn('positive integer', result.stderr)
            self.assertFalse(calls.exists(), 'curl ran with an invalid limit or page')

    def test_valid_limit_and_page_reach_the_api_with_the_right_offset(self):
        response = ('{"meta":{"count":1,"page":3,"per_page":25},"results":[{"cited_by_count":7,'
                    '"publication_year":2020,"title":"T","authorships":[],"doi":null,"id":"W1"}]}')
        with tempfile.TemporaryDirectory() as temp:
            env, calls = self._stub_env(temp, response)
            result = subprocess.run(['bash', str(SEARCH), 'q', '25', 'relevance', '3'], capture_output=True,
                                    text=True, timeout=20, env=env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('per_page=25&page=3&', calls.read_text())
            self.assertIn('51. [7 cites] (2020) T', result.stdout)
            defaults = subprocess.run(['bash', str(SEARCH), 'q'], capture_output=True, text=True,
                                      timeout=20, env=env)
            self.assertEqual(defaults.returncode, 0, defaults.stderr)
            self.assertIn('per_page=10&page=1&', calls.read_text().splitlines()[-1])


if __name__ == '__main__':
    unittest.main()

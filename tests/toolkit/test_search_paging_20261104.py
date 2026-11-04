"""Offline regressions for paper-search/scripts/search.sh limit/page validation.

curl is replaced by a stub on PATH that records each call, so nothing reaches the network.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEARCH = ROOT / 'skills/paper-search/scripts/search.sh'


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash') and shutil.which('jq'), 'needs bash and jq')
class SearchPagingValidationTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.temp = Path(self._temp.name)
        self.addCleanup(self._temp.cleanup)
        bindir = self.temp / 'bin'
        bindir.mkdir()
        self.curl_log = self.temp / 'curl.log'
        curl = bindir / 'curl'
        curl.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CURL_LOG"\n'
                        'echo \'{"meta":{"count":0,"page":1,"per_page":1},"results":[]}\'\n')
        curl.chmod(0o755)
        self.env = {**os.environ, 'PATH': f'{bindir}:{os.environ["PATH"]}',
                    'CURL_LOG': str(self.curl_log)}

    def run_search(self, *args):
        self.curl_log.unlink(missing_ok=True)
        return subprocess.run(['bash', str(SEARCH), *args], capture_output=True, text=True,
                              timeout=20, env=self.env, cwd=self.temp)

    def test_subscript_on_a_defined_variable_cannot_execute_commands(self):
        # Under `set -u` an unknown name like a[...] aborts before its subscript is
        # expanded, but a name the script (or the environment) defines does not.
        for name in ('QUERY', 'PATH', 'HOME'):
            marker = self.temp / f'pwned-{name}'
            payload = f'{name}[$(touch {marker})]'
            for args in (['q', '10', 'relevance', payload], ['q', payload]):
                with self.subTest(name=name, args=args):
                    marker.unlink(missing_ok=True)
                    result = self.run_search(*args)
                    self.assertFalse(marker.exists(), 'argument was evaluated as shell arithmetic')
                    self.assertNotEqual(result.returncode, 0)

    def test_non_positive_or_non_decimal_limit_and_page_are_rejected_before_any_request(self):
        for bad in ('0', '-1', '-5', 'abc', '1.5', '0x10', '010', '2+2', ' 3', '10&per_page=200'):
            for args in (['q', bad], ['q', '10', 'relevance', bad]):
                with self.subTest(args=args):
                    result = self.run_search(*args)
                    self.assertNotEqual(result.returncode, 0, result.stdout)
                    self.assertFalse(self.curl_log.exists(),
                                     f'curl was called for {args!r}: {self.curl_log.read_text() if self.curl_log.exists() else ""}')

    def test_valid_limit_and_page_still_query_with_the_expected_offset(self):
        result = self.run_search('q', '25', 'cites', '3')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.curl_log.read_text().splitlines()
        self.assertEqual(len(calls), 1)
        self.assertIn('per_page=25&page=3&sort=cited_by_count:desc', calls[0])


if __name__ == '__main__':
    unittest.main()

"""Offline URL parameter integrity regressions for paper-search sort selection.

The OpenAlex request is intercepted; this test never contacts external hosts.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SEARCH = ROOT / 'skills/paper-search/scripts/search.sh'


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash') and shutil.which('jq'), 'needs bash and jq')
class SearchSortParameterTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.temp = Path(self._temp.name)
        self.addCleanup(self._temp.cleanup)
        bindir = self.temp / 'bin'
        bindir.mkdir()
        self.curl_log = self.temp / 'curl.url'
        curl = bindir / 'curl'
        curl.write_text('#!/bin/sh\nprintf "%s\\n" "$2" > "$CURL_LOG"\n'
                        'echo \'{"meta":{"count":0,"page":1,"per_page":10},"results":[]}\'\n')
        curl.chmod(0o755)
        self.env = {**os.environ, 'PATH': f'{bindir}:{os.environ["PATH"]}',
                    'CURL_LOG': str(self.curl_log)}

    def run_search(self, sort):
        self.curl_log.unlink(missing_ok=True)
        result = subprocess.run(['bash', str(SEARCH), 'privacy proof', '10', sort, '2'],
                                capture_output=True, text=True, timeout=20, env=self.env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.curl_log.exists(), 'curl was not called')
        return parse_qs(urlsplit(self.curl_log.read_text().strip()).query)

    def test_custom_sort_cannot_add_an_openalex_filter_parameter(self):
        sort = 'publication_date:desc&filter=type:article'
        params = self.run_search(sort)
        self.assertEqual(params['sort'], [sort])
        self.assertNotIn('filter', params)
        self.assertEqual(params['page'], ['2'])

    def test_sort_aliases_and_custom_sort_still_reach_api_as_one_parameter(self):
        for value, expected in (('relevance', 'relevance_score:desc'),
                                ('cites', 'cited_by_count:desc'),
                                ('date', 'publication_date:desc'),
                                ('publication_date:asc', 'publication_date:asc')):
            with self.subTest(value=value):
                params = self.run_search(value)
                self.assertEqual(params['sort'], [expected])
                self.assertEqual(len(params['sort']), 1)


if __name__ == '__main__':
    unittest.main()

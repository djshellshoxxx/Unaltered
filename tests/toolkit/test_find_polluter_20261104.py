"""Offline regressions for systematic-debugging/find-polluter.sh test-file iteration.

npm is a stub on a PATH limited to the stub directory plus /usr/bin:/bin; it records each
argument list and creates the pollution only for the file named in $POLLUTER.
"""
import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIND_POLLUTER = ROOT / 'skills/systematic-debugging/find-polluter.sh'
BASH = shutil.which('bash')

NPM_STUB = textwrap.dedent('''\
    #!/bin/sh
    line=''
    for arg in "$@"; do line="$line[$arg]"; done
    printf '%s\\n' "$line" >> "$STUB_LOG"
    if [ -n "$POLLUTER" ] && [ "$2" = "$POLLUTER" ]; then touch polluted; fi
    exit 0
''')


@unittest.skipUnless(os.name == 'posix' and BASH and shutil.which('find'), 'needs bash and find')
class FindPolluterFileNameTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.temp = Path(self._temp.name)
        self.addCleanup(self._temp.cleanup)
        bindir = self.temp / 'bin'
        bindir.mkdir()
        (bindir / 'npm').write_text(NPM_STUB)
        (bindir / 'npm').chmod(0o755)
        self.project = self.temp / 'project'
        (self.project / 'tests').mkdir(parents=True)
        self.log = self.temp / 'npm.log'

    def make_tests(self, *names):
        for name in names:
            (self.project / 'tests' / name).write_text('// synthetic\n')

    def run_polluter(self, polluter=''):
        env = {'PATH': f'{self.temp / "bin"}:/usr/bin:/bin', 'HOME': str(self.temp),
               'STUB_LOG': str(self.log), 'POLLUTER': polluter, 'LC_ALL': 'C'}
        return subprocess.run([BASH, str(FIND_POLLUTER), 'polluted', 'tests/*.test.js'],
                              capture_output=True, text=True, timeout=30, env=env, cwd=self.project)

    def npm_calls(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def test_file_name_with_spaces_is_run_and_reported_as_one_file(self):
        self.make_tests('a b.test.js', 'plain.test.js')
        result = self.run_polluter(polluter='./tests/a b.test.js')
        self.assertEqual(self.npm_calls(), ['[test][./tests/a b.test.js]'])
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('FOUND POLLUTER', result.stdout)
        self.assertIn('Test: ./tests/a b.test.js\n', result.stdout)

    def test_glob_characters_in_file_names_are_not_expanded(self):
        names = ['a.test.js', 'x*.test.js', 'xy.test.js', '[ab].test.js']
        self.make_tests(*names)
        result = self.run_polluter()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('Found 4 test files', result.stdout)
        self.assertEqual(sorted(self.npm_calls()),
                         sorted(f'[test][./tests/{name}]' for name in names))
        self.assertNotIn('[5/4]', result.stdout)


if __name__ == '__main__':
    unittest.main()

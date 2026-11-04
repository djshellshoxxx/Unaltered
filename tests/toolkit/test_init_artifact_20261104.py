"""Offline regressions for web-artifacts-builder/scripts/init-artifact.sh argument handling.

node, npm and pnpm are stubs on a PATH limited to the stub directory plus /usr/bin:/bin.
The stubs only record their arguments; nothing is installed and nothing reaches the network.
"""
import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INIT_ARTIFACT = ROOT / 'skills/web-artifacts-builder/scripts/init-artifact.sh'
BASH = shutil.which('bash')

NODE_STUB = textwrap.dedent('''\
    #!/bin/sh
    if [ "$1" = "-v" ]; then echo v22.0.0; exit 0; fi
    printf 'node %s\\n' "$*" >> "$STUB_LOG"
    exit 1
''')
NPM_STUB = textwrap.dedent('''\
    #!/bin/sh
    printf 'npm %s\\n' "$*" >> "$STUB_LOG"
    exit 0
''')
# `pnpm create vite NAME ...` lays down the one template file the script edits with sed;
# every other pnpm call fails so the script stops right after that edit.
PNPM_STUB = textwrap.dedent('''\
    #!/bin/sh
    printf 'pnpm %s\\n' "$*" >> "$STUB_LOG"
    if [ "$1" = "create" ]; then
      mkdir -p -- "$3" || exit 1
      printf '%s\\n' '<link rel="icon" type="image/svg+xml" href="/vite.svg" />' \\
        '    <title>Vite + React + TS</title>' > "$3/index.html"
      exit 0
    fi
    exit 1
''')

UNSAFE_NAMES = (
    'x/;e touch pwned;#',        # GNU sed: ends s///, then `e` runs a shell command
    'x\ne touch pwned',          # same, via a newline in the sed script
    'a/b',
    'a&b',
    'a\\1',
    '../escape',
    '-x',
    'with space',
)


@unittest.skipUnless(os.name == 'posix' and BASH and shutil.which('sed'), 'needs bash and sed')
class InitArtifactArgsTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.temp = Path(self._temp.name)
        self.addCleanup(self._temp.cleanup)
        self.bindir = self.temp / 'bin'
        self.bindir.mkdir()
        self.runs = 0
        self.log = self.temp / 'stub.log'
        self._stub('node', NODE_STUB)
        self._stub('npm', NPM_STUB)

    def _stub(self, name, body):
        path = self.bindir / name
        path.write_text(body)
        path.chmod(0o755)

    def run_init(self, *args):
        # A fresh sandbox per run, so files left by one subtest cannot satisfy another.
        self.runs += 1
        self.sandbox = self.temp / f'run{self.runs}'
        self.work = self.sandbox / 'work'
        self.work.mkdir(parents=True)
        self.log.unlink(missing_ok=True)
        env = {'PATH': f'{self.bindir}:/usr/bin:/bin', 'HOME': str(self.temp),
               'STUB_LOG': str(self.log), 'LC_ALL': 'C'}
        return subprocess.run([BASH, str(INIT_ARTIFACT), *args], capture_output=True,
                              text=True, timeout=30, env=env, cwd=self.work)

    def calls(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def test_missing_argument_fails_before_installing_pnpm(self):
        result = self.run_init()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual([c for c in self.calls() if c.startswith('npm')], [],
                         'npm install ran before the project name was validated')

    def test_unsafe_name_fails_before_installing_pnpm(self):
        for name in UNSAFE_NAMES:
            with self.subTest(name=name):
                result = self.run_init(name)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual([c for c in self.calls() if c.startswith('npm')], [],
                                 'npm install ran before the project name was validated')

    def test_unsafe_name_is_rejected_before_it_reaches_pnpm_or_sed(self):
        self._stub('pnpm', PNPM_STUB)
        for name in UNSAFE_NAMES:
            with self.subTest(name=name):
                result = self.run_init(name)
                pwned = sorted(str(p) for p in self.sandbox.rglob('pwned'))
                self.assertEqual(pwned, [], 'project name was executed through sed')
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.calls(), [], 'pnpm ran with an unvalidated project name')

    def test_valid_name_still_reaches_the_title_edit(self):
        self._stub('pnpm', PNPM_STUB)
        result = self.run_init('my-app_1.0')
        index = self.work / 'my-app_1.0' / 'index.html'
        self.assertTrue(index.exists(), result.stdout + result.stderr)
        self.assertEqual(index.read_text(), '    <title>my-app_1.0</title>\n')
        self.assertEqual(self.calls()[0], 'pnpm create vite my-app_1.0 --template react-ts')


if __name__ == '__main__':
    unittest.main()

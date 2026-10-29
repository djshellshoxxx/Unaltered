"""Offline regressions for the bundled updater setup and doctor scripts; a stub curl stands in for the network."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'shared/scripts'
STUB_CURL = """#!/bin/sh
printf '%s\\n' "$@" > "$CURL_ARGS_LOG"
out=""
while [ $# -gt 0 ]; do
  if [ "$1" = "-o" ]; then out="$2"; shift; fi
  shift
done
printf 'not the published archive' > "$out"
"""


def run_doctor(project):
    result = subprocess.run([sys.executable, '-I', str(SCRIPTS / 'auto_update_doctor.py'), str(project), '--json'],
                            capture_output=True, text=True, timeout=60, check=True)
    return {check['name']: check['status'] for check in json.loads(result.stdout)['checks']}


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash'), 'needs bash')
class WinSparkleDownloadTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.addCleanup(self._temp.cleanup)
        self.base = Path(self._temp.name)
        (self.base / 'bin').mkdir()
        (self.base / 'bin' / 'curl').write_text(STUB_CURL)
        (self.base / 'bin' / 'curl').chmod(0o755)
        self.project = self.base / 'project'
        self.project.mkdir()
        self.log = self.base / 'curl-args'

    def run_setup(self, **env):
        return subprocess.run(['bash', str(SCRIPTS / 'setup_winsparkle.sh')], cwd=self.project, capture_output=True,
                              text=True, timeout=60,
                              env={**os.environ, 'PATH': f"{self.base / 'bin'}:{os.environ['PATH']}",
                                   'CURL_ARGS_LOG': str(self.log), **env})

    def test_digest_mismatch_installs_nothing(self):
        result = self.run_setup(WINSPARKLE_SHA256='00' * 32)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('does not match', result.stdout + result.stderr)
        self.assertFalse((self.project / 'external' / 'WinSparkle').exists())

    def test_download_refuses_non_https_redirects(self):
        self.run_setup(WINSPARKLE_SHA256='00' * 32)
        args = self.log.read_text().splitlines()
        for flag in ('--proto', '--proto-redir'):
            self.assertIn(flag, args)
            self.assertEqual(args[args.index(flag) + 1], '=https')

    def test_version_cannot_change_the_download_path(self):
        result = self.run_setup(WINSPARKLE_VERSION='0.9.2/../../x')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists(), 'curl ran with an unvalidated version')


class SetupUpdatesTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.addCleanup(self._temp.cleanup)
        self.project = Path(self._temp.name)

    def setup(self, env_text):
        (self.project / '.env').write_text(env_text)
        return subprocess.run([sys.executable, '-I', str(SCRIPTS / 'setup_updates.py'), '--project-root',
                               str(self.project), '--skip-download'], capture_output=True, text=True, timeout=60)

    def env_value(self, key):
        for line in (self.project / '.env').read_text().splitlines():
            if line.startswith(f'{key}='):
                return line.split('=', 1)[1]
        return None

    def test_missing_public_key_keeps_updates_disabled(self):
        result = self.setup('GITHUB_USER=u\nGITHUB_REPO=r\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.env_value('ENABLE_AUTO_UPDATE'), 'FALSE')
        self.assertIn('AUTO_UPDATE_EDDSA_PUBLIC_KEY is empty', result.stderr)

    def test_public_key_enables_updates(self):
        result = self.setup('GITHUB_USER=u\nGITHUB_REPO=r\nAUTO_UPDATE_EDDSA_PUBLIC_KEY=abc=\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.env_value('ENABLE_AUTO_UPDATE'), 'TRUE')

    def test_plain_http_feed_is_refused_without_writing(self):
        original = 'AUTO_UPDATE_EDDSA_PUBLIC_KEY=abc=\nAUTO_UPDATE_FEED_URL_MACOS=http://example.invalid/appcast.xml\n'
        result = self.setup(original)
        self.assertEqual(result.returncode, 1)
        self.assertEqual((self.project / '.env').read_text(), original)


class DoctorTests(unittest.TestCase):
    def test_enabled_without_key_and_http_feed_fail(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / '.env').write_text('ENABLE_AUTO_UPDATE=TRUE\nAUTO_UPDATE_FEED_URL_MACOS=http://example.invalid/a.xml\n'
                                          'AUTO_UPDATE_FEED_URL_WINDOWS=https://example.invalid/w.xml\n')
            status = run_doctor(project)
        self.assertEqual(status['Public EdDSA key configured'], 'fail')
        self.assertEqual(status['macOS feed URL'], 'fail')
        self.assertEqual(status['Windows feed URL'], 'pass')

    def test_disabled_without_key_only_warns(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / '.env').write_text('ENABLE_AUTO_UPDATE=FALSE\n')
            status = run_doctor(project)
        self.assertEqual(status['Public EdDSA key configured'], 'warn')
        self.assertEqual(status['macOS feed URL'], 'warn')


if __name__ == '__main__':
    unittest.main()

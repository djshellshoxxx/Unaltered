"""Offline Git-state regressions for the trusted cloud-publication scope boundary."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

GUARD = Path(__file__).with_name('cloud_scope_guard.py')


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'fixture')
        self.git('config', 'user.email', 'fixture@users.noreply.github.com')
        for path in ['src/ui/example.ts', 'src/core/net/allowlist.ts', 'scripts/build.mjs', 'docs/SPEC.md']:
            file = self.root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('original\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.base = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True)

    def guard(self):
        return subprocess.run(['python3', str(GUARD), self.base], cwd=self.root, text=True, capture_output=True)

    def test_staged_protected_change_missing_from_legacy_guard_is_rejected(self):
        (self.root / 'src/core/net/allowlist.ts').write_text('changed\n')
        self.git('add', 'src/core/net/allowlist.ts')
        self.assertEqual(self.git('ls-files', '-m', '-o', '--exclude-standard'), '')
        result = self.guard()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Rejected path', result.stderr)

    def test_staged_protected_deletion_missing_from_legacy_guard_is_rejected(self):
        self.git('rm', '-q', 'scripts/build.mjs')
        self.assertEqual(self.git('ls-files', '-m', '-o', '--exclude-standard'), '')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_new_protected_publisher_file_missing_from_diff_is_rejected(self):
        (self.root / 'scripts/unapproved.sh').write_text('echo unwanted\n')
        self.assertEqual(self.git('diff', '--name-only'), '')
        result = self.guard()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Rejected path', result.stderr)

    def test_committed_protected_change_is_rejected_against_original_base(self):
        (self.root / 'docs/SPEC.md').write_text('changed\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'agent commit')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_staged_and_untracked_safe_source_changes_are_allowed(self):
        (self.root / 'src/ui/example.ts').write_text('changed\n')
        self.git('add', '.')
        (self.root / 'src/ui/new.ts').write_text('new\n')
        result = self.guard()
        self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(os.name == 'posix', 'POSIX mode checks')
    def test_mode_change_is_rejected_even_when_core_filemode_is_disabled(self):
        self.git('config', 'core.filemode', 'false')
        (self.root / 'src/ui/example.ts').chmod(0o755)
        result = self.guard()
        self.assertNotEqual(result.returncode, 0)

    @unittest.skipUnless(os.name == 'posix', 'POSIX symlink checks')
    def test_staged_symlink_is_rejected(self):
        (self.root / 'src/ui/new.ts').symlink_to('/tmp/outside')
        self.git('add', '.')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_safe_source_deletion_is_rejected_conservatively(self):
        self.git('rm', '-q', 'src/ui/example.ts')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_control_character_filename_is_rejected(self):
        (self.root / 'src/ui/bad\n.ts').write_text('new\n')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_base_must_be_an_exact_commit(self):
        self.base = 'HEAD'
        self.assertNotEqual(self.guard().returncode, 0)


if __name__ == '__main__':
    unittest.main()

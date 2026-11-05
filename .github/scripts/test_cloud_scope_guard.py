"""Offline Git-state regressions for the trusted cloud-publication scope boundary."""
from contextlib import chdir
import os
from pathlib import Path
import runpy
import shlex
import subprocess
import sys
import tempfile
import unittest

GUARD = Path(__file__).with_name('cloud_scope_guard.py')
WORKFLOW = Path(__file__).parents[1] / 'workflows' / 'unaltered-codex-cloud.yml'


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

    def trusted_guard_commands(self):
        prefix = 'git show "$BASE_SHA:.github/scripts/cloud_scope_guard.py" | '
        commands = [shlex.split(line.strip().split(prefix, 1)[1])
                    for line in WORKFLOW.read_text().splitlines() if line.strip().startswith(prefix)]
        self.assertEqual(len(commands), 4, 'Exercise development, both packaging and publication boundaries')
        return [[self.base if arg == '$BASE_SHA' else arg for arg in command] for command in commands]

    def test_trusted_guard_never_imports_untrusted_checkout_modules(self):
        marker = self.root / 'executed-before-scope-check'
        (self.root / 'json.py').write_text(
            'from pathlib import Path\nPath("executed-before-scope-check").write_text("yes")\n')
        for command in self.trusted_guard_commands():
            with self.subTest(command=command):
                marker.unlink(missing_ok=True)
                result = subprocess.run(command, input=GUARD.read_text(), cwd=self.root, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0, 'The newly added root module is out of scope')
                self.assertFalse(marker.exists(), 'Rejecting the patch must not first execute its Python module')

    def test_trusted_guard_ignores_pythonpath_module_injection(self):
        marker = self.root / 'executed-before-scope-check'
        with tempfile.TemporaryDirectory() as outside:
            (Path(outside) / 'json.py').write_text(
                f'from pathlib import Path\nPath({str(marker)!r}).write_text("yes")\n')
            env = {**os.environ, 'PYTHONPATH': outside}
            for command in self.trusted_guard_commands():
                with self.subTest(command=command):
                    marker.unlink(missing_ok=True)
                    result = subprocess.run(command, input=GUARD.read_text(), cwd=self.root, env=env,
                                            text=True, capture_output=True)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertFalse(marker.exists(), 'Interpreter environment must not run untrusted modules')

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

    @unittest.skipUnless(os.name == 'posix', 'POSIX executable probe')
    def test_malformed_base_is_rejected_before_any_git_process(self):
        probe = self.root / 'bin'
        probe.mkdir()
        executable = probe / 'git'
        executable.write_text('#!/bin/sh\n: > "$UNALTERED_GIT_PROBE"\nexit 99\n')
        executable.chmod(0o755)
        marker = self.root / 'git-was-called'
        env = {**os.environ, 'PATH': str(probe), 'UNALTERED_GIT_PROBE': str(marker)}
        for value in ['', 'HEAD', '--help', '--version', '-c', '--config-env=core.pager=EVIL',
                      '--upload-pack=payload', 'a' * 39, 'a' * 41, 'A' * 40, 'g' * 40,
                      'a' * 40 + '\n', 'a' * 39 + '\t', 'a' * 39 + '\r', 'a' * 40 + ' --help',
                      'a' * 40 + ';payload', 'a' * 40 + '^{commit}']:
            with self.subTest(value=repr(value)):
                result = subprocess.run([sys.executable, '-I', str(GUARD), value], cwd=self.root,
                                        env=env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(marker.exists(), 'Malformed input must not reach any Git process')

    @unittest.skipUnless(os.name == 'posix', 'Ubuntu workflow executable boundary')
    def test_guard_does_not_execute_a_path_shadowed_git(self):
        probe = self.root / 'bin'
        probe.mkdir()
        executable = probe / 'git'
        executable.write_text('#!/bin/sh\n: > "$UNALTERED_GIT_PROBE"\nexit 99\n')
        executable.chmod(0o755)
        marker = self.root / 'git-was-called'
        # Keep the probe outside scope accounting so successful validation is still possible.
        self.git('config', 'core.excludesFile', str(self.root / 'ignored'))
        (self.root / 'ignored').write_text('/bin/\n/ignored\n')
        env = {**os.environ, 'PATH': str(probe), 'UNALTERED_GIT_PROBE': str(marker)}
        result = subprocess.run([sys.executable, '-I', str(GUARD), self.base], cwd=self.root,
                                env=env, text=True, capture_output=True)
        self.assertFalse(marker.exists(), 'The trusted validator must not resolve Git through an untrusted PATH')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_valid_hex_must_identify_a_commit(self):
        self.base = self.git('rev-parse', 'HEAD^{tree}').strip()
        self.assertNotEqual(self.guard().returncode, 0)

    def test_base_must_be_an_ancestor_of_current_head(self):
        self.git('checkout', '-q', '--orphan', 'unrelated')
        self.git('commit', '-qm', 'unrelated root')
        self.assertNotEqual(self.guard().returncode, 0)

    def test_unmerged_index_is_rejected(self):
        blob = self.git('rev-parse', 'HEAD:src/ui/example.ts').strip()
        self.git('update-index', '--force-remove', 'src/ui/example.ts')
        stages = ''.join(f'100644 {blob} {stage}\tsrc/ui/example.ts\n' for stage in [1, 2, 3])
        subprocess.run(['git', 'update-index', '--index-info'], input=stages, cwd=self.root,
                       text=True, capture_output=True, check=True)
        self.assertNotEqual(self.guard().returncode, 0)

    def test_git_api_requires_an_immutable_validated_base(self):
        api = runpy.run_path(str(GUARD))
        with self.assertRaises(TypeError):
            api['GitState']('--help')
        with self.assertRaises(ValueError):
            api['CapturedBase']('--help')
        base = api['CapturedBase'](self.base)
        with self.assertRaises(AttributeError):
            base.value = 'HEAD'
        state = api['GitState'](base)
        with chdir(self.root):
            state.verify_base()


if __name__ == '__main__':
    unittest.main()

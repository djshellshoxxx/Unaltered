"""Fail-closed path boundary for cloud patches; execute bytes from the captured trusted Git base.

This policy deliberately excludes trust/network/cryptographic code and all workflow/build/release controls.
It does not replace independent code review: allowed tests and sources can themselves execute code.
"""
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

SAFE_PREFIXES = ('src/ui/', 'src/core/strip/', 'tests/unit/', 'tests/e2e/', 'tests/fuzz/', 'tests/helpers/')
SAFE_EXACT = {'src/main.ts', 'scripts/parser-fuzz.mjs', 'unaltered-codex-report.txt'}
PROTECTED_DOCS = {'OPSEC.md', 'SPEC.md', 'RELEASE.md', 'DECISIONS.md', 'DEPENDENCIES.md', 'THREAT_MODEL.md', 'AUDIT.md', 'NETWORK.md', 'R1_ACCEPTANCE.md'}


# This guard runs only in the Ubuntu workflow. Never discover its executable through an agent-controlled PATH.
TRUSTED_GIT = ('/usr/bin/git', '--no-replace-objects', '--no-pager', '-c', 'core.fsmonitor=false')


@dataclass(frozen=True)
class CapturedBase:
    """An exact immutable commit identifier, never a Git option, revision expression or mutable ref."""

    value: str

    def __post_init__(self):
        if not isinstance(self.value, str) or re.fullmatch('[0-9a-f]{40}', self.value) is None:
            raise ValueError('Expected an immutable full commit SHA')


class GitState:
    """Fixed read-only operations: callers cannot supply Git switches or arbitrary command argument vectors."""

    def __init__(self, base: CapturedBase):
        if not isinstance(base, CapturedBase):
            raise TypeError('Git state requires a validated captured base')
        self.base = base

    def verify_base(self):
        # Git documents --end-of-options for verification of untrusted revision operands. The validated SHA is also
        # kept behind each command's option terminator, independently of the input validation above.
        verified = subprocess.check_output([
            *TRUSTED_GIT, 'rev-parse', '--verify', '--end-of-options', self.base.value + '^{commit}',
        ], stderr=subprocess.PIPE).decode().strip()
        if verified != self.base.value:
            raise ValueError('Base does not identify the captured commit')
        subprocess.check_output([
            *TRUSTED_GIT, 'merge-base', '--is-ancestor', '--', self.base.value, 'HEAD',
        ], stderr=subprocess.PIPE)

    def root(self):
        return Path(os.fsdecode(subprocess.check_output([
            *TRUSTED_GIT, 'rev-parse', '--show-toplevel',
        ], stderr=subprocess.PIPE).strip()))

    def changed_paths(self):
        outputs = [
            subprocess.check_output([
                *TRUSTED_GIT, 'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z',
                '--end-of-options', self.base.value, 'HEAD', '--',
            ], stderr=subprocess.PIPE),
            subprocess.check_output([
                *TRUSTED_GIT, 'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z',
                '--cached', '--end-of-options', self.base.value, '--',
            ], stderr=subprocess.PIPE),
            subprocess.check_output([
                *TRUSTED_GIT, 'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--',
            ], stderr=subprocess.PIPE),
            subprocess.check_output([
                *TRUSTED_GIT, 'ls-files', '--others', '--exclude-standard', '-z', '--',
            ], stderr=subprocess.PIPE),
        ]
        return {os.fsdecode(path) for output in outputs for path in output.split(b'\0') if path}

    def tree_entries(self):
        return subprocess.check_output([
            *TRUSTED_GIT, 'ls-tree', '-r', '-z', '--', self.base.value,
        ], stderr=subprocess.PIPE)

    @staticmethod
    def index_entries():
        return subprocess.check_output([
            *TRUSTED_GIT, 'ls-files', '--stage', '-z', '--',
        ], stderr=subprocess.PIPE)


def allowed(path):
    if any(ord(c) < 32 or ord(c) == 127 for c in path) or '\\' in path:
        return False
    if any(part in ('', '.', '..') for part in path.split('/')):
        return False
    folded = path.casefold()
    if any(token in folded for token in ('secret', 'credential', '.env')):
        return False
    if path in SAFE_EXACT or path.startswith(SAFE_PREFIXES):
        return True
    return path.startswith('docs/') and path.endswith('.md') and path.split('/')[1] not in PROTECTED_DOCS and not path.startswith(('docs/gates/', 'docs/diagnostics/'))


def tree_modes(state):
    out = {}
    for item in state.tree_entries().split(b'\0'):
        if item:
            meta, path = item.split(b'\t', 1)
            out[os.fsdecode(path)] = meta.split()[0].decode('ascii')
    return out


def index_modes(state):
    out = {}
    for item in state.index_entries().split(b'\0'):
        if item:
            meta, path = item.split(b'\t', 1)
            mode, _, stage = meta.split()
            if stage != b'0':
                raise ValueError('Unmerged index')
            out[os.fsdecode(path)] = mode.decode('ascii')
    return out


def main():
    if len(sys.argv) != 2:
        raise ValueError('Expected an immutable full commit SHA')
    base = CapturedBase(sys.argv[1])
    state = GitState(base)
    state.verify_base()
    root = state.root()
    os.chdir(root)
    changed = state.changed_paths()
    original = tree_modes(state)
    index = index_modes(state)
    # Git may ignore worktree mode changes with core.filemode=false. Inspect modes independently.
    for path in original.keys() | index.keys():
        file = root / path
        if file.is_symlink():
            changed.add(path)
        elif file.exists() and file.is_file():
            expected = original.get(path)
            current = '100755' if file.stat().st_mode & stat.S_IXUSR else '100644'
            if expected and current != expected:
                changed.add(path)
    problems = []
    for path in sorted(changed):
        if not allowed(path):
            problems.append(f'Rejected path: {json.dumps(path)}')
            continue
        file = root / path
        if any(part.is_symlink() for part in [file, *file.parents] if part != root.parent):
            problems.append(f'Symlink path: {json.dumps(path)}')
            continue
        try:
            mode = file.lstat().st_mode
        except FileNotFoundError:
            problems.append(f'Deletion requires independent review: {json.dumps(path)}')
            continue
        if not stat.S_ISREG(mode):
            problems.append(f'Non-regular file: {json.dumps(path)}')
            continue
        actual = '100755' if mode & stat.S_IXUSR else '100644'
        expected = original.get(path, '100644')
        if actual != expected or index.get(path, expected) != expected or expected not in ('100644', '100755'):
            problems.append(f'File mode change: {json.dumps(path)}')
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        return 1
    print(f'Scope checked against {base.value}: {len(changed)} path(s)')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError):
        print('Scope validation failed; no patch is eligible for publication.', file=sys.stderr)
        sys.exit(1)

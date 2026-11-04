"""Fail-closed path boundary for cloud patches; execute bytes from the captured trusted Git base.

This policy deliberately excludes trust/network/cryptographic code and all workflow/build/release controls.
It does not replace independent code review: allowed tests and sources can themselves execute code.
"""
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


def git(*args):
    return subprocess.check_output(['git', *args], stderr=subprocess.PIPE)


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


def tree_modes(base):
    out = {}
    for item in git('ls-tree', '-r', '-z', base).split(b'\0'):
        if item:
            meta, path = item.split(b'\t', 1)
            out[os.fsdecode(path)] = meta.split()[0].decode('ascii')
    return out


def index_modes():
    out = {}
    for item in git('ls-files', '--stage', '-z').split(b'\0'):
        if item:
            meta, path = item.split(b'\t', 1)
            mode, _, stage = meta.split()
            if stage != b'0':
                raise ValueError('Unmerged index')
            out[os.fsdecode(path)] = mode.decode('ascii')
    return out


def main():
    if len(sys.argv) != 2 or re.fullmatch('[0-9a-f]{40}', sys.argv[1]) is None:
        raise ValueError('Expected an immutable full commit SHA')
    base = sys.argv[1]
    if git('rev-parse', '--verify', base + '^{commit}').decode().strip() != base:
        raise ValueError('Base does not identify the captured commit')
    git('merge-base', '--is-ancestor', base, 'HEAD')
    root = Path(os.fsdecode(git('rev-parse', '--show-toplevel').strip()))
    os.chdir(root)
    changed = set()
    for args in [
        ('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', base, 'HEAD', '--'),
        ('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--cached', base, '--'),
        ('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--'),
        ('ls-files', '--others', '--exclude-standard', '-z'),
    ]:
        changed.update(os.fsdecode(p) for p in git(*args).split(b'\0') if p)
    original = tree_modes(base)
    index = index_modes()
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
    print(f'Scope checked against {base}: {len(changed)} path(s)')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError):
        print('Scope validation failed; no patch is eligible for publication.', file=sys.stderr)
        sys.exit(1)

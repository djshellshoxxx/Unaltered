# Separate cloud automation scope repair — 2026-11-04

Branch `codex/automation-scope-guards-20261104`, based on cached main `1b6dd91`. This change is separate from the
application recovery candidate. It does not include or activate PR41/42, add automatic merging, dispatch paid work,
change API credentials, or publish a release.

The existing development guard only read `git ls-files -m -o`. Staged-only edits, staged deletions and commits could
escape it. A publisher that reads only `git diff --name-only` also misses newly added files after `git apply` without
`--index`. These gaps were reproduced in synthetic Git repositories before correction.

The new protected helper in `.github/scripts/cloud_scope_guard.py` checks committed, staged, unstaged and untracked
paths against an immutable base captured before model execution. Paths use NUL delimiters. Index conflicts, symlinks,
non-regular files, deleted files and executable-mode changes fail closed. Worktree mode checks remain effective when
Git's `core.filemode` is disabled. The conservative path policy allows UI/metadata source, selected tests, ordinary
Markdown status documents and the existing parser fuzz driver. Cryptographic/hash/OTS/network policy code,
workflow/build/release configuration, dependencies and canonical trust documents require separate human-reviewed work.

Development loads guard bytes from the captured Git base rather than the model-editable worktree, and rechecks after
running changed tests and after staging. Publication starts from a fresh trusted checkout, rejects any changed main
base, applies the patch with `--index`, and repeats the same guard before PR creation or CI dispatch. All resulting PRs
are drafts. Patch transport lives outside the checkout. No untrusted patch code executes in the privileged publisher.

Validation: ten offline scope tests pass. Eight failed against the reproduced legacy path policy; the tests cover
staged protected changes/deletions, untracked publisher files, model commits, safe staged/new sources, ignored mode
changes, symlinks, source deletion, control-character paths and invalid base identifiers. Python compile and
`git diff --check` also pass. Hosted workflow execution and live publication are unverified.

This is a scope-boundary repair, not complete paid-automation qualification. Existing scheduled execution remains
inherited from main. Hard API token/dollar limits, actual usage/cost accounting, persisted failure backoff and safe
review governance remain unresolved; do not enable broader paid scheduling or integrate PR41/42 on this evidence.
The existing same-job model/test execution is not a full isolation boundary. The fresh publisher guard restricts paths,
not malicious semantics within allowed code; independent review and exact-head CI remain mandatory.

Recovery: use the separate automation bundle provided by the recovery session, check out the named branch, run
`python3 .github/scripts/test_cloud_scope_guard.py`, and inspect this diff independently from application changes.

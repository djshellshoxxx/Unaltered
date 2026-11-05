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

## Independent recovery review — 2026-11-05

The retained `2d42bf0` guard and tests are unique relative to main `1b6dd91` and the refreshed PR41/42 heads
`d352916`/`db519a9`. All ten existing Git-state tests pass in the unrestricted recovery environment.
The patch remains separate from core application work, and the checkout had no dirty files or stashes before review.

Review reproduced an additional publication-boundary defect: loading trusted guard bytes with `python3 -` still allows
Python to import a patch-provided root `json.py` before the guard can reject that file. `PYTHONPATH` can similarly
redirect imports. The guard now runs as `python3 -I -` at all four development, packaging and publication invocations.
[Python isolated mode](https://docs.python.org/3/using/cmdline.html#cmdoption-I) excludes the working directory and user
site packages from module lookup and ignores `PYTHON*` environment variables. Two new regression tests execute the
actual four workflow invocations against checkout-local and `PYTHONPATH` module injection. Their eight subcases failed
before the invocation repair; all twelve tests pass after it. No workflow was activated or dispatched.

This does not qualify paid scheduling, spending controls or same-job agent isolation. The inherited daily schedule,
missing hard expenditure limits, missing cost accounting/backoff and requirement for independent code review remain.
PR41/42 use shell scope loops rather than this Python stdin launcher; their existing enumeration gaps are not resolved
by this isolated change. Do not fold in their automatic integration or parallel paid execution as part of this repair.

## Git argument and executable boundary — 2026-11-05

PR52 analysis at `75cb81e` reports `pythonsecurity:S8705`, issue `AaGtmvaYEQLW3PQJTyKi`, tracing the command-line base
through the generic Git wrapper into `rev-parse`. Seventeen adversarial CLI cases (leading switches, revision syntax,
control characters, trailing arguments and malformed/uppercase/wrong-length SHA text) now confirm rejection before
any Git process starts. No argument-injection reproduction was found after the required exact-SHA validation.
Review did reproduce a separate executable lookup defect: a malicious `git` earlier in `PATH` ran before validation.

The generic arbitrary-argument wrapper has been replaced with an immutable validated `CapturedBase` and fixed
read-only `GitState` operations. Every dynamic revision operand follows its command's explicit option terminator:
`--end-of-options` for `rev-parse`/`diff`, and `--` for `merge-base`/`ls-tree`. See
[Git's untrusted revision guidance](https://git-scm.com/docs/git-rev-parse#Documentation/git-rev-parse.txt---verify).
The Ubuntu-only workflow guard uses `/usr/bin/git` directly, disables paging and the optional filesystem monitor,
and retains the existing external-diff/text-conversion prohibitions. It does not discover executables through `PATH`.

All eighteen offline tests pass, including the reproduced PATH shadow, immutable API, non-commit/non-ancestor base and
unmerged index cases, plus the existing four-launcher module-injection and Git-state path-policy regressions.
Python compilation, OPSEC and diff checks pass. The allowlist and rejection rules for paths, modes, symlinks and deletions
are unchanged. These are functional argument/executable boundaries; no analyzer suppression or rule configuration is
introduced. External Sonar reanalysis remains required after publication; local passing tests alone do not close it.

The inherited daily schedule, missing expenditure/accounting/backoff controls and same-job agent isolation limitations
remain unchanged. No paid workflow, merge, production deployment or release is authorized by this repair.

# Security audit round 4 — 2026-11-19

Base: `1b75b950eb151562415c362e676c569fdd80de55` on the integrated development candidate.
Worker branch: `audit/security-round4-20261119`.
Implementation commit: `94d0525` (`ci: require native Windows junction safety checks`).

## Result

This fresh worker reviewed the third round's literal Unicode configuration and Windows reparse-point repairs. No additional demonstrated product defect was found in that scope. The actionable qualification gap was that the two new native Windows junction regressions were skipped by the Linux-only toolkit job and were not invoked in the existing Windows job.

The Windows job now installs Python 3.11 using the same reviewed, full-SHA `actions/setup-python` pin as the reference job. A required Python step selects exactly these existing cases:

- `test_windows_destination_junction_is_refused`
- `test_windows_template_junction_is_refused_before_overwrite`

The step rejects the wrong host or Python minor version before loading the tests. After execution, it fails unless exactly two tests ran successfully with zero skips. Both cases create actual directory junctions using `mklink /J` and verify that the generator refuses them while preserving existing content. They exercise the generator before any starter initialization or SDK tooling is needed.

Python 3.11 supplies the Windows reparse attributes used by the fix, while the convenience `Path.is_junction()` helper was introduced in 3.12; references are retained in the [third-round report](SECURITY-20261119-ROUND3.md). The workflow uses GitHub's documented [`shell: python` execution mode](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsshell), so the interpreter selected by setup-python executes the step directly.

This adds two steps to the existing Windows job. Job count, runner, timeout, workflow triggers, schedules, permissions, model settings, and paid automation activation are unchanged. Existing build, test, browser, archive, and checksum gates remain in place.

## Independent review

- The shared configuration reader and updater now agree on LF record framing. Quoted U+0085/U+2028/U+2029 remain literal data; the updater validates and serializes replacement values before writing. The version writer explicitly reads and writes UTF-8 in both version files.
- The generator checks symbolic-link mode and Windows reparse attributes using `lstat` before removing a destination or copying a template entry. Its missing-parent and overlap behavior remains covered. The preflight still assumes a stable filesystem and an intentionally selected template; this review does not turn it into a sandbox against concurrent filesystem replacement.
- Native junction tests invoke the real generator in a subprocess with `--force` and a synthetic template. A refused destination must still exist, and the original marker must remain. The template-junction case requires the existing destination marker to survive.
- The workflow gate checks actual test count, skip list, and success instead of accepting unittest's normal zero exit status for an all-skipped suite. A static workflow regression also protects the required Python version, action pin reuse, selected cases, and unconditional failure behavior.

## Validation

| Check | Result |
| --- | --- |
| New workflow contract on the parent workflow | Failed as expected: no Python/native-junction qualification step. The six existing contracts passed. |
| `node --test tests/ci/workflows.test.mjs` after the change | 7 passed, zero skipped. |
| `python -m unittest discover -s tests/toolkit -p 'test_env_config_20261119.py' -v` | 9 passed. |
| `python -m unittest discover -s tests/toolkit -p 'test_create_project_20261119.py' -v` | 25 total: 23 passed, 2 native Windows cases skipped on Linux. |
| Extract and compile the actual workflow's Python block; invoke it on this Linux host | Syntax valid; exit 1 with the required-native-Windows message before tests ran. This is a guard check, not native junction evidence. |
| `node --max-old-space-size=384 node_modules/eslint/bin/eslint.js tests/ci/workflows.test.mjs` | Passed. |
| `git diff --check` | Passed. |

No native Windows or browser execution occurred in this worker. Passing local contracts cannot establish that the junction cases pass on Windows. The parent owns publication and exact-source hosted qualification.

## Fresh-worker handoff

1. Integrate the workflow/contract commit, retaining the required two-test, zero-skip condition.
2. Inspect the final candidate's Windows CI log for two executed, passing junction cases on Python 3.11. A queued run, an unrelated checkpoint, or the Linux skips do not close this gate.
3. If native execution exposes a portability defect, preserve the fixtures and failure output, fix the demonstrated cause, and rerun the same assertions.
4. Keep the dependency update and final integrated qualification evidence with their respective workers and coordinator. No dependency pins changed in this lane.

This was an internal development review using synthetic local data, not an external human audit. No remote mutation, workflow dispatch, release, deployment, or API-funded model execution was performed.

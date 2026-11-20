# Security audit round 3 — 2026-11-19

Base: `e5efcba05dbfb60a67195a264bc023986f3c424d` on `integration/unaltered-reviewed-20261119`.
Worker branch: `audit/security-round3-20261119`.

This fresh development review inspected the two previous security handoffs and the integrated starter path checks, shared literal configuration reader and its five consumers, updater feed output, Pages comparator, cloud publication scope boundary, and inactive admission-policy source. All test inputs were synthetic and local. This is an independent worker pass within development, not an external human security audit.

## Confirmed defects and fixes

| Commit | Finding and change | Evidence |
| --- | --- | --- |
| `6113575d8300de79774fe818967cc4b68c216f52` | The updater used Unicode-aware `splitlines()` while the shared reader treats LF as the record separator. Rewriting an unrelated flag changed U+0085, U+2028, and U+2029 inside a quoted developer name into actual LF characters, corrupting the value. The writer now uses the same LF record framing and strict UTF-8 decoding as the reader. | The new round-trip regression failed for all three separators before the change and passed afterward. |
| `6113575d8300de79774fe818967cc4b68c216f52` | The version reader used UTF-8 but the version writer used the host locale for `.env` and `CMakeLists.txt`. A non-UTF-8 locale could fail to read names emitted by the generator. All four version-file read/write operations now select UTF-8 explicitly. | A subprocess with the C locale and Python UTF-8 mode disabled failed with `UnicodeDecodeError` before the change. It now preserves the synthetic Chinese/Cyrillic text and updates both versions correctly. |
| `986e80bd7cccab7a7e64d0ea7470767c0609a3b7` | Junction refusal depended on the optional `Path.is_junction()` helper, leaving older Python versions with only the symbolic-link check. The starter now checks `lstat` file attributes for Windows reparse points as well as symbolic-link mode before overwrite or copy. | Synthetic directory-shaped and regular-file-shaped reparse metadata produced three failed assertions/subtests on the baseline. Both new tests pass after the fix. Two additional native Windows junction cases are present but were skipped on this Linux host. |

Python's documentation identifies [`Path.is_junction()` as new in 3.12](https://docs.python.org/3/library/pathlib.html#pathlib.Path.is_junction). Windows [`st_file_attributes` predates that helper](https://docs.python.org/3.11/library/os.html#os.stat_result.st_file_attributes), and the [`stat` module provides `FILE_ATTRIBUTE_REPARSE_POINT`](https://docs.python.org/3.11/library/stat.html#stat.FILE_ATTRIBUTE_REPARSE_POINT). The compatibility tests exercise this documented metadata contract; they are not a substitute for a native Windows run.

The configuration findings establish data corruption and locale-dependent failure. This lane did not establish an external exploitation path for those findings.

## Independent boundary review

- The literal reader never evaluates configuration text. It removes one matching quote pair and decodes only the generator's four double-quoted escapes. The five Python consumers load the adjacent reader; the release-note test intercepts its transport and uses a synthetic authorization value. Literal configuration remains a defined subset, not a shell interpreter.
- The updater serializes replacement values before modifying the existing file. Ordinary bare flags retain their expected representation. XML title/version output escapes text delimiters; the existing XML regression confirms tag-like project text cannot become a feed element.
- Starter checks still precede destructive overwrite, preserve missing-parent creation, reject overlap, and exclude the established `.git`, `integrate`, and `todo` entries. The reparse change conservatively rejects Windows reparse entries rather than following them. Preflight checks still assume a stable filesystem and a deliberately selected executable template; they are not a sandbox against concurrent filesystem substitution.
- The Pages comparator normalizes the supplied root lexically before `lstat`, rejects linked roots and linked descendants, and compares portable relative names plus content hashes. All three existing comparator tests independently passed, including trailing slash/dot root spellings in both argument positions.
- The cloud scope guard uses captured base bytes, fixed Git/Python executables, isolated Python imports, and disabled replacement refs. It checks committed, indexed, working-tree, and untracked paths, plus modes and symlinks. Fresh publisher validation checks the applied patch as data before draft PR creation. All 22 boundary tests independently passed.
- A path allowlist does not prove that permitted source or tests have safe behavior. Changed tests run in the development job; the guard does not supply full process/filesystem isolation for that job. This remains a documented limitation, not a new claim of isolation.
- The admission helper remains a pure predicate over supplied metadata. It is still **unwired**: no active budget enforcement, owner opt-in behavior, or spending cap is claimed for the inherited schedule. All 24 offline admission tests passed.

No additional demonstrated scope-boundary, literal-evaluation, XML element-creation, or comparator link defect remained in the reviewed cases. That statement is limited to this source inspection and the recorded regressions.

## Exact local validation

| Command | Result |
| --- | --- |
| `python3 -m unittest discover -s tests/toolkit -p test_env_config_20261119.py -v` | 9 passed. New regressions failed first with four assertions/subtests. |
| `python3 -m unittest discover -s tests/toolkit -p test_create_project_20261119.py -v` | 25 total: 23 passed, 2 native Windows tests skipped. Synthetic reparse baseline failed three assertions/subtests. |
| `python3 -m unittest discover -s tests/toolkit -p test_updater_trust_20261029.py -v` | 10 passed. |
| `python3 -I .github/scripts/test_cloud_scope_guard.py` | 22 passed. |
| `python3 -I .github/scripts/test_cloud_run_policy.py` | 24 passed. |
| `node_modules/.bin/vitest run tests/unit/pages-build-comparison.test.ts --maxWorkers=1` | 3 passed. |
| `node --test tests/ci/workflows.test.mjs` | 6 passed. |
| `gitleaks git . --log-opts=e5efcba05dbfb60a67195a264bc023986f3c424d..HEAD --redact --no-banner` at `986e80b` | Both code commits scanned; no leaks reported. |
| `git diff --check` | Passed. |
| `git diff --name-only e5efcba05dbfb60a67195a264bc023986f3c424d HEAD -- .github` at `986e80b` | Empty: no workflow or guard source changes in this round. |

No full TypeScript, native browser, release, or cross-platform qualification was attempted in this lane. The parent owns the final integrated candidate and hosted qualification.

## Fresh-worker handoff

1. Review and integrate the two code commits independently, preserving the explicit distinction between synthetic Windows metadata coverage and native Windows evidence.
2. Run the starter suite on a native Windows host, including the two `mklink /J` fixtures; if older Python compatibility is part of the supported toolkit, exercise Python 3.10/3.11 as well as the current version. The existing Python toolkit CI job is Linux-only, so its success does not fill this gap.
3. Qualify the final integrated tree using the parent's normal gates. This report's tests apply to this branch, not an unspecified later candidate.
4. Keep future admission-policy wiring and any associated automation configuration separately scoped. Workflow triggers, schedules, permissions, paid API/model settings, publication behavior, and activation were unchanged here.

This worker performed no remote mutation, workflow dispatch, API-funded model execution, deployment, or publication. No real credentials or private user data were used in the tests.

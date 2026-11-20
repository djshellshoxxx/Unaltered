# Security audit round 1 — 2026-11-19

Base: `abc6ff24c5da14261d5919c68673ee3ad8c6db99` (PR #96).
Lane: starter generator, filesystem boundaries, and Pages reproducibility comparison.

## Confirmed findings and fixes

- `create_project.py` removed an existing `--force` destination before validating the source. Missing files, invalid templates, and overlapping paths could remove the destination or the starter itself. Source markers, tree entry types, and non-overlapping resolved paths are now checked first. Destination symlinks/junctions are refused. Ordinary missing parent directories remain supported.
- Template symlinks were followed while copying, permitting files outside the selected template to enter the generated project. Copied trees now reject links, dangling links, and non-regular entries before overwrite. Existing `.git`, `integrate`, and `todo` exclusions are preserved.
- The generator accepted an app-specific password and wrote it into `.env`. The removed option is hidden and rejected with a generic message that does not echo its value; the generated password field is empty. The compatibility rejection avoids argparse printing an unknown argument together with the secret.
- Generated `.env` values were executable shell text. A synthetic developer name containing command substitution created a marker when the generated file was sourced. Generated values now escape double quotes, backslashes, dollar signs, and backticks; options containing control characters are refused before filesystem changes.
- `compare-pages-builds.mjs` accepted a symbolic-link root when passed with a trailing slash or dot. The root is lexically resolved before `lstat`, preserving rejection for bare, slash, dot, and dot/slash variants in either argument.

## Verification

- Before the source/password fix: 19 Python tests ran with 13 failing assertions/subtests, demonstrating destructive pre-validation behavior, external-file copying, and password acceptance.
- Before the `.env` fix: both additional tests failed; the shell command-substitution marker was actually created inside a disposable fixture.
- Final generator suite: `python3 -m unittest discover -s tests/toolkit -p test_create_project_20261119.py -v` — **21 passed**.
- Before the comparator fix: the symlink root with a trailing slash returned success and failed its regression assertion.
- Comparator suite: `node_modules/.bin/vitest run tests/unit/pages-build-comparison.test.ts --maxWorkers=1` — **3 passed** on the final unchanged retry.
- An earlier comparator run exceeded its existing 30-second test timeout during shared host resource pressure. That failure is distinct from the subsequent passing result; neither the repository timeout nor the checks were relaxed.
- `git diff --check` passed. No full TypeScript, cross-platform, release, or hosted-CI qualification was claimed by this lane.

## Handoff to a fresh security worker

1. Independently review the generator and comparator diffs and the regression assumptions. Check Windows junction behavior and the normal absent-parent path on hosted CI.
2. Inspect non-shell `.env` readers: several bundled helpers strip quotes without decoding escapes. The shell round-trip of special values is tested here; special-character display/configuration round-trips through those readers need separate review.
3. Inspect unique PR #52 automation scope-guard work against the current integrated tree. Preserve workflow triggers, permissions, protected-path checks, and paid-workflow restrictions while evaluating safe integration.
4. Source templates and artifact directories must remain stable during these local operations. Preflight validation does not provide a sandbox against concurrent hostile filesystem mutation or malicious executable template contents. No claim of independent human security audit is made.

This lane used synthetic fixtures only. It did not publish, deploy, push, merge remote changes, modify credentials, or activate paid automation.

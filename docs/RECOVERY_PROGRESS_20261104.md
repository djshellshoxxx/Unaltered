# Recovery and qualification ledger — 2026-11-04 UTC

Integration owner: root, branch `codex/recover-qualify-20261104`, recovered base `7e8f437`.
Recovery bundle independently verified; original main `1b6dd91` and its uncommitted lockfile edits preserved.
All workers below were confirmed local subagents using isolated checkouts. No additional cloud instances were started.

| Owner | Branch/base | Exclusive source ownership | Tests/dependencies | Integration/status |
|---|---|---|---|---|
| Root | recovery / `7e8f437` | `src/ui/views/verify.ts`, new UI lifecycle tests, integration documentation | Fake-DOM lifecycle/focus tests; Node 22 clean-cache installation | Upgrade abort, overlap prevention and keyboard focus committed; source integrations owned here |
| Reliability | `codex/hash-recovery-review-20261104` / `7e8f437` | Hash implementation and hash unit tests | Worker failure/cleanup regressions; genuine descriptor-backed files through 2 GiB + 1 | `79b31f3`, `29f4d97`, `e5b1907` integrated as `f9daa62`, `463a4e7`, `4446aca`; independent review also caught upgrade focus regression |
| Release | `codex/release-recovery-20261104` / `7e8f437` | Build script, archive/package tests, release instructions; subsequently PNG parser/new header tests | Package output/HTML CSP hash regressions; PNG structural tests | Build `925e0ae` integrated as `77f7c58`; PNG `aa2ff39` integrated as `5e1b920`, focused parser 51/51 pass |
| Reconciliation | cached remote refs vs `7e8f437` | Read-only branch analysis; JSON/Markdown ledger | Ancestry, patch identity, range-diff, content evidence | 45 branch records committed in `52de0fd`; see `RECOVERY_BRANCH_LEDGER_20261104.md` |
| Reconciliation, follow-up | `codex/automation-scope-guards-20261104` / main `1b6dd91` | Separate checkout's workflow, protected scope helper, tests and automation handoff | 10 Git-state tests pass; 8 reproduced failures with legacy checks | `2d42bf0`; separate bundle, never integrated into product; expenditure/accounting/backoff remain open |

Only root integrates shared source. No worker was assigned either lockfile, canonical specifications, cryptographic
primitives or concurrent edits to CI. The automation checkout remains separate from the application candidate.

## Recovery baseline

- `7e8f437` is present in both the persistent checkout and the verified complete-history bundle. Worker validation and
  cleanup, browser-normalized URL guards, stale share-link clearing, and artifact-only Pages preparation are present.
- Node `22.23.4`, Linux `6.8.0-1064-azure`, x86_64. Lock SHA-256:
  `836f4e61ef6339339bbbf6f07692a31dadd141cbe3755ef5610f7980dff262df`.
- Same filtered qualification at this exact recovery base: **313 pass / 4 skips**, 29 files, **41.86 s**. This enables the
  optional virtual 2 GiB case, excludes `cli-io.test.ts`, deselects three FIFO cases and skips the unavailable Python oracle.
  The exclusions are command-line qualification limits; repository tests were not deleted or weakened.
- Initial unfiltered check on Node 24: **312 pass / 4 fail / 2 skips**, 30 files, **22.91 s**. Three FIFO subprocess
  creations fail with `EPERM`; the stdout-error child emits empty stderr in the restricted executor.
- Online `npm ci --ignore-scripts` failed on registry DNS. A clean install then succeeded using copied existing npm
  cache data, `--offline --ignore-scripts`, with Node 22: **139 packages installed in 9 s**. This private dependency tree
  is retained at `.development/dependencies-recovery/`; the candidate's `node_modules` links to it.
- `npm audit --omit=dev` could not reach the advisory endpoint. The offline install's printed zero-vulnerability line
  is **not** treated as a fresh vulnerability assessment. No manifest or dependency lock was changed.
- E2E command built successfully but failed before browser execution: loopback `listen EPERM`. No installed browser
  version or new browser/axe/Tor/platform pass is claimed. Python OpenTimestamps reference is not installed.
- GitHub fetch, push and Actions listing failed, including retries after implementation. Cached refs remain the only
  branch evidence. PR50's number association is supplied by the owner; its cached audit was inspected. Live PR state,
  newer branches, governance, SonarCloud and exact-head hosted CI remain unverified.

## Feature and release accounting

| Area | Implementation / verification | Remaining dependencies |
|---|---|---|
| Consolidation | Recovery and all cached branches reconciled; newer security code retained | Fetch current refs and review before publishing or merging |
| Hashing | Message-deserialization fallback and timer cleanup; real sparse-file digests and bounded reads/RSS pass | Actual browser File matrix, suspend/stall/low-memory qualification on target devices |
| Stamping/verification | Existing fail-closed OTS, quorum, malformed-input and R1 honesty guards retained | Independent reference runtime, live Bob/Finney evidence and calendar CORS remain external |
| UI | Upgrade cancellation/overlap prevention; generation checks; available-action keyboard focus | Full browser/accessibility suite, human screen-reader and usability review |
| Packaging/Pages | LF-normalized inline CSP hashing; exact archive/runtime allowlists; manual Pages preparation remains non-deploying | Native Windows/macOS execution, browser subpath/offline tests, second-person rebuild |
| Automation | Separate scope repair covers Git states and publisher boundary; draft-only PRs | Hard expenditure enforcement, actual cost accounting, failure backoff and hosted validation before enabling |
| Release | Reproducible unsigned artifacts and checksums prepared | SonarCloud triage, independent audit/rebuild, signing, human language/accessibility/Tor, OPS/domain/legal and deployment authorization |

Completion percentages are not estimated: the remaining acceptance gates have independent external dependencies and
no agreed weighting. Passing test totals do not establish code-complete, audited, signed or production-ready status.
No merge, production tag, deployment, release, signing key, repository setting or paid workflow activation occurred.

## Final source qualification

Source SHA: `5e1b9205627c8d4da9bc104754005690271b6656` (subsequent checkpoint edits are documentation only).
Node `22.23.4`, clean private dependency install, unchanged lock digest above.

- Filtered available unit qualification: **334 passed / 5 skipped**, 32 files, **83.62 s**. Command:
  `UNALTERED_BIG=1 node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1
  --exclude '**/cli-io.test.ts' --testNamePattern '^(?!.*(?:idle FIFO|named pipe)).*$'`.
  Compared with the recovered 313-pass revision, this adds 2 worker, 5 upgrade lifecycle/focus and 14 PNG tests;
  the separately executed real-file test adds one opt-in skip here. Three FIFO cases and the unavailable reference
  also skip. The stdout subprocess file remains excluded in this filtered command.
- Full `npm run check`: OPSEC/typecheck/lint passed; units **333 passed / 4 failed / 3 skipped**, 33 files, **42.61 s**.
  The four failures remain restricted FIFO/stdout subprocess cases described above. Because Vitest failed, the
  command did not proceed into its subsequent Node test runner. Full green qualification is **not achieved**.
- Direct Node executor/build/package/workflow tests: **28 passed / 1 platform skip**, no failures.
- Two final builds: every `dist/` file byte-identical; build code **`0fe9be8834c6d1f0`**; five release checksum entries
  passed. This is a same-environment reproducibility result, not a second-person or native cross-platform rebuild.
- Genuine file-backed and generated-CLI evidence is recorded below, separately from the optional/filtered unit run.

Final browser tests, reference interoperability, live dependency audit, native Windows/macOS execution and hosted
quality/security gates remain unverified. No external qualification or production-ready milestone is asserted.

## Additional implementation evidence

- `77f7c58`: fixes CSP style hashes for CRLF/lone-CR build inputs by normalizing text before hashing/packaging.
  Two regressions failed before correction. Canonical LF output initially remained unchanged; subsequent source fixes
  intentionally change the build code. Exact artifact allowlists exclude `skills/` and `shared/` from all distributions.
- `daa8b07`, `314f2ce`: receipt replacement and Cancel abort pending upgrade requests; repeated Upgrade presses cannot
  start overlapping requests. Stale success cannot clear a newer controller/result. Keyboard focus follows the available
  action. Five focused lifecycle tests pass, including a reproduced focus regression found by independent review.
- `f9daa62`, `463a4e7`: `messageerror` now terminates the failed worker and uses the existing fallback; releasing an inline
  worker clears its ten-second URL timer. Focused hashing: 77 pass / 1 optional skip before the new real-file test.
- `4446aca`: opt-in real descriptor-backed file acceptance, **1 pass in 81.25 s**. Sizes: 0, 1 MiB, 4 MiB−1, 4 MiB,
  4 MiB+1, 100 MiB, 1 GiB, 2 GiB and 2 GiB+1. All digests matched Node crypto streams; reads ≤4 MiB and sampled
  additional RSS <200 MiB. Includes cancellation/restart at 100 MiB. Sparse files with boundary markers test real reads
  and large offsets; this does not establish disk throughput or browser `File` behavior.
- Generated Node CLI also hashed a genuine sparse 2 GiB+1 fixture and matched system `sha256sum` exactly.
- `5e1b920`: PNG bounds/header guards. Thirteen regressions failed before correction; header/strip/adversarial tests
  **51/51 pass**. Checks dimensions, legal depth/colour combinations, compression/filter/interlace and required indexed
  palette. Self-check bounds lengths before CRC reads. IDAT remains compressed and is not validated by decompression.
- Focused Node executor/package/workflow tests on Node 22: **28 pass / 1 platform skip**, running each test module
  directly. Node 22 does not support the newer `--test-isolation=none` option used in the previous Node 24 session.
- Search/paging/sort Python tests: **5 pass**. Separate automation scope tests: **10 pass**, eight previously failed
  against the legacy scope guard. Automation changes remain excluded from this product branch.

Protocol references used for the line-ending correction:
[HTML input preprocessing](https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream),
[CSP element matching](https://www.w3.org/TR/CSP3/#match-element-to-source-list).
PNG structural constraints follow [the W3C PNG specification](https://www.w3.org/TR/png-3/).

## Restart and publication

Product checkout: `.development/consolidation-20261104`, branch `codex/recover-qualify-20261104`.
Separate automation checkout: `.development/automation-scope-20261104`, branch
`codex/automation-scope-guards-20261104`, head `2d42bf02e37cdd5f5d7b6377b9f5b52cf164714b`, based on `1b6dd91`.
No PR was published: GitHub DNS failure persists for both branches. Do not merge automation into the product candidate.
Its handoff describes why spending limits, usage accounting, backoff and hosted execution remain mandatory follow-up.

Bundles, patch, logs and checksums are preserved in `.development/evidence-recovery-20261104/`. The original
`.development/evidence-20261104/consolidation.bundle` remains intact. To recover elsewhere:

```sh
git clone .development/evidence-recovery-20261104/product.bundle recovered-unaltered
cd recovered-unaltered
git switch codex/recover-qualify-20261104
git remote set-url origin https://github.com/djshellshoxxx/Unaltered.git
git fetch origin
git log --oneline HEAD..origin/main
git diff origin/main...HEAD --stat
```

After reviewing the refreshed remote state and running supported exact-head CI:

```sh
git push -u origin codex/recover-qualify-20261104
gh pr create --draft --base main --head codex/recover-qualify-20261104 \
  --title "Recover consolidation and harden hashing, upgrades, PNG and offline builds" \
  --body-file docs/RECOVERY_PR_BODY_20261104.md
```

Next priority: fetch live PR/CI/SonarCloud evidence, run unrestricted CLI/reference/browser/platform qualification,
then complete Bob/Finney and human release gates. Investigate the Windows checksum helper's behavior with an
empty/malformed checksum list on a machine with PowerShell; this is an unexecuted review suspect, not a fixed defect.
No API cost telemetry is exposed here; no separate API-funded workflow or application calendar request was dispatched.

# Autonomous consolidation — 2026-11-04 UTC

Candidate branch: `codex/consolidate-release-20261104`. This is an isolated development checkout, based on cached
PR47 `2592675cb55b58f079a3059907eba1187d7e8865`, itself based on cached main
`1b6dd91be87d1a8c92725439bb87a0517b4156ba`. Nothing was merged, deployed, tagged or released.
This record supersedes historical candidate ownership advice for this continuation, without claiming previous release
gates are complete. Source checkpoint before this documentation: `0f811a2`.

## Repository and PR reconnaissance

The original checkout's `.git` is mounted read-only. Its existing `package-lock.json` modification was preserved.
Development used a writable local clone and reused the installed dependencies without changing either lockfile.
The cached main history includes #40 (API-funded workflow), #38 (hash cancellation/evidence), #34 (prior consolidation),
and the earlier FIFO and responsiveness fixes. No new dependency or runtime service was introduced.

GitHub CLI could not connect to `api.github.com`; remote push dry-run could not resolve `github.com`. Web retrieval of
PR47/48/50 also failed. Consequently, current open/closed status, branch ownership, latest main, exact-head CI, required
checks and PR50 content cannot be established. All comparisons below use the locally cached refs. Do not infer that
this branch is current with the remote until fetching succeeds.

| PR | Cached disposition |
|---|---|
| #39 | Both `03ad38a` and `76caf3e` are ancestors of #47. Preserve its per-calendar attribution, receipt binding and private capture directories. #47 also contains the later `NOT_UPGRADED` guard and call-log atomicity fix. |
| #41, #42 | Automation changes kept separate. No activation, secrets, spending configuration or autointegration changes. Existing main workflow remains inherited. |
| #43–#46 | Their hash timeout, OTS serialization, metadata detection and announcement fixes are ancestors of #47; retained without duplicating merges. |
| #47 | Primary base. Preserve all source, tests, pinned reference dependencies, worker CSP/SRI, metadata, OPSEC and evidence improvements. |
| #48 | Selected only `3c63dda` (two cancellation regressions) and `1f44905` (CI concurrency/timeouts). Fuzz realpath repair already exists in #47. Its older full tree would discard verified #47 functionality. |
| #49 | Selected `c4afe4a` and `dde46ea` (OpenAlex sort encoding and regression). Corrected a #47 paging test that assumed unencoded colons, using decoded URL parameter assertions. |
| #50 | Live content unavailable. Cached `origin/codex/unaltered-consolidation-audit-20261104` contains an audit document, but its PR number is not independently confirmed. No inferred merge. |

Older branches and historical release controls remain documented in #47's inherited `docs/ULTRA_RUN_BOARD.md` and
`docs/BRANCH_LEDGER_20261030.md`. The original checkout retains its remote refs; a ref snapshot is preserved beside this
handoff in `docs/evidence/cached-refs-20261104.txt`. No remote branch was rewritten or deleted.

## Completed engineering

| Commit | Change and expected behavior |
|---|---|
| `d386f5b`, `0c98674` | #49 regression and encoding fix: a custom OpenAlex sort remains one query value, including embedded `&filter=`. |
| `9cbc925` | #48 cancellation coverage: pending non-Blob BYOB reads and never-settling chunk yields stop waiting after abort and remove listeners. |
| `0716e69` | #48 CI isolation: manual dispatches cannot cancel or be cancelled by push/PR runs; jobs have explicit time limits. |
| `f5a10a5`, `f7fd8f1` | Browser-normalized URL scheme and attribute-case checks reject script URLs containing TAB/LF/CR or leading C0 controls. Ordinary relative, HTTPS, fragment and blob URLs remain accepted. Defense in depth: no hostile application caller was demonstrated. |
| `925ad52` | Worker completions require 32 SHA-256 bytes, the full input byte count and a known cross-check status. Construction failure releases the worker Blob URL. Invalid completions terminate and use the existing fallback. |
| `007d13c` | Null/primitive/array worker messages and invalid progress cannot throw out of the handler or publish invalid progress. They use the same fallback and cleanup. |
| `35a7ea5` | Invalid or conflicting share-link navigation clears an older fingerprint. Normal tab navigation and returning to the same link preserve chosen file/result state. |
| `2d4134a` | Manual Pages review artifact workflow, nested `/Unaltered/` server support and browser smoke test. No deploy job or write permission. See `docs/PAGES.md`. |
| `424fd8e` | Corrected #48 timeout limits: both three-attempt large-file jobs have 40 minutes, allowing three 600-second tests plus setup. The 540-second per-attempt hash deadline and 200 MiB Chromium ceiling are unchanged. |
| `0f811a2` | OpenAlex paging regression compares decoded values so valid URL encoding does not falsely fail existing tests. |

Hash, DOM and routing regressions were observed failing before their fixes. Independent final review identified the CI
timeout mismatch above, which was corrected. Existing client-only architecture, two-source Bitcoin verification floor,
proof replay, bounded parsers and hash cancellation remain intact. No external code or dependency was added.

## Verification in this session

Environment: Linux, Node `24.22.2`, existing pinned dependency installation. CI continues to select Node 22.
Results here are local evidence, not new GitHub CI results or replacements for human review.

- TypeScript and ESLint: passed on the integrated source and Pages test. `git diff --check`: clean.
- Non-CLI unit suite: 26 files, **290 passed / 2 optional skips**. Separate CLI output/race tests: **13 passed**;
  CLI suite with the three FIFO cases deselected: **9 passed / 3 deselected**.
- Final combined available unit qualification: **29 files, 313 passed / 4 skipped**, with
  `UNALTERED_BIG=1 node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --exclude '**/cli-io.test.ts'
  --testNamePattern '^(?!.*(?:idle FIFO|named pipe)).*$'`. Three FIFO cases were deselected and the optional Python
  reference case skipped; the stdout subprocess test was excluded. No tests were removed or loosened in the repository.
- Virtual 2 GiB Node hash acceptance: **1 passed**. Its digest matched Node crypto and the test's sampled additional
  RSS stayed below 200 MiB. This is a virtual source, not real-file browser or Firefox/WebKit memory evidence.
- Focused Node workflow/executor/build/package tests: **25 passed / 1 platform skip**. These include CSP/SRI and eval
  guards, archive checks and worker failure/deadline behavior. Run with `--test-isolation=none` so the test cases execute
  in this environment rather than relying on a restricted child runner.
- Search/paging/sort Python tests: **5 passed** after the decoded-parameter correction. Shell argument tests: **5 passed**.
- Two final builds: byte-identical across every `dist/` file; build code `6e95f8029814fdba`. All five release checksum
  entries passed. Build and packaging need no server runtime after generation.
- OPSEC check: passed, with the inherited warning that the existing evidence ZIP is not inspected for embedded metadata.

Known failing or uncompleted checks are retained rather than skipped in the repository:

- The initial `npm run check` stopped at unit failures: **284 passed, 4 failed, 2 skipped**. Three failures were
  `mkfifo` child creation denied with `EPERM`; the stdout-error integration test's restricted child produced empty
  stderr. These tests still require an unrestricted runner. No production CLI fix was inferred from that symptom.
- Full Node tests with isolation disabled: **102 passed, 14 failed, 4 skipped**. Failures involved restricted `git`/Node
  child execution or absent child output in campaign, R1 CLI and network-check tests. Even a trivial Node child returned
  `spawnSync ... EPERM`; the seeded fuzz command also failed at its first `git rev-parse` child. No new fuzz campaign or
  independent reference result is claimed.
- Broad Python discovery was interrupted after partial progress and a socket-related error; no full-suite count is
  claimed. Focused URL and shell tests above completed normally.
- Playwright could not start its server: `listen EPERM 127.0.0.1:4173`. No browser binaries were found locally. New Pages
  smoke and existing full-browser/large-file/accessibility/offline gates are unverified in this continuation.
- Historical successful multi-platform/browser CI in `ULTRA_RUN_BOARD.md` is inherited evidence only. Its reported
  SonarCloud B security rating remains unresolved; issue details and current status could not be fetched here.

## Prioritized remaining backlog

| Priority | Task / acceptance criteria | Dependency |
|---|---|---|
| P0 | Fetch current main, open PRs #39/#41–#50, all branch heads and exact-head checks; compare against this checkpoint before pushing. Inspect PR50 instead of assuming its scope. | Working GitHub network/authentication |
| P0 | Publish this candidate branch and create a draft PR against main with the prepared body. Keep source PRs open; no main merge. | Current remote comparison; repository push access |
| P0 | Full `npm run check`, Python toolkit and hash-pinned reference suite pass on Node 22 with no policy-induced failures. | Runner permitting normal child processes, FIFO creation and reference install |
| P0 | All browser/CSP/axe/offline tests pass with zero retries on Chromium, Firefox and WebKit; three 2 GiB attempts meet existing deadlines and Chromium RSS ceiling. Pages smoke loads `/Unaltered/` and hashes offline with actual worker evidence. | Installed pinned browsers and local loopback sockets |
| P0 | Read and resolve/triage the actual SonarCloud finding, then require a passing exact-head quality gate. | SonarCloud access; live CI |
| P1 | Confirm Bob and Finney upgraded receipts independently, bound to each target and checked by the reference verifier; classify pending-404 CORS honestly. Do not introduce a proxy/backend. | Confirmed receipts, permitted browser network; calendar operator headers |
| P1 | Repeat native OS builds and cross-platform checksum comparison on this exact candidate. Pass manual Pages artifact workflow without enabling publication. | GitHub Actions |
| P1 | Complete independent security audit/rebuild, screen-reader, native Spanish, usability and Tor/Trusted Types gates with named evidence. | Independent people/environments |
| P2 | Reassess remaining documented review suspects (fuzz executor edge cases, HTML/CSP parser gate, mutable release-tag recheck and optional PNG palette handling) with failing reproductions before edits. | Scope/spec confirmation; representative fixtures |
| Release gate | Offline signing/public key, repository/account controls, domain/legal review and explicit release/deployment authorization. | Maintainer and external controls |

## Recovery and publication

The writable checkout is preserved at `.development/consolidation-20261104/` within the original workspace. Its local
branch contains every commit; `dist/` contains the qualified static site and portable artifacts. A Git bundle and logs
are preserved under `.development/evidence-20261104/`. Original tracked source and lockfile modifications were not
overwritten. Check the current branch head with `git log -1 --oneline` in the writable checkout.

Once network access works, fetch and compare before publication:

```sh
git fetch origin
git log --oneline HEAD..origin/main
git diff origin/main...HEAD --stat
git push -u origin codex/consolidate-release-20261104
gh pr create --draft --base main --head codex/consolidate-release-20261104 \
  --title "Consolidate hardening and prepare static Pages qualification" \
  --body-file docs/CONSOLIDATION_PR_BODY_20261104.md
```

Do not run the push/create steps until the fetched state has been reviewed for changes. No new PR URL exists for this
continuation: remote publication failed at network resolution. Existing source PRs are
[47](https://github.com/djshellshoxxx/Unaltered/pull/47),
[48](https://github.com/djshellshoxxx/Unaltered/pull/48) and
[49](https://github.com/djshellshoxxx/Unaltered/pull/49).

API usage/cost telemetry is unavailable. No separate API-funded development workflow was dispatched, and no application
requests, credentials, account settings, production deployments or release publication were performed.

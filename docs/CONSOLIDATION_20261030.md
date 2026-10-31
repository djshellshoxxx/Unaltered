# Audit-preparation consolidation — 2026-10-30

Date: America/Los_Angeles; machine logs use UTC 2026-10-31. **The consolidation is reviewable; the audit-preparation
milestone remains incomplete. M4/M5 and release completion are not claimed.** Firefox/WebKit candidate 2 GiB completion,
native stall A/B, cancellation residuals and human/operational requirements remain open. Local failures are preserved.

## Candidate and ownership

| Item | Identity |
|---|---|
| Integration branch | `codex/audit-preparation-20261030` |
| Review | [Draft PR34](https://github.com/djshellshoxxx/Unaltered/pull/34) |
| Refreshed main/base | `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd` |
| Product/test checkpoint | `d09c2401839ea5a06fd794c9666d439b17e500e4` |
| Final source/workflow checkpoint | `f2e7d24017171475be23f9e069a91ae195fea2c3` |
| Source PR-context execution | `31369ca8e82ca077abdc1dfa8489a30fbe665902` |
| Both source and PR-context full trees | `063f20dd792428ad05667a45c493ef1ded0c38b5` |
| Development version | `0.3.1`, unchanged |
| Final documentation head | Resolve the PR head / `git rev-parse HEAD`; commits after f2e7d24 change documentation/evidence only |

Root integrates. Read-only workers reconciled every branch, investigated hashing, checked reference/tooling/security,
and reviewed the changed range. These are internal agent reviews, not REL-3 independent audit or REL-4 second-person rebuild.
No workers own outstanding implementation. The initial `work` branch and working tree were clean at the base and preserved.
No existing branch was rewritten/deleted, PR closed, main merged, release/tag/deployment made, account setting changed,
credential created or paid external agent/API invoked. New commits use a neutral repository-local identity and are
**unsigned**: no project signing key was available or created. Signing remains an owner requirement before integration.

## Reconciliation and changes

[The complete branch ledger](BRANCH_LEDGER_20261030.md) accounts for all 28 original remote refs, exact tips, ancestry,
patch equivalence, unique commits, omissions, PR discussions and older CI. Main already contains PR28/29/32. Four source
PRs remain open and untouched:25/30/31/33. The new candidate is a linear selection from current main, not blind merges.

- **PR25** supplies silence-based timing, immediate hashing of partial bytes and resume at the last hashed offset.
  Kept bounded slices, buffer reuse, EOF checks, typed permanent-stall errors, slow trickle, mid-chunk resume and late-read tests.
  Its extra workflow uses main's freshly verified full-SHA Action pins. Firefox/WebKit completion does not measure RSS.
- **PR31** supplies the extra `[3,6,7]` progress assertion and clearer timeout comment. Its overlapping loop is superseded
  by PR25. Added an independent partial/reopened-slice regression: ranges `[0,3],[3,6],[4,6],[6,9],[9,11]`, progress
  `[3,6,9,11]`, four yields, independently correct digest.
- **PR30** supplies Upgrade-only `unreadable` for `NET_FAILED`, still `ok:false`; readable404 is normal pending.
  The notice explicitly allows either an unreadable pending reply or a network problem. Failed inputs remain byte-identical;
  no network failure adds confirmation or VERIFIED. Realistic CORS mocks reject pending reads and allow confirmed replies.
- **PR33** supplies the seven language cases, including saved receipts and completed/in-flight upgrades, using those same
  network helpers. Language changes do not restart hashing, verification, submission or lookup work.
- Reproduced four cancellation defects: final-progress abort, final data-read abort, final EOF abort and WebCrypto abort
  could still yield a digest. Checks now suppress success at those asynchronous boundaries. Four RED cases passed after repair.
- Reproduced a retained-buffer model:32 progress/stall cycles with unresolved backend cancellation retained128 MiB even
  though the per-offset stall counter reset. Now three unresolved/failed data-reader cancellations stop with typed
  `INPUT_UNREADABLE` before allocating a fourth buffer; fulfilled cancellation releases the budget. Tiny EOF probes do not
  transfer the hashing buffer. Two RED cases and settled-cancellation/EOF/cadence controls pass. This assumes fulfilled
  cancellation completes teardown; it is not a proof of every native backend's memory reclamation.
- Internal review reproduced a mixed result where one calendar extends a still-pending proof and another is unreadable.
  The notice no longer incorrectly claims the resulting proof is unchanged; the real-browser regression failed then passed.
- Selected the two human-gate documents from `733079e`, refreshed to synthetic fixtures and current draft Spanish copy.
  Deferred its optional Bob/Finney runner/helper/tests/template: readable200 plus global VERIFIED could falsely attribute
  confirmation to a target whose proof failed or remained pending. No new diagnostic runtime/package entry is shipped.
  Older desktop/toolkit expansion and all unapplied experiments remain outside this milestone; exact reasons are in the ledger.

## Local verification of source checkpoint

Linux x86_64, Debian trixie/glibc2.41, Node22.22.0/npm10.9.4, Python3.12.14/OpenTimestamps0.4.5. The installed system
Chromium154.0.8037.57 is supplemental evidence, not Playwright's pinned Chromium156. Pinned browser installation was
attempted separately for Chromium, Firefox and WebKit; allowed tooling could not download the denied CDN hosts (HTTP403).

| Check | Result / limits |
|---|---|
| `npm ci --ignore-scripts` | PASS139 packages; exact lockfile unchanged. Initial unwritable default npm cache failed, then workspace cache succeeded. |
| `UNALTERED_PYTHON=<venv>/bin/python npm run check` | PASS: OPSEC/type/lint,173 Vitest pass/1 optional Node2GiB skip,5 Node regressions. Files frozen into d09c240 are identical to this tested state. |
| Two clean `npm run build` runs | PASS all10 files byte-identical, not only top-level checksum lists. Five distributable checksums pass. |
| Python toolkit unittest | PASS18/18. Initial restricted-sandbox loopback failures were stopped and recorded, then a permitted run passed; no test retry hides them. |
| Reference codec/differential | PASS21/21 with the actual pinned Python oracle. Initial sandbox `spawnSync EPERM` is recorded separately. |
| Fixture regeneration | PASS all six `.ots` fixtures and `expected.json` byte-identical. |
| Full Chromium E2E, `--retries=0` |59 pass,2 fail,1 optional2GiB skip: offline `file://` denied before app execution; responsiveness81ms against unchanged `<50ms`. Prior preliminary run59 pass/1 offline failure/1 skip is retained, not substituted. |
| Seven language cases, `--repeat-each=3 --retries=0` | PASS21/21, no retries. Created/downloaded proof content and request/worker counts asserted. |
| Node2GiB, `UNALTERED_BIG=1 ... hash.test.ts` | PASS37/37 (about15s), including optional large input. |
| Real-file Chromium2GiB, three attempts, no retries | PASS3/3; durations38.844/38.727/35.324s; sampled extra renderer RSS58,978,304 /56,725,504 /58,376,192 bytes. Independent digest, worker, `<200MiB` and540s requirements unchanged. |
| Local R1 browser attempt | FAIL/BLOCKED: `TLS_OR_PROXY`, Alice `ERR_TUNNEL_CONNECTION_FAILED`, PENDING, no download and no CSP violation. Independent header fetch also HTTP403. Native source evidence below supersedes neither local failure nor residual hosts. |
| Gitleaks8.30.1 | PASS all fetched history, outgoing source commit and complete source snapshot; no leaks. Official archive digest verified before use. Final docs scan is a separate finalization check. |
| Dependencies | Runtime-only audit PASS0; full audit FAIL11 moderate dev-only minimatch entries. No high/critical; no blanket fix/downgrade applied. See DEPENDENCIES.md. |
| Registry signatures/provenance | Locally BLOCKED by TUF/Sigstore host HTTP403; native source job verifies139 signatures and58 attestations. |
| Workflow static checks | PASS strict PyYAML BaseLoader/duplicate-key check and46 Bash blocks;8 PowerShell blocks/actionlint unavailable locally. Native Windows execution is separate evidence. |

The documented local baseline comparison, focused responsiveness investigation and final documentation-head CI outcomes
are recorded in the final evidence addendum. Local baseline success would not establish the original native stall fixed.
Do not equate Firefox/WebKit ordinary E2E with their large-file job or memory-ceiling evidence.

## Native source evidence

[Source run41171752457](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457) is associated with d09c240;
logs actually check out31369ca. Fetching that merge and comparing full Git trees established exact tree equality with
d09c240, including source/tests/workflow. Do not attribute this run to a different source tree or a later documentation SHA.

- Native Chromium/Firefox/WebKit and Windows app suites:61 pass/1 optional2GiB skip each; selected logs contain no retry
  or flaky markers even though ordinary CI permits one retry. Local repeated-language evidence explicitly uses zero retries.
  Jobs [Chromium124450996415](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996415),
  [Firefox124450996367](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996367),
  [WebKit124450996395](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996395),
  [Windows124450996516](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996516).
- [Linux124450996543](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996543):139 registry
  signatures/58 attestations, type/lint,172 tests/2 expected skips (reference interpreter absent in this job, optional Node2GiB),
  five Node tests and two identical builds. Dedicated differential job supplies the missing reference coverage. Windows has
  two additional platform-specific CLI skips,170 tests/4 skips, plus all61 app cases and real package checksum verification.
- [Chromium2GiB124450996457](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996457):3/3,
  retries0, digest visible30.165/29.983/30.026s; unchanged RSS/deadline assertions. Firefox/WebKit2GiB job is **skipped**
  because this is a PR event. A manual `ci.yml` dispatch against the candidate is still required.
- [R1124450996370](https://github.com/djshellshoxxx/Unaltered/actions/runs/41171752457/job/124450996370): real pinned
  Chromium156.0.8078.4 app Upgrade/Verify `PASS` on the upstream2016 receipt, block428648; independent Python on that same
  downloaded receipt reports `digestMatches=true`, `verifiedTime=1473227803`, `ok=true`, pending0. This establishes Alice's
  confirmed path for this exact source tree. It does not establish Bob/Finney or eliminate the pending404 CORS limitation.
- Secret scan, OPSEC, macOS and differential jobs also succeeded. The cross-OS checksum job must be read separately;
  retaining a workflow definition is not acceptance. Final evidence addendum records its result and artifact identities.
- Combined commit-status API reports Snyk success only; it is distinct from Actions. The run-list snapshot still reported
  queued after individual jobs completed, so conclusions above derive from job results/logs, not that stale aggregate field.
  Live network check is informational and fails. The initial PR34 Sonar ratingC signal was investigated and corrected in f2e7d24 (details below); it requires a fresh head check.
  Older PR25 evidence remains historical. Draft CodeRabbit comments are explicitly not reviews.

## Artifact identities

Build id `f56566235e06e0b4`; version0.3.1. Local clean-build manifests cover all10 files; native builders print the same id.
Distributable SHA256:

```text
35e33bf657d63ccd9b3dd2b24655eb89f26686c92e12787116c3785df6b45dd1  unaltered-0.3.1-macos.zip
36e4c1b92201b242fc1232e2441d6fbd1eaf9ae8020b0e83dded1d69fe757375  unaltered-0.3.1.zip
37930af11f66e1434c17cd78a1c8ff2d97efe147e1bc2553216aa726ee9579ec  unaltered-cli-0.3.1.mjs
a1acf2b541e7fb2c0d4f7ceb48d8eec15c327e441f17b02d979e7ac3ae86f946  unaltered-0.3.1-linux.tar.gz
ec417a90de7e2fba2329e50aa233241cf821987dcb8918bdce718bc0a1ec0fb7  unaltered-0.3.1.html
```

These are unsigned validation artifacts, not a release. Compact committed evidence is in
`docs/evidence/consolidation-20261030.json`; the committed evidence archive retains commands, raw logs, JSON browser
results, source input identities, official pin checks and internal review records. No real sensitive file was used.

## Remaining blockers and smallest next actions

| Blocker / residual | Owner type | Smallest executable next action |
|---|---|---|
| Candidate Firefox/WebKit2GiB completion | Maintainer on an authorized GitHub API path | `gh workflow run ci.yml --repo djshellshoxxx/Unaltered --ref codex/audit-preparation-20261030`; inspect both three-attempt jobs, exact SHA, logs and no retries. Current executor's `gh api` is forbidden. |
| Native stall comparison | Developer/native CI operator | Read `git show origin/diag/read-stall-ab-20261027:.github/workflows/diag-read-stall.yml`; recreate its8-shard/2-arm/3-attempt comparison on a new diagnostic-only branch rooted at d09c240, update trigger/pins, preserve the0b448d8 baseline restoration. Do not merge diagnostic workflow into production. |
| Local offline browser policy and81ms gap | Browser/performance reviewer | Use pinned native run logs and the retained local phases; repeat the unchanged responsiveness case on an idle host, no retry/threshold changes. Do not erase the failed full run. |
| Fallback cancellation can wait30s+bounded cleanup | Hashing developer/auditor | Reproduce with `isCancelled` during a pending BYOB read; design signal-driven interruption with stream/EOF/cleanup regressions before changing API. Worker cancellation already terminates immediately. |
| Pre-existing never-settling cross-check read after abort | Hashing developer/auditor | Run the retained controlled `crosscheck-pending` reproduction; extend `readCrossCheckInput` with bounded/abort-aware reads, then prove cancellation/byte/memory behavior. No native reproduction yet; no universal prompt-cancellation claim. |
| Full dev audit11 moderate minimatch entries | Dependency reviewer | Inspect `npm audit --json` and `npm ls minimatch`; review compatible fixed transitive tree and integrity diff, then re-run checks/provenance. Static trusted lint globs narrow exposure but do not close advisory. |
| Local provenance403 | Environment administrator or native CI | On an authorized path run `npm audit signatures`; no trust/TLS bypass. Native source job139/58 success is already recorded. |
| Bob/Finney confirmed browser paths | Network reviewer with existing anchored receipt | Run existing `scripts/r1-acceptance.mjs` with the appropriate target receipt; verify the same download independently. Inputs here name only Alice; HTTP200 alone is insufficient. |
| Pending404 CORS / outages | Product/network owner | Keep conservative pending state and failed-calendar detail; review known limitation against SPEC9 options. No proxy, no-cors, host or CSP change made. |
| PR25 Sonar signal / final PR independent review | Maintainer/security reviewer | Verify the fresh PR34 Sonar result after the f2e7d24 correction; inspect any remaining annotation and review unsigned commits. Draft bot comments do not close review. |
| A11Y-1 / Spanish / UT-1 | Human screen-reader/native-Spanish/usability reviewers | Execute `docs/gates/SCREEN_READER_SCRIPT.md`; review all draft163 keys in `SPANISH_STRINGS_20261030.md`; record3-5 nontechnical-user outcomes. |
| Tor/Trusted Types Q7 | Browser-security reviewer | Test current built artifact in actual Tor Browser; record CSP/Trusted Types behavior without bypasses. |
| REL-2/3/4 | Fuzzing reviewer, independent auditor, separate rebuilder | Extend documented campaigns; choose auditor and publish report; separate person rebuilds exact candidate and compares all artifacts. Internal agents and same-host double build do not substitute. |
| OPS/signing/release/legal/domain | Owner/key custodian/legal reviewer | Complete TODO OPS/Q5/LEGAL gates and trustworthy signing/rebuild decisions separately. No release, deployment, credentials, purchases or account change is authorized by this candidate. |

## Recovery and continuation

On this executor, tools/logs live under `/workspace/work/unaltered`; this directory is scratch and is not committed.
Build/install recovery (use another authorized network path if CDN/TUF/service destinations remain forbidden):

```sh
git fetch origin
git switch codex/audit-preparation-20261030
git status --short --branch
git log -2 --oneline
export PATH=/workspace/work/unaltered/tools/node-v22.22.0-linux-x64/bin:$PATH
export npm_config_cache=/workspace/work/unaltered/npm-cache
npm ci --ignore-scripts
UNALTERED_PYTHON=/workspace/work/unaltered/ots-reference/bin/python npm run check
npm run build
CHROMIUM_PATH=/usr/bin/chromium npx --no-install playwright test --retries=0
CHROMIUM_PATH=/usr/bin/chromium npx --no-install playwright test tests/e2e/language-switch.spec.ts --repeat-each=3 --retries=0
UNALTERED_BIG=1 npx --no-install vitest run tests/unit/hash.test.ts
CHROMIUM_PATH=/usr/bin/chromium UNALTERED_BIG_BROWSER=1 npx --no-install playwright test tests/e2e/memory.spec.ts --repeat-each=3 --retries=0 --max-failures=1
```

On a fresh host, install Node22 and the locked browser builds (`npx playwright install --with-deps chromium firefox webkit`),
create a scratch Python venv with `opentimestamps==0.4.5`, and set `UNALTERED_PYTHON` accordingly. Omit the system-Chromium
override to use pinned Chromium. Never disable browser/TLS policy to make a gate pass.
The source branch is published as PR34; final docs/evidence are committed separately, with working-tree and final-head
verification recorded in the final handoff. Restore the repository branch only on top of its recorded main prerequisite.

Ready-to-run continuation prompt:

> Continue djshellshoxxx/Unaltered from draft PR34, branch codex/audit-preparation-20261030. Refresh main and PR/branch
> tips before action. Read HANDOFF.md, this consolidation record, BRANCH_LEDGER_20261030.md and final evidence addendum.
> Final source/workflow checkpoint is f2e7d24017171475be23f9e069a91ae195fea2c3; product/tests match d09c2401839ea5a06fd794c9666d439b17e500e4. Later handoff commits are docs only.
> Preserve all branches/history and existing PRs. Finish the non-PR Firefox/WebKit2GiB dispatch, native controlled stall
> A/B and documented cancellation/dependency residuals without weakening50ms/<200MiB/540s or hiding failures with retries.
> Use actual per-target app/reference evidence for Bob/Finney. Keep human accessibility/Spanish/usability, Tor/Trusted
> Types, independent audit/rebuild, signing and operational/legal gates open until evidenced. No main merge, force push,
> branch deletion, PR closure, release/deployment, credentials/account changes or paid external API usage. Update exact-SHA
> acceptance and leave one reviewable candidate for the owner's integration decision; do not claim M4/M5/release complete.

## Final evidence addendum before documentation publication

- Local controlled baseline restoration: all3 attempts passed; candidate all3 passed. Baseline durations35.317/38.783/36.222s;
  peak extra renderer RSS79249408/80613376/80019456bytes. Baseline source restoration and input hashes are retained.
  The native stall did not reproduce here; this is not the requested native8-shard evidence and does not prove a fix.
- Focused idle responsiveness investigation: unchanged case5/5 passes, `--repeat-each=5 --retries=0`. This does not erase
  the81ms full-suite failure. Native pinned suites separately passed the unchanged case. No threshold/retry policy changed.
- Downloaded native Linux/macOS/Windows source artifacts, verified archive digests against GitHub metadata, compared every
  distributable byte to local:15/15 payload matches and6/6 checksum-list copies equal. Artifact IDs13031123873,13030729844,
  13030809644; exact archive SHA256 and per-file identities are in committed JSON. This is executed comparison of actual
  native artifacts, distinct from the native comparison job's still-queued status at this snapshot.
- Source run41171752457:10 required jobs succeeded; cross-platform comparison job124451539616 still queued; FF/WebKit
  large-file job skipped by PR condition; informational live check fails. Do not describe all Actions gates as green.
- Current PR34 Sonar comment [6539446027](https://github.com/djshellshoxxx/Unaltered/pull/34#issuecomment-6539446027)
  reported security ratingC / failed quality gate on d09c240. Public GitHub check-page inspection recovered the actual
  annotation at ci.yml:175: unversioned `npx playwright test` could implicitly fetch if the locked local CLI were absent.
  f2e7d24017171475be23f9e069a91ae195fea2c3 changes the new job's install/test commands to
  `node node_modules/@playwright/test/cli.js ...`; it fails closed if missing. Executed installed CLI version1.64.1 and
  memory-test collection successfully; thresholds, arguments and pins unchanged. Product/test diff d09c240..f2e7d24 is empty.
  Fresh final-head Sonar evidence is required; old rating failure is not silently treated as a pass.
- Documentation publication triggers a new exact-head PR run. The committed final handoff and PR description record its
  actual head/run/job state after publication, separately from source checkpoint evidence. No production/test bytes change.

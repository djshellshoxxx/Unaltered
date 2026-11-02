# Current consolidation — 2026-10-30 (America/Los_Angeles)

Current publication addendum: [final handoff and raw evidence](docs/FINAL_HANDOFF_20261030.md).

Reviewable candidate: **[draft PR34](https://github.com/djshellshoxxx/Unaltered/pull/34)**, branch
`codex/audit-preparation-20261030`, based on current main `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd`.
Final source/workflow SHA: `f2e7d24017171475be23f9e069a91ae195fea2c3`; product/test checkpoint: `d09c2401839ea5a06fd794c9666d439b17e500e4`.
The final workflow-only correction calls the installed pinned Playwright CLI directly, eliminating implicit npx downloads;
subsequent commits contain documentation/evidence.
**Audit-preparation milestone incomplete; no M4/M5 or release completion claim.** Start with
[the consolidated acceptance/recovery record](docs/CONSOLIDATION_20261030.md),
[every branch disposition](docs/BRANCH_LEDGER_20261030.md), and
[internal review](docs/REVIEW_CONSOLIDATION_20261030.md). These supersede historical ownership/merge advice below.

Integrated selected #25/#30/#33 work plus #31's unique progress assertion/comments. Main already includes #28/#29/#32.
Hashing retains silence timing, immediate partial-byte hashing, exact resume, bounded slices/reuse, EOF and typed errors.
Added demonstrated final-boundary cancellation and retained-data-buffer repairs. The pending notice acknowledges network
ambiguity and remains truthful for mixed changed-pending results. Seven language cases pass21/21 with no retries.
All28 original remote branches were checked by ancestry/patch identity and inspected; no source branch was rewritten,
merged, deleted or closed. Human gate scripts were selected; a false-positive Bob/Finney diagnostic was omitted.

Local Node22 check173+5 pass (1 optional skip); Node2GiB37/37; two builds10/10 byte-identical; real-file Chromium2GiB3/3,
max extra renderer RSS58,978,304 bytes, unchanged540s/<200MiB. Local full E2E59pass/2fail/1skip preserves managed
file-navigation denial and81ms responsiveness failure. Native source CI provides distinct pinned-engine, platform and
Alice app/reference evidence; exact logs/tree equality, all skips and remaining non-PR large-file gate are in the record.
Local pinned-browser/provenance/service paths are blocked by policy; no bypass or credentials were introduced.

Remaining: candidate FF/WebKit2GiB dispatch (no RSS evidence there), native stall A/B, documented fallback cancellation
limits, dev minimatch advisory, Bob/Finney confirmed paths/pending CORS, human accessibility/Spanish/usability,
Tor/Trusted Types, independent audit/rebuild, signing and operational/legal controls. Commits are unsigned with a neutral
repo-local identity; no signing key was created. No main merge, release, tag, deployment, purchase, paid external agent/API
or account/credential change. Owner reviews one candidate; preserve existing PRs25/30/31/33.

Final documentation head, working-tree verification, local baseline/focused-performance results and latest CI are recorded
in the final evidence addendum and committed handoff. Recovery and ready-to-run continuation prompt are in the record.
All earlier dated sections are retained as historical evidence, including PR25 context immediately below.

---

# Continuation 2026-10-30 — PR25 timeout policy integrated (main merged in, not rebased)

- The owner approved the silence-based stall policy of PR25 (decision D6, 2026-10-30). `main` (`da9b0a3`) was merged into
  `claude/friendly-faraday-papf5c`; the branch was **not** rebased and its stall-timer code and tests are unchanged.
- `HANDOFF.md` was the only conflict. Both sides are kept: every section from main unchanged, and the PR25 section below,
  placed by date above "(c) — owner decisions applied". Exact-head CI and the Firefox/WebKit 2 GiB dispatch are recorded in
  the next top-level handoff section written after the merge.

# Continuation 2026-10-29 (g) — MP3 trailer regression, updater trust, download names

Branch `claude/unaltered-continuation-20261029` (draft PR29), stacked on PR28 `codex/accepted-gates-20261028` at
`d124dd47971fdff1ef600e27e918d7421f1cbec3` (exact-head CI run 40730873116: all 11 required jobs green; informational live check red,
known pending-404 CORS). Commits: `758be7c` (fixes), `82440ed` (review follow-up) and this documentation/evidence commit. Main
`9f06c46`, PR28 `d124dd4` and PR25 `92e2420` were not rewritten, merged or pushed to. Root (one Claude Code session) integrates;
one read-only reviewer finished; none active. No paid broker/API calls, credentials, releases, tags, deployments or settings changes.
Section (f) was written by an earlier session on PR28 after the `codex/claude-handoff-20261028` prompt; reconciled here.

Changes (details: `docs/REVIEW_20261028.md`, "Continuation (g)"):
- `src/core/strip/audio.ts`: a truncated final frame whose declared length reached end of file hid a real ID3v1/APEv2 tag; since
  `99562ed` the "cleaned" copy kept it with `removed: []`. Tag-like trailing bytes are now refused; self-check rejects them too.
- `src/ui/download.ts`: download names drop C1 and bidirectional controls; truncation by code point.
- Toolkit `shared/scripts/`: HTTPS-only downloads incl. redirects, optional archive SHA-256 (environment or `.env`), validated
  versions; updater stays disabled without a public key; non-HTTPS feeds refused; doctor fails both. Digests stay optional (none
  verified offline). Regressions: `tests/unit/audio.test.ts`, `tests/unit/ui.test.ts`, `tests/toolkit/test_updater_trust_20261029.py`;
  each fails on its parent and passes now.

Results run here (Linux executor, 4 vCPU, Node 22.22.0, pinned Chromium 1243; OpenTimestamps 0.4.5 in a scratch venv):
- `UNALTERED_PYTHON=<venv>/bin/python npx vitest run`: 159 pass, 1 optional Node 2 GiB skip. `npm run check` (no reference set):
  OPSEC/type/lint pass, 156 pass, 2 skips; 5 Node pass. Toolkit unittest: 18 pass. Six reference fixtures regenerate byte-identical.
- `npm run build` twice: byte-identical (10 files); five `SHA256SUMS` OK. Final build id `dd9631a63565c907`.
- `playwright test --retries=0` (Chromium) on the final build: 56 pass, 1 optional skip. An earlier full run during a concurrent
  4-core fuzz campaign failed only the 50 ms worker-responsiveness test (101 ms gap at change dispatch); without that load it passed
  5/5 isolated and in the full run. Threshold unchanged. 2 GiB browser gate not run locally (hash code untouched); CI runs it.
- Fuzz seed 20261029: 1000000 mutations (1000036 inputs), six targets, 1153 s, no finding (`docs/evidence/fuzz-20261029.json`;
  bundle SHA equals the bundle at `758be7c`). Bounded campaign, not exhaustive coverage.
- Firefox/WebKit/Tor: not available locally; CI covers Firefox/WebKit app tests.

Ready queue left: none independently executable here beyond further campaigns. Blocked/conditional (unchanged): PR28/PR29 owner
approval and merge order (PR28, then PR29 retargeted to main, then PR25 per section (f)); PR25 timeout policy and Firefox/WebKit 2 GiB
evidence; pending-404 CORS policy and Bob/Finney confirmed paths; signing; human screen-reader/Spanish/usability; independent
audit/rebuild (REL-3/4); release/account/legal controls; mandatory toolkit digests (need verified upstream values). Missing checkpoint
`1e0fd6b` remains unrecovered. Next: confirm exact-head CI on PR29's pushed head.

# Continuation 2026-10-28 (f) — audio fuzzing, independent pass, toolkit follow-up

Branch `codex/accepted-gates-20261028` (draft PR28). Start: `9e16d5bafddd207d7fa14621fe01a6d692885213`, whose exact-head CI run
40721017408 passed all required jobs (this supersedes the "unexecuted at this snapshot" note in section (e) below). New commits:
`99562ed` (MP3 trailer fix, WAV/MP3 fuzz targets, two toolkit fixes), `0b4ee6f` (independent-review fixes) and this
documentation/evidence commit. Main `9f06c46` and PR25 `92e2420` were not rewritten, merged or pushed to. Root (one Claude
Code session) owns integration; one toolkit worker and one read-only product reviewer finished with disjoint ownership; none active.
No paid broker/API calls, credentials, releases, tags, deployments or settings changes.

Changes (details, evidence and residuals: `docs/REVIEW_20261028.md`, section "Continuation (f)"):
- `src/core/strip/audio.ts`: ID3v1/APEv2 trailers are removed only while the MP3 frame chain does not already reach the end.
  Before: tag-like payload bytes rejected valid files and an APE-like footer silently dropped a real audio frame.
- `tests/fuzz/targets.ts`, `scripts/parser-fuzz.mjs`: `wav` and `mp3` targets (six total), RIFF-length repair for half of WAV mutations.
- `src/ui/views/verify.ts`, `src/ui/strings.ts`: share-link (no file) results no longer say "this exact file" (EN/ES; Spanish
  not native-reviewed). `src/cli/run.ts`: refuse pipes/devices and content longer than stat size. `src/ui/store.ts`,
  `src/ui/views/settings.ts`: remove receipts by identity, bound loaded list to 500. `scripts/build.mjs`: replacer-function fill
  plus inline-bytes-equal-CSP-hash gate (dist output byte-identical).
- Toolkit: `skills/webapp-testing/scripts/with_server.py` (unread pipes), `skills/brainstorming/scripts/stop-server.sh`
  (canonical `/tmp` containment); regressions `tests/toolkit/test_followup_20261028.py`. Updater/download trust stays residual.
- Every fix has a regression that failed on the old code and passes now (unit, browser or offline Python).

Results run here (Linux executor, Node 22.22.0, pinned Chromium 1243; OpenTimestamps 0.4.5 reference in a local venv):
- `UNALTERED_PYTHON=<venv>/bin/python npm run check` at `0b4ee6f`: OPSEC/type/lint pass, 156 Vitest pass, 1 optional skip; 5 Node pass.
- Python toolkit unittest: 8 pass. `npm run build`: two builds byte-identical across the build.mjs change (10 files).
- `playwright test --retries=0` (Chromium): 56 pass, 1 optional skip (2 GiB spec). The offline single-file `file://` test ran and
  passed in this executor (it was administrator-blocked in the previous one; no policy was changed).
- `UNALTERED_BIG_BROWSER=1 playwright test tests/e2e/memory.spec.ts --repeat-each=3 --retries=0`: 3/3 pass, digest visible at
  48.0/49.4/49.1 s, <200 MiB assertion held (max sampled extra renderer RSS 64.4 MiB), 540 s deadline unchanged.
- Fuzz seed 20261028: 250000 mutations (250036 inputs), six targets, 322 s with `--seconds 900`, no finding
  (`docs/evidence/fuzz-20261028-audio.json`). With the standard `--seconds 300` under concurrent load: 226873 mutations,
  wall-clock stop, no finding (`...-audio-300s.json`). Bounded campaigns, not exhaustive coverage.
- Firefox/WebKit/Tor: not available locally (only pinned Chromium); CI covers Firefox/WebKit app tests. Not a pass.

PR25 reconciliation (read-only; scratch worktree, nothing pushed): PR25 touches only `src/core/hash/stream.ts`,
`tests/unit/hash.test.ts`, `tests/e2e/memory.spec.ts`, `.github/workflows/ci.yml` and `HANDOFF.md`; PR28 touches none of the first
three. Trial merge of `92e2420` onto `0b4ee6f` conflicts only in `HANDOFF.md`. On that merge: typecheck/lint clean, 157 Vitest
pass (2 skips, reference interpreter not set), Chromium 56 pass with zero retries, Chromium 2 GiB 3/3 (digest 36.1/36.9/36.5 s,
max sampled extra RSS 64.8 MiB). Firefox/WebKit 2 GiB completion was not run (no engines here; PR25's new job runs off-PR only).
Recommendation for the owner: merge PR28 first, then merge main into PR25 resolving `HANDOFF.md` by keeping both sections, and
require fresh exact-head CI (incl. a manual dispatch for the Firefox/WebKit 2 GiB job) before PR25 merges. The policy change
(stall timer measures silence, not chunk-fill time) still needs the owner's decision; PR25's owner keeps those files.

Ready queue left: none independently executable here beyond longer/native fuzz campaigns. Blocked/conditional (unchanged):
PR28 owner approval/merge; PR25 policy decision and Firefox/WebKit 2 GiB evidence; pending-404 CORS policy and Bob/Finney
confirmed paths; signing; human screen-reader/Spanish/usability; independent audit/rebuild (REL-3/4); release/account/legal
controls; toolkit download pinning (needs verified upstream digests). Missing checkpoint `1e0fd6b` remains unrecovered.
Next: confirm exact-head CI on the pushed head in PR28, then follow the recommendation above.

# Continuation 2026-10-28 (e) — reviewed security candidate

Source/test/workflow commit: `d908d6037acf2aebf635d528a2fd06581d4c7866`, on
`codex/accepted-gates-20261028`, above the verified first checkpoint `8d8f9922d7a7010e7ff1db23b97d6a365d8150d5`.
This handoff/evidence commit is documentation-only. Main remains `9f06c46d061f8a0f67d8684b6c9c6cbbd163242d`;
Claude-owned PR25 remains `92e2420da02b2ba11d0161f72f7bb9ff338170b4`. Neither branch was rewritten or merged.

Follow-up checkpoint887e724 is published as draft PR28. Native run40719843975 at that exact head passed Linux,
Windows, provenance, differential/toolkit tests, all55 app tests in each Chromium/Firefox/WebKit (no retry markers),
and all three unchanged2GiB attempts (digest38.44/38.19/38.02s). macOS remained queued and cross-OS comparison had
not run when this note was refreshed, so this is not full native acceptance. A local current-build2GiB attempt also
passed44.3s. Informational R1 passed the real Alice confirmed-upgrade/app/reference path at block428648; details and
residuals are in `docs/NETWORK.md`. Pending404 CORS and Bob/Finney confirmed paths remain open.

The same run exposed stale style-based R1 diagnostic fields after the neutral Upgrade copy change. A small follow-up
derives confirmation only after Verify and excludes status notices from unknown-calendar warnings; node syntax/lint pass.
That diagnostic correction changes no product bytes, transport, acceptance threshold or release trigger. Its final exact
head must receive its own CI status. The PR description/checks are the live completion record; historical runs stay preserved.

Completed after the first checkpoint: aggregate proof budgets and transactional merge rollback; stack-safe serialization;
bounded WAV/PNG removal summaries; explicit Blob URL ownership/revocation and stable relabel downloads; truthful Upgrade
wording; five bundled-toolkit corrections (script/benchmark injection, port killing, redirect credential forwarding and omitted
tool results). Test audit also removed a typed-error false-pass path and strengthened request-count/transformed-byte oracles.
See [internal review, scope and residuals](docs/REVIEW_20261028.md). This is not REL-3 independent audit acceptance.

Fresh integrating-executor results on this source:

- `UNALTERED_PYTHON=/tmp/unaltered-reference/bin/python npm run check`: OPSEC/type/lint pass,150 Vitest pass,1 optional Node2GiB
  skip;5 Node supervisor/renderer regressions pass. Python OpenTimestamps0.4.5 reference oracle actually executed.
- Four offline Python toolkit regressions pass; six regenerated reference fixtures byte-identical. Native differential CI also
  runs those Python regressions. No SDK/credentials/live requests are used by the new toolkit tests.
- Full local Chromium154 with `--retries=0`:54 pass,1 optional browser-memory skip,1 failure before app execution at
  `file://.../dist/unaltered-0.3.1.html#stamp`: `ERR_BLOCKED_BY_ADMINISTRATOR`. Policy is preserved; offline acceptance needs native CI.
- Two builds byte-identical, all five distributable checksums pass; build id`b1ebd362733ac666`,36.4KiB gzip.
- Both250000-mutation campaigns completed250028 inputs without finding,230333ms before parser corrections and228607ms after;
  exact source state/bundle SHA/limits: `docs/evidence/fuzz-20261028*.json`. No exhaustive/native-decoder coverage claimed.
- Source/staged secret checks and OPSEC pass; final outgoing-history scan and remote SHA verification precede publication.

Three coordinated workers completed bounded roles (Luna targets/tests, Sol code/toolkit review/fixes, Astra deeper product security
and changed-range review); none remain active. Root owns integration. All47 active product/tooling/workflow files and66 bundled
executable scripts were included in source review, with dynamic/external limits in the detailed record. No paid Claude calls.

Native CI for the final diagnostic/evidence checkpoint is unexecuted **at this documentation snapshot**. Root will reconcile
exact-head CI in draft PR28; its description/checks will carry the completed result without another source change.
Do not attribute old73fc82e/9f06c46 browser evidence to this new head. Ordinary E2E may retry once in CI; inspect attempts before
claiming repeatable50ms performance. Original Chromium2GiB/540s/<200MiB job remains three attempts/zero retries, unchanged.

Next owner: inspect exact remote branch/PR head, review `9f06c46..HEAD`, reconcile current main/PR25 ownership and CI, then obtain
the required specific PR approval before integration. No merge attempt is planned here; no merge source/target was mutated.
R1 live confirmed app/reference round-trip and pending-CORS policy, signing, human accessibility/Spanish/usability, independent
audit/rebuild and release/account/legal controls remain open. No backend/proxy/browser bypass, release/deployment/tag, purchase,
credentials or account-security changes occurred. Recover by fetching this branch, reading these notes, and reproducing the
commands in `docs/REVIEW_20261028.md` / `docs/FUZZING.md`. Preserve historical failures, old checkpoints and unique remote work.

# Historical continuation 2026-10-28 (d) — accepted gate work, separate ownership

- Reconciled main `9f06c46d061f8a0f67d8684b6c9c6cbbd163242d`, exact-head CI40651059987 completed success. Earlier browser
  results are historical, not acceptance of this continuation. All old work/branches are preserved; local800b9cc is an ancestor of main.
- Work branch: `codex/accepted-gates-20261028`, based on that main. Claude-owned PR25 remains at
  `92e2420da02b2ba11d0161f72f7bb9ff338170b4` and currently conflicts with main; do not edit/rebase/merge its timeout work.
  Language preservation is already merged. Dependabot PR27 is separate. Specific PR approval requires owner confirmation.
- Unowned accepted slice: REL-2 / SPEC12 coverage-guided parser fuzz tooling. Added four V8-feedback entrypoints, synthetic
  corpus retention, bounded independent worker supervision and exact finding replay; no dependencies or runtime code changed.
  See `docs/FUZZING.md`. Local `npm run check`:142 Vitest passes,1 optional large-input skip,4 supervisor tests pass; OPSEC/type/lint
  pass. The longer seeded campaign completed250028 inputs (250000 mutations) in230333ms without finding; bounded64KiB input,
  four targets, V8 feedback, Node24.19.0. Compact exact report: `docs/evidence/fuzz-20261028.json`; this is not exhaustive coverage.
- Root integrates. One inexpensive worker completed only fuzz-target/oracle files. A disjoint read-only app/CLI/build/tooling
  code audit is running; root covers core modules. Deep security review follows code audit and corrections, with explicit limits.
  Code audit reproduced stale Stamp receipts after changing cleaning and a skip link that switched views. Both are fixed;
  all six new regressions failed before and pass after. Full local Chromium suite:51 pass,1 optional memory skip,1 failure on
  managed `file://` administrator policy. Build id5d6e1799e43b37c5. No duplicate timeout implementation.
  Deep security review is running and has identified further issues in combined-proof bounds, chunk-list cost and Upgrade
  wording; those are not fixed by this first checkpoint. Legacy toolkit executable review is separate and in progress.
- No merge, deployment/release, new credentials/security settings or paid Claude usage. New branch pushes trigger no CI/release
  in inspected workflows (CI:main/PR/manual; release:manual). Preserve2GiB/540s/<200MiB Chromium and50ms limits unchanged.
- Next: finish deep/legacy review, reproduce/fix supported security findings, rerun affected gates, secret
  scan and updated source/evidence checkpoint. R1, signing, human accessibility/Spanish/usability, independent audit/rebuild and
  release/account/legal controls remain open. This is agent-assisted internal review, not the independent audit required by REL-3.

# Continuation 2026-10-28 (c) — PR #25, head `73fc82e`

Owner approved: watchdog timeout policy, Firefox/WebKit 2 GiB check, language switch (#9). #25 covers the first two; the language switch is a separate PR and is not started.

- Timeout policy: Blob reads no longer pass a full-chunk `min`, so any delivered bytes reset the 30 s stall timer (silence, not chunk-fill time). Reopen-from-last-hashed-byte and 3-consecutive-stall `INPUT_UNREADABLE` unchanged. Progress and yielding are throttled to once per chunk of progress because Firefox delivers ~64 KiB reads. New unit tests (slow trickle not abandoned; mid-chunk stall resumes at the right offset) fail on the old logic.
- Firefox/WebKit: `tests/e2e/memory.spec.ts` runs there without an RSS probe (completion, digest, 540 s limit only; the 200 MiB ceiling is NOT evidenced). CI job `Browser 2 GiB completion (firefox|webkit)` runs on main and manual dispatch only. Dispatched run 40626267870 on `73fc82e`: Firefox 3/3 (~38 s each), WebKit 3/3 (~19 s each), both real passes with digest.
- Chromium 2 GiB gate on `73fc82e` with the new rule: passed in both the PR run and the dispatched run (2 x 3 attempts, ~2.2-2.5 min per job), plus 3/3 locally. Six attempts is not an A/B; the stall is still not proven fixed. Re-running the 8-shard baseline-vs-candidate comparison against this head would be the like-for-like evidence.
- Everything else on `73fc82e` green except the informational live check (known CORS 404 on pending calendar lookups).

# Continuation 2026-10-28 (c) — owner decisions applied

- Owner approved and main now holds #6, #7, #8, #11 (incl. #10 watchdog, #13 worker-error fix) as merge commits; main `8c182ca` CI run 40622738468 green on every required job, including the 2 GiB gate (3/3) and byte-identical builds. Only the informational live check is red (calendar 404 without CORS on pending lookups).
- Owner chose the **recommended language-switch option** (U-N1: language is presentation state). Branch `claude/stoic-mccarthy-m7xpb8` merges `codex/proposal-language-presentation-20261027` (`bea5aae`) into main cleanly; `docs/proposals/LANGUAGE_SWITCH.md` marked accepted.
- Owner approved merging #3 (`55ca050`, README + toolkit wiki). Its README was written when the repo held only the JUCE toolkit; resolved by keeping the app README as primary and adding a "Bundled agent toolkit" section; wiki Home retitled "Toolkit Wiki" and pointed at the app README.
- Local on the merged tree: `npm run check` 138 passed / 1 skipped; build ok; Chromium e2e 46/46 on rerun (first run: the known 50 ms worker-responsiveness flake); `language-switch.spec.ts` 12/12 over 3 repeats.
- Owner asked to close old PRs whose content is in main: #1, #2, #4, #5, #10, and diagnostic #12.
- Still open: slow-device timeout policy, R1 live-server evidence and pending-lookup CORS wording, signing, human accessibility/Spanish/usability review, independent audit and rebuild, release controls.

# Continuation 2026-10-28 (b) — branch `claude/stoic-mccarthy-m7xpb8`

Base: `cbc4c7e` (#11 head, = #8 + R1 script fix + #10 watchdog + bounded cancel cleanup). Main `8bcae50` and every other branch untouched; nothing merged. #9 (language proposal) still isolated, owner decision still pending. #12 stays diagnostic-only.

- **#12 A/B re-verified from the job logs (run 40617290194, head `6f5b6c9`).** Watchdog 8/8 shards pass (~2 min each). Baseline (`0b448d8` hash source) fails shards 1, 2, 4, 7, 8, passes 3, 5, 6. All five failures have **one identical signature**: after ~30–33 s of normal progress (426–495 of 512 slices, extra RSS ~70 MiB), the first BYOB read on a fresh slice never settles for the remaining ~500 s until the 540 s deadline. **Correction to the previous entry:** baseline shard 4 was not "a very slow pipeline with a read pending 30 s": `since` in the `worker-io` trace is the absolute worker clock when the read started (30 282 ms), `now` was 531 337 ms, so that read was pending ~501 s like the others. None is a memory failure. This matches the failure mode the watchdog targets (reopen the unconsumed range). Still not a root cause in Chromium, not a slow-device test, Chromium/Linux only.
- **Defect fixed (found reviewing the watchdog integration):** when the worker's `hashSource` threw a typed input error (`INPUT_UNREADABLE` after three stalls, or `INPUT_INVALID` when a file shrinks mid-read), the worker posted a bare `error`, `hashBlob` treated it as "worker unavailable" and **re-hashed the whole file on the main thread** (duplicate hashing, main-thread load, up to another 90 s of stalls, typed error lost). The worker now posts `{type:'failed', code, message}` for `UnalteredError`s; the main thread rejects with that error only for an allow-listed code (`INPUT_INVALID`, `INPUT_UNREADABLE`); anything else still falls back as before. Regressions in `tests/unit/hash.test.ts` (“worker outcomes”): the two typed-failure tests fail before the change, pass after; fallback and unexpected-code cases pass both ways.
- Local verification on this branch (Linux, pinned Chromium 1243 at `/opt/pw-browsers`): `npm run check` 138 passed / 1 skipped; `npm run build` ok; full Chromium e2e 42 passed / 1 skipped on rerun (first full run: the known 50 ms worker-responsiveness flake, then 6/6 isolated passes); `UNALTERED_BIG_BROWSER=1` memory spec 2/2 pass (~54 s, extra RSS ~62 MiB). Firefox/WebKit not available locally: CI only.
- Known, not changed: main-thread fallback notices cancellation only between reads, so a stalled read delays cancel by up to `STALL_MS` per stall (bounded, ≤ 90 s); the worker path terminates immediately. Slow-device trade-off of the 30 s per-4 MiB-read timeout unchanged (policy call). Worker message `cancelled` is never produced (cancel terminates the worker).

# Continuation 2026-10-28 (integration checkpoint, branch claude/friendly-faraday-papf5c)

Topology (verified): #6 `0b448d8` <- #7 (+5) <- #8 (+11) <- #9 (+12, PROPOSAL, not integrated). #10 `0fa99d7` is one commit directly on #6; #12 (`diag/read-stall-ab-20261027`, DIAGNOSTIC, do not merge) targets #10's branch. This branch = #8 `6d60024` + R1 script fix + merge of #10 + the fixes below. Only this branch is pushed to; nothing merged anywhere.

- R1: `scripts/r1-acceptance.sh` failed after a PASSING browser step because `curl | head -c` took SIGPIPE (exit 23) under `pipefail`. Fixed; CI on `c880b6a` shows the reference step `ok: true`, block 428648. Still browser + reference evidence only, not the live-server acceptance R1 needs.
- Live calendar check: `GET /timestamp/<hex>` returns 404 without `Access-Control-Allow-Origin` on alice, bob and finney (red on #8 too). A browser sees a network error for a pending lookup. App behaviour for that case is undecided.
- Watchdog defect found in review of #10: after a stall, cleanup awaited `reader.cancel()` unbounded, so a backend whose cancel never settles hung the hash on cancellation. Cleanup now waits at most `CANCEL_SETTLE_MS` (1 s). Regression test fails before the change (HUNG), passes after. Added test: bytes an abandoned read delivers late are ignored.
- Known watchdog trade-offs, unchanged: a device slower than about 140 KB/s for three consecutive 4 MiB reads now errors; each abandoned stalled read retains its 4 MiB buffer until it settles. The 30 s timeout covers the first-chunk open too. Whether a progress-based timeout is better is a policy call, separate from correctness.
- Stall is NOT proven fixed. Evidence still needed: the #12 A/B (8 shards x 2 arms, native). Gates and limits unchanged.
- `npm run check` on this branch: 134 passed, 1 skipped (local, Linux).
- A/B result (#12, run 40617290194, diag head `6f5b6c9`): watchdog 8/8 shards (24/24 attempts) passed in about 2 min each; baseline `0b448d8` source 3/8 shards (12/17 attempts) passed, all 5 failures were 540 s timeouts, none a memory failure. Supporting evidence that #10 recovers from the stall; not a root cause, not a slow-device test, Chromium only. Baseline shard 4 log: 495/512 slices done at 531 s with a read pending 30 s, so at least one failure was a very slow pipeline rather than one permanent hang (unverified in general).
- Exact-head CI on `e698b4c` (#11): all green including the 2 GiB gate and R1 job, except the informational live check (known CORS 404 on pending lookups).

# Unaltered handoff — 2026-10-27 (second continuation)

Owner: this task owns only `djshellshoxxx/Unaltered`. Root integrates; one reviewer agent ran (read-only, finished).
Never force-push; never push to main. Main `8bcae50`, PR #6 head `0b448d8` unchanged.

## Branch stack (all draft PRs, none merged)

| PR | Branch | Head | Base | Content |
|---|---|---|---|---|
| #6 | `codex/resume-acceptance-20261024` | `0b448d8` | main | 0.3.1 integration (earlier sessions) |
| #7 | `codex/ui-correctness-checkpoint-20261025` | `c0ae8e7` | #6 | Verify: receipt bounds, stale-completion suppression, abort superseded runs |
| #8 | `codex/ordinary-fixes-20261027` | this commit | #7 | CLI receipt bounds, Stamp cancel state, hashing-abort tests, R1 tooling |
| #9 | `codex/proposal-language-presentation-20261027` | `bea5aae` | #8 | **PROPOSAL, needs product decision**: keep state across language switch |

## PR #7 status

- Independent review of `0b448d8..c0ae8e7` (reviewer agent, read-only): **no blocking defects**. Reviewer reproduced 13 probes (input changes during
  hashing, between hash and read, during network; rapid repeats; stale `finally`; over-limit with a file) and a mutation
  check (removing the abort fails all 5 new tests). Non-blocking: remount does not stop old work (proposal covers it);
  Upgrade requests are not cancellable (bounded by the 15 s fetch timeout); new tests used only the prefill path (#8 adds
  hashing-time cases).
- Native CI: `fc8f9aa` (same source as `03fc5ac`) run 40586156255 — all 11 required jobs passed.
  `c0ae8e7` (handoff-only change) run 40587001019 — 10/11 required passed, **Browser 2 GiB memory acceptance failed**
  (job 122481018812, 9m51s). Logs not inspected: the GitHub API is rate-limited from this executor and MCP has no log access.
- **Not ready to merge**: the required memory gate failed on its exact head. The merge into #6 also still needs the owner's go-ahead.

## Memory gate (required) — open, pre-existing, now the main blocker

- Native, each a fixed 3-attempt run on unchanged hash source:

  | Result | Commit, run |
  |---|---|
  | **pass** | `0b448d8` (run 40111133625), `fc8f9aa` (40586156255), `bea5aae` #9 (40592405203, 2m08s) |
  | **fail** | `c0ae8e7` (job 122481018812, 9m51s), `1532064` (job 122491912806, 9m34s), `be7e14d` (job 122498576476, 10m53s) |

  Every failure lasts about setup plus the 540 s per-attempt deadline, matching the historical read stall.
  The failing `be7e14d` and passing `bea5aae` ran at the same time, and `bea5aae` contains all of `be7e14d`. So the
  stall is intermittent per run, not caused by any change in #7/#8/#9.
- Local, this executor (same pinned Chromium 156, 4 vCPU): 13/13 (`c0ae8e7` 3/3; `c80f2ac` 10/10, 30–35 s each).
- Conclusion: the 0b448d8 EOF-lifecycle change did not make the native gate repeatable (about 50% of recent runs).
  Next: read the failure logs/artifact `browser-memory-failures` (spec prints `memory-acceptance worker-io=` read state)
  with an authenticated session, then continue the read-stall investigation. Gates (2 GiB, <200 MiB RSS, 540 s, 3 fixed attempts) unchanged.

## #8 contents (all tested locally; see PR #8 body)

- CLI reads at most `maxInputBytes + 1` receipt bytes, before hashing (same message as the browser). 3 unit tests.
- Stamp: an item's own Cancel settled nothing and left it "working"; now shows "Cancelled…" with Remove. Browser test.
- Spanish agreement fix in `stamp.rejected` (not a native-speaker review).
- 4 Verify tests: input change during hashing terminates the superseded worker.
- R1 tooling: `docs/R1_ACCEPTANCE.md`, `scripts/r1-acceptance.{mjs,sh}`, `tests/differential/verify_reference.py`,
  informational CI job `r1-acceptance`. No new calendar submissions.

## R1 — open, closer

Node (this executor): Alice's confirmed upgrade `GET` → `200`, `Access-Control-Allow-Origin: *`; our upgrade + verify →
VERIFIED, block 428648; reference library verified the same receipt against blockchain.info's header. Browser here:
`TLS_OR_PROXY` (`ERR_CERT_AUTHORITY_INVALID`, executor TLS inspection), so no CORS conclusion. The browser was not
made to trust that CA (that would override the browser's own refusal). Native `r1-acceptance` job **failed fast** on
`be7e14d` (job 122498576578, 31 s) and `bea5aae` (job 122499717803, 34 s). Its logs are unread, so the cause is unknown
and it is **not** evidence about CORS. Next: read that job's log; the JSON includes the classification.
Bob/Finney confirmed replies remain unobserved.

## Product decision pending

Language switch (U-N1): see `docs/proposals/LANGUAGE_SWITCH.md` on the proposal branch. Recommended: language as
presentation state (keep inputs/results/running work). Alternatives A (stop old work), B (warn first), C (status quo).

## Still open (need people or credentials)

Signing (commits unsigned; no key), human screen-reader/Spanish/usability review, independent audit and rebuild,
release controls, OPS-1..6, LEGAL-1. Automated checks do not satisfy these.

## Recovery

`git fetch origin`, check out a branch above, `npm ci --ignore-scripts`, `npm run check`, `npm run build`,
`node_modules/.bin/playwright test --retries=0`. Known local flake: the 50 ms responsiveness test fails about 1 in 4
full-suite runs, including on unmodified `0b448d8`; 10/10 isolated passes on #8 and the proposal. Threshold unchanged.

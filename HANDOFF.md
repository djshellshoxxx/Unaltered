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

# Unaltered handoff — 2026-10-27 (second continuation)

Owner: this task owns only `djshellshoxxx/Unaltered`. Root integrates; one reviewer agent ran (read-only, finished).
Never force-push; never push to main. Main `8bcae50`, PR #6 head `0b448d8` unchanged.

## Branch stack (all draft PRs, none merged)

| PR | Branch | Head | Base | Content |
|---|---|---|---|---|
| #6 | `codex/resume-acceptance-20261024` | `0b448d8` | main | 0.3.1 integration (earlier sessions) |
| #7 | `codex/ui-correctness-checkpoint-20261025` | `c0ae8e7` | #6 | Verify: receipt bounds, stale-completion suppression, abort superseded runs |
| #8 | `codex/ordinary-fixes-20261027` | this commit | #7 | CLI receipt bounds, Stamp cancel state, hashing-abort tests, R1 tooling |
| proposal | `codex/proposal-language-presentation-20261027` | `f1eaafa` | #8 | **Needs product decision**: keep state across language switch |

## PR #7 status

- Independent review of `0b448d8..c0ae8e7`: **no blocking defects**. Reviewer reproduced 13 probes (input changes during
  hashing, between hash and read, during network; rapid repeats; stale `finally`; over-limit with a file) and a mutation
  check (removing the abort fails all 5 new tests). Non-blocking: remount does not stop old work (proposal covers it);
  Upgrade requests are not cancellable (bounded by the 15 s fetch timeout); new tests used only the prefill path (#8 adds
  hashing-time cases).
- Native CI: `fc8f9aa` (same source as `03fc5ac`) run 40586156255 — all 11 required jobs passed.
  `c0ae8e7` (handoff-only change) run 40587001019 — 10/11 required passed, **Browser 2 GiB memory acceptance failed**
  (job 122481018812, 9m51s). Logs not inspected: the GitHub API is rate-limited from this executor and MCP has no log access.
- **Not ready to merge**: the required memory gate failed on its exact head. The merge into #6 also still needs the owner's go-ahead.

## Memory gate (required) — open, pre-existing, now the main blocker

- Native: `0b448d8` 3/3 (run 40111133625), `fc8f9aa` pass, `c0ae8e7` fail, `1532064` (#8) fail (job 122491912806, 9m34s).
  Both failures last about setup + the 540 s per-attempt deadline, matching the historical read stall
  (`docs/HANDOFF_20261024.md`). Hash source, memory spec and diagnostics are unchanged since `0b448d8`.
- Local, this executor (Chromium 156, 4 vCPU): `c0ae8e7` 3/3 pass (35.4/31.1/32.5 s). A 10-attempt run is recorded below.
- Conclusion so far: the 0b448d8 EOF-lifecycle change did not make the native gate repeatable; no change in #7/#8 touches it.
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
`TLS_OR_PROXY` (`ERR_CERT_AUTHORITY_INVALID`, executor TLS inspection), so no CORS conclusion. Closes when the
`r1-acceptance` CI job (native runner) passes. Bob/Finney confirmed replies remain unobserved.

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

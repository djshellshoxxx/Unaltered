# Ultra run board — 2026-11-04

The single coordination ledger for the 2026-11-04 integration run. The integration owner (one Claude Code
cloud session) maintains it. Older dated ledgers (`CONSOLIDATION_20261030.md`, `BRANCH_LEDGER_20261030.md`) remain
historical evidence.

- Candidate: branch `claude/funny-lamport-2jfc0e`, draft [PR47](https://github.com/djshellshoxxx/Unaltered/pull/47).
- Base: main `1b6dd91be87d1a8c92725439bb87a0517b4156ba`.
- Final source SHA and the final wave are in the "Final state" section at the end.
- Status: unaudited, unsigned development candidate. Nothing is merged to main. No release, tag, signing, deployment
  or account change.

## Topology actually used

- **One cloud instance.** `create_session` was available but was not used. Lanes A/B/C ran as isolated
  git-worktree subagents in this instance, and GitHub Actions supplied the extra compute for the three-engine and
  platform runs. Reasons:
  - The local machine has only Chromium.
  - Child cloud sessions cannot report back into this session.
  - Separate full-context sessions would have added cost and push conflicts for little extra throughput.
- **Peak concurrency:** 6 workers, plus 1 log-extraction helper.
- **Models:**
  - Opus: security-critical review and fixes (OTS/verification, metadata parsers, network/CLI).
  - Sonnet: UI/i18n, the PR39 review and the toolkit.
  - Haiku: CI-log extraction.
- **Worker branches** were committed locally in worktrees and merged into the candidate with `--no-ff`. No worker
  pushed. Several worktrees started from main `1b6dd91` instead of `583aca4`; each was told to merge `583aca4`, and
  the integration merges handled the rest.

## Task ledger

| Lane | Task | Worker / model | State | Owned files | Commits on candidate | Tests | Notes |
|---|---|---|---|---|---|---|---|
| A | Merge open hardening PRs #43–#46 | integrator | IMPLEMENTED AND VERIFIED | stream.ts, codec.ts, detect.ts, dom.ts | `5d61489` `ee01d8f` `aa6fa61` `583aca4` | Vitest 195/2 skip; CI run [41756401080](https://github.com/djshellshoxxx/Unaltered/actions/runs/41756401080) green | Source PRs left open, not rewritten |
| B | Review and merge PR #39 (Bob/Finney attribution tooling) | Sonnet reviewer + integrator | IMPLEMENTED AND VERIFIED | scripts/lib/r1-calendars.mjs, scripts/r1-bob-finney.mjs, tests/r1/*, ci.yml step | merge after `583aca4` | `node --test tests/r1/r1-calendars.test.mjs` 40 pass / 1 skip (41/41 with pinned reference) | Full R1 stays BLOCKED (live Bob/Finney evidence) |
| C | Toolkit hardening | Sonnet | IMPLEMENTED AND VERIFIED | skills/brainstorming/scripts/start-server.sh, tests/toolkit/test_shell_args_20261104.py | `f27a2d3` | toolkit unittest 20/20; failed (hung) before fix | Unreproduced suspects listed below |
| C | UI wording/i18n/a11y/download/store review | Sonnet | IMPLEMENTED AND VERIFIED | src/ui/**, tests/unit/ui-*.test.ts | `3ef5bab` `cd8a4b5` `b83ad89` `0e6d85f` `c702623` | Vitest 217/2 skip; local Chromium E2E 69 pass / 1 skip, `--retries=0` | New ES string is a DRAFT pending native review |
| B | Trusted Types delivery/enforcement (Q7 evidence) | integrator | IMPLEMENTED AND VERIFIED (Chromium); Firefox/WebKit via CI | tests/e2e/trusted-types.spec.ts | `479f5f4` | Chromium 2/2; mutation (directive removed) fails the test | Q7 decision itself stays with the owner; Tor Browser untested |
| B | minimatch dev-only advisory | integrator | RESEARCH COMPLETE (accepted risk) | docs/DEPENDENCIES.md | `479f5f4` | n/a | No upstream lint-chain release accepts `>=11.0.1` |
| A | Fallback/cross-check cancellation residual | (already fixed by #38) | SUPERSEDED by main `e550b5a` | — | — | hash.test.ts "cancellation while file I/O is pending" (BYOB data/eof, fallback/cross-check arrayBuffer, WebCrypto) | Waits stop on abort; native reads are not cancelled (documented in `awaitAbortable`) |
| B | Firefox/WebKit 2 GiB completion on candidate hash code | CI dispatch | IMPLEMENTED AND VERIFIED (completion only) | — | at `583aca4` | Dispatch run [41756413597](https://github.com/djshellshoxxx/Unaltered/actions/runs/41756413597): Firefox 3/3 (digest ≈52 s), WebKit 3/3 (≈17 s), Chromium memory 3/3 | No RSS probe on Firefox/WebKit: no memory-ceiling claim there |
| B | Native stall A/B diagnostic | read-only evidence extraction | RESEARCH COMPLETE | — | — | [run 41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747) | See "Native stall A/B" below |
| A | OTS codec/verify adversarial review | Opus | see wave 1b | src/core/ots/** | — | — | — |
| A | Metadata parser adversarial review | Opus | see wave 1b | src/core/strip/** | — | — | — |
| B | Network transport and CLI review | Opus | see wave 1b | src/core/net/**, src/cli/** | — | — | — |
| B | API-funded Codex automation (#40 merged; #41/#42 open) | inspection only | NOT MODIFIED | .github/workflows/unaltered-codex-cloud.yml | — | 0 workflow runs recorded at 2026-11-04T01:50Z; first scheduled slot is 09:53 UTC | Another provider's workflow; not duplicated or overwritten |

## Native stall A/B (diagnostic only; never merge its workflow)

Run [41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747), branch
`diag/read-stall-ab-20261102`, head `d77763e`, 2026-11-03.

- **Candidate arm:** hash modules from `03f3ac8`, identical to current main's `src/core/hash`.
  - 8/8 shards, 24/24 attempts passed.
  - Digest visible at 24.3–39.2 s.
  - Peak extra renderer RSS 39.1–46.7 MB, under the unchanged 200 MiB limit.
- **Historical baseline arm:** `0b448d8`.
  - 6 of 8 shards failed their first attempt at the 540 s deadline.
  - Each failure shows a single `read-await` that never advanced. Progress was stuck at 0.75–0.85 from about 130 s
    to 540 s.
  - Shards 1 and 5 passed 3/3.
  - 12 attempts were not run because of the first-failure stop. They are not counted as passes.

This reproduces the native pending-read stall with the historical hashing family, while the candidate family completes
under the same scaffold. As the diagnostic README says, it changes the family as a unit: it does not isolate one
patch's contribution or prove Chromium's internal root cause. Per-shard figures were extracted from 400-line log tails;
the test-level error text of the failed attempts is above that window.

## Unreproduced suspects (not changed; candidates for future work)

- **Toolkit:**
  - `web-artifacts-builder/scripts/init-artifact.sh` puts an unvalidated name into a `sed` expression and installs pnpm
    before validating.
  - `find-polluter.sh` word-splits test names.
  - Two artifact scripts lack `pipefail`/`set -u`.
- **UI:**
  - A malformed `#h=` silently lands on Stamp.
  - Focus can land on `body` after Check completes or Remove is pressed.
  - Results may be announced up to three times (`aria-live` output, `role=status` card and `announce()`). Needs the human
    screen-reader pass.
  - `safeFileName` keeps U+2028/2029 and zero-width characters.
  - Core error text stays English in the Spanish UI (already documented).

## Suspects reproduced after review

- **Toolkit:** `paper-search/scripts/search.sh` ran commands from its `limit`/`page` arguments: bash arithmetic expands
  a subscript such as `QUERY[$(cmd)]`. The first regression test used the unset name `a`, which `set -u` aborts on
  before the subscript is expanded, so it passed without any validation. Fixed on `worker/final-tooling-20261104`:
  both arguments must be plain positive integers, and the test now covers set names, checks that the payloads are live
  and checks that the refusal does not come from `set -u`.

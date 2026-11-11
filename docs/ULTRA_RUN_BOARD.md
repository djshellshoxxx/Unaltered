# Ultra run board — 2026-11-04

The single coordination ledger for the 2026-11-04 integration run. The integration owner (one Claude Code
cloud session) maintains it. Older dated ledgers (`CONSOLIDATION_20261030.md`, `BRANCH_LEDGER_20261030.md`) remain
historical evidence.

- Candidate: branch `claude/funny-lamport-2jfc0e`, draft [PR47](https://github.com/djshellshoxxx/Unaltered/pull/47).
- Base: main `1b6dd91be87d1a8c92725439bb87a0517b4156ba`.
- Final source SHA, validation results and CI runs: the "Final state" section at the end.
- Status: unaudited, unsigned development candidate. Nothing is merged to main. No release, tag, signing, deployment
  or account change.

## Topology actually used

- **One cloud instance.** `create_session` was available but was not used. Lanes A/B/C ran as isolated
  git-worktree subagents and multi-agent workflows in this instance, and GitHub Actions supplied the extra compute for
  the three-engine and platform runs. Reasons:
  - The local machine has only Chromium.
  - Child cloud sessions cannot report back into this session.
  - Separate full-context sessions would have added cost and push conflicts.
- **Wave 1:** 6 worktree workers, plus 1 log-extraction helper.
- **Wave 2 discovery** (hash, bytes, build, CI/release, fuzz harness, acceptance scripts):
  - 6 finders and 3 skeptic lenses per finding (reproduce, intent, impact), 124 agents in total.
  - A finding survived only with 2 of 3 lenses **and** an actual reproduction.
- **Final review** of the combined diff: 5 area reviewers plus the same 3-lens verification, 57 agents.
- **Parallel suspects workflow:** reproduce-first, with an independent review of each fix (4 agents).
- **Models:**
  - Opus: security-critical review and fixes, workflow agents.
  - Sonnet: UI/i18n, the PR39 review and the toolkit.
  - Haiku: CI-log extraction.
- **Worker branches** were committed locally in worktrees and merged into the candidate with `--no-ff`. No worker
  pushed.
- **Git identity.** Commits before `19afa04` use the neutral identity `Unaltered contributors`; later commits use
  `Claude <noreply@anthropic.com>`, which this environment signs, so GitHub verifies them.

## Task ledger

| Lane | Task | State | Merge on candidate | Evidence | Notes |
|---|---|---|---|---|---|
| A | Merge open hardening PRs #43–#46 | IMPLEMENTED AND VERIFIED | `5d61489` `ee01d8f` `aa6fa61` `583aca4` | CI run [41756401080](https://github.com/djshellshoxxx/Unaltered/actions/runs/41756401080) | Source PRs left open, not rewritten |
| B | PR #39 Bob/Finney attribution tooling | IMPLEMENTED AND VERIFIED | `ad5ac89` | `tests/r1/r1-calendars.test.mjs` 41/41 with pinned reference | Full R1 stays BLOCKED (live Bob/Finney evidence) |
| A | OTS: quorum floor of two sources; `verifyProof` replays caller-built proofs; reference attestation order | IMPLEMENTED AND VERIFIED | `8cfb930` | each fix failed first; pinned-reference differential; fixtures regenerate identically | FR-7 step 5, ADR-006 |
| A | Calendar stamp minimum: one count per calendar host; a NaN minimum falls back to M=2 | IMPLEMENTED AND VERIFIED | `826b9e5` | `tests/unit/ots-calendar-guards.test.ts` (failed first); independently reviewed | FR-4. Leftover duplicate pending after upgrade is cosmetic; not changed |
| A | Metadata (wave 1): APEv2 footer bounds, PNG PLTE/tRNS rules, JFIF/WAV changes listed, `ID3 ` label | IMPLEMENTED AND VERIFIED | `0b5f18f` | `tests/unit/strip-adversarial.test.ts` | — |
| A | Metadata (final review): kept WAV chunks reduced to their defined fields; APE item count no longer a bound | IMPLEMENTED AND VERIFIED | `77ee087` | text hidden in kept WAV chunks reproduced, then fixed; SPEC §8.2a updated | Values of kept fields are not inspected (stated limit) |
| B | Network/CLI: oversized bodies cancelled; torn same-size reads refused; output-write errors without a stack trace | IMPLEMENTED AND VERIFIED | `47fa95e` `19afa04` | `tests/unit/net-body`, `cli-race`, `cli-io` | SR-8 |
| B | CLI `hash` output: names with LF/CR are escaped GNU-style; other control characters (TAB excepted) are refused; all other names, including Windows paths, print verbatim | IMPLEMENTED AND VERIFIED | `a9a5f95` superseded by `9ebe0d1`; `e9a8e6d` `d9b4fdc` | Windows CI red at `1dbdbf3` reproduced and fixed; GNU `sha256sum -c --strict` interop tests | Non-GNU `sha256sum` (macOS, uutils) cannot read the escaped form; only names with line breaks are affected |
| C | UI: link wording, link/file exclusivity, download suffixes, store order, DOM sinks, one-pass placeholders, conflicting `h=` | IMPLEMENTED AND VERIFIED | `63be188` | `tests/unit/ui-*.test.ts` | New ES string is a DRAFT |
| C | UI (final review): focus restored by each ancestor's position, id and row key; share link applied once | IMPLEMENTED AND VERIFIED | `64fe9c2` | `tests/e2e/focus-restore.spec.ts`, `share-link-history.spec.ts` | The previous restore could move focus from Remove to Copy |
| B | Trusted Types delivery and enforcement tests; skipped (never passed) when the engine lacks the API | IMPLEMENTED AND VERIFIED (Chromium); Firefox/WebKit via CI | `479f5f4` `5a1a8d3` | mutation test (directive removed) fails | Q7 decision stays with the owner; Tor untested |
| B | Build: multi-file worker started from an SRI-pinned `blob:` URL (inherits the page CSP and Trusted Types); honest package checks; build code published; eval gate on every bundle | IMPLEMENTED AND VERIFIED | `43ca0e5`, integration fix `30690fc` | `tests/toolkit/build-output.test.mjs`; two builds byte-identical | ADR-010 amended. Before, a worker loaded by URL ran with no `connect-src` and no integrity check |
| B | CI: native Windows zip check (it checked the macOS zip); E2E `--retries=0`; whole-fixture diff; hash-pinned reference client | IMPLEMENTED AND VERIFIED | `326147b`, `30690fc` | `tests/ci/workflows.test.mjs` | The PowerShell step was not runnable locally; CI is its evidence |
| B | Fuzz harness: offset-based coverage feedback; evidence records a dirty tree and harness/seed hashes | IMPLEMENTED AND VERIFIED | `4c7d908` | `tests/fuzz/campaign.test.mjs` | The `ranges` field of older evidence is not comparable with `coveredOffsets` |
| B | Acceptance scripts: fail-closed `opsec-check.sh`; private R1 output; bounded `network-check` and R1 fetches | IMPLEMENTED AND VERIFIED | `264f3db` | `tests/toolkit/opsec-check.test.mjs`, `tests/r1/r1-acceptance.test.mjs`, `tests/toolkit/network-check.test.mjs` | Without exiftool, tracked media is now a finding |
| C | Toolkit: `start-server.sh` missing-value loop; `search.sh` arithmetic injection; `init-artifact.sh` name validation; `find-polluter.sh` splitting | IMPLEMENTED AND VERIFIED | `6f2cab8` `c7dc77b` `5a1a8d3` | toolkit unittest 32/32 | — |
| B | minimatch dev-only advisory | RESEARCH COMPLETE (accepted risk) | `479f5f4` | `docs/DEPENDENCIES.md` 2026-11-04 | No upstream lint-chain release accepts `>=11.0.1` |
| A | Fallback/cross-check cancellation residual | SUPERSEDED by main `e550b5a` (#38) | — | `hash.test.ts` "cancellation while file I/O is pending" | Waits stop on abort; native reads are not cancelled (documented) |
| B | Native stall A/B diagnostic | RESEARCH COMPLETE | — | [run 41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747) | See below |
| B | API-funded Codex automation (#40 merged; #41/#42 open) | NOT MODIFIED | — | 0 runs at 2026-11-04T01:50Z; first scheduled slot 09:53 UTC | Another provider's workflow |

## Native stall A/B (diagnostic only; never merge its workflow)

Run [41561857747](https://github.com/djshellshoxxx/Unaltered/actions/runs/41561857747), branch
`diag/read-stall-ab-20261102`, head `d77763e`, 2026-11-03.

- **Candidate arm:** hash modules from `03f3ac8`, identical to main's `src/core/hash`.
  - 8/8 shards, 24/24 attempts passed.
  - Digest visible at 24.3–39.2 s.
  - Peak extra renderer RSS 39.1–46.7 MB.
- **Historical baseline arm:** `0b448d8`.
  - 6 of 8 shards failed their first attempt at the 540 s deadline, with a single `read-await` that never advanced.
    Progress was stuck at 0.75–0.85.
  - Shards 1 and 5 passed.
  - 12 attempts were not run because of the first-failure stop. They are not counted as passes.

This reproduces the native pending-read stall with the historical family while the candidate family completes. It
does not isolate one patch's contribution or prove Chromium's root cause.

## Reviewed but not confirmed (residual notes; no code change)

These were raised by an automated reviewer and failed verification: fewer than 2 of 3 lenses agreed, though the
behaviour usually reproduced. Each is low severity unless marked.

- **Hash:**
  - Native Blob read errors from the worker are not typed, so a worker read failure re-hashes on the main thread.
  - The worker's `done` digest shape is not checked beyond the cross-check.
  - The inline blob URL is not revoked if Worker construction throws.
  - `stallMs` above 2^31−1 is accepted.
  - A non-Blob `ChunkSource` longer than its declared size hashes only the prefix.
- **Build/CI:**
  - `connect-src` is scraped from the allowlist source text.
  - The CSP hash gate compares JS strings rather than parsed HTML.
  - The draft release job does not re-check the tag after building.
- **Fuzz:**
  - Executor edge cases on busy/closed workers.
  - `seedExecutions` is the planned count.
  - A replay with a bad manifest is recorded as a finding.
- **Acceptance:** *(fixed in `76bfb01`)* `r1-acceptance.mjs` reported R1 PASS when no upgrade had produced a receipt.
- **UI:**
  - A conflicting `h=` leaves an earlier link's fingerprint on screen.
  - The `el()` script-URL guard can be bypassed by tabs, newlines or C0 characters (no caller passes such URLs).
- **CLI:**
  - The same-size-rewrite check depends on timestamp granularity.
  - A chmod, link or rename during a read makes it refuse an unchanged file.
- **Strip:** a truecolour PNG's suggested-palette `PLTE` is kept.
- **Tooling:**
  - The R1 negative controls do not exercise the pending/non-200 guards.
  - `start-server.sh` now rejects empty option values.
- **Unreproduced earlier suspects:**
  - A malformed `#h=` lands silently on Stamp.
  - Focus can land on `body` after Check completes.
  - Results may be announced up to three times (screen-reader pass).
  - `safeFileName` keeps U+2028/2029 and zero-width characters.
  - Core error text stays English in the Spanish UI.
- **SonarCloud:** reports 1 new non-blocking issue (quality gate passed). Its text could not be read here, because
  sonarcloud.io is blocked by this environment's proxy.

## Owner-action checklist (smallest action that unblocks each gate)

Agents cannot complete these. Each needs the owner, a named person, or an external party.

| Gate | Why agents cannot close it | Smallest owner action |
|---|---|---|
| Merge decision for this candidate | Merging to main needs separate owner authorization | Review draft PR47; when satisfied, mark it ready and merge. Afterwards, decide whether to close source PRs #39 and #43–#46, which this PR contains |
| PR #41 / #42 (API-funded Codex automation) | Another provider's workflow and secrets | After its first scheduled run, check the run log and cost, then decide whether to merge #41, then #42 |
| OPS-2 / OPS-3 | Repository settings | Settings → Branches: protect `main` (PRs, required checks, signed commits, no force-push). Settings → Security: enable secret scanning, push protection, Dependabot alerts and private vulnerability reporting |
| OPS-1 / OPS-5 | Personal identity and account security | Record the pseudonymity decision in `docs/OPSEC.md` §1. Enable hardware-key 2FA on GitHub and any hosting or registrar account |
| OPS-4 / REL-5 | Signing keys must be created offline by the owner | Generate the offline release key and publish its public key in the repo and in two other places. Only then sign `SHA256SUMS` for a release |
| REL-3 / Q6 | Needs an independent auditor | Choose an auditor and give them this candidate SHA plus `docs/AUDIT.md` |
| REL-4 | Needs a second person | A second person follows `docs/RELEASE.md` on their own machine and compares `dist/SHA256SUMS` with CI's |
| A11Y-1 | Needs a human screen-reader user | Run `docs/gates/SCREEN_READER_SCRIPT.md` in NVDA or VoiceOver, including the new focus behaviour and the possible triple announcement |
| Spanish copy | Needs a native speaker | Review `docs/gates/SPANISH_STRINGS_20261030.md` plus `verify.d.noLater.link` ("Esta huella digital existía a más tardar hacia {time} (UTC)") |
| UT-1 | Needs 3–5 people | Run the usability test with non-technical participants |
| Q7 Trusted Types / Tor | Owner decision; no Tor Browser here | Run `tests/e2e/trusted-types.spec.ts` in Tor Browser, or record that Tor is unsupported, then decide Q7 |
| R1 Bob/Finney confirmed paths | Needs live confirmed receipts and real browser network access | Follow `docs/R1_BOB_FINNEY_TEMPLATE.md` with `scripts/r1-bob-finney.mjs` on a networked machine |
| Pending-receipt CORS (404 without ACAO) | Calendar operators set this header | Ask the calendar operators to send `Access-Control-Allow-Origin` on 404 responses, or approve an ADR for a different approach (no silent proxy) |
| Q5 / LEGAL-1 | Domain and legal decisions | Decide the domain policy; get legal review of the public wording |
| SonarCloud gate (B security rating on new code) | The issue cannot be read here (sonarcloud.io blocked) | Open https://sonarcloud.io/project/issues?id=djshellshoxxx_Unaltered&pullRequest=47&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true and fix or mark the remaining vulnerability; or allow `sonarcloud.io` in this environment's network settings and ask the agent to fix it |
| exiftool in CI | `opsec-check.sh` now treats tracked media as a finding without exiftool | If media files are ever tracked, install a pinned exiftool in the `opsec` job first |

## Final state

Final source SHA: `3144a44`. After the validation below, `30690fc` → `3144a44` added only:
- `d4d765e`: macOS CI fix. The fuzz driver's temp directory is now realpath'd, because on macOS `/var` → `/private/var`
  hid all coverage. Reproduced on Linux with a symlinked `TMPDIR`; covered by a regression test.
- `57f8561`, `e251361`: a containment guard and a constant error message in the test stub
  `tests/r1/stubs/browser-step.mjs`, for SonarCloud's path-traversal findings there.
- `b60fee6` and its revert `0e7cf12`: a SonarCloud test-scope file, reverted because it had no observed effect.
- `853a620`, `57f2472`: `r1-acceptance.sh` creates its default work directory with an explicit `mktemp` template under
  `TMPDIR` (BSD/macOS `mktemp -d` did not use the test's `TMPDIR`). The stub guard is restored to the form SonarCloud
  accepts.
- `76bfb01`: the R1 runner reports PASS only when Upgrade produced the receipt that Verify confirmed. A Verified result
  without one is the new classification `NOT_UPGRADED`. This was a residual note; it is now reproduced and fixed.
- `3144a44`: the R1 test doubles write each call record in one append. Concurrent pipeline stages interleaved records
  (seen on macOS CI); reproduced locally with 400 concurrent pairs; covered by a regression test.

Product code (`src/`) and the build are unchanged since `30690fc`.

Local results at the final source (Linux, 4 vCPU, Node 22.23.4, pinned Chromium; reference `opentimestamps==0.4.5`):

- `UNALTERED_PYTHON=<venv> npm run check`: OPSEC PASS, typecheck and lint clean, Vitest 289 passed / 1 skipped
  (the optional Node 2 GiB test), Node tests 117/117.
- `npm run build` twice: all 10 `dist/` files byte-identical. Build code `77fbaedbbad25b65`; `sha256sum -c SHA256SUMS`
  OK. `hasher.worker.js` is no longer shipped.
- Fixture regeneration with the hash-pinned reference set: `diff -r` identical, `expected.json` included.
- `npx playwright test --retries=0` (Chromium): 80 passed, 1 skipped (the optional 2 GiB spec), 0 failed. This covers
  the 50 ms responsiveness check, the offline `file://` build, Trusted Types, focus restoration and share-link history.
- Chromium 2 GiB ×3 and the 300 s harness check: see the update below.
- Fuzz on the final cleaners at `04a9c1f` (cleaners unchanged since): seed 20261105, 1,000,000 mutations, no finding,
  1153 s (`docs/evidence/fuzz-20261105.json`).
- Chromium 2 GiB ×3 at `04a9c1f`: 3/3. Digest visible at 34.4/34.8/35.1 s; max sampled extra renderer RSS
  60,760,064 bytes against the unchanged 200 MiB and 540 s limits.

CI:

- `c7dc77b`: Windows, macOS, Linux build, Chromium 2 GiB memory, Chromium/Firefox E2E, differential and secret scan
  all passed before the run was cancelled by the next push.
- Full matrix by `workflow_dispatch` at `d4d765e`: [run 41783868297](https://github.com/djshellshoxxx/Unaltered/actions/runs/41783868297),
  conclusion **success**. `d4d765e` has the final product code and the new `blob:` worker.
  - Firefox 2 GiB 3/3, digest visible at about 44 s.
  - WebKit 2 GiB 3/3, about 17 s, worker observed.
  - Chromium 2 GiB memory: passed.
  - E2E (Chromium, Firefox and WebKit, `--retries=0`): passed.
  - Windows: passed, including the first execution of the native Windows zip check with its shipped
    `Verify-Checksums.ps1`.
  - macOS, Linux build/test/reproducibility, the cross-platform byte-identical comparison, the differential job and
    the secret scan: passed.
  - Only the informational live check failed, as it does on main (see above).
- Local 2 GiB ×3 at `30690fc`, the source with the new `blob:` worker: 3/3, worker observed in all three attempts.
  Digest visible at 33.6/35.3/35.3 s; max sampled extra renderer RSS 61,231,104 bytes.
- The 300 s check of the new fuzz harness at `30690fc`: 222,092 mutations, no finding, `coveredOffsets` recorded per
  target. It also correctly reported `sourceDirty: true`, because uncommitted doc edits were in the tree.
- **SonarCloud quality gate: FAILED, open.**
  - It passed through `d9b4fdc`. At `30f2625` it reported "C Security Rating on New Code"; after the stub guard it
    reports B, meaning one minor vulnerability is left.
  - sonarcloud.io is blocked by this environment's network policy, so the issue text could not be read and was not
    guessed further.
  - Owner action: open the PR's SonarCloud issues and fix or triage the remaining vulnerability, or allow
    `sonarcloud.io` for the session.
- The informational live check fails on every head, main included: calendars answer a pending
  `GET /timestamp` with 404 and no CORS header.

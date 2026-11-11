# Hardest remaining work — orchestration prompt, 2026-11-11 UTC

This file is a reusable prompt. A lead agent pastes it into a new session (or hands each **Workstream** section to a
sub-agent) to start the hardest open engineering work in Unaltered. It was written from `main` at `556fc2d` after
reading `docs/TODO.md`, `docs/AUDIT.md`, `docs/COMPLETION_STATUS.md`, `docs/handoff/AUTONOMOUS-DEVELOPMENT-LATEST.md`,
`docs/ARCHIVAL_QR_PROTOCOL.md`, `docs/FUZZING.md`, the CORS evidence and the list of open pull requests.

## State at the time of writing

- `main` CI, QR print/scan qualification and the authorized Pages publication are green on `556fc2d`.
- The scheduled workflow "Unaltered API-Funded Cloud Development" (`.github/workflows/unaltered-codex-cloud.yml`)
  fails on `main` (runs 42690811469, 42863867428). It was not activated by any of this work.
- 23 pull requests are open (#41–#78). Many are draft, stacked or superseded by #67–#69.
- The container used for this run cannot reach calendars or explorers (the egress proxy refuses them). Live network
  qualification must run in CI (`network-check`) or in an environment whose allowlist includes those hosts.

## Out of reach for agents (do not attempt, do not claim)

Independent audit (REL-3), second-person rebuild (REL-4), release signing and key distribution (REL-5, OPS-4),
repository/account settings (OPS-1..6), human screen-reader, native Spanish and usability tests, Tor Browser, native
Safari/Edge, owner decisions Q5 (domain) and Q7 (Trusted Types), legal review, reading the SonarCloud finding, and
contacting calendar operators. Agents may prepare material for these people. They never perform or simulate them.

## The five hardest agent-tractable problems, ranked

| # | Problem | Why it is hard | Workstream |
|---|---|---|---|
| 1 | **R1: pending upgrades are unreadable in browsers.** All three calendars answer `GET /timestamp/<commitment>` for a pending commitment with 404 and no `Access-Control-Allow-Origin`. The browser gets an opaque `TypeError`, the same signal as an outage. | The root cause is outside the repo (nginx `add_header` without `always`). The app must stay honest without being able to read the reply. | A |
| 2 | **Hash fallback cancellation and stalls.** The main-thread fallback can wait for a 30 s watchdog while a native BYOB read is pending. Cross-check reads were made abort-aware later, but the residual was never re-qualified or closed. An unreadable file mid-hash may still surface a raw `DOMException`. | Browser backend behaviour, races between abort, EOF and cleanup, memory ceilings. Tests must model real stuck reads. | B |
| 3 | **New hostile-input parsers are not fuzzed.** The fuzz harness covers six targets (OTS proof, calendar timestamp, JPEG, PNG, WAV, MP3). The archival QR frame decoder, the QR image header inspection, the trusted-header parser and the stored receipt list are newer parsers of untrusted bytes and have only unit/property tests. | Needs harness targets with real oracles (round-trip, bounds, no unexpected exception), seeds without private data, then triage of real findings. | C |
| 4 | **Archival QR is not production-qualified.** `ARCHIVAL_QR_PROTOCOL.md` requires independent golden vectors and third-party decoder verification. Recovery is proven only for clean 150 DPI PDF rasters, not for photographs (rotation, perspective, blur, JPEG noise, uneven light, low contrast). | Requires an independent decoder, a distortion corpus and measured recovery rates, while keeping the in-app decoder unchanged unless a defect is proven. | D |
| 5 | **PR backlog and failing automation.** About 23 open PRs overlap and stack. Small, test-backed fixes (#74–#78, #71, #65) wait unreviewed. The scheduled automation workflow fails. | Each PR must be checked against `main` for being superseded or still unique, without closing, merging into `main` or rewriting anyone's branch. | E |

## Rules for every agent

1. Work only in your own git worktree. Edit only the paths your workstream owns. If you need a change outside them,
   stop and report it to the lead with the exact diff you would make.
2. Do not edit `docs/TODO.md`, `HANDOFF.md`, `docs/COMPLETION_STATUS.md`, `package-lock.json` or any workflow file.
   Report the line you want changed. Do not add npm dependencies. Test-only Python packages go in a scratch venv,
   pinned with `--require-hashes` in a `requirements.txt` next to the test, licence recorded (no GPL/AGPL).
3. Test first. Every fix has a regression test that you saw fail before the fix and pass after it. Never weaken an
   assertion, raise a threshold, add a retry or skip a test to get green.
4. Setup in your worktree:
   ```bash
   npm ci --ignore-scripts
   ```
   Python reference (needed by differential tests):
   ```bash
   python3 -m venv "$SCRATCH/venv" && "$SCRATCH/venv/bin/pip" install -q opentimestamps==0.4.5
   ```
   and export `UNALTERED_PYTHON="$SCRATCH/venv/bin/python"`.
5. **Browser tests share port 4173 and four CPUs.** Wrap every Playwright command in the shared lock, for example
   `flock "$LOCK" npx playwright test tests/e2e/<spec> --retries=0`, and run `npm run build` inside the same lock
   first. During iteration, run only the affected specs. A responsiveness failure while other agents are busy is
   re-run once on its own. If it fails again, report it. Do not change its threshold.
6. Final check before you report: `npm run check`. If you changed browser-visible code, also run the affected e2e
   specs under the lock.
7. Commit in your worktree with a clear message and these trailers:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: <session URL>
   ```
   Do not push. The lead integrates your commits.
8. Never put home paths, tokens, personal data or real private receipts in code, fixtures, evidence or commit
   messages. `scripts/opsec-check.sh` must pass.
9. Report in this format (at most 40 lines):
   `TASK | BRANCH+SHAS | CHANGED FILES | RESULT | EVIDENCE (commands + pass counts) | UNVERIFIED | BLOCKERS | TODO-LINES`.

---

## Workstream A — R1 pending-upgrade CORS (hardest)

**Goal:** the browser tells a probably-still-pending receipt apart from a calendar outage without being able to read
the 404. Also prepare an upstream fix the owner can submit.

**Owns:** `src/core/ots/calendar.ts`, a new `src/core/ots/liveness.ts` (or similar), `src/core/net/*` only if needed,
`src/ui/views/verify.ts`, new keys in `src/ui/strings.ts` (English and Spanish, with key parity),
`tests/unit/ots-*liveness*.test.ts`, `tests/e2e/*liveness*.spec.ts`, `docs/NETWORK.md`, a new ADR-014 in
`docs/DECISIONS.md`, and `docs/proposals/OTS_SERVER_CORS.md`.

**Read first:** `docs/evidence/cors-continuation-20261105.md`, `docs/NETWORK.md`, `docs/evidence/r1-targets-20261105.json`,
`src/core/ots/calendar.ts` (`upgrade`, the `unreadable` flag), commit `4113c49` (reference-client fallback copy), ADR-001,
ADR-006 and ADR-008.

**Design to evaluate, then implement if it holds:**
1. A *liveness canary* per calendar. Record one commitment per built-in calendar that the evidence shows returns a
   complete, readable (CORS-enabled) 200, for example the Alice/Bob/Finney R1 targets. When a pending lookup comes
   back unreadable, fetch that calendar's canary through the same allowlisted, bounded transport. If the canary
   reads and parses as a valid timestamp whose commitment matches the request, report
   "calendar reachable; this receipt is probably still waiting for Bitcoin". If not, report
   "calendar unreachable or blocked". Never report "pending" as fact, and never treat a canary result as a proof
   result.
2. Privacy: the canary is a fixed public commitment, so it reveals nothing about the user's file. It adds at most one
   request per calendar per upgrade attempt. Document this in `NETWORK.md`. It must not widen the CSP or the allowlist.
3. Fail closed: canary bytes are parsed by the existing calendar timestamp parser, with the existing byte and time
   limits. A malformed canary reply means "unknown", never "pending".
4. Tests: unit tests with a fake fetch covering canary readable, canary unreadable, canary malformed, canary
   commitment mismatch, abort, and timeout. An e2e test with mocked routes for both UI states. Both languages.
5. An ADR-014 with context, decision, alternatives considered (do nothing, proxy (rejected by ADR-001), a different
   provider, the canary) and consequences.
6. `docs/proposals/OTS_SERVER_CORS.md`: the minimal upstream change for `opentimestamps-server`
   (`contrib/nginx/*`: `add_header Access-Control-Allow-Origin * always;`), with a citation of the nginx `always`
   documentation and the exact file and line at commit `1e955ea3b036453bf795505d923f2643f773810c`. Include a short,
   neutral note an operator could act on. **Do not open an upstream issue or PR and do not contact anyone.**

**Done when:** `npm run check` passes, the new unit and e2e tests pass in Chromium, `strings` parity passes, and the
live qualification command for CI is written down. Live calendars are not reachable from this container. Say so.

## Workstream B — hash fallback cancellation residual

**Goal:** close or precisely re-scope the open item "Resolve documented fallback cancellation residual (including
pending cross-check reads)" and the low item "raw `DOMException` if a file becomes unreadable mid-hash".

**Owns:** `src/core/hash/*`, `tests/unit/hash*.test.ts`, `tests/e2e/hash-*.ts`, `tests/e2e/hash-*.spec.ts` and a new
`docs/evidence/hash-cancel-20261111.md`.

**Read first:** `docs/CONSOLIDATION_20261030.md` lines 135–150, `docs/REVIEW_CONSOLIDATION_20261030.md` lines 35–45,
`docs/diagnostics/pending-cancel-fixtures.patch`, `src/core/hash/stream.ts` (`awaitAbortable`, `within`, `abandon`,
`readCrossCheckInput`, `hashSource`), `src/core/hash/hasher.ts`, `tests/unit/hash-cancel-residual.test.ts`.

**Steps:**
1. Reproduce first. Use the retained diagnostic fixtures to build controlled models of (a) a BYOB read that never
   settles while `signal` aborts, (b) a slice `arrayBuffer()` that never settles during cross-check, and (c) a source
   that throws a `DOMException` (`NotReadableError`, `NotFoundError`) halfway through. Record for each how long
   `hashBlob` takes to settle after abort and which error type reaches the UI.
2. If abort already settles promptly (`readCrossCheckInput` gained `awaitAbortable`), prove it with tests that fail
   if prompt settlement regresses, and document the remaining bound (abandoned backend buffers).
3. If abort still waits for the 30 s watchdog in the BYOB fallback, make the wait itself abort-driven (race the
   pending read against `signal`, then `abandon` the reader), keeping the existing EOF, short-read, oversize, memory
   and watchdog behaviour. Existing hash tests must still pass unchanged.
4. Map unexpected `DOMException`s from reads to a typed `UnalteredError` with a generic message. Never surface a raw
   browser message.
5. Write `docs/evidence/hash-cancel-20261111.md` with exact numbers, and say in the report whether the TODO item can
   be ticked or how it should be reworded.

**Done when:** new regressions fail before and pass after, all existing hash tests (including
`UNALTERED_BIG=1 npx vitest run tests/unit/hash.test.ts` if time allows) pass, and the affected Chromium hash e2e
specs pass under the lock.

## Workstream C — fuzz the new hostile-input parsers

**Goal:** bring the archival QR and other newer untrusted-byte parsers into the coverage-guided harness, run bounded
campaigns and fix real findings.

**Owns:** `tests/fuzz/*`, `scripts/parser-fuzz.mjs`, `scripts/lib/fuzz-*.mjs`, `docs/FUZZING.md`,
`docs/evidence/fuzz-20261111*.json`, the `test` script line in `package.json` (only to add a new test file), and fixes
in `src/core/archive/frames.ts`, `src/core/archive/qr-decode.ts`, `src/core/archive/qr-limits.ts`,
`src/core/archive/qr-image.ts`, `src/core/ots/trusted-header.ts`, `src/ui/store.ts`.

**Read first:** `docs/FUZZING.md`, `tests/fuzz/targets.ts`, `scripts/parser-fuzz.mjs`, `docs/ARCHIVAL_QR_PROTOCOL.md`,
`tests/archival/golden-v1.hex`, `tests/unit/archival-qr-*.test.ts`, `tests/unit/qr-image-*.test.ts`.

**Targets to add (synchronous entry points only, with oracles):**
1. QR frame parse and reassembly: accepted frame sets must reassemble to bytes whose checksum matches, re-encode to the
   same frames, and respect the 16 MiB and 4096-frame limits. Mixed or conflicting sets must be rejected with a typed
   error.
2. QR image header inspection (PNG/JPEG dimension reading before native decode): must never report dimensions
   different from the declared header, never accept above 6000 px per side or 16 Mpx, and never throw untyped.
3. Trusted 80-byte header parsing and comparison (`trusted-header.ts`).
4. Stored receipt-list parsing in `src/ui/store.ts` (hostile `localStorage` JSON): must not throw, must drop invalid
   entries, and must never hold a file name.
Seeds come only from repository fixtures and generated synthetic data.

**Run:** at least one 300-second campaign per new target, with a fixed seed. Commit the compact report JSON. For each
finding: minimal synthetic regression test, fix, replay passes.

**Done when:** `npm test` (including the fuzz harness self-tests) passes, campaign JSON is committed, and findings are
fixed or listed with reproduction bytes kept out of Git if sensitive.

## Workstream D — archival QR robustness and independent decoding

**Goal:** meet the protocol's own production prerequisite (independent golden vectors and third-party decoder
verification) and measure recovery from camera-like images.

**Owns:** `tests/qualification/*`, `tests/archival/*`, `playwright.qr.config.ts`, `src/core/archive/qr-scan.ts`,
`src/core/archive/qr-scan.worker.ts`, `docs/ARCHIVAL_QR_PROTOCOL.md`, `docs/QR_INTEGRATION_VALIDATION.md`,
`docs/evidence/qr-robustness-20261111.json`.

**Read first:** `docs/ARCHIVAL_QR_PROTOCOL.md`, `docs/QR_INTEGRATION_VALIDATION.md`, `docs/QR_ENCODER_REUSE.md`,
`tests/qualification/qr-pdf.spec.ts`, `tests/archival/test_recover_reference.py`, `src/core/archive/qr-print.ts`,
`src/core/archive/qr-scan.ts`, `tests/helpers/qr-raster.ts`.

**Steps:**
1. Independent decoding: in a scratch venv, install a permissively licensed decoder (prefer `zxing-cpp`, Apache-2.0)
   and a PDF rasterizer that is not AGPL (`pdftoppm` exists on this host, or `pypdfium2`). Pin with hashes in
   `tests/archival/requirements.txt` and record licences. Decode the app's printed PDF for at least three receipt sizes
   and every error-correction level, feed the raw byte payloads to the existing Python reference recovery, and check
   that the recovered `.ots` is byte-identical. Add this as an opt-in test, skipped with a clear message when the
   decoder is absent.
2. Golden vectors: add a second, independently constructed vector set (Python builds the frames from the spec text,
   not from TypeScript output) with expected hex. TypeScript and Python must both agree.
3. Distortion corpus: generate deterministic, seeded variants of the rasterized pages (rotation 0–10°, perspective
   skew, Gaussian blur, JPEG quality 30–90, gamma and uneven lighting, 100–300 DPI, partial occlusion of one symbol).
   Measure in-app (jsQR worker path in Chromium) and zxing recovery per variant. Commit only the generator and a
   compact results JSON, not the images.
4. If the in-app path fails where recovery is clearly feasible (zxing succeeds), make the smallest scan-pipeline
   change in `qr-scan.ts` or its worker (for example extra binarization thresholds or rotations), within the existing
   120 s deadline and image limits, with a regression test. Do not change protocol bytes or the print layout.
5. Update the two docs with what is now qualified and what is not (real printers and phone cameras remain human
   evidence).

**Done when:** opt-in independent-decoder test passes locally, golden vectors agree in both languages, robustness JSON
is committed, and `npx playwright test -c playwright.qr.config.ts --retries=0` passes under the lock.

## Workstream E — pull-request backlog ledger and failing automation

**Goal:** a factual ledger of every open PR, the small verified fixes integrated onto the lead's branch, and a
diagnosis of the failing scheduled workflow.

**Owns:** `src/core/reports/*`, `src/cli/*`, `src/core/archive/qr-plan.ts`, their tests, and
`docs/handoff/PR_BACKLOG_20261111.md`. Read-only access to everything else, including all PR branches.

**Steps:**
1. For each open PR (#41–#78): head SHA, base, whether its changes are already in `main` (`git cherry`, patch-id, tree
   comparison), unique remaining changes, conflicts with `main`, CI state, and a recommendation (integrate, superseded,
   needs owner, leave). Never close, merge to `main`, comment on or rewrite any PR.
2. Integrate onto your worktree branch only PRs that are still unique, small, test-backed and inside your owned paths
   (candidates: #74 evidence ZIP snapshot, #75 batch cancel result, #76 batch empty names, #77 receipt time order,
   #78 QR plan page minimum, #71 CLI parity if it rebases cleanly). For each one: confirm its regression fails on
   `main` and passes after, then cherry-pick with `-x` so the source stays traceable.
3. Diagnose the failing "Unaltered API-Funded Cloud Development" scheduled runs from their logs. Report the cause and
   the smallest owner action. Do not edit, disable or dispatch the workflow.
4. Dependabot PRs #56/#57: report whether they pass checks. #55 updates a third-party action used only by the
   automation workflow: report, do not integrate.

**Done when:** the ledger is committed, each integrated PR has its regression evidence, and `npm run check` passes on
the integrated worktree branch.

---

## Lead integration

1. Merge each workstream branch into the session branch in the order E, C, B, A, D (smallest blast radius first),
   resolving `strings.ts` additions by hand.
2. Run `npm run check`, then the full Chromium e2e suite with `--retries=0`, then the QR qualification config.
3. Update `docs/TODO.md` and `HANDOFF.md` from each report's TODO-LINES. Record what remains unverified.
4. Push the session branch and open one draft PR that links every source PR integrated by E.

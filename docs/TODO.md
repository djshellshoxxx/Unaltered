# TODO

Current publication addendum: [final handoff and raw evidence](FINAL_HANDOFF_20261030.md).

Legend: `[ ]` open, `[x]` done. IDs map to milestones in `BUILD_PLAN.md` and requirements in `SPEC.md`.
Do tasks in order within a milestone unless marked parallel.

## Authoritative integration status — 2026-11-04

- Candidate: draft [PR47](https://github.com/djshellshoxxx/Unaltered/pull/47), branch `claude/funny-lamport-2jfc0e`.
- Base: main `1b6dd91`. PR34 is already merged into main.
- Task states, CI run IDs and unreproduced suspects: [ULTRA_RUN_BOARD.md](ULTRA_RUN_BOARD.md).
- The 2026-10-30 section below is historical. Where the two disagree, this section supersedes it.

Done (each fix has a regression test that failed on its parent):

- [x] **Hardening PRs.** Merged #43 (stall-timeout validation), #44 (proof serialization guard), #45 (truncated
  `ftyp`) and #46 (stale live-region announcements). Also merged #39, the Bob/Finney attribution tooling; its offline
  tests pass with the pinned reference.
- [x] **Fallback/cross-check cancellation.** Resolved on main by #38: waits on pending BYOB, fallback, cross-check
  and WebCrypto reads stop on abort, covered by unit tests.
  - Native reads are not themselves cancelled. `awaitAbortable` documents this, so no "native read cancelled" claim
    is made.
- [x] **Firefox/WebKit 2 GiB completion dispatch** on the candidate's hash code (run 41756413597): Firefox 3/3,
  WebKit 3/3, Chromium memory 3/3.
  - Completion only: there is no RSS probe on Firefox or WebKit, so no memory-ceiling claim is made for them.
- [x] **Native stall A/B diagnostic** (run 41561857747):
  - Candidate hashing family: 24/24 attempts passed.
  - Historical family: failed 6 of 8 shards at 540 s with a stuck pending read.
  - Diagnostic only; it does not establish Chromium's root cause.
- [x] **Local Chromium full E2E**, `--retries=0`: 69 passed, 1 optional skip. The 50 ms responsiveness test passed,
  as did the offline single-file test.
- [x] **Dev-only minimatch advisory** (11 moderate entries): accepted risk with a dated rationale in
  `DEPENDENCIES.md`. No upstream lint-chain release accepts the fix yet; runtime audit is 0.
- [x] **Trusted Types.** Delivery and enforcement are now tested for both builds. Chromium enforces; Firefox and
  WebKit are covered by the CI E2E matrix.
- [x] **OTS fixes:**
  - The explorer quorum can never fall below two sources (FR-7 step 5).
  - `verifyProof` replays caller-built proofs before trusting them.
  - Attestations are ordered like the reference serializer.
- [x] **Metadata parser fixes:**
  - A forged APEv2 footer can no longer drop a real MP3 frame.
  - PNG PLTE/tRNS must fit the colour type.
  - Dropped JFIF header bytes and zeroed WAV pad bytes are now listed.
  - `ID3 ` WAV chunks get the correct label.
- [x] **Network/CLI fixes:**
  - Oversized reply bodies are cancelled.
  - `hash` output escapes newline, CR and `\` the way sha256sum does, only in names that contain a line break, so
    Windows paths print unchanged. Names with other control characters (TAB excepted) are refused.
  - A same-size rewrite during a read fails instead of printing a torn fingerprint.
  - A failed output write gives a generic error with no stack trace (SR-8).
- [x] **UI fixes:**
  - The share-link result says "fingerprint", not "file".
  - A share link and a picked file are mutually exclusive.
  - Download names keep their suffixes.
  - Turning the receipt list off deletes the data before the flag.
  - Focus is kept across re-renders.
  - String-valued inline handlers and script URLs are refused.
  - Placeholders are substituted in one pass.
  - A link with conflicting `h=` fragments yields no fingerprint.
- [x] **Toolkit:** `start-server.sh` no longer loops forever when an option has no value.
- [x] **Final review of the combined diff and wave-2 discovery** (multi-agent; each finding needed 2 of 3 skeptic lenses
  plus an actual reproduction). Fixed, each test-first:
  - Focus restoration could move focus to another control (Remove → Copy). Back/Forward no longer discards the
    chosen file.
  - Kept WAV chunks carried hidden trailing bytes. APEv2 item counts are no longer a hard bound.
  - CLI hash lines are GNU-readable; names with other control characters are refused.
  - The multi-file hash worker ran outside the page CSP and SRI. It now starts from an SRI-pinned `blob:` URL
    (ADR-010 amended).
  - Package checks claimed genuineness; the multi-file `index.html` was offered for `file://`; the build code was
    never published; the eval gate covered only one bundle.
  - The Windows CI zip check verified the macOS zip. E2E gates retried. The fixture gate skipped `expected.json`. The
    reference client was not hash-pinned.
  - Fuzz coverage feedback missed branches; fuzz evidence ignored a dirty tree.
  - `opsec-check.sh` passed when git was unusable and missed several identity and metadata leaks. R1 and
    `network-check` scripts had unsafe output paths and unbounded fetches.
  - Calendar stamp minimum: duplicate URLs counted twice; a NaN minimum disabled the check.
  - Toolkit `search.sh` / `init-artifact.sh` / `find-polluter.sh` input handling.
  - Rejected findings are listed as residual notes in `ULTRA_RUN_BOARD.md`.
- [x] **Second fuzz campaign** on the final WAV/APE cleaners (`docs/evidence/fuzz-20261105.json`, 1,000,000
  mutations, no finding).

Still open:

- [ ] **R1 residuals:**
  - Bob/Finney confirmed browser paths.
  - The pending-receipt `GET /timestamp` returns 404 without CORS on all three calendars; the live check re-confirmed
    this on 2026-11-04.
- [ ] **Q7 Trusted Types decision** (owner) and Tor Browser testing (no Tor Browser available to agents).
- [ ] **Human gates:**
  - Screen-reader pass, including whether results are announced up to three times.
  - Native review of all Spanish copy, including the new `verify.d.noLater.link`.
  - Usability test with 3–5 people.
- [ ] **External and owner gates:**
  - Independent audit (REL-3) and a second-person rebuild (REL-4).
  - Signing (REL-5) and OPS-1..6.
  - Domain (Q5) and legal review (LEGAL-1).

## Authoritative consolidation status — 2026-10-30 (historical)

Candidate [PR34](https://github.com/djshellshoxxx/Unaltered/pull/34), final source/workflow `f2e7d24017171475be23f9e069a91ae195fea2c3` (product/tests `d09c2401839ea5a06fd794c9666d439b17e500e4`),
from main `da9b0a3`. Main already contains PR28/29/32; selected continuation25/30/31/33 is consolidated without closing them.
See [acceptance, blockers, owners and exact next commands](CONSOLIDATION_20261030.md),
[all branch dispositions](BRANCH_LEDGER_20261030.md) and current HANDOFF.md. Older acceptance notes below are historical.

- [x] Consolidate silence-based partial-read hashing, cadence tests, conservative pending handling and seven language cases.
- [x] Reproduce/fix final-boundary cancellation and unresolved data-buffer accumulation; internal changed-range review.
- [x] Local173+5 check, reference21/21, toolkit18/18, fixtures7/7, ten-file reproducibility, Node2GiB37/37, Chromium real-file2GiB3/3.
- [ ] Finish candidate acceptance ledger: FF/WebKit2GiB manual dispatch, native stall A/B and documented local browser/performance failures.
- [ ] Resolve documented fallback cancellation residual (including pending cross-check reads) before claiming universal cancellation support.
- [ ] Review11 moderate dev-only minimatch audit entries; runtime-only audit0. Local provenance blocked; native source verification recorded.
- [ ] R1 residuals: Bob/Finney confirmed browser paths and known pending404 CORS/outage limitation. Alice source app/reference path has native evidence.
- [ ] Human accessibility, all draft Spanish copy, usability3-5 people, Tor/Trusted Types, independent audit/rebuild, signing, operations and legal/domain controls.

**Milestone remains incomplete; M4/M5/release are not complete.** Do not change development version0.3.1 to match historical release plans.
The detailed existing open requirements remain open; internal agents/native CI do not satisfy human or independent-person gates.

## Repository and operations (do first)
- [ ] **OPS-1** Decide pseudonymity policy for maintainers; document it (OPSEC §1). Rename/replace anything personal in the repo **before** the first public release.
- [ ] **OPS-2** Enable on GitHub: branch protection on `main` (PRs required, status checks required, signed commits required, no force-push), secret scanning + push protection, Dependabot alerts.
- [ ] **OPS-3** Enable private vulnerability reporting (Settings → Security).
- [ ] **OPS-4** Create release-signing key (offline/hardware); publish public key in repo and 2 other places; replace the TODO in `SECURITY.md`.
- [ ] **OPS-5** Hardware-key 2FA on GitHub and any hosting/registrar accounts.
- [ ] **OPS-6** Set repo-local git identity; run `./scripts/opsec-check.sh`.
- [x] **CI-1** Review `.github/workflows/ci.yml`; add the build/test jobs once a lockfile exists.
- [x] **CI-2** Replace action version tags with full commit SHAs (official action repository tag targets resolved through the GitHub API on 2026-10-22; recorded in `COMPLETION_STATUS.md`).
- [x] **UX-1** Write `docs/UX.md` (wireframes from the design discussion + final copy for SPEC §11).

## M0: Spikes
- [x] **M0-1** Evaluate official OTS JS package vs in-house codec; write ADR-003 outcome.
- [x] **M0-2** Read `python-opentimestamps` source: stamping, nonce, calendar request/response, merging, attestation tags. Record file/line citations.
- [ ] **M0-3** Browser CORS test for each calendar and explorer; write `docs/NETWORK.md` (confirmed hosts, API shapes, rate limits). Update SPEC §9 allowlist.
- [x] **M0-4** Install pinned toolchain: `npm install --save-exact --save-dev typescript esbuild vitest fast-check @playwright/test eslint` (+ plugins), commit lockfile, verify integrity hashes, wire `npm run check`.
- [x] **M0-5** Generate reference fixtures with the Python `ots` client (pending + confirmed) and expected outcomes.
- [x] **M0-6** Write `scripts/build.mjs` stub and confirm two builds produce identical output.

## M1: Hashing
- [x] **FR-1a** `core/hash/hasher.worker.ts` streaming SHA-256 (noble `sha256.create()`), 4 MiB chunks.
- [x] **FR-1b** `core/hash/hasher.ts` API with `AbortSignal` and progress.
- [x] **FR-1c** WebCrypto cross-check for files ≤ 64 MiB.
- [x] **FR-1d** Tests: vectors (`tests/vectors/sha256.json`), random-chunking property test, 2 GiB memory test.
- [x] **FR-2** Fingerprint display + copy (basic UI harness).
- [x] **SR-1/3** CSP and SRI generation in build; fail build if inline script appears (except single-file build).

## M2: OpenTimestamps
- [x] **NET-1** `core/net/allowlist.ts` + `fetch.ts` (timeouts, size caps, credentials omit, no referrer).
- [x] **NET-2** Lint rule / test that only `core/net` calls `fetch`.
- [x] **OTS-1** `types.ts`, `ops.ts`, `codec.ts` with caps/depth/iterative parsing.
- [x] **OTS-2** `calendar.ts`: submit (FR-4), upgrade (FR-6).
- [x] **OTS-3** `bitcoin.ts`: block header sources + quorum + disagreement handling.
- [x] **OTS-4** `verify.ts` with all result states (FR-7).
- [x] **OTS-5** Negative tests (SR-10): mutated file, mutated proof, truncated proof, wrong calendar, disagreeing explorers, pending-only, unknown tag.
- [x] **OTS-6** Differential tests vs Python client (CI job).
- [x] **OTS-7** Fuzz harness for codec (SR-9).
- [ ] **Q7** Decide Trusted Types policy after testing in Chromium, Firefox, Tor Browser.

## M3: Stripping
- [x] **STR-1** `strip/detect.ts` by magic bytes.
- [x] **STR-2** `strip/jpeg.ts` allowlist rewriter + self-check.
- [x] **STR-3** `strip/png.ts` allowlist rewriter + CRC verification + self-check.
- [x] **STR-4** Synthetic fixtures: EXIF with GPS, embedded thumbnail, XMP, IPTC (APP13), trailing data after EOI, truncated files, APNG.
- [x] **STR-5** Property tests: idempotent, no forbidden markers/chunks, image still decodes.
- [x] **STR-6** Fuzz tests.
- [x] **Q3/Q4** Decide ICC and Orientation handling; update SPEC §8.

## M4: UI and hardening
- [x] **UI-1** Stamp view (FR-1,2,3,4,5) including cleaned-copy-required flow.
- [x] **UI-2** Verify view (FR-7,8), all six result states with icon + text + colour.
- [x] **UI-3** About / "check independently" view with `ots` + own-node instructions.
- [x] **UI-4** Mandatory copy blocks (SPEC §11).
- [x] **FR-9** Single-file offline build and its CSP hashes.
- [ ] **A11Y-1** axe scan + keyboard + screen-reader pass. Automated axe/keyboard checks pass; the human screen-reader pass remains open.
- [x] **E2E-1** Playwright: stamp → download → verify; offline mode; CSP violation = fail.
- [ ] **UT-1** Usability test with 3-5 non-technical people.
- [ ] **Q6** Choose independent auditor.

## M5: Release
- [x] **REL-1** Refresh `THREAT_MODEL.md` and `DEPENDENCIES.md` internal review record (2026-10-24; bounded scope and outstanding external review in `REVIEW_REFRESH_20261024.md`).
- [ ] **REL-2** Long fuzz run; fix findings. Coverage-guided harness and a 250000-mutation seeded pilot added 2026-10-28
  (`FUZZING.md`, `evidence/fuzz-20261028.json`); WAV/MP3 targets and an MP3 trailer fix added in continuation (f)
  (`REVIEW_20261028.md`). A 1000000-mutation seed-20261029 campaign after the continuation (g) MP3 fix found nothing
  (`evidence/fuzz-20261029.json`). Broader corpora, native-decoder campaigns and independent review remain open.
- [ ] **REL-3** Independent audit; publish report.
- [ ] **REL-4** Second person reproduces the build byte-for-byte.
- [ ] **REL-5** Sign `SHA256SUMS`; publish release, IPFS CID, key in 2+ places.
- [ ] **Q5** Decide domain policy.
- [ ] **LEGAL-1** Legal review of the public site wording and any jurisdictional exposure.

## Backlog (v0.2+)
- [x] FR-10 Batch stamping, FR-11 share link, FR-12 local receipt list, FR-13 settings, FR-14 i18n (English, Spanish)
- [x] PDF metadata *warning* (stripping PDFs is not implemented and not claimed)
- [x] CLI verifier (ADR-011; packaged for Node >=22)
- [ ] Additional anchors (new ADR required)

## Current acceptance notes (2026-10-24)

See [the resume handoff](HANDOFF_20261024.md), [parser evidence](PARSER_ACCEPTANCE_20261024.md), and
[release controls](RELEASE_CONTROLS_20261024.md) for ownership, exact baseline refs, fresh evidence and reproducible next steps.
The four small-input parser regressions are fixed and the targeted 69-test suite passes. Chromium passed the real-file
2 GiB / less than 200 MiB renderer-RSS acceptance and the 50 ms responsiveness check. Managed browser policy blocks
`file://`; pinned browser downloads and Sigstore trust metadata are blocked by network policy. Live browser calls fail
at the managed tunnel, so M0-3/R1 remains open. No required gate is skipped or relaxed. Native CI and human accessibility,
Spanish, usability, independent audit/rebuild and signing controls remain prerequisites for any release claim.

Native follow-up: source`9495512a3108062a5ea3195c1cb6bff59743a125`, run40106725622, passed Linux/Windows/macOS build/tests
and checksum identity, all19 app checks in each browser engine, pinned-Chromium2GiB memory, reference, provenance and secret
checks. Bounded Blob reads resolved the reproduced WebKit responsiveness failure without relaxing50ms. M0-3/R1 and the
human/signing/audit controls stay open; see the latest handoff milestone for exact evidence and ownership.

## Historical status notes (2026-10-14 build session; superseded where newer evidence exists)
- **Done in code, with caveats:** M0-5 fixtures are *synthetic* (generated with the reference library, no live calendar involved). FR-1d: the 2 GiB / <200 MiB memory test runs in Node (`UNALTERED_BIG=1 npm test`, passed), not yet in a CI browser. A11Y-1: axe scans pass; the manual screen-reader pass is still open. Q3 = drop ICC (default); Q4 = warn only (v0.1).
- **Still open, needs a person, network or credentials:** M0-3 (live CORS, run `npm run network-check`), OPS-1..6, CI-2 (action SHAs cannot be verified offline), CI secret-scan job, UT-1, Q5/Q6/Q7 (Firefox and Tor Browser untested), REL-1..5, LEGAL-1, differential tests on real calendar proofs, coverage-guided fuzzing (REL-2), Firefox/WebKit e2e.

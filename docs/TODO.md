# TODO

Legend: `[ ]` open, `[x]` done. IDs map to milestones in `BUILD_PLAN.md` and requirements in `SPEC.md`.
Do tasks in order within a milestone unless marked parallel.

## Repository and operations (do first)
- [ ] **OPS-1** Decide pseudonymity policy for maintainers; document it (OPSEC §1). Rename/replace anything personal in the repo **before** the first public release.
- [ ] **OPS-2** Enable on GitHub: branch protection on `main` (PRs required, status checks required, signed commits required, no force-push), secret scanning + push protection, Dependabot alerts.
- [ ] **OPS-3** Enable private vulnerability reporting (Settings → Security).
- [ ] **OPS-4** Create release-signing key (offline/hardware); publish public key in repo and 2 other places; replace the TODO in `SECURITY.md`.
- [ ] **OPS-5** Hardware-key 2FA on GitHub and any hosting/registrar accounts.
- [ ] **OPS-6** Set repo-local git identity; run `./scripts/opsec-check.sh`.
- [x] **CI-1** Review `.github/workflows/ci.yml`; add the build/test jobs once a lockfile exists.
- [ ] **CI-2** Replace action version tags with full commit SHAs (verify each SHA against the action's official release).
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
- [x] **A11Y-1** axe scan + keyboard + screen-reader pass.
- [x] **E2E-1** Playwright: stamp → download → verify; offline mode; CSP violation = fail.
- [ ] **UT-1** Usability test with 3-5 non-technical people.
- [ ] **Q6** Choose independent auditor.

## M5: Release
- [ ] **REL-1** Refresh `THREAT_MODEL.md` and `DEPENDENCIES.md` review record.
- [ ] **REL-2** Long fuzz run; fix findings.
- [ ] **REL-3** Independent audit; publish report.
- [ ] **REL-4** Second person reproduces the build byte-for-byte.
- [ ] **REL-5** Sign `SHA256SUMS`; publish release, IPFS CID, key in 2+ places.
- [ ] **Q5** Decide domain policy.
- [ ] **LEGAL-1** Legal review of the public site wording and any jurisdictional exposure.

## Backlog (v0.2+)
- [x] FR-10 Batch stamping, FR-11 share link, FR-12 local receipt list, FR-13 settings, FR-14 i18n (English, Spanish)
- [x] PDF metadata *warning* (stripping PDFs is not implemented and not claimed)
- [ ] CLI verifier, additional anchors (new ADRs)

## Status notes (2026-10-14 build session)
- **Done in code, with caveats:** M0-5 fixtures are *synthetic* (generated with the reference library, no live calendar involved). FR-1d: the 2 GiB / <200 MiB memory test runs in Node (`UNALTERED_BIG=1 npm test`, passed), not yet in a CI browser. A11Y-1: axe scans pass; the manual screen-reader pass is still open. Q3 = drop ICC (default); Q4 = warn only (v0.1).
- **Still open, needs a person, network or credentials:** M0-3 (live CORS, run `npm run network-check`), OPS-1..6, CI-2 (action SHAs cannot be verified offline), CI secret-scan job, UT-1, Q5/Q6/Q7 (Firefox and Tor Browser untested), REL-1..5, LEGAL-1, differential tests on real calendar proofs, coverage-guided fuzzing (REL-2), Firefox/WebKit e2e.

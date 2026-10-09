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
- [ ] **CI-1** Review `.github/workflows/ci.yml`; add the build/test jobs once a lockfile exists.
- [ ] **CI-2** Replace action version tags with full commit SHAs (verify each SHA against the action's official release).
- [ ] **UX-1** Write `docs/UX.md` (wireframes from the design discussion + final copy for SPEC §11).

## M0: Spikes
- [ ] **M0-1** Evaluate official OTS JS package vs in-house codec; write ADR-003 outcome.
- [ ] **M0-2** Read `python-opentimestamps` source: stamping, nonce, calendar request/response, merging, attestation tags. Record file/line citations.
- [ ] **M0-3** Browser CORS test for each calendar and explorer; write `docs/NETWORK.md` (confirmed hosts, API shapes, rate limits). Update SPEC §9 allowlist.
- [ ] **M0-4** Install pinned toolchain: `npm install --save-exact --save-dev typescript esbuild vitest fast-check @playwright/test eslint` (+ plugins), commit lockfile, verify integrity hashes, wire `npm run check`.
- [ ] **M0-5** Generate reference fixtures with the Python `ots` client (pending + confirmed) and expected outcomes.
- [ ] **M0-6** Write `scripts/build.mjs` stub and confirm two builds produce identical output.

## M1: Hashing
- [ ] **FR-1a** `core/hash/hasher.worker.ts` streaming SHA-256 (noble `sha256.create()`), 4 MiB chunks.
- [ ] **FR-1b** `core/hash/hasher.ts` API with `AbortSignal` and progress.
- [ ] **FR-1c** WebCrypto cross-check for files ≤ 64 MiB.
- [ ] **FR-1d** Tests: vectors (`tests/vectors/sha256.json`), random-chunking property test, 2 GiB memory test.
- [ ] **FR-2** Fingerprint display + copy (basic UI harness).
- [ ] **SR-1/3** CSP and SRI generation in build; fail build if inline script appears (except single-file build).

## M2: OpenTimestamps
- [ ] **NET-1** `core/net/allowlist.ts` + `fetch.ts` (timeouts, size caps, credentials omit, no referrer).
- [ ] **NET-2** Lint rule / test that only `core/net` calls `fetch`.
- [ ] **OTS-1** `types.ts`, `ops.ts`, `codec.ts` with caps/depth/iterative parsing.
- [ ] **OTS-2** `calendar.ts`: submit (FR-4), upgrade (FR-6).
- [ ] **OTS-3** `bitcoin.ts`: block header sources + quorum + disagreement handling.
- [ ] **OTS-4** `verify.ts` with all result states (FR-7).
- [ ] **OTS-5** Negative tests (SR-10): mutated file, mutated proof, truncated proof, wrong calendar, disagreeing explorers, pending-only, unknown tag.
- [ ] **OTS-6** Differential tests vs Python client (CI job).
- [ ] **OTS-7** Fuzz harness for codec (SR-9).
- [ ] **Q7** Decide Trusted Types policy after testing in Chromium, Firefox, Tor Browser.

## M3: Stripping
- [ ] **STR-1** `strip/detect.ts` by magic bytes.
- [ ] **STR-2** `strip/jpeg.ts` allowlist rewriter + self-check.
- [ ] **STR-3** `strip/png.ts` allowlist rewriter + CRC verification + self-check.
- [ ] **STR-4** Synthetic fixtures: EXIF with GPS, embedded thumbnail, XMP, IPTC (APP13), trailing data after EOI, truncated files, APNG.
- [ ] **STR-5** Property tests: idempotent, no forbidden markers/chunks, image still decodes.
- [ ] **STR-6** Fuzz tests.
- [ ] **Q3/Q4** Decide ICC and Orientation handling; update SPEC §8.

## M4: UI and hardening
- [ ] **UI-1** Stamp view (FR-1,2,3,4,5) including cleaned-copy-required flow.
- [ ] **UI-2** Verify view (FR-7,8), all six result states with icon + text + colour.
- [ ] **UI-3** About / "check independently" view with `ots` + own-node instructions.
- [ ] **UI-4** Mandatory copy blocks (SPEC §11).
- [ ] **FR-9** Single-file offline build and its CSP hashes.
- [ ] **A11Y-1** axe scan + keyboard + screen-reader pass.
- [ ] **E2E-1** Playwright: stamp → download → verify; offline mode; CSP violation = fail.
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
- [ ] FR-10 Batch stamping, FR-11 share link, FR-12 local receipt list, FR-13 settings, FR-14 i18n
- [ ] PDF metadata handling, CLI verifier, additional anchors (new ADRs)

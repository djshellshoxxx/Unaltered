# Feature and code audit

**Scope:** `djshellshoxxx/Unaltered` branch `claude/zealous-wozniak-ey71lr` against `docs/SPEC.md` v0.1 plus the v0.2 and later items listed in SPEC section 2.
**Base commit:** see `git log` of this branch (the audit text was written with the code, not afterwards). **Date:** 2026-10-14.
**Method:** every requirement traced from the UI entry point through processing, output and error handling; verified by tests that were run (commands below), by a Chromium end-to-end run, and by an independent read-only code review (section 4).
**Not an independent security audit.** Section 5 lists what this audit could not establish.

## 1. How the evidence was produced

| Command | Result when this was written |
|---|---|
| `npm run check` (opsec, `tsc --noEmit`, eslint, vitest) | pass; 73 tests passed, 1 opt-in skipped |
| `UNALTERED_BIG=1 npx vitest run tests/unit/hash.test.ts` | pass: a virtual 2 GiB source hashed with < 200 MiB RSS growth (18 s) |
| `npm run test:e2e` (build + Playwright, Chromium) | pass: 19 tests incl. axe WCAG 2.2 AA scans on all four views and zero CSP violations |
| `node scripts/build.mjs` twice | byte-identical `.zip` and `.html` (same SHA-256) |
| CI on `windows-latest` and cross-platform byte comparison | see the PR checks; results are recorded in section 6 |

Verification status vocabulary: **verified complete** (implemented and tested), **implemented, untested** (code exists, no automated evidence), **partial**, **missing**, **not applicable**. Nothing is described as released: no tag, signature or release exists.

## 2. Functional requirements

| ID | Status | Where | Evidence / gap |
|---|---|---|---|
| FR-1 Local hashing | verified complete (browser memory proof partial) | `core/hash/{stream,hasher,hasher.worker}.ts` | vectors incl. 1,000,000 x "a", random-chunking property test, cancel/progress tests (`hash.test.ts`); WebCrypto cross-check in the worker for <= 64 MiB; main-thread gap about 12 ms hashing 48 MiB (e2e, threshold 50 ms). The 2 GiB bound is proven in Node, not in a CI browser |
| FR-2 Fingerprint display | verified complete | `ui/views/stamp.ts`, `core/bytes.ts#groupHex` | grouped 8, copy button, never truncated (e2e asserts the grouped digest) |
| FR-3 Metadata stripping | verified complete for JPEG/PNG | `core/strip/*`, `ui/views/stamp.ts` | digest is over the cleaned copy; Create is disabled until the cleaned copy is downloaded; orientation acknowledgement; unsupported types need an acknowledgement and are never called clean; 15 unit/property/fuzz tests; browser test with a real encoder JPEG that decodes after cleaning |
| FR-4 Stamp | verified complete against mocked calendars | `core/ots/calendar.ts#stampBatch` | nonce-blinded commitment, never the file digest (unit + e2e); M-of-N with per-calendar report; allowlist enforced. **Not yet exercised against a live calendar** |
| FR-5 Receipt | verified complete | `ui/views/stamp.ts`, `ui/download.ts` | `<name>.ots`, pending notice, keep notice, download only on click. No storage of receipts |
| FR-6 Upgrade | verified complete against mocks | `calendar.ts#upgrade`, `ui/views/verify.ts` | 404 stays pending, success merges and drops the satisfied pending attestation, offered as a *new* download, unknown calendars skipped and reported. Live behaviour unverified |
| FR-7 Verify | verified complete against synthetic chains | `ots/verify.ts`, `ots/bitcoin.ts` | all six states reachable in tests; negative tests for mutated file, mutated/truncated proof, wrong Merkle root, disagreeing explorers, single/duplicate source, header/hash mismatch, pending-only. Header parsing checked against the real genesis block |
| FR-8 Trust levels | verified complete | `ui/views/verify.ts`, `ui/views/about.ts` | L1 text, L2 instructions and copy button shown on the VERIFIED screen (e2e) |
| FR-9 Offline single-file | verified complete | `scripts/build.mjs` | e2e loads it from `file://` offline with no network request and no CSP violation |
| FR-10 Batch | verified complete | `calendar.ts#catSha256` | reference construction; 5-file batch test; e2e 3-file batch posts one tip |
| FR-11 Share link | verified complete | `ui/router.ts`, `stamp.ts#shareRow` | fragment only, no file name; `file://` links omit the local path; e2e |
| FR-12 Receipt list | verified complete | `ui/store.ts`, `ui/views/settings.ts` | off by default, try/catch everywhere, stores only digest/time/label; e2e checks nothing is stored by default and file names never are |
| FR-13 Settings | verified complete, narrowed by ADR-008 | `ui/state.ts` | built-in endpoints only (CSP) |
| FR-14 Accessibility, language | verified (automated) / partial (manual) | `ui/strings.ts`, `styles.css` | axe WCAG 2.2 AA clean, keyboard test, 44 px targets at 360 px, no horizontal scroll; English and Spanish with key/placeholder parity test. Manual screen-reader pass **not done**; Spanish is not reviewed by a native speaker |
| 3.1 Time semantics | verified complete | `strings.ts` | "no later than about"; a test forbids "created at" |
| PDF warning, in-app L2 instructions (v0.2) | verified complete | `stamp.ts`, `about.ts` | PDF stripping is *not* implemented and not claimed |
| CLI verifier, extra anchors (later) | missing (planned only) | - | out of v0.1/v0.2 scope |

## 3. Non-functional and security requirements

| ID | Status | Evidence / gap |
|---|---|---|
| NFR-1 No backend | verified | static output only; architecture-guard tests |
| NFR-2 Dependencies | verified | one runtime dependency (`@noble/hashes`, sha2 only) |
| NFR-3 Size < 150 KiB gzip | verified | build fails above budget; currently about 31 KiB gzip |
| NFR-4 Browsers | partial | Chromium only. Firefox, Safari, Edge and Tor Browser **untested** |
| NFR-5 file://, HTTPS, IPFS | verified for file:// and HTTP(S) | relative URLs only. IPFS gateway not tested |
| NFR-6 No storage by default | verified | e2e asserts empty `localStorage`; no cookies/IndexedDB/service worker |
| NFR-7 Reproducible | verified on one platform; cross-platform checked in CI | double build identical; `.gitattributes` fixes line endings |
| NFR-8 Mobile | verified | 360 px e2e |
| SR-1 CSP | verified | generated from the allowlist; no `'unsafe-*'`; Trusted Types policy; meta CSP cannot set frame-ancestors, so `main.ts` also refuses to run framed (e2e) |
| SR-2 No third-party origin | verified | test scans sources for URLs |
| SR-3 SRI / hashed inline | verified | build gates; Chromium loads SRI scripts from the site (e2e) |
| SR-4 No eval/innerHTML etc. | verified | ESLint rules + source-scan test + Trusted Types |
| SR-5 Pinned deps, `--ignore-scripts` | verified in config; `npm audit signatures` in CI | lockfile committed |
| SR-6 Reproducible gate | verified in CI config | |
| SR-7 Signed releases | **missing** | needs the offline key (OPS-4); procedure in `docs/RELEASE.md` |
| SR-8 Generic errors | verified | `safeMessage`; no `console` (lint) |
| SR-9 Parser fuzz/property tests | partial | fast-check mutation fuzzing (3000-4000 runs per parser per run). No coverage-guided fuzzer (M5) |
| SR-10 Negative tests | verified | see FR-7 row |
| SR-11 External links | verified | `rel="noreferrer noopener"`; no forms |
| SR-12 SHA-256 only | verified | SHA-1/RIPEMD/Keccak/other file hashes refused |

## 4. Independent code review

An independent read-only review of `core/ots`, `core/net`, `core/strip`, `core/hash` was run against the spec. Findings and their disposition are in section 7 of this file.

## 5. Limitations of this audit

- **No live network.** The build environment could not reach calendars or explorers. CORS (risk R1), the exact calendar and Esplora responses, and rate limits are unconfirmed. Run `npm run network-check`; the `network-check` CI job also does.
- **No proofs from real calendars.** Fixtures are synthetic (generated with the reference library). The first real stamp and upgrade must be compared with `ots verify` (L2).
- **One browser engine** (Chromium) and Linux/Windows runners only. No macOS/Safari/Firefox/Tor.
- **No independent security audit**, usability test, legal review, release signing, IPFS pin, domain decision, or branch-protection settings (OPS-1..5, UT-1, REL-1..5, LEGAL-1). These need people or credentials.
- **GitHub Actions are pinned by version tag, not SHA** (CI-2): SHAs could not be verified from this environment. No secret-scan job (gitleaks) yet.
- Block-time precision and L1 trust assumptions are inherent (ADR-006).

## 6. Windows build

`dist/unaltered-<v>.zip` is built by `npm run build` and checked on `windows-latest` in CI: install without scripts, typecheck, lint, unit tests, build, Chromium end-to-end tests, the shipped checksum logic run against the real zip, and a byte comparison of the Linux and Windows `SHA256SUMS`. See `docs/RELEASE.md` and ADR-009. Results of the latest run are in the PR checks.

## 7. Independent review: findings and disposition

No input was found that makes `verify()` return `VERIFIED` wrongly (digest equality is checked first; every node derives from the file digest; quorum needs identical headers from distinct hosts).

| # | Finding | Disposition |
|---|---|---|
| 1 | Hostile proof with thousands of Bitcoin attestations caused unbounded sequential explorer requests | **Fixed.** Parser caps attestations at 256; verify refuses more than 16 distinct Bitcoin attestations before any request. Tests added |
| 2 | Upgrade sent one GET per duplicate pending attestation | **Fixed.** Deduplicated by (calendar, commitment). Test added |
| 3 | `mergeTree` quadratic CPU | **Fixed.** Indexed by op/attestation key, plus a step cap. Test added |
| 4 | JPEG kept segments could carry free-form bytes (DRI tail, repeated JFIF/Adobe, padded DQT/DHT/SOF/SOS) | **Fixed.** Exact structure validation; one JFIF and one Adobe only. Tests added. The entropy-coded scan data is copied verbatim; it cannot be inspected without re-encoding, so hidden data inside a valid scan is a stated limit |
| 5 | PNG kept chunks not validated or deduplicated | **Fixed for tRNS/sRGB/PLTE** (once, length bounds, colour-type check). IDAT payload (including bytes after the zlib stream) is copied verbatim: same stated limit |
| 6 | Unknown attestation or op tags make the whole proof invalid, where the reference preserves unknown attestations | **Accepted.** Fails closed as SPEC section 6 requires. Compatibility cost: such proofs cannot be verified or upgraded here; use the reference tool |
| 7 | Header quorum has no proof-of-work check | **Accepted, documented.** A target check would not add security: a forger can cheaply mine a header at the minimum difficulty. Trust rests on the explorer quorum (L1) or the user's own node (L2) |
| 8 | `varuint` could return an unsafe integer | **Fixed.** Rejected as malformed |
| - | `verifyProof` accepted a null digest | **Fixed.** Parameter is now required |
| - | Unconfirmed: raw `DOMException` if a file becomes unreadable mid-hash; ~80 MB worst-case memory from 20k nodes of 4 KiB messages | Open, low. The UI shows a generic message for any non-typed error |

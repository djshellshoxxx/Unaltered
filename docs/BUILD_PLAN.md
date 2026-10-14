# Build Plan

Estimates are rough ideal days for one experienced full-stack developer working part-time-equivalent focus; double them for a first-time contributor. They are planning aids, not promises.

## 0. Critical path

`M0 spikes → M1 hashing → M2 OTS stamp/upgrade/verify → M3 strip → M4 UI + hardening → M5 audit prep + release`.
M3 can run in parallel with M2 after M1.

## 1. Milestones

### M0: De-risking spikes (5-7 days)
Goal: turn every **[SPIKE]** in the SPEC into a verified fact before building on it.

| Task | Output | Exit criterion |
|---|---|---|
| M0-1 Evaluate OTS JS package vs in-house codec (ADR-003) | Decision + notes | Criteria 1-5 recorded; if in-house, a written outline of the format taken from reference source with file/line citations |
| M0-2 Read `python-opentimestamps` stamping path | Notes on nonce, merging, calendar request/response format | Our description matches reference outputs on 3 real stamps |
| M0-3 Browser CORS test for each calendar and explorer | Table in `docs/NETWORK.md` | ≥ 2 calendars and ≥ 2 explorers confirmed callable from a browser page, or R1 mitigation chosen |
| M0-4 Toolchain install with pinned versions | `package-lock.json`, `npm run check` runs (empty) | Clean `npm ci --ignore-scripts` on CI |
| M0-5 Create reference corpus | `tests/fixtures/ots/` with proofs from reference client (pending + confirmed), and expected verify outcomes | Reviewed, no personal data in fixtures |

**Gate:** if CORS blocks both calendar hosts and explorers, stop and decide R1 before M1.

### M1: Hashing core (4-5 days)
- `core/hash` with worker, noble SHA-256, WebCrypto cross-check (FR-1, FR-2)
- Vectors test, chunking property test, 2 GiB memory test, abort support
- Deterministic build script skeleton (`scripts/build.mjs`) and CSP/SRI generation

**Exit:** FR-1/FR-2 acceptance met; build is byte-reproducible.

### M2: OpenTimestamps (10-15 days)
- `core/net` (allowlist, caps, timeouts) with tests that no other module can call `fetch`
- `core/ots` codec, ops, calendar, bitcoin quorum, verify (FR-4 to FR-8)
- Negative tests (SR-10), differential tests vs reference client, parser fuzz harness (SR-9)
- Decide Q7 (Trusted Types)

**Exit:** a file stamped by our app verifies in the reference client; a file stamped by the reference client verifies in ours; all negative tests pass; no verify path can emit `VERIFIED` without a quorum.

### M3: Metadata stripping (7-10 days)
- `strip/detect`, `strip/jpeg`, `strip/png` per SPEC section 8; property and fuzz tests; fixtures with synthetic EXIF/XMP/thumbnail/trailing-data cases
- Decide Q3, Q4

**Exit:** for every fixture, output contains only allowlisted structures and passes self-check; malformed inputs rejected; unsupported types warn.

### M4: UI, accessibility, hardening (8-10 days)
- Stamp / Verify / About screens (FR-2,3,5-8,14); copy blocks (SPEC section 11)
- Single-file build (FR-9); CSP enforced; Playwright e2e incl. CSP-violation = failure; axe scan; keyboard and screen-reader pass
- Non-technical user test (3-5 people): can they explain what the receipt does and does not prove?
- Pick auditor (Q6)

**Exit:** NFR/SR checklists green; usability findings fixed or documented.

### M5: Audit prep and v0.1 release (7-10 days of dev, plus auditor lead time of weeks)
- Threat model refresh; dependency review record complete; fuzz long run
- Independent audit (focus: `core/net`, `core/ots`, `core/strip`, build and release process)
- Release procedure rehearsal: signed `SHA256SUMS`, IPFS CID, public key published in 2+ places
- Decide Q5 (domain)

**Exit:** audit findings addressed; reproducible build verified by a second person; signed v0.1.0 tag.

**Rough total:** 40-55 ideal days of development (about 2-3 months solo), excluding audit wait time.

## 2. Quality gates in CI (from M0-4)

1. `opsec-check` (always)
2. secret scan
3. typecheck, lint (incl. no-eval/no-innerHTML rules), unit + property tests
4. build twice and compare hashes
5. e2e with CSP violation capture
6. differential tests vs reference client (Python, dev-only job)
7. dependency lockfile integrity (`npm ci`, `npm audit signatures`)

## 3. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | CORS blocks browser calls to calendars/explorers | Medium | High (changes architecture) | M0-3 first; fallback options in SPEC section 9 | dev |
| R2 | OTS JS package unfit; in-house codec bugs | Medium | High | Differential + fuzz testing; small codec; audit scope | dev |
| R3 | Parser vulnerability in strip/codec | Medium | High | Allowlist, caps, fuzzing, audit | dev |
| R4 | Explorer outage or collusion | Medium | Medium | Quorum, multiple sources, L2 instructions | dev |
| R5 | Users over-trust "VERIFIED" or lose receipts | High | High | Copy blocks, usability testing, About page | dev + UX |
| R6 | App distribution tampered (clone, host compromise) | Medium | High | Reproducible builds, signatures, offline single-file, docs | maintainers |
| R7 | Maintainer account/key compromise | Low-Med | Critical | Hardware 2FA, offline release key, signed commits | maintainers |
| R8 | Audit cost/time | High | Medium | Seek grants (open-source security funds); narrow audit scope; staged public beta labelled unaudited | maintainers |
| R9 | Legal pressure or misuse claims | Low-Med | High | No accusation features, no hosting of content, legal consult pre-launch | maintainers |
| R10 | Bus factor of 1 | High | Medium | Document everything; recruit second reviewer by M4; escrowed recovery plan | maintainers |

## 4. Funding note

This kind of tool rarely earns usage fees. Realistic funding is grants and donations (open-source security and press-freedom funds) rather than per-use revenue. Do not add payment features to the app; keep funding external to the code.

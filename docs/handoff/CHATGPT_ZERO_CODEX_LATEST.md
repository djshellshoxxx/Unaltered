# ChatGPT zero-Codex continuation — 2026-11-10, fourth rotation

## Source and ownership
- Base main: `556fc2d49a4bbc005babd0094c9233ae4ad418ad` (unchanged at inspection).
- Current isolated feature branch: `chatgpt/zero-codex/evidence-zip-snapshot-20261110`; test-first source commits `13c5b40f1d2de80f189878363011dc3bd0ac5d14` (regression-only), `9b1e5862d976879122522b0dd2c43e2d5eb861b1` (fix), `b3a481dacac6b60f0c4c632d5e3ea818be9c158f` (TypeScript-safe test helper).
- [Draft PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71) is Claude-owned and remains unmerged at `c4e43c7b9ca0704bd0526a5317e49ff3749125e0`; its CLI/QR files were not edited. Its hosted CI passed 13 jobs with one skipped and an informational failed pending-404 CORS probe; QR print-scan passed. No approval to merge.
- [PR #70](https://github.com/djshellshoxxx/Unaltered/pull/70) is the draft continuation specification.
- [Docs PR #72](https://github.com/djshellshoxxx/Unaltered/pull/72) current head `2ef1e7ff2ac644226a463d8fe4254f07dd100c49` and [audit PR #73](https://github.com/djshellshoxxx/Unaltered/pull/73) `648041d3b84b26436bc98d22d5c6aa12a5aa32d9` both have **completed** exact-head CI and QR print-scan. On both heads the browser WebKit job passed; each main CI had 12 successes, one skip, one failing *informational* live-CORS check. The workflow conclusion was success, not a claim that every job succeeded.
- No `AGENTS.md` at the source commit; `CONTRIBUTING.md`, `SECURITY.md`, source tests and continuation policy read.

## Independent feature slice: immutable evidence ZIP bytes
A deterministic source-level race exists when the caller mutates its Uint8Array buffers after calling `createEvidenceZip` but before the asynchronous manifest hashing finishes. Previously the original's manifest SHA-256 could refer to different bytes than the ZIP's `original.bin` entry, despite matching ZIP CRCs.

**Changed files:**
- `tests/unit/evidence-zip.test.ts`: synthetic regression mutates both input arrays immediately after invoking the asynchronous export, then checks both stored entries and manifest SHA-256 values against the call-time bytes.
- `src/core/reports/evidence-zip.ts`: snapshot both inputs immediately after existing 16-MiB and nonempty checks and before the first await; use those snapshots consistently for SHA-256 manifest, CRC, ZIP data and offsets.
- This handoff (branch-local). Do not assume it is identical to the separate draft documentation branch's handoff. Integration will need to reconcile the same path rather than discard either history.

**Reproduction and validation:**
- An independently executed **small Node 22 JavaScript model of the same await/digest/reference ordering** produced differing SHA-256 hashes after immediate caller mutation. It is not a run of the repository's Vitest suite.
- Regression was committed before implementation. The failing repository baseline was **not executed**; no evidence of a hosted red run is claimed.
- Hosted checks at this branch's final head are **pending**. No local npm/tsc/Vitest/browser/print test was executed.
- Existing ZIP format, receipt verification semantics, trust paths, network policies and dependency set remain unchanged.

## Separate audit and documentation phases
The fourth deterministic read-only audit rotation selected `src/core/reports/evidence-zip.ts`, reviewing manifest creation, call sites, ZIP layout, test vectors and untrusted-buffer ownership. The audit finding is limited to the confirmed asynchronous input aliasing mismatch and its isolated remediation; not a false Bitcoin verification or a cryptographic break. A separate isolated audit ledger on PR #73 tracks this coverage, without editing its code.
Documentation/wiki source is owned by PR #72; its Home/sidebar keep separate User Guide and Developer Guide links. No live GitHub wiki publication was performed, and no independent concurrent audit or docs worker was spawned.

## Next checkpoint
1. Inspect exact-head GitHub Actions of the evidence-buffer draft PR and classify each job; repair only reproducible failures without weakening tests.
2. Qualify the audit/docs PR heads after their next ledger-only changes; keep the informal live-404/CORS failure visible and require a complete WebKit verdict.
3. Continue certificate/CLI work only after PR #71 author ownership and integration status resolves; then advance receipt/batch verification without conflicting files.
4. Reconcile duplicate handoff paths during authorized integration. No main merge, Pages deployment, live wiki publication, release, human security review claim or real-funds operation has occurred.

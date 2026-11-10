# ChatGPT randomized read-only audit ledger

## 2026-11-10 — PNG metadata-cleaning parser

**Audit type:** Single ChatGPT invocation, distinct read-only inspection phase. No second concurrent worker/subagent was available or used; no Codex or paid API was invoked.

**Source:** `main` commit [`556fc2d49a4bbc005babd0094c9233ae4ad418ad`](https://github.com/djshellshoxxx/Unaltered/commit/556fc2d49a4bbc005babd0094c9233ae4ad418ad). Audit branch: `chatgpt/zero-codex/audit-png-20261110` from that exact source SHA.

**Selection:** Prior audit ledger absent; initial eligible candidate list contains 18 core source files across OTS, stripping, network, QR and reports. Seed uses the final 8 hexadecimal digits of the main SHA, `4ad418ad`, interpreted as an unsigned integer modulo 18 (index 9, zero-based), selecting `src/core/strip/png.ts`. On the next audit, exclude this seed/path until other candidate areas have been covered; continue to record seed and prior coverage.

### Evidence inspected

- `src/core/strip/png.ts:34-41`: header bounds, dimensions, and color-depth restrictions.
- `src/core/strip/png.ts:43-61`: tRNS normalization/CRC update and copy semantics.
- `src/core/strip/png.ts:62-171`: chunk sequencing, CRC checking, retained fields, ancillary stripping, upper bound and output self-check.
- `src/core/strip/png.ts:173-188`: structural self-check of retained PNG chunks.
- Callers/trust boundary: `src/core/strip/detect.ts` checks PNG magic bytes; `src/core/strip/index.ts` bounds supported files to 256 MiB and returns a new Blob after cleaning; user-supplied PNG bytes can reach the parser.
- Existing test coverage inspected: `tests/unit/png-header-guards.test.ts`, `png-continuation-guards.test.ts`, and `security-sweep-png-transparency.test.ts`. These cover invalid dimensions, illegal color/depth pairs, retained-chunk order, tRNS normalization, subarray/Buffer aliasing, and nonzero byte offsets.

### Result

**No reproducible new correctness or security defect established from source inspection.** No public vulnerability report, fix claim, or test claim is warranted. This was **source inspection only**, not a completed independent audit or execution of unit/fuzz/browser tests. The parser preserves compressed IDAT bytes without decompressing them, so structural self-check is not an image-decoder qualification; this limitation is already stated in the tests and should not be mislabeled as a discovered bug.

**Unexamined areas / future audit:** CRC CPU cost under permitted 256 MiB input, full png chunk-order matrix against PNG3 with independently decoded synthetic fixtures, and browser decode parity for nontrivial color profiles/packed channels. These are coverage proposals, **not** verified vulnerabilities. Do not file issues on speculation.

**Tests executed in this run:** none. Existing tests were read but not rerun. **Other branches:** [PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71) owns distinct-source certificate checking and CLI parity; this audit did not modify its files or branch.

**Next audit:** choose another currently unaudited core file using the updated seed and this ledger, inspect callers and tests, and reproduce before reporting any defect. Maintain separate audit-branch ownership. 

---
## Second rotation — 2026-11-10 — OpenTimestamps calendar submission and upgrade

**Source:** unchanged main `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. **Read-only source review**, performed sequentially, not by a second concurrent ChatGPT agent. No tests executed during this phase.

**Selection and non-repeatability:** previous ledger covered `src/core/strip/png.ts`. This iteration sampled 18 sorted, previously unaudited core paths across archive/hash/network/OTS/report areas, excluding PNG. Seed string: `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|2026-11-10`. FNV-1a 32-bit unsigned = `3959105590`; index `3959105590 % 18 = 10`; selected `src/core/ots/calendar.ts`. Exclude calendar and PNG from the next selection before recomputing with the updated audit ledger.

### Inspected code, callers and boundaries

- `src/core/ots/calendar.ts:48-78`: endpoint normalization, host identity, random nonce generation; production nonce uses `crypto.getRandomValues`.
- `src/core/ots/calendar.ts:106-153`: digest-length check, minimum M, per-host deduplication, `/digest` request, failed-calendar handling. At most one distinct selected host counts toward acceptance.
- `src/core/ots/calendar.ts:173-228`: bounded proof parser, pending URI matching, grouped upgrade requests, sanitized errors, cancellation and transactional merge.
- `src/core/net/fetch.ts` and `src/core/net/allowlist.ts`: HTTPS/host allowlisting, blocked credentials and off-allowlist requests, redirect denial, response byte/time caps and safe error mapping.
- `src/core/ots/codec.ts` plus `src/core/ots/types.ts`: receipt parse caps (1 MiB input, at most 20,000 nodes, 256 attestations and depth 256), rejection of malformed/unknown operations.
- Existing tests read, **not executed**: `tests/unit/ots-calendar-guards.test.ts` (duplicate hosts, NaN/invalid minima), `tests/unit/ots-continuation-calendar-url.test.ts` (URI canonicalization, hostile addresses), `tests/unit/protocol-independent-upgrade-fanout.test.ts` (merge rollback, cancel, deduplicated fan-out) and `tests/unit/ots-flow.test.ts` (stamp/upgrade semantics).

**Result:** No new reproducible correctness, privacy, or security defect established by source inspection. The bounded-but-parallel upgrade fan-out and real-host pending-404 CORS behavior merit continued qualification; neither is filed as a vulnerability without a concrete failing case. The latter is already documented in `docs/NETWORK.md`, including a 2026-11-05 Chromium confirmed-path test and remaining pending-404 limitation. Do not convert an HTTP 404 lacking ACAO into a positive verification result.

**Next audit:** rotate to another not-yet-inspected area (e.g., QR decoder, hash streaming, evidence ZIP), inspect callers and exact regression tests, and only propose a fix after independent reproduction. This PR changes only the audit ledger. No live network requests, CI reruns, merges or security-gate changes.

---
## Third rotation — 2026-11-10 — archival binary QR frame integrity

**Read-only, sequential phase:** no independent second ChatGPT worker/subagent was available; no paid API, Codex, or execution agents used. **Inspected source:** unchanged `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad` (the review is not a standalone cryptographic audit).

**Reproducible selection:** exclude previously sampled `src/core/strip/png.ts` and `src/core/ots/calendar.ts`. Sort all remaining `.ts` files in `src/core/archive`, `hash`, `net`, `ots`, `reports` and `strip`, excluding `.worker.ts`. 31 files remain. FNV-1a 32-bit hash of `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|src/core/ots/calendar.ts|2026-11-10|rotation-3` yields **622937467**; `622937467 % 31 = 0`, selecting `src/core/archive/frames.ts`. Exclude all three inspected paths next rotation.

### Inspected code and surrounding boundaries

- `src/core/archive/frames.ts`: fixed 80-byte magic/version/length header, maximum 16 MiB receipt and 4096 frames; encoding snapshots source bytes before asynchronous hashing; SHA-256 and domain-separated 16-byte proof identifier; recovery checks nonzero/bounded indices and sizes, consistent metadata, duplicate conflicts, exact partition length, digest and identifier.
- `src/core/archive/qr-encode.ts` and `qr-plan.ts`: frame bytes flow into the QR encoder; print planning enforces 64-symbol and max-page limits, stronger than the raw transport maximum.
- `src/core/archive/qr-decode.ts`, `qr-scan.worker.ts`, `qr-scan.ts` and `qr-limits.ts`: browser scan uses bounded image dimensions, a decoding worker and frame byte-length checks; QR text/URL is not executed.
- `src/core/archive/qr-print.ts`: printed appendix describes protocol framing, digital receipt preservation, and independent verification requirement. Certificate display metadata is not proof of Bitcoin anchoring; PR #71 separately owns the distinct-source check.
- Existing tests **read, not executed:** `tests/unit/archival-qr-frames.test.ts`, `archival-qr-properties.test.ts`, `archival-qr-encode.test.ts`, `archival-qr-decode.test.ts`; they cover independent golden bytes, permutation/duplicates, corrupted metadata/payload, mixed frames, and pixel decoder round trips.

**Finding disposition:** no reproducible new correctness, integrity, privacy or security defect established. The raw 4096-frame/16-MiB transport limit must not be conflated with the 64-symbol print/scan workflow. Header checks and SHA-256 protect recovery against tampered, incomplete or cross-proof frame sets in inspected code; this review did not prove memory bounds or printed-media resilience universally. Avoid inventing a vulnerability from speculative asynchronous input mutation without a concrete failing trace.

**Tests:** no local npm, Vitest, fuzz, QR camera/print, browser or runtime tests executed in this audit phase; earlier exact-head CI is reported separately, not attributed to this audit. **Next:** choose an unaudited core path from the updated ledger, inspect caller/test paths and reproduce any claim before proposing a fix. No branch other than this audit PR changed.

---
## Fourth rotation — 2026-11-10 — evidence ZIP manifest/entry consistency

**Source tree:** `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad`; previous audit paths, in ledger order: `src/core/strip/png.ts`, `src/core/ots/calendar.ts`, `src/core/archive/frames.ts`. **Worker:** separate read-only audit phase within this ChatGPT invocation; **no concurrent second agent**, no Codex or paid API.

**Pseudorandom selection:** The GitHub tree contains 33 eligible `.ts` files under `src/core/{archive,hash,net,ots,reports,strip}/` after excluding `*.worker.ts`; removing the three prior paths leaves 30 sorted candidates. FNV-1a 32-bit of `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|src/core/ots/calendar.ts|src/core/archive/frames.ts|2026-11-10|rotation-4` = **626612633**, index `626612633 % 30 = 23`, selecting **`src/core/reports/evidence-zip.ts`**. Exclude this path on rotation five.

**Adjacent source and tests inspected:** `src/core/reports/evidence-manifest.ts` (SHA-256 copies before async wait and states `NOT_PERFORMED`), `src/ui/views/verify.ts:142-153` (browser export caller allocates fresh typed arrays), `src/core/reports/verification.ts` (report independently identifies verification), `tests/unit/evidence-zip.test.ts` and `tests/unit/evidence-manifest.test.ts` (existing size, ZIP CRC, hash and semantic tests). The unmerged Claude-owned PR #71 uses evidence ZIP through its CLI but its changed file list does **not** include `evidence-zip.ts` or the existing ZIP unit tests.

### Verified correctness finding: caller-buffer mutation during asynchronous evidence export
- **Source evidence:** `src/core/reports/evidence-zip.ts:19-26` awaits `createEvidenceManifest(original, receipt)` and then retains the original caller-owned arrays as ZIP entries. `src/core/reports/evidence-manifest.ts:13-20` copies each input before awaiting its digest. `evidence-zip.ts:31-43` then calculates CRC and appends the *later*, potentially mutated file data.
- **Concrete deterministic reproduction:** call `createEvidenceZip(original, receipt)`, mutate `original[0]` immediately before awaiting its promise, then compare the SHA-256 of the embedded `original.bin` against `manifest.json.original.sha256`. JavaScript enters the first digest synchronously and copies the original before the caller mutation; the export continuation stores the changed array. A **small separate Node 22 model of exactly that ordering** was executed: hashes differed. The repository's regression-only commit was **not executed against the unchanged implementation**; do not claim a hosted red baseline.
- **Impact/severity/confidence:** **low-to-moderate correctness/integrity risk; high confidence in async aliasing mechanism**. It can create self-inconsistent exported evidence if any caller reuses a buffer while the promise is pending. The inspected browser UI creates fresh arrays, so this is **not evidence of an exploitable browser attack, Bitcoin-verification bypass, privacy disclosure or cryptographic compromise**. No actual user evidence loss has been observed.
- **Disposition:** proposed an isolated, reviewable **draft [PR #74](https://github.com/djshellshoxxx/Unaltered/pull/74)**, with test-only commit `13c5b40f1d2de80f189878363011dc3bd0ac5d14`, minimal input-snapshot correction `9b1e5862d976879122522b0dd2c43e2d5eb861b1`, and TypeScript-safe test helper `b3a481dacac6b60f0c4c632d5e3ea818be9c158f`. Tests now assert embedded bytes and manifest hashes match the call-time snapshots. The audit branch itself changes **this ledger only**. CI on the feature PR is pending; no production release or merge claim.

**Next:** qualify PR #74 exact-head hosted regression and the audit head; rotate to an unaudited path next time and reconcile any independent findings without overwriting the ongoing CLI branch. No local repository Vitest/build/browser tests executed in this phase; no security gates relaxed.

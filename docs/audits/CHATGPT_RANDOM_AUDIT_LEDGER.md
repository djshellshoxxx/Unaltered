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

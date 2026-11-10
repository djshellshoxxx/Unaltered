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

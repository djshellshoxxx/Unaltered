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


---
## Fifth rotation — 2026-11-10 — archival QR raster decoder boundaries

**Source:** unchanged default-branch commit `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. **Execution:** a separate *sequential read-only* ChatGPT audit phase; no independent concurrent subagent, Codex, external scanner or paid API. The audit branch changes this ledger only.

**Deterministic nonrepeat selection:** Previous inspected paths in ledger order: `src/core/strip/png.ts`, `src/core/ots/calendar.ts`, `src/core/archive/frames.ts`, `src/core/reports/evidence-zip.ts`. A verified shortlist of seven previously unaudited core source paths was formed (archive QR decode; net allowlist/fetch; OTS codec; report manifest/verification; strip index). The FNV-1a 32-bit hash of `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|src/core/ots/calendar.ts|src/core/archive/frames.ts|src/core/reports/evidence-zip.ts|2026-11-10|rotation-5` = **1148550473**; index `1148550473 % 7 = 0` selected **`src/core/archive/qr-decode.ts`**. This was a *shortlist*, not a claimed enumeration of the entire repository tree. Exclude all five audited paths before future selection.

### Read-only review scope and trust boundaries

- `src/core/archive/qr-decode.ts`: `decodeRasterFrames` validates safe integer dimensions, 21..6000 sides, <=16 million pixels and exact RGBA buffer length **before copying**; `symbolCandidates` uses bounded cells and 64 candidate limit; decode retries `jsQR` at direct and two downscaled sampling phases, validates QR magic/length and finite corners, then clears located rectangles before rescanning. Unrecognized QR text/URLs are not executed. Frame ordering reads a 32-bit index from a >=81-byte magic-matching payload; full frame metadata and content authentication are handled on recovery, not inside the raster locator.
- `src/core/archive/qr-limits.ts`: 16,000,000 pixels, 6000-pixel side, maximum 64 located symbols per input raster.
- `src/core/archive/qr-scan.ts`: worker transfer, abort/timeout termination at 120 seconds, worker response type/length checks, raster bitmap and canvas cleanup, source image header guard through `qrImageDimensions`. The decoded external image is untrusted; the scanner does not grant Bitcoin verification.
- `src/core/archive/qr-scan.worker.ts`: accepts only `Uint8ClampedArray` pixels and converts decoder errors to `ok: false` instead of forwarding detailed errors.
- `src/core/archive/frames.ts`: `recoverReceiptFrames` validates version, payload lengths, bounded count, consistent proof ID/hash, frame indices, duplicates, exact assembly length and SHA-256; scanner results must pass this independent integrity check.
- `src/core/archive/qr-encode.ts` provides canonical renderer and byte frames. Existing tests **read but not rerun**: `tests/unit/archival-qr-decode.test.ts`, `archival-qr-frames.test.ts` (including cross-proof rejection and byte-exact recovery). The test suite also exercises ECC variations, rotation, multi-symbol pages, and impossible dimension rejection.

**Outcome:** No new *reproducible* correctness, security or privacy defect was established from these source/caller/test inspections. Image pixel/scale heuristics may affect practical printed-media recovery under unusual scans, but that is a coverage limitation, **not a substantiated vulnerability**. No exploit, runtime reproduction, fuzz run, print/camera test or external cryptographic audit occurred. Further qualification could measure adversarial raster worst-case decoding time within the existing worker timeout, rotated/marginal QR fixtures and exact recovered-frame count; no production changes are warranted absent evidence.

**Related CI, not an audit run:** [PR #74](https://github.com/djshellshoxxx/Unaltered/pull/74) evidence ZIP head `aa2382bfeff2ea376dca7c96cc65b62447dd3ce7` passed Linux typecheck/lint/unit/reproducible build, Windows, Chromium/Firefox/WebKit, QR qualification and other listed checks in [CI #42841449237](https://github.com/djshellshoxxx/Unaltered/actions/runs/42841449237), but macOS was cancelled, cross-OS checksum jobs skipped, and the *informational* live calendar/CORS probe failed. The cancelled macOS job was individually rerun in this continuation and was queued when this audit note was prepared. Do not declare exact-head full cross-platform qualification yet.

**Next rotation:** inspect a newly selected, unaudited source path with callers/tests; preserve this audit branch's isolation and record only demonstrated findings. No merges, releases, wiki publication or security gate changes.


---
## Sixth rotation — 2026-11-10 — network destination allowlist and request boundary

**Source:** `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. This was a distinct **sequential read-only review**, not a second concurrent worker. No Codex, external scanner, paid API, local repository test suite or live network request was used.

**Reproducible selection:** exclude five previously inspected paths, in ledger order: `src/core/strip/png.ts`, `src/core/ots/calendar.ts`, `src/core/archive/frames.ts`, `src/core/reports/evidence-zip.ts`, `src/core/archive/qr-decode.ts`. Enumerate and sort actual `.ts` source paths under `src/core/{archive,hash,net,ots,reports,strip}/`, excluding `*.worker.ts` and those five paths. **28 eligible files** remained. FNV-1a 32-bit seed `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|src/core/ots/calendar.ts|src/core/archive/frames.ts|src/core/reports/evidence-zip.ts|src/core/archive/qr-decode.ts|2026-11-10|rotation-6` yielded `2352986449`; index `9` of 28 selected `src/core/net/allowlist.ts`. Exclude this sixth path on the next rotation.

**Inspected source and trust boundaries (main-branch line references):**
- `src/core/net/allowlist.ts:1-24`: single endpoint source lists three OTS calendars, two Bitcoin explorers, and minimum quorum counts of two. Build CSP derives from this file; changing allowed origins would be a security-policy change requiring review.
- `src/core/net/fetch.ts:28-43`: URL parsing restricts HTTPS, credentials, ports and the exact `url.host` allowlist before a request. Test seam `allowInsecure` is not production configuration.
- `src/core/net/fetch.ts:48-78`: declared and streamed response-size caps and cancel-on-oversize behavior. `src/core/net/fetch.ts:80-118`: safe-integer size/timer bounds, no credentials/referrer/cache, `redirect:'error'`, request abort and timeout-to-safe-error mapping.
- `src/core/net/capability.ts`: browser network status describes capability, never claims calendar/explorer reachability or Bitcoin confirmation.
- Existing tests **read, not executed**: `tests/unit/net.test.ts` (host, userinfo, port, redirect, secret/referrer, byte caps, fetch-only architecture and origin references); `tests/unit/net-policy-bounds.test.ts` (invalid caps/timeouts rejected before transport); `tests/unit/network-capability.test.ts` (honest online/offline claims).
- `docs/THREAT_MODEL.md` sets IP/metadata and false-VERIFIED boundaries; `docs/NETWORK.md` documents pending-404 CORS behavior and separately qualified historical confirmed paths.

**Result:** No newly *reproduced* correctness, privacy or security defect was established. Passing a custom `NetPolicy` or request headers from an untrusted future caller would require separate review, but the inspected source does not establish that an untrusted user controls these options today. Do not file speculative findings or weaken URL/CORS/verification checks. This does not constitute an independent security audit.

**CI reconciliation relevant to this audit (not executed by the auditor):** PR #74 exact-head `aa2382bfeff2ea376dca7c96cc65b62447dd3ce7` CI [42841449237](https://github.com/djshellshoxxx/Unaltered/actions/runs/42841449237) now shows **12 passed, one skipped, one failed informational calendar/explorer live check** after the previously cancelled macOS job succeeded on retry; cross-platform byte-identical build job also succeeded. PR #72 exact-head `4ba1eb29a1dca07d5d5b8cc3dcf28eecf7d04f93` CI [42850661317](https://github.com/djshellshoxxx/Unaltered/actions/runs/42850661317) and PR #73 previous exact-head `c034dbede9f90b150d80872281dce5980782a419` CI [42850146627](https://github.com/djshellshoxxx/Unaltered/actions/runs/42850146627) each report the same 12/1/1 composition; the workflows' overall conclusion is success, **not** an assertion that every job passed.

**Next audit:** select an unaudited core path with the updated exclusion ledger and inspect callers, actual trust boundaries and regression tests. The audit branch contains only the ledger; no production code, other owner's branch, main, deployment or release was touched. This ledger edit itself requires fresh exact-head CI qualification.


---
## Seventh rotation — 2026-11-10 — OpenTimestamps operation application and canonical ordering

**Source:** unchanged `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. Distinct **sequential read-only source-review phase** in this ChatGPT run; no second concurrent ChatGPT worker, Codex, paid API, local test runner or external scanner was used.

**Pseudorandom selection:** Exclude the six audited paths in ledger order: `src/core/strip/png.ts`, `src/core/ots/calendar.ts`, `src/core/archive/frames.ts`, `src/core/reports/evidence-zip.ts`, `src/core/archive/qr-decode.ts`, `src/core/net/allowlist.ts`. GitHub's complete recursive tree (not truncated) at the main SHA contains 33 eligible `.ts` files under `src/core/{archive,hash,net,ots,reports,strip}/`, excluding `*.worker.ts`. After exclusions, 27 sorted candidates remain. FNV-1a unsigned 32-bit seed `556fc2d49a4bbc005babd0094c9233ae4ad418ad|src/core/strip/png.ts|src/core/ots/calendar.ts|src/core/archive/frames.ts|src/core/reports/evidence-zip.ts|src/core/archive/qr-decode.ts|src/core/net/allowlist.ts|2026-11-10|rotation-7` hashes to `2190186635`; index `2190186635 % 27 = 14` selects **`src/core/ots/ops.ts`**. Exclude all seven paths at the next rotation.

### Inspection scope and evidence

- `src/core/ots/ops.ts:1-22`: `applyOp` implements SHA-256, append and prepend; result length must not exceed `LIMITS.maxMsg` (4096 bytes). Operation arguments are untrusted until checked by parse/serialize boundaries.
- `src/core/ots/ops.ts:24-43`: tag mapping rejects unsupported runtime kinds; operation ordering uses tag then lexicographic byte argument, and equality reuses that comparator.
- `src/core/ots/types.ts:1-20,33-62`: narrow operation union, wire tags and parser resource limits. Unsupported hash/reverse/hexlify operations are explicitly rejected; no claim of general OTS operation compatibility.
- `src/core/ots/codec.ts:20-49,70-146`: decoder accepts only supported tags and enforces 1..4096-byte operation arguments, copies parsed argument bytes, replays each commitment via `applyOp`, caps node count/depth/input bytes and detects duplicate edges.
- `src/core/ots/codec.ts:193-271`: serializer validates operation kind and argument before encoding, rejects duplicate edges and enforces resulting message length, tree depth, node and output caps.
- `src/core/ots/verify.ts:44-108`: the verification boundary reserializes caller-built proofs before re-parsing, checks the exact file digest and requires independently agreed Bitcoin header/Merkle evidence before returning `VERIFIED`. A successful comparator/operation alone cannot confer verification.
- `src/core/bytes.ts:1-37`: byte concatenation uses new allocation; `compareBytes` orders arguments lexicographically.
- Existing tests **read only, not run**: `tests/unit/codec.test.ts` (reference fixture round trips, parser hostile-input and length/depth/fuzz bounds), `tests/unit/ots-canonical-order.test.ts` (reference attestation order), `tests/unit/proof-budget.test.ts` (message/depth/aggregate-budget restrictions), `tests/unit/ots-flow.test.ts` (real verification/quorum contract with mocked explorers). Relevant threat boundaries: `docs/THREAT_MODEL.md` (malicious receipts and false VERIFIED outcomes).

**Finding:** No new reproducible correctness defect, verification bypass, security flaw or privacy leak was established by this bounded source review. `applyOp` is a low-level export and assumes typed operations, but inspected untrusted receipt entry points validate op tags and argument bounds before replay. This does not establish a real user-controlled bypass. No new issue or vulnerability report is justified. No runtime tests, fuzzing, Bitcoin network checks or independent cryptographic audit were performed as part of this review.

**Independent CI context:** audit PR #73 at previous exact head `410f5a61c21ce65361ad16ae26a08dd934912a35` had CI [42860786517](https://github.com/djshellshoxxx/Unaltered/actions/runs/42860786517) and QR [42860786492](https://github.com/djshellshoxxx/Unaltered/actions/runs/42860786492) completed **successfully**; CI included an informational live-calendar check with a failed job. These are hosted checks of the previous audit head, **not** execution of the seventh audit. This new ledger commit needs its own exact-head qualification. Do not merge, deploy, publish or alter cryptographic protocol/security gates.

---
## Eighth rotation — 2026-11-10 — shared byte/varuint primitives

**Selection and source:** At `main` commit `556fc2d49a4bbc005babd0094c9233ae4ad418ad`, enumerate the 37 `src/core/**/*.ts` blobs in GitHub's recursive tree, exclude two `*.worker.ts` files and seven previously audited starting points in ledger order: `strip/png.ts`, `ots/calendar.ts`, `archive/frames.ts`, `reports/evidence-zip.ts`, `archive/qr-decode.ts`, `net/allowlist.ts`, and `ots/ops.ts` (each relative to `src/core/`). Sort the remaining 28 paths. FNV-1a 32-bit on main SHA joined by `|` with the seven full prior paths yields **232002547**, index **7** of 28, selecting `src/core/bytes.ts`. No prior starting path was reused.

**Read-only scope and evidence:**
- `src/core/bytes.ts:5-27`: hex encoding/decoding, non-spread byte concatenation, byte equality and offset accounting; `fromHex` rejects odd/nonhex input. `concatParts` aggregates lengths and copies segments; callers must impose aggregate size budgets.
- `src/core/bytes.ts:29-53`: lexicographic comparison, reversal, optional human-readable grouping. `groupHex` has no validation for user-supplied nonpositive group widths, but this review did **not** establish a reachable untrusted-width caller, a reproducible production exploit, or a justified security finding.
- `src/core/bytes.ts:55-109`: bounded Reader operations, safe-integer unsigned varuint decode, length-bounded fields and safe-integer varuint encode; no external network or secrets handling.
- Trust-boundary callers read: `src/core/ots/codec.ts` replays/parses hostile `.ots` receipts with input/node/depth/field caps, `src/core/ots/ops.ts` limits operation results, `src/core/ots/verify.ts` compares file digests before any positive result, and `src/core/archive/frames.ts` validates archival QR frame lengths and SHA-256 checksum.
- Existing tests inspected but **not executed**: `tests/unit/codec.test.ts` (truncation, oversized fields and reference fixture round-trip), `tests/unit/proof-budget.test.ts` (aggregate parsing/merge budget), `tests/unit/ots-canonical-order.test.ts` (deterministic serialization) and `tests/unit/audit-sweep-serialization.test.ts` (rejection of invalid serializer inputs).

**Result:** No new reproducible vulnerability/correctness failure established from source inspection. No change to production, tests or trust policy, and no private vulnerability was publicly disclosed. This is not a completed independent security audit or runtime test qualification. Residual coverage for later runs: actual caller reachability of optional `groupHex` width and byte-concatenation budget boundaries with adversarial inputs, without claiming an unproven vulnerability. Audit was a distinct **sequential read-only phase**, not a concurrent second ChatGPT worker. No Codex or paid API agent was used. This ledger-only head requires fresh exact-head GitHub CI; previously passing runs qualify only prior commits.

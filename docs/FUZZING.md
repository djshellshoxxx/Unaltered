# Parser fuzzing (REL-2 / SPEC section 12)

`npm run fuzz:parsers` adds V8 block-range feedback to the existing fast-check tests. It uses installed esbuild and Node's
in-process inspector API; no dependency, listening debug port, product instrumentation, backend or network request is added.
See the [Node inspector API](https://nodejs.org/api/inspector.html) and [V8 precise coverage description](https://v8.dev/blog/javascript-code-coverage).

```sh
npm ci --ignore-scripts
npm test
npm run fuzz:parsers -- --iterations 250000 --seconds 300 --seed 20261028
npm run fuzz:parsers -- --iterations 10000000 --seconds 300 --seed 20261111 --targets qr-frames
```

The driver bundles `tests/fuzz/campaign-targets.ts`: the six original entrypoints in `tests/fuzz/targets.ts` (detached OTS
proof, bare calendar timestamp, JPEG, PNG, WAV and MP3; WAV/MP3 added 2026-10-28 continuation (f)) and four hostile-input
targets in `tests/fuzz/targets-hostile.ts` (added 2026-11-11, see below). `--targets a,b` limits the round-robin to the named
targets, so one campaign can be spent on a single parser; without it every target runs. The worker awaits each case, so an
asynchronous entrypoint (archival frame recovery hashes with WebCrypto) is checked to completion and a promise that never
settles hits the same parent deadline as a synchronous hang. Initial cases come only from the repository's synthetic/reference fixtures. Every `.ots`
file in `tests/fixtures/ots` must be tracked by Git: an untracked or ignored one stops the run before anything is fuzzed or
written, so a local receipt left there is never fuzzed or copied into a corpus. Unsupported Litecoin, RF64 WAV and
free-format MP3 remain negative seeds. Mutations flip/replace/insert/delete/truncate bytes; half of PNG mutations repair
surviving chunk CRCs and half of WAV mutations restore the RIFF length to reach deeper parser branches.
Half of `qr-frames` mutations go through the target's `repairCase` hook, which rewrites payload lengths and both checksums
(and, in one of two modes, renumbers indices and counts) so mutated frame sets reach reassembly instead of stopping at the
SHA-256 check. The hook runs in the driver, never in the worker, so it adds no coverage of its own.
An input is retained for further mutation when it runs bundled source offsets that no earlier input for that target ran.
V8 reports block counts in a minimal form: it leaves out a block that runs as often as its parent and joins neighbours with
equal counts. So each offset takes the count of the innermost reported range around it. A new branch counts even when it
runs as often as its function, and the same blocks run with other counts do not. Coverage includes bundled parser/helpers and
oracle wrappers; it is not an edge-coverage percentage, native decoder/sanitizer coverage, or proof that every branch was tested.

Normal parser rejection is allowed. Unexpected exceptions are findings. Once OTS parsing succeeds, canonical round-trip,
digest and attestation-commitment equivalence failures remain findings, even if they throw a typed parser error. Accepted
image/audio output must pass self-check, remain byte-idempotent, never grow and leave the input unchanged; an MP3 result
that reports no removal must equal its input. This does not establish
pixel or audio equivalence, browser decoding of every mutation, full sanitization or robustness of third-party decoders.

### Hostile-input targets (2026-11-11)

Each oracle is independent of the code under test where that is possible: Node's own SHA-256 instead of WebCrypto or
`@noble/hashes`, and a separate reading of the specification instead of the product's control flow. Every implementation is
injectable, and `tests/fuzz/oracles.test.mjs` (part of `npm test`) feeds each oracle deliberately broken implementations and
requires it to report them, so a target cannot silently degrade to "did not throw".

| Target | Entry point | Input | Oracle (any violation is a finding) |
|---|---|---|---|
| `qr-frames` | `recoverReceiptFrames`, `encodeReceiptFrames` (`src/core/archive/frames.ts`) | A frame-list container: big-endian u16 length + frame bytes, or a repeat record (top bit set) that duplicates the previous frame, so up to 4100 frames fit in 64 KiB | Accept/reject and the recovered bytes equal a reference reassembler written from `ARCHIVAL_QR_PROTOCOL.md` (missing, conflicting, mixed and malformed sets must be rejected); every accepted frame's SHA-256 and proof ID match the result; never accepts more than 4096 frames or 16 MiB; a canonically chunked set re-encodes to exactly its distinct frames and every re-encoding round-trips; rejection is an `Error` whose message starts `Invalid archival QR frame: `; input frames are unchanged |
| `qr-image` | `qrImageDimensions` (`src/core/archive/qr-image.ts`) | Raw PNG/JPEG bytes | Dimensions equal the PNG IHDR or the first JPEG SOFn header as read by a reference tokenizer (ITU T.81 B.1.1); never above 6000 px per side or 16 Mpx, never below 21 px (checked against both the specification and the exported constants); appending bytes or inserting an APPn segment after SOI leaves the result unchanged; rejection is a plain `Error` with one of the eight documented messages; input unchanged |
| `trusted-header` | `checkTrustedHeader`, `verifyWithTrustedHeader` (`src/core/ots/trusted-header.ts`) | Mode byte, up to 80 header bytes, `.ots` receipt. Mode bits choose the hash form (exact, upper case, wrong nibble, trailing newline), splice the receipt's Bitcoin commitment into the Merkle root, choose the height (attested, +1, nonce, hostile number), take the file digest from the receipt, pass the header as an offset view, or pass a non-string hash | The header check succeeds exactly when Node's double SHA-256 of 80 bytes matches the supplied hash and the height is a u32, otherwise it throws `UnalteredError` `SOURCE_INVALID`; parsed fields equal the supplied bytes and do not alias them; verification never throws, keeps `USER_SUPPLIED_HEADER` trust, returns the state an independent model gives and, when matched, the right height, hash and time; inputs unchanged |
| `receipt-store` | `loadReceipts`, `addReceipt`, `removeReceipt` (`src/ui/store.ts`) | UTF-8 text placed in an in-memory `localStorage` under the receipt-list key | Never throws; returns at most 500 plain objects with exactly the keys `digestHex`, `createdAtUtc`, `label` (so a stored `fileName` or any other field is never kept or written back), lowercase 64-hex digests and fields bounded to 40/200 characters, equal to a model of the documented contract; loading does not rewrite storage; after hostile data a new record is stored first without losing, reordering or inventing others, and removing it restores the rest |

Not covered by these targets: native browser image decoding (`createImageBitmap`) and the jsQR pixel decoder
(`decodeRasterFrames`, which needs a raster and is exercised by the archival scan tests and QR qualification workflow), the
12 MiB image byte limit (fuzz inputs are at most 64 KiB), 16 MiB receipts (a 64 KiB input cannot carry one; the limit is
checked by rejection of a larger declared length), real Bitcoin headers or chain membership, and browser `localStorage`
quotas or exceptions (covered by `tests/unit/ui-store-robust.test.ts`). Seeds are the committed `.ots` fixtures, the
committed golden frame `tests/archival/golden-v1.hex` and generated synthetic data. Campaign evidence for these targets is in
`docs/evidence/fuzz-20261111.json`.

Bounds are independent of all product acceptance limits: 64 KiB per fuzz input, 256 retained inputs per target, one input at
a time, one-second parent deadline per input, 128 MiB worker old-generation heap plus 16 MiB young generation. These heap
settings do **not** measure process RSS, external ArrayBuffers or the product's Chromium <200 MiB gate. The parent can
terminate a synchronous infinite loop; crashes, worker exits and timeouts fail the campaign. The iteration and wall-clock
budgets both apply after startup. This small-input campaign does not replace full-size/count/depth boundary tests.

Each run creates a fresh ignored `scratch/fuzz/campaign-*` directory. It retains coverage-growing bytes and a report with
the source SHA; `sourceDirty`, true when `git status` shows tracked changes or untracked files, so the run may not match
that SHA; the bundled-target SHA256; `harnessSha256` for the driver and its `scripts/lib/fuzz-*.mjs` modules;
`seedFixtures`, the seed count and the SHA256 of the output of `cd tests/fixtures/ots && LC_ALL=C sha256sum *.ots`;
Node/V8 versions, seed/budgets and outcomes; `coveredOffsets`, the bundled source offsets run at least once for that
target; and corpus counts. Evidence recorded before 2026-11-04 has none of `sourceDirty`, `harnessSha256` or `seedFixtures`,
and has `ranges` instead of `coveredOffsets`: the number of distinct positive-count V8 range shapes, which missed branches
run as often as their function and counted count-only shape changes, so the two numbers cannot be compared. Every 1000
mutations updates the report. A finding additionally saves its exact bytes, digest and manifest and exits nonzero. Reports
distinguish iteration completion, wall-clock exhaustion, replay success and findings; a bounded clean run is not an
exhaustive audit.

```sh
npm run fuzz:parsers -- --replay scratch/fuzz/campaign-EXAMPLE/finding.json
```

Replay validates the target, size and byte digest and runs through the same worker and oracles. Reproduce with the same
source, dependency lockfile and Node/V8 version; coverage offsets depend on the bundle. The harness does not automatically
minimize inputs. Triage findings, reduce them, then commit a minimal synthetic regression with the fix. Never feed or publish
real sensitive files, photos, private receipts or research packs. Keep campaigns' bulk corpora out of Git; record compact,
non-sensitive evidence in the handoff. `npm test` also exercises coverage feedback, exception reporting, worker exit and
parent termination using deliberately faulty test functions. No long campaign runs by default in ordinary CI.

## Recorded campaigns

Bounded, seeded campaigns whose compact reports are committed under `docs/evidence/`. Each is clean only for its
recorded source, seed and budget; none is exhaustive coverage or an independent audit (REL-2 stays open).

| Date | Report | Source | Seed | Mutations (inputs) | Duration | Result |
|---|---|---|---|---:|---:|---|
| 2026-11-04 | [fuzz-20261104.json](evidence/fuzz-20261104.json) | `0b5f18f` | 20261104 | 1,000,000 (1,000,036) | 1171 s | budget-complete, no finding |
| 2026-11-04 | [fuzz-20261104-ext-20261105.json](evidence/fuzz-20261104-ext-20261105.json) | `459cded` (parser sources equal to the PR48 head) | 20261105 | 1,500,000 (1,500,036) | 1638 s | budget-complete, no finding |

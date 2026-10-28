# Parser fuzzing (REL-2 / SPEC section 12)

`npm run fuzz:parsers` adds V8 block-range feedback to the existing fast-check tests. It uses installed esbuild and Node's
in-process inspector API; no dependency, listening debug port, product instrumentation, backend or network request is added.
See the [Node inspector API](https://nodejs.org/api/inspector.html) and [V8 precise coverage description](https://v8.dev/blog/javascript-code-coverage).

```sh
npm ci --ignore-scripts
npm test
npm run fuzz:parsers -- --iterations 250000 --seconds 300 --seed 20261028
```

The driver bundles four synchronous entrypoints: detached OTS proof, bare calendar timestamp, JPEG and PNG. Initial cases
come only from the repository's synthetic/reference fixtures. Unsupported Litecoin remains a negative proof seed. Mutations
flip/replace/insert/delete/truncate bytes; half of PNG mutations repair surviving chunk CRCs to reach deeper parser branches.
Inputs reaching new positive-count V8 ranges are retained for further mutation. Coverage includes bundled parser/helpers and
oracle wrappers; it is not an edge-coverage percentage, native decoder/sanitizer coverage, or proof that every branch was tested.

Normal parser rejection is allowed. Unexpected exceptions are findings. Once OTS parsing succeeds, canonical round-trip,
digest and attestation-commitment equivalence failures remain findings, even if they throw a typed parser error. Accepted
image output must pass self-check, remain byte-idempotent, never grow and leave the input unchanged. This does not establish
pixel equivalence, browser decoding of every mutation, full sanitization or robustness of third-party decoders.

Bounds are independent of all product acceptance limits: 64 KiB per fuzz input, 256 retained inputs per target, one input at
a time, one-second parent deadline per input, 128 MiB worker old-generation heap plus 16 MiB young generation. These heap
settings do **not** measure process RSS, external ArrayBuffers or the product's Chromium <200 MiB gate. The parent can
terminate a synchronous infinite loop; crashes, worker exits and timeouts fail the campaign. The iteration and wall-clock
budgets both apply after startup. This small-input campaign does not replace full-size/count/depth boundary tests.

Each run creates a fresh ignored `scratch/fuzz/campaign-*` directory. It retains coverage-growing bytes and a report with
source SHA, bundled-target SHA256, Node/V8 versions, seed/budgets, outcomes and range/corpus counts. Every 1000 mutations
updates the report. A finding additionally saves its exact bytes, digest and manifest and exits nonzero. Reports distinguish
iteration completion, wall-clock exhaustion, replay success and findings; a bounded clean run is not an exhaustive audit.

```sh
npm run fuzz:parsers -- --replay scratch/fuzz/campaign-EXAMPLE/finding.json
```

Replay validates the target, size and byte digest and runs through the same worker and oracles. Reproduce with the same
source, dependency lockfile and Node/V8 version; coverage offsets depend on the bundle. The harness does not automatically
minimize inputs. Triage findings, reduce them, then commit a minimal synthetic regression with the fix. Never feed or publish
real sensitive files, photos, private receipts or research packs. Keep campaigns' bulk corpora out of Git; record compact,
non-sensitive evidence in the handoff. `npm test` also exercises coverage feedback, exception reporting, worker exit and
parent termination using deliberately faulty test functions. No long campaign runs by default in ordinary CI.

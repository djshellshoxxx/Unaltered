# Parser acceptance evidence — 2026-10-24

Scope: SPEC §§6, 8.1, 8.2, 8.2a and SR-9/SR-10. Tests extend the existing synthetic fixtures; no new file formats or metadata policies.

## Completed coverage

- WAV/MP3: 200 deterministic varied sample/frame payload cases check byte preservation, input immutability and repeat-cleaning stability. Each format also receives 1,000 bounded mutations; accepted outputs must pass the self-check and be stable when cleaned again.
- WAV: exhaustive truncation of a small untagged fixture and explicit nonzero pad normalization. MP3: MPEG-1/2/2.5 frame sizes, padding, false sync bytes within payloads and the eight/nine leading ID3 tag boundary.
- OTS: exact accepted/rejected depth (file and calendar body), node and attestation count boundaries; message growth, argument, URI, payload and calendar-body input limits. Existing 3,000 mutation cases now check canonical serialization stability plus digest and attestation commitment preservation. Existing 3,000 garbage cases remain.
- JPEG/PNG: existing 4,000 mutation cases per format now also check repeated-cleaning byte stability; the 200 JPEG option cases do likewise.
- Resource regressions: 130,000 small retained chunks/segments in WAV, JPEG and PNG exercise JavaScript argument limits using inputs below the strip input cap. Malformed APE length consuming all MP3 frames must be rejected.

Seeds: `20261024` for audio, JPEG and OTS mutations; `20261025` for PNG mutations and OTS garbage. Counts are bounded CI checks, not long fuzz runs.

## Findings and verification

Before production fixes, three many-chunk fixtures threw native `RangeError: Maximum call stack size exceeded` at `concat(...parts)` / `concat(...out)` in the WAV/JPEG/PNG cleaners. The malformed APE fixture returned `cleaned` with empty audio; the dispatch self-check rejects that output, but the cleaner contract was inconsistent. Each finding was reproduced in a failing test and reported to the production-file owner before changes.

Commands (run from repository root; cache path is specific to this environment):

```sh
npm_config_cache=/tmp/unaltered-npm-cache npx vitest run tests/unit/audio.test.ts tests/unit/codec.test.ts tests/unit/strip.test.ts
npm_config_cache=/tmp/unaltered-npm-cache npx eslint tests/unit/audio.test.ts tests/unit/codec.test.ts tests/unit/strip.test.ts tests/helpers/audio.ts
npm_config_cache=/tmp/unaltered-npm-cache npm run typecheck
```

Final post-fix results: all three commands exited 0. Targeted suites passed **69/69 tests across 3 files**, duration 5.98 s (Vitest start 14:50:20 UTC). Owned-file ESLint and repository TypeScript checking passed. Owned-file `git diff --check` also exited 0.

The production owner replaced dynamic argument spreading in the three cleaners with an array-based `concatParts` helper and rejected empty MP3 frame ranges. Independent review of those four production-file diffs found no scope or correctness issue: the helper retains the existing concatenation order/copy behavior, the existing variadic API remains available, and the frame check closes the zero-iteration validation case. The four previously failing regressions pass in the final targeted run. This review does not replace full-repository validation.

## Remaining acceptance work

- Licensed or provenance-recorded real encoder corpus, decoded audio/image comparison and interoperability testing. Synthetic MP3 payloads test container/frame byte handling; they do not establish decodable audio.
- Long-running, coverage-guided fuzzing and memory/runtime characterization across browsers. Passing bounded properties cannot establish absence of crashes or hangs for all inputs.
- Full sanitization is not claimed: WAV sample data, MP3 frame payloads/Xing strings, steganography and watermarks remain outside metadata stripping policy.
- Live calendar corpus/differential coverage and external acceptance items remain as recorded in TODO/BUILD_PLAN; the optional Python reference test may return early when its interpreter is unavailable.

# Bug-hunt round 3 — 2026-11-19

Branch: `audit/bugs-round3-20261119`.
Independent starting point: consolidated candidate
`e5efcba05dbfb60a67195a264bc023986f3c424d`.
The integration coordinator owns remote publication and final qualification.

## Finding and repair

### Retained evidence-size feedback (`2b43566`)

The size guard correctly rejected an oversized export before reading either
input, but retained its already-translated error string. Changing from English
to Spanish left that UI-owned message in English despite an existing Spanish
translation. This differs from the documented exception for untranslated errors
originating in the core.

A new unit regression failed with the English message where the Spanish message
was expected. The view now retains the `evidence-limit` condition and translates
it while rendering. The 16 MiB combined-input limit and pre-read rejection are
unchanged. The same regression checks the switch back to English, available
actions, and zero input reads. All 12 export and batch lifecycle unit tests passed
after the fix.

### Unsupported-cleaning test signature (`7ff1e2f`)

The coordinator's broader suite reported failures in both language cases of
`bugs-sweep-unsupported-cleaning.test.ts`. The focused run reproduced them: the
exact-call assertion still expected `stripMetadata(original)`, while the repaired
cancellation path correctly calls `stripMetadata(original, signal)`.

Updated that assertion to retain its one-call and original-file checks while
also requiring the same live signal used by detection and hashing. It must become
aborted when the user changes the cleaning choice. All warning, selected-option,
acknowledgement, target-byte, and button-state assertions remain in place. The
two language cases pass with no production cleaning change. A final combined run
of this file and both lifecycle files passed all 14 tests.

## Independent review of the integrated repairs

Reviewed export generation ownership, abort-aware native-read/archive waits,
button re-entry guards, input replacement, download publication, language
changes, and batch completion ownership. The integration keeps both contextual
help and the batch input handlers that invalidate work through `stopBatch(null)`.
No further product defect was demonstrated in that scope.

Language changes retain selected `File` objects and operation state. The
interface rebuild is synchronous, so temporarily moving the output node during
relabeling does not itself permit an asynchronous completion to publish into a
detached view. The current-generation and aborted-signal checks still control
export publication and batch results.

## Native-browser coverage (`df50e1d`)

Added `tests/e2e/verify-export-batch-lifecycle.spec.ts` with 10 cases:

- A held evidence export cannot download after cancellation, original-file
  replacement, or receipt replacement (three cases).
- A held export survives a language change and produces one actual browser
  download containing the selected bytes and their checksums, without new reads.
- Oversized-input feedback relabels before either input is read.
- Batch working/cancelled status relabels; a cancelled receipt read cannot restore
  a result or restart work.
- Replacing either batch picker clears working output and discards the previous
  completion (two cases).
- A completed batch's Bitcoin block label changes language without another hash
  worker, receipt read, or explorer request.
- A pairing error relabels and clears when the matching receipt is selected;
  verification then completes normally.

The test probe delays completion of real native file reads. Hash workers,
WebCrypto, ZIP generation, and downloads remain real browser operations. Pending
proof fixtures are inert; the confirmed proof uses the existing mocked explorer
fixture and the real proof-verification path. Tracking outstanding native reads
and digest operations avoids a timed sleep for negative download assertions.
No production bounds, browser flags, retries, or trust rules were changed.

## Verification and limits

Passed locally:

```sh
node_modules/.bin/vitest run \
  tests/unit/bugs-sweep-unsupported-cleaning.test.ts \
  tests/unit/verify-evidence-lifecycle.test.ts \
  tests/unit/verify-batch-lifecycle.test.ts --maxWorkers=1
# 3 files, 14 tests passed.

node_modules/.bin/eslint src/ui/views/verify.ts \
  tests/unit/verify-evidence-lifecycle.test.ts \
  tests/e2e/verify-export-batch-lifecycle.spec.ts
node_modules/.bin/eslint tests/unit/bugs-sweep-unsupported-cleaning.test.ts

node_modules/.bin/playwright test \
  tests/e2e/verify-export-batch-lifecycle.spec.ts --list --retries=0
# 10 tests collected; no browser launched.

git diff --check
```

The new native-browser assertions have **not** run here. The coordinator already
established that local Chromium fails before assertions because the environment
denies its socket creation. This worker did not retry that launch or alter its
security flags. Final-head typechecking and broad tests remain centralized.

A read-only refresh of first-wave CI run `44660341153` and QR run `44660341142`
still showed queued jobs, apart from the optional 2 GiB completion job marked
skipped. No executed failure log was available. Those first-wave runs concern
`fe260d924beaeb34102c0bafa236cca6ff9a921c`, not these new commits.

## Fresh-worker handoff

1. Qualify the 10 new browser cases against the published consolidated head in
   Chromium, Firefox, and WebKit. Keep real download and native read assertions.
2. Inspect any exact-head hosted failure before assigning it to product behavior
   or infrastructure. Collection success is not browser qualification.
3. Preserve the new retained size condition and its English/Spanish regression
   during consolidation. No additional product change is proposed from this
   round's reviewed scope.

No remote write, deployment, release, or paid API call was performed.

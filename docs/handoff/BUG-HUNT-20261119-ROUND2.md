# Bug-hunt round 2 — 2026-11-19

Branch: `audit/bugs-round2-20261119`, based on the first bug-hunt round at
`381eca60a8e2841218f47881231e7eba4d9dc881`. The integration coordinator owns
remote publication and final qualification.

## Findings and repairs

### Evidence-export lifecycle (`3031691`)

The export action did not record an active operation. Repeated clicks started
multiple reads and archives, input replacement did not invalidate the pending
export, and a late read error could replace the result associated with newer
inputs. There was no cancellation action while an export was pending.

Exports now snapshot the selected file references and share the verification
generation and abort controller. Only the current operation can publish a
download or error. Native reads and archive creation are awaited through the
existing abort-aware helper; cancelling abandons the wait without claiming to
cancel the underlying native operation. The action is disabled while exporting,
and the interface distinguishes preparing an archive from checking a receipt.
Language changes preserve the operation without reading either input again.

Six lifecycle regressions failed before the fix. The focused verification,
upgrade, export, and localization suite passed 28 tests afterward. Targeted
ESLint passed.

### Batch status and localization (`1a68dd4`)

Cancelling a batch left its working message visible. Batch results were stored
only as already-rendered DOM, so changing the language did not update progress,
pairing errors, or the Bitcoin block label on completed results.

Batch output is now retained as a small state union and rendered in the current
language. Cancelling shows an explicit cancelled state and releases the current
controller. A new selection clears the previous result. Receipt reads stop
waiting on abort, and late completion cannot restore cancelled output. Result
codes, proof details, receipt pairing, and verification rules are unchanged.

Four regressions failed before the fix. The combined seven-file suite passed
39 tests afterward. Targeted ESLint passed.

### Oversized evidence feedback (`d3b41ea`)

The intentional 16 MiB input rejection threw an ordinary `Error`. The safe error
formatter therefore replaced the useful size explanation with “Something went
wrong.” The rejection now uses the existing typed, user-safe error class. The
byte limit itself is unchanged, and neither input is read when it is exceeded.

The new regression failed before the fix. The final export and batch lifecycle
suite passed all 11 tests. Targeted ESLint and `git diff --check` passed.

## Verification commands

```sh
node_modules/.bin/vitest run \
  tests/unit/verify-batch-lifecycle.test.ts \
  tests/unit/verify-evidence-lifecycle.test.ts \
  tests/unit/batch-verify.test.ts \
  tests/unit/batch-pair.test.ts \
  tests/unit/ui-verify.test.ts \
  tests/unit/ui-upgrade-cancel.test.ts \
  tests/unit/ui.test.ts --maxWorkers=1
```

The command above passed 39 tests before the final size-feedback regression was
added. The final two-file export/batch run passed 11 tests after that addition.
These are separate runs, not an aggregated claim about one final full suite.

## Independent review of round 1

Reviewed the Stamp cancellation signal, item ownership, queue drainage, and
retained error-state changes. No additional defect was demonstrated in that
scope. Existing round-1 tests cover late native resolution/rejection and listener
cleanup. This round does not claim a new native browser qualification for those
paths.

## Fresh-worker handoff

1. Independently review the three commits against the consolidated candidate,
   preserving its contextual-help changes in `verify.ts` and `strings.ts`.
2. Exercise export cancellation, selection replacement, language changes, and
   completed batch relabeling in the native browser matrix. The current local
   environment denies browser socket creation before assertions, so no browser
   pass is claimed here.
3. Run final-head TypeScript, full tests, and CI centrally. This worker did not
   repeat compiler runs after the coordinator reported memory termination.
4. Keep the pending Playwright update separate until its exact-head Firefox
   settings journey is qualified. The previously reported failure was a page
   crash at `locator.dispatchEvent`, not a failed product assertion; that alone
   does not establish whether the cause was infrastructure or an engine defect.

No remote push, merge, deployment, release, or paid workflow was performed.

# Bug-hunt round 4 — 2026-11-19

Fresh review baseline: `1b75b950eb151562415c362e676c569fdd80de55`.
Branch: `audit/bugs-round4-20261119`.

## Result

The initial scoped review found no additional reproducible application-runtime
defect in the evidence-export, batch-verification, and localization integration.
The coordinator's subsequent full typecheck found a test-typing blocker, repaired
in `63ffc06` as described below. The newly added native-browser assertions have
not executed here, and the candidate is not release-qualified by these checks.

## Independent review

Reviewed the third round's browser journeys against the integrated production
markup, `main.ts` routing and language handling, hash-worker construction,
evidence ZIP/manifest generation, batch pairing and verification, and the
synthetic explorer fixture.

- Picker IDs, action labels, result containers, retained selection labels, and
  expected byte-size text match their production producers.
- Language changes use same-document hash navigation. Ordinary tab navigation
  retains the selected files, operation generation, and result state; relabeling
  rebuilds presentation without repeating verification or export work.
- The browser probe delays the completion of a real native `File` read. Worker
  hashing, WebCrypto, ZIP generation, and actual downloads remain native. The
  probe tracks pending reads and digests, then drains continuation tasks before
  checking that a cancelled or replaced export attempted no download.
- The successful-export journey waits for an actual browser download and checks
  the saved ZIP for both original inputs and both manifest checksums. The pending
  proof fixture uses an inert, untrusted calendar and does not require a service.
- The confirmed batch journey uses the existing two-explorer fixture, including
  its height and header requests. Its no-repeat assertions cover reads, worker
  creation, and explorer requests across language changes.
- Cancellation and input replacement preserve their separate single-file and
  batch operation generations. Late completion cannot overwrite newer output.
  Both batch input handlers retain `stopBatch(null)` and contextual help.
- The unsupported-cleaning regression still checks the warning, acknowledgement,
  original bytes, and exactly one cleaning call. Its new signal checks agree
  with the repaired API: detection, cleaning, and hashing share a live signal,
  which is aborted when the cleaning choice changes.

The browser probe observes only main-window native reads and digest operations;
it is not a general browser memory or worker-internals instrument. Worker count
assertions establish construction counts, not a separate memory guarantee.

## Follow-up compiler finding and repair

The fourth code-audit worker's full TypeScript check reported five `TS2352`
diagnostics in the new browser test. Its direct casts from the browser's `window`
to a structural type requiring `__lifecycleProbe` asserted a property that had
not been declared on `Window`. These errors were in the reviewed baseline; the
compiler version remained TypeScript 6.0.3 during the dependency update.

The repair declares the test-owned property as optional on `Window` and narrows
it at access sites. Installing the probe establishes the property explicitly;
waiting for a read checks its optional release callback; releasing or observing
the probe checks initialization before access. Read/digest completion accounting,
download checks, and every ownership assertion remain in place. No unchecked
`any` or double assertion was introduced.

One full `tsc --noEmit` run at a 384 MiB Node heap passed with no diagnostics after
the repair. Targeted lint passed, and all ten browser cases still collected. The
code-only commit was handed to the dependency worker for qualification against
the updated lint dependencies; it does not depend on this handoff file.

## Verification

```sh
node node_modules/vitest/vitest.mjs run \
  tests/unit/verify-evidence-lifecycle.test.ts \
  tests/unit/verify-batch-lifecycle.test.ts \
  tests/unit/bugs-sweep-unsupported-cleaning.test.ts --maxWorkers=1
# 3 files, 14 tests passed.

node --max-old-space-size=384 node_modules/typescript/bin/tsc --noEmit
# Passed after the probe typing repair; no diagnostics.

node --max-old-space-size=384 node_modules/eslint/bin/eslint.js \
  tests/e2e/verify-export-batch-lifecycle.spec.ts
# Passed after the probe typing repair.

node node_modules/@playwright/test/cli.js test \
  tests/e2e/verify-export-batch-lifecycle.spec.ts --list --retries=0
# 10 tests collected; no browser launched.

git diff --check
```

Native Chromium, Firefox, and WebKit assertions remain pending. The coordinator
previously established that local Chromium cannot launch because socket setup
is denied. This worker did not retry the launch, change flags, dispatch a
workflow, or mutate remote state. The final combined dependency qualification,
full-suite testing, and exact-head hosted evidence remain centralized with the
coordinator and the other fourth-round workers.

## Next-worker handoff

Review actual hosted results for the final integrated head, especially the ten
new lifecycle cases. Preserve the read, worker, network, and saved-download
oracles when investigating any engine-specific failure. A collection result
does not establish a native pass; no further product change is proposed from
this round's reviewed scope.

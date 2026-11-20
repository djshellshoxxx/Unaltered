# Bug-hunt round 4 — 2026-11-19

Fresh review baseline: `1b75b950eb151562415c362e676c569fdd80de55`.
Branch: `audit/bugs-round4-20261119`.

## Result

No additional reproducible defect was found in the reviewed evidence-export,
batch-verification, and localization integration. This round changes only this
handoff. It does not claim that the newly added native-browser assertions have
executed or that the candidate is release-qualified.

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

## Verification

```sh
node node_modules/vitest/vitest.mjs run \
  tests/unit/verify-evidence-lifecycle.test.ts \
  tests/unit/verify-batch-lifecycle.test.ts \
  tests/unit/bugs-sweep-unsupported-cleaning.test.ts --maxWorkers=1
# 3 files, 14 tests passed.

node node_modules/@playwright/test/cli.js test \
  tests/e2e/verify-export-batch-lifecycle.spec.ts --list --retries=0
# 10 tests collected; no browser launched.

git diff --check
```

Native Chromium, Firefox, and WebKit assertions remain pending. The coordinator
previously established that local Chromium cannot launch because socket setup
is denied. This worker did not retry the launch, change flags, dispatch a
workflow, or mutate remote state. Full typechecking, dependency qualification,
full-suite testing, and exact-head hosted evidence remain centralized with the
coordinator and the other fourth-round workers.

## Next-worker handoff

Review actual hosted results for the final integrated head, especially the ten
new lifecycle cases. Preserve the read, worker, network, and saved-download
oracles when investigating any engine-specific failure. A collection result
does not establish a native pass; no further product change is proposed from
this round's reviewed scope.

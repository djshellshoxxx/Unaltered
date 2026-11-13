# Hash fallback cancellation and unreadable-file evidence, 2026-11-11 UTC

Workstream B of `docs/handoff/HARD-PROBLEMS-20261111.md`. Base: `6fb200e` (origin/main `556fc2d` plus the handoff doc).
Host: Linux, 4 CPUs shared with four other agents, Node v22.23.4, Chromium "Google Chrome for Testing 153.0.8010.12"
(Playwright build 1243). Only synthetic files were used.

## Questions and answers

| # | Residual as recorded | Reproduced on current code? | Outcome |
|---|---|---|---|
| a | Main-thread fallback abort waits for the 30 s stall watchdog while a BYOB read is pending (`CONSOLIDATION_20261030.md`, `REVIEW_CONSOLIDATION_20261030.md`) | **No.** Closed by `8d3e7cb` (abort-driven `within`/`awaitAbortable`) | Regression locks added. No production change |
| b | A pending cross-check `slice().arrayBuffer()` never settles after abort | **No.** Closed by `8d3e7cb` (`readCrossCheckInput` uses `awaitAbortable`) | Regression lock added. No production change |
| c | Raw `DOMException` if a file becomes unreadable mid-hash (`AUDIT.md`, "Unconfirmed", low) | **Yes**, in controlled models and natively in Chromium. Natively it is mostly a `TypeError`, not a `DOMException` | Fixed in `src/core/hash/stream.ts`, with unit and Chromium regressions |

## Method

1. **Controlled models, real timers** (scratch harness, not committed; the committed fake-timer tests below are its
   deterministic form). `hashBlob(blob, { noWorker: true, signal })` runs over a `Blob` whose `slice()` returns
   parts with scripted `stream()` (a BYOB byte stream) and `arrayBuffer()`. Time is measured with `performance.now()`
   from `abort()` (a, b) or from the call (c) until the promise settles. The 40 s cap stands for "never".
   The same harness ran against the pre-fix sources (`8d3e7cb^` `stream.ts`/`hasher.ts`) for comparison.
2. **Native Chromium.** A real file is written to a temporary directory and selected by **path** with
   `setInputFiles`, so the browser backs the `File` with the disk file. The file is then deleted, or rewritten with a
   newer mtime, before Verify → Check. A temporary probe (not committed) recorded the native rejection of each read API
   in the page and in a worker.

## Results: controlled models (main-thread fallback)

| Case | Model | Pre-fix `8d3e7cb^` | Current `6fb200e` | After this change |
|---|---|---|---|---|
| a1 | BYOB data read never settles; `cancel()` never settles | 31 007.6 ms, ABORTED | 1 006.9 ms, ABORTED | 1 017.6 ms, ABORTED |
| a2 | BYOB data read never settles; `cancel()` settles | 29 975.8 ms | 0.3 ms | 0.2 ms |
| a3 | End-of-slice BYOB read never settles; `cancel()` never settles | 30 988.6 ms | 1 001.3 ms | 1 001.8 ms |
| a4 | End-of-slice BYOB read never settles; `cancel()` settles | 29 976.1 ms | 0.3 ms | 0.2 ms |
| b1 | Cross-check `slice().arrayBuffer()` never settles | never (> 40 000 ms, still pending) | 0.2 ms | 0.2 ms |
| c1 | BYOB read rejects `DOMException NotReadableError` at 4 MiB of 9 MiB | raw `DOMException` + backend message | raw `DOMException` + backend message | `UnalteredError INPUT_UNREADABLE` |
| c2 | Same, `NotFoundError` | raw | raw | `INPUT_UNREADABLE` |
| c3 | Fallback `slice().arrayBuffer()` rejects `NotReadableError` at 4 MiB | raw | raw | `INPUT_UNREADABLE` |
| c4 | Cross-check `slice().arrayBuffer()` rejects `NotReadableError` at 4 MiB | raw | raw | `INPUT_UNREADABLE` |

The raw message in c1–c4 was the model's backend text, which included a file path. `safeMessage()` hid it from the UI
("Something went wrong."), but the typed code and actionable message were lost.

## Results: native Chromium (page and worker, same results)

| Read API | File deleted after selection | File modified after selection |
|---|---|---|
| `slice().arrayBuffer()` | `DOMException NotFoundError` | `DOMException NotReadableError` |
| `slice().stream()` BYOB `read()` | `TypeError: network error` | `TypeError: network error` |
| `stream()` default `read()` | `TypeError: network error` | `TypeError: network error` |

Before the fix, in the app (Verify → Check, `tests/e2e/hash-unreadable.spec.ts`), every case showed **"Something went
wrong."**. On the worker path the worker answered the untyped `{ type: 'error' }`. The page then treated the worker as
unusable and **re-read the whole file on the main thread**, only to fail the same way. A mapping limited to
`DOMException` would not have fixed Chromium's hashing path, which uses BYOB stream reads.

## Change (`src/core/hash/stream.ts` only)

- `readFailure(error)`: an `UnalteredError` passes through unchanged (ABORTED, INPUT_INVALID). Anything else becomes
  `INPUT_UNREADABLE` with the existing generic message: "The browser stopped delivering the file. Try again, or copy
  the file to a local disk first." No browser text and no `cause` is kept.
- `hashSource`: a local boolean `reading` is true only while awaiting a file read (BYOB data read, end-of-slice read,
  slice `arrayBuffer()`). The existing `catch` maps the error only when `reading` is set. Errors from `onProgress`,
  `yieldFn` or hashing are not relabelled. Cancellation still wins: an aborted signal returns `null` first.
- `readCrossCheckInput`: the per-chunk read is wrapped the same way. The worker's `cross()` already rethrows
  `UnalteredError`, so a cross-check read failure is now `failed/INPUT_UNREADABLE`. Before, it was a silently
  `skipped` cross-check that the main thread then repeated.
- Real-time path: no new allocation, closure or promise per chunk (one boolean store before and after each await).
  The EOF, short-read, oversize, stall watchdog (`STALL_MS` 30 s), `MAX_STALLS`, `CANCEL_SETTLE_MS` and memory
  behaviour are unchanged. No existing test was modified.

## Regression tests

- `tests/unit/hash-cancel-residual.test.ts`, new block "prompt settlement of main-thread fallback cancellation
  mid-file" (5 tests). It covers a second-slice data/EOF read pending with `cancel()` settling (settles at fake time
  0, no timer left) and with `cancel()` hanging (settles by `CANCEL_SETTLE_MS`). It also covers a hanging second
  cross-check chunk (settles at fake time 0, no further slices, no digest). Against the pre-fix sources:
  **5 failed**. Against current code: **5 passed**.
- `tests/unit/hash-unreadable.test.ts` (30 tests). It runs `TypeError`, `NotReadableError` and `NotFoundError`
  through the BYOB data read, the EOF read, the fallback slice, a non-Blob stream, the cross-check, `hashBlob` (main
  thread) and the worker module (mid-hash and cross-check). Guards: abort precedence, no relabelling of non-read
  errors or short reads, and a readable file still completes with `cross: 'ok'`. Before the fix: **27 failed,
  3 passed** (the 3 guards). After: **30 passed**.
- `tests/e2e/hash-unreadable.spec.ts` (4 Chromium tests). A file deleted or modified after selection, on the worker
  path and the forced main-thread fallback. The UI shows the typed message. The worker replies exactly
  `[{ type: 'failed', code: 'INPUT_UNREADABLE' }]` with one hash start, so there is no main-thread re-read. Before
  the fix: **4 failed** ("Something went wrong."). After: **4 passed**.

## Commands and counts (after the change)

```
npx vitest run tests/unit/hash-unreadable.test.ts tests/unit/hash-cancel-residual.test.ts   # 37 passed
npm run check            # opsec ok, typecheck ok, lint ok; vitest 619 passed / 2 skipped; node 129 pass / 1 skip
flock "$LOCK" bash -c 'npm run build && npx playwright test tests/e2e/hash-unreadable.spec.ts tests/e2e/hash-worker-evidence.spec.ts --retries=0'   # 7 passed
```

```
flock "$LOCK" bash -c 'npm run build && npx playwright test --retries=0'   # Chromium: 121 passed, 1 skipped (opt-in 2 GiB memory), 1.7 min
UNALTERED_BIG=1 npx vitest run tests/unit/hash.test.ts                      # 76 passed, including the 2 GiB <200 MiB case
```

## Remaining bounds (not defects, documented limits)

1. **Cleanup wait.** If a backend never settles `reader.cancel()`, the main-thread fallback settles an abort after at
   most `CANCEL_SETTLE_MS` (1 s; measured 1 001–1 018 ms). If `cancel()` settles, abort settles at once (0.2–0.3 ms).
   The worker path is not affected: abort terminates the worker at once.
2. **Abandoned native work.** Abort stops *our wait*. It does not cancel a native `Blob.arrayBuffer()`, a WebCrypto
   digest or a stuck backend read. Their results are ignored and dropped. Per hash operation, backend-held hashing
   buffers are bounded at `MAX_STALLS` × `CHUNK_SIZE` (3 × 4 MiB = 12 MiB). That is at most two abandoned data
   readers plus the in-flight read, because the third abandonment throws `INPUT_UNREADABLE`. On top of that come
   one-byte end-of-slice probes and at most one in-flight cross-check chunk (4 MiB). The bound holds only if the
   backend releases a buffer when its read settles or is collected. Across many cancelled operations on a backend that never settles, nothing
   in the app can reclaim that memory.
3. **Models, not native stalls.** (a) and (b) were proven with scripted streams. A real native never-settling Blob read
   has still not been reproduced in a browser, and the original native stall cause remains unknown. (c) is native for
   "unreadable before the first read". The mid-hash variant is proven in models only, because a deterministic native
   mid-read failure was not attempted.
4. **Engines.** Native results are for Chromium 153 only. Firefox and WebKit may reject with other types. Any untyped
   read rejection maps to `INPUT_UNREADABLE`, but that was not run on those engines here.

## Correction (1d5bdde)

The first version of this fix made a rejected read inside the worker final. CI WebKit (run 42944774093) showed that
WebKit's offline single-file build cannot read the Blob in its worker, but can on the main thread, so offline hashing
broke. A rejected worker read now replies `error` and the page falls back. Only a main-thread read failure becomes the
typed `INPUT_UNREADABLE`. The worker-path expectations above changed accordingly; the main-thread results are unchanged.

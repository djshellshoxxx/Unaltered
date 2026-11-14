# Workstream B notes (hash fallback cancellation residual, typed read errors)

Worktree: wt/b, branch `ws/b-hash-cancel`, base `6ff1cbd`. Scratch: this directory (`$SCRATCH`).

## Status log (newest last)

- 00:58 Started from a clean base (no earlier commits, no earlier notes). Baseline in this worktree:
  `npx vitest run tests/unit/hash.test.ts tests/unit/hash-cancel-residual.test.ts tests/unit/hash-worker-startup.test.ts tests/unit/hash-real-file.test.ts`
  -> 3 files passed, 1 skipped; 81 tests passed, 2 skipped.

## Reading of the base code (before any change)

- Main-thread fallback (`hashBlob` -> `hashSource(blob, { signal, yieldFn })`): every await is wrapped in
  `awaitAbortable` (BYOB data read, end-of-slice read, slice `arrayBuffer`, yield, cross-check read, WebCrypto digest).
  So the 30 s watchdog is NOT what an abort waits for any more (#38).
- What still waits after abort: the `finally` in `hashSource` awaits `reader.cancel()` for up to `CANCEL_SETTLE_MS`
  (1 s) and that wait ignores the signal. With a backend whose cancellation never settles, abort -> settle = 1000 ms.
- Polling-only cancellation (`isCancelled` without `signal`) cannot interrupt a pending read. Shipped callers: the
  worker (flag set by a `cancel` message that `hasher.ts` never sends; it terminates the worker instead) and the CLI
  (no cancellation at all).
- Read failures are not mapped anywhere: a rejected `reader.read()` / `slice().arrayBuffer()` leaves `hashSource`
  and `readCrossCheckInput` as thrown by the engine. In the worker that becomes `{ type: 'error' }`, which makes the
  page re-hash the whole file on the main thread; a failed worker cross-check read becomes `'skipped'` and the page
  repeats the cross-check read. Either way the caller ends with the raw error (UI: "Something went wrong.").
- `src/cli/run.ts` relies on its own errors passing through `hashSource` unchanged (`tests/unit/cli.test.ts:54`), so
  the mapping must apply to browser `Blob` reads only, not to every `ChunkSource`.

## Decisions

(filled in below as they are made)

## Pitfalls

(filled in below)

## Left to do

(filled in below)

## Native exploration on the unmodified base (Chrome for Testing 153.0.8010.12, Playwright 1.64.1 revision 1243)

Logs: `$SCRATCH/explore-e2e-base.log`, `-2.log`, `-3.log`; spec copies in `$SCRATCH/explore/`.

- A file changed (mtime only, or appended) or deleted after it was chosen:
  - `slice().arrayBuffer()` and `text()` reject with `DOMException` `NotReadableError` (changed) or `NotFoundError`
    (deleted). Message for NotReadableError: "The requested file could not be read, typically due to permission
    problems that have occurred after a reference to a file was acquired."
  - A BYOB `reader.read()` on `slice().stream()` rejects with **`TypeError: network error`**, not a DOMException.
    `reader.cancel()` then rejects with the same TypeError. So mapping only `DOMException` would miss Chromium's
    real behaviour on the path the app normally takes.
- UI on base in every native case (worker and forced main thread, Verify and Stamp, also mid-hash on a 512 MiB
  sparse file modified at 5 % progress): "Something went wrong."
- Worker path on base: the worker's read fails, it posts `{ type: 'error' }`, the page then re-reads the file on the
  main thread (second `TypeError` seen in the page) and ends with the untyped error.
- With `Blob.prototype.stream` removed (model of an engine without Blob byte streams) the fallback's native
  `arrayBuffer()` rejects with the raw `DOMException` `NotReadableError`: UI "Something went wrong."
- Stuck-backend model in the page (pull and cancel never settle, Worker removed):
  - real clock: abort -> "Cancelled." alert = 1006.00 ms (in-page `performance.now()`),
  - paused page clock (`page.clock.pauseAt`): not settled after 3 s; settles after `page.clock.runFor(1001)`.
- Healthy native backend, forced main thread, 512 MiB sparse file cancelled at 5 %: abort -> alert 2.40 ms,
  `reader.cancel()` settled in 0.70 ms. So the 1 s wait needs a backend whose cancellation does not settle.

# Stopped parallel run, 2026-11-11 UTC: handoff

## What this is

A second session started executing `docs/handoff/HARD-PROBLEMS-20261111.md` on this branch (PR #81) while the session
that owns PR #79 was executing the same prompt. This run was stopped about 20 minutes into the workstreams, before
any workstream finished.

Why it stopped:
- The session that owns PR #79 reported that the repository owner chose it to finish workstreams A–D.
- A coordinator session relayed that work on this repository is paused.
- Several of this run's agents were cut off at about 01:13 UTC when their usage allowance ran out.

**Nothing in this folder was reviewed or finished.** Do not merge this branch for its workstream content. Use the
folder as a source of notes and partial patches for whoever continues the work. PR #79 is the live line of work.

The branch itself is `main` at `6c02ce7` plus the Workstream E results of PR #79 at `6ff1cbd`, plus this folder.

## State of each workstream when the run stopped

| Workstream | Reached | Files here |
|---|---|---|
| A, code (liveness canary) | Design evaluation written. No code. | `notes-a1.md` |
| A, upstream proposal | Sources fetched and facts recorded with line numbers. Document not written. | `notes-a2.md` |
| B, hash cancellation | Base code read, behaviour measured in Chromium on the unmodified base. No code. | `notes-b.md` |
| C, fuzzing | Parsers and harness read, harness driver change started. One finding candidate, reported privately. No campaign run. | `notes-c.md`, `partial-c.patch` |
| D, part 1 (independent vectors and decoding) | Python frame builder, expected vectors and self-test written from the specification text. TypeScript comparison test drafted. Third-party decoding not started. | `notes-d1.md`, `partial-d1.patch` |
| D, part 2 (distortion corpus) | Corpus generator and Playwright spec drafted. Not run. | `notes-d2.md`, `partial-d2.patch` |
| E, verification of PR #79's results | Started. No findings were delivered. | none |

The patches are `git diff` output against `6ff1cbd`. Check one with
`git apply --check docs/handoff/stopped-run-20261111/partial-d1.patch`. The lead of this run did not run the code
in them. Treat every file in them as a draft.

## Points worth carrying over

Each point comes from an agent's notes and was **not** verified by a second reader.

1. **A, canary validation.** A calendar reply does not carry its commitment. `parseTimestampBody(bytes, rootMsg)`
   roots the tree at whatever commitment the caller passes, so "the parsed commitment equals the requested one" is
   true for every reply that parses. A canary check built only on that accepts any well-formed reply. The notes
   propose binding the canary to a pinned property of the genuine reply: the recorded Bitcoin block height and,
   where the repository evidence records it, the Merkle root the reply reaches. See `notes-a1.md`, section 1.4.
2. **A, what a canary proves.** A passing canary is a fact ("this server answered a test request just now") plus a
   hedged inference. A failing canary is not evidence of an outage. See `notes-a1.md`, sections 1.2 and 1.3.
3. **A, upstream proposal.** The line to change is line 22 of `contrib/nginx/a.pool.opentimestamps.org` at the cited
   upstream commit (the file was fetched in this run). The nginx website could not be reached from the container;
   the documentation text was read from the source repository of that website instead. See `notes-a2.md`.
4. **B, error type.** In Chromium, a BYOB read on a file that was changed or deleted after selection rejects with
   `TypeError: network error`, not with a `DOMException`. Mapping only `DOMException` would miss the path the app
   normally takes. `slice().arrayBuffer()` does reject with `NotReadableError` or `NotFoundError`. See `notes-b.md`.
5. **B, what still waits after abort.** Every await in the main-thread fallback is already abort-aware. The
   remaining wait is the `reader.cancel()` settle in the `finally` of `hashSource` (up to 1 s, ignores the signal):
   1006 ms measured with a backend whose cancellation never settles, 2.4 ms with a healthy one. The CLI relies on
   its own errors passing through `hashSource` unchanged, so a mapping must apply to browser `Blob` reads only.
6. **C, typed rejections.** `frames.ts` and `qr-image.ts` reject with a bare `Error`, not `UnalteredError`. The
   fuzz harness cannot restrict a campaign to one target, and its report records an absolute output path.
7. **D, specification ambiguities.** Six were found from the text alone (`notes-d1.md`, A1 to A6). One of them:
   16 MiB in at most 4096 frames needs at least 4096 payload bytes per frame, more than one QR byte-mode symbol
   holds (2953 − 80 = 2873), so the real ceiling with QR symbols is 4096 × 2873 = 11,767,808 bytes.
8. **D, licences.** `numpy` was left out of the test environment because its wheels bundle a runtime under GPL with
   an exception. Pillow and the standard library were enough for the corpus generator. See `notes-d2.md`.

## What was verified in this run

Only the baseline at `6ff1cbd`, in this run's container:
- `npm run check`: exit 0 (vitest 603 passed, 5 skipped; node tests 128 passed, 2 skipped).
- `npx playwright test --retries=0` (Chromium): 117 passed, 1 skipped.
- `npx playwright test -c playwright.qr.config.ts --retries=0`: 2 passed.

## Not done

- Every "Done when" line of workstreams A to D in the prompt.
- The independent verification of Workstream E (cherry-pick fidelity, regression evidence, ledger facts, the
  diagnosis of the failing scheduled workflow, code review of the integrated fixes).
- Lead integration, the full gates on integrated work, and the updates to `docs/TODO.md` and `HANDOFF.md`.

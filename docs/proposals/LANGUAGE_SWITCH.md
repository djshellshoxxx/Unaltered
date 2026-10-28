# Proposal: language is presentation state (U-N1)

**Status: proposal, awaiting a product decision.** Not part of #7 or #8. Nothing in SPEC FR-14, UX.md or DECISIONS.md says
what a language switch does to loaded files, receipts, results or running work, so this is a choice for the owner.

## Current behaviour (observed)

Choosing a language in Settings calls `mountAll()`, which rebuilds every view from scratch:

- **Stamp:** every selected file, fingerprint, cleaned copy and **receipt not yet downloaded** is discarded. A running
  stamp still reaches the calendars, but its receipt can no longer be downloaded. Running hash workers are not stopped.
- **Verify:** the selected file, receipt and any result disappear (a fingerprint from a share link is re-applied). A running
  verification is not stopped; since #7 its result is discarded instead of written into detached nodes.
- Object URLs of offered downloads are revoked.

The reviewer of #7 reproduced the Verify part (probes P8/P9); the Stamp part follows from the same `mountAll()` call.

## Proposed behaviour

Treat language as presentation state:

1. Keep the selected file(s), receipt and fingerprint, and every result, in both views.
2. Re-render all visible text in the new language from that retained state. A shown result keeps its *state* (for example
   PENDING stays PENDING); only its wording changes.
3. Never restart, repeat or cancel work because of a language switch: a running hash or verification finishes once and
   renders in the language current at that moment. No second hash worker, receipt read or calendar request.
4. About and Settings, which hold no user work, are rebuilt as today.

## Implementation (this branch)

- `mountStamp` and `mountVerify` return a `relabel()` handle that rebuilds their frames and re-renders from their
  existing state. Stamp already rendered items from data, so it needs only the frame split out.
- Verify keeps what each output area shows as data (`working`, `report`, `upgraded`, `error`) instead of only as DOM, so
  `relabel()` can render it again. The generation/abort ownership from #7 is unchanged.
- `main.ts` `onLang()` calls `relabel()` on Stamp and Verify instead of `mountAll()`.
- `tests/e2e/language-switch.spec.ts`: four cases (result kept and translated; in-progress verification completes once;
  stamped item kept without re-hashing; in-progress hash finishes once). All four fail on the current behaviour.

## Consequences and limits

- Error texts from the core (`safeMessage`) are English in both languages today; a kept error stays English. Unchanged.
- Each re-render issues a new object URL for an offered download, pointing at the same Blob, so no data is copied. URLs
  are revoked on reload as today. Many switches with a large cleaned file keep that one Blob alive, which it already is.
- The file inputs are rebuilt, but the chosen `File` objects are held by the view, as they are between renders today.
- No storage, persistence or new state outlives the page (NFR-6 unchanged).

## Smaller alternatives, if this is not wanted

| Option | Change | Consequence |
|---|---|---|
| A. Keep remount, stop old work | On switch, abort the old views' controllers before `mountAll()` | No wasted hashing/requests; the user still loses inputs, results and un-downloaded receipts |
| B. Keep remount, warn first | Disable the language choice, or confirm, while files or results are loaded | Nothing is lost silently; extra step; still discards on confirm |
| C. Status quo | None | Silent loss of un-downloaded receipts and results; background work continues |

This proposal is preferred because it loses nothing and repeats nothing. A and B are each a few lines in `main.ts`/`settings.ts`.

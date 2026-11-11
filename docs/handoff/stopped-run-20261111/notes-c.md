# Workstream C notes (fuzz the new hostile-input parsers)

Worktree `wt/c`, branch `ws/c-fuzz`, base `6ff1cbd`. `$SCRATCH` = this directory.

## Status log (newest last)

- Started from a clean base (no commits beyond `6ff1cbd`, empty scratch). Read COMMON.md, C.md, the prompt
  sections, FUZZING.md, the harness (driver, worker, executor, coverage), all four parser sources and their tests.

## Facts found while reading (before any change)

- `frames.ts`: `recoverReceiptFrames` / `encodeReceiptFrames` are `async` only because of `crypto.subtle.digest`.
  All structural checks run before the first `await`. Rejections are bare `Error('Invalid archival QR frame: …')`.
- `qr-image.ts`: `qrImageDimensions` is synchronous. Rejections are bare `Error` with 8 fixed messages.
  The only caller (`qr-scan.ts` `scanQrImage`) maps every failure to `UnalteredError('INPUT_UNREADABLE')`.
- `trusted-header.ts`: synchronous, typed (`SOURCE_INVALID`), `verifyWithTrustedHeader` returns a state report.
- `store.ts` `loadReceipts`: synchronous, wrapped in try/catch, projects to the three allowed fields.
- Harness: one worker, synchronous `runCase(target, bytes)`, V8 block coverage, round-robin over all TARGETS,
  no way to restrict a campaign to one target, `report.output` is an absolute path.

## Decisions

1. Typed rejection is read strictly (brief note 1): `UnalteredError` with an expected code. Bare `Error` from
   `frames.ts` / `qr-image.ts` therefore counts as a finding. Fix keeps every message text, changes only the class.
2. Sync core for frames: brief note 3 says fuzz the synchronous core. None is exported, so `frames.ts` gets a
   behaviour-preserving split (`assembleReceiptFrames` + async wrapper that only does the two digests).
   The wrapper is not run by campaigns; a vitest test cross-checks it against the target verdict.
3. Oracles take the parser as a parameter so planted-bug variants can be run through the same oracle (self-tests).
4. Driver gets `--targets`, structure hooks from the bundle, and a repo-relative `output` so the report can be
   committed unedited.

## Commands that worked

(filled in as I go)

## Pitfalls

(filled in as I go)

## Left to do

(see bottom; updated as I go)

## Finding candidate

One finding candidate in the QR image header inspection was confirmed locally before the run stopped.
It was reported privately to the repository owner, as SECURITY.md asks. Details are deliberately not recorded here.

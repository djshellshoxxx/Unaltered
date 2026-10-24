# Completion and validation record

## Current replacement executor — 2026-10-24

Continue from [HANDOFF_20261024.md](HANDOFF_20261024.md). It records source reconciliation, non-overlapping worker ownership,
reproduced parser bugs and fixes, current checks, exact remote checkpoints and blockers. The missing old local checkpoint
was not recovered. The records below are historical evidence; they do not establish the new candidate's hosted CI or release readiness.

## Previous validation — 2026-10-22

## Integrated product

The selected `main` checkout contained only the license and agent tooling. The existing product development history was
fast-forwarded locally from `8bcae50f90d08efcead4c5ff549543d4cc703af4` to
`4c5dcc44ac0d306276c2e2af9505f02ecc4e6e8f` (`claude/peaceful-curie-u239yn`). This preserves the original history and includes
the prior specification, v0.1/v0.2 implementation, hardened parsers, CLI and three-platform distribution work, and v0.3 audio
metadata support. It does not establish that development-branch changes have been merged into `main`.

Unaltered is a browser application and Node CLI. Its accepted ADR-009/011 distribution consists of offline HTML and browser
launchers in Windows/macOS ZIP and Linux tar archives. It is not an audio processor and has no VST3 or CLAP deliverable.

## Corrections

- Reject truncated RIFF containers, incomplete chunk headers and missing odd-length chunk pad bytes.
- Validate every MPEG Layer III frame boundary, including bitrate/sample-rate values and truncation. Reject arbitrary
  trailing bytes; refuse free-format input rather than guessing its boundaries. Retained frame bytes remain unchanged.
- Reject unknown ID3 major versions and reserved flags. Validate v2.4 footer identity and agreement with its header.
- Apply frame validation in the exported MP3 self-check as well as the cleaner.
- Replace every Actions version tag in CI and release workflows with the official repository's resolved full commit SHA.
- Reuse a BYOB byte-stream backing buffer for hashing instead of retaining obsolete slice allocations until browser GC;
  retain the slice fallback for browsers/sources without byte streams. Reject invalid sizes, short/oversized slices and
  premature byte-stream EOF. The first real-browser 2 GiB acceptance run exposed 277,639,168 extra renderer RSS bytes;
  after the correction the unchanged 200 MiB limit passed at 57,077,760 bytes (54.4 MiB).
- Replace the two-language select with a native labeled radio group, preserving in-memory locale and keyboard focus.
  In pinned WebKit 27.2, an isolated `document.createElement('select')` under `style-src 'self'` emits a
  `style-src-attr inline` violation, even without any style attribute. Input/radio construction does not. The strict
  CSP remains unchanged. EN↔ES arrow-key switching, selected-control focus, browser-locale restoration on reload and
  empty storage are tested. Touch tests measure and activate the associated 44 px label, including its far edge.
- Add Linux secret scanning from the official Gitleaks 8.30.1 artifact, checked against the SHA-256 recorded by GitHub
  (`551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`). The local scan found no leaks across all 16 then-existing commits.
- Add native CI coverage for Chromium, Firefox and WebKit and the opt-in Chromium real-file 2 GiB renderer-RSS acceptance.
  The source and lockfile root versions are 0.3.1; dependency versions and integrity hashes are unchanged.

The audio regressions were observed failing before their fixes. Test fixtures now contain full 417-byte MPEG-1 Layer III
frames rather than eight-byte sync-like fragments, so frame-boundary tests exercise the container contract.

## Local evidence and limits

`npm ci --ignore-scripts` installs from the unchanged dependency lockfile. OPSEC, TypeScript and ESLint checks passed.
The full unit/property/mutation suite passed all 110 tests with `UNALTERED_BIG=1` (2 GiB input with bounded memory);
the normal run passed 109 and skipped that single opt-in test. Reference OpenTimestamps 0.4.5 regenerated all six binary fixtures
byte-for-byte, and all 17 codec/differential checks passed with `UNALTERED_PYTHON` set to that reference interpreter. Two successive builds produced
identical top-level `SHA256SUMS`; checksums passed for the offline HTML, Node CLI, Windows ZIP, macOS ZIP and Linux tarball.
This is reproducibility on this Linux machine, not a new cross-OS reproduction claim.

With `CHROMIUM_PATH=/usr/bin/chromium`, the existing browser suite passed 17 of 19 checks, including mocked calendar/Bitcoin
flows, JPEG cleaning, strict CSP/SRI, all four axe scans, keyboard navigation and touch targets. The local-file offline check
was blocked by managed Chromium with `ERR_BLOCKED_BY_ADMINISTRATOR`. The responsiveness test exceeded its 50 ms event-loop
gap limit during shared-machine activity (199 ms; focused retry 230.4 ms). After concurrent C++ builds stopped, the unchanged
responsiveness test passed in a focused run (5.2 seconds overall). Neither assertion nor browser policy was disabled. The
local-file check remains blocked on this machine and must run on the native CI runners.

Live Node network observations and the pending-calendar CORS limitation are recorded in `NETWORK.md`.

Registry trust validation passed: `npm audit signatures` verified all 141 installed package registry signatures and 59
attestations after the environment allowed the standard `tuf-repo-cdn.sigstore.dev` trust-metadata destination.

### Native and additional engine evidence

The first signed integration commit `af706325fa1187dd35e1c78ae7bcb528ad069d89` passed all required native CI jobs
([run 39799701670](https://github.com/djshellshoxxx/Unaltered/actions/runs/39799701670)): Windows build/tests/browser checks,
Linux build/tests, cross-platform byte identity, reference differential checks, Chromium browser checks and OPSEC. Its
informational live-network job failed as documented. The subsequent 0.3.1 memory/UI changes require their own native run.

Local WebKit now passes functional stamp/verify flows, offline `file://`, strict CSP/SRI, language keyboard controls and all
four axe scans after the select correction. Its unchanged 48 MiB responsiveness check still fails on this cloud host
(195–341 ms event-loop gaps against the 50 ms requirement). Instrumentation confirmed a real worker returns `done` with
WebCrypto cross-check `ok`, worker construction takes about 2 ms and `postMessage` returns without a measured delay.
A real disk-backed 48 MiB source also showed a 195 ms gap, so this was not dismissed as a synthetic-fixture artifact.
The threshold and fixture remain unchanged. A complete native engine matrix must resolve this failure before a release
can claim the responsiveness requirement is satisfied; it is not yet established as host-only behavior.

Firefox starts with writable XDG config/cache directories, but this cloud host mounts `/proc/self/uid_map` read-only;
content processes report `EROFS` and crash. Its sandbox was not disabled. Native CI is needed for Firefox validation.

The user-space browser prerequisites were downloaded through signed Debian repository metadata and extracted into a
separate sysroot. WebKit's `ldconfig -p` heuristic cannot see user libraries, although `ldd` and `ctypes.CDLL` resolve them.
For local tests a supported executable-path override runs the same pinned MiniBrowser through an external launcher that
preserves its bundled libraries and appends the sysroot; the upstream shell launcher otherwise discards `LD_LIBRARY_PATH`.
Only the static host-requirement heuristic is overridden after those checks, not browser policies or test assertions.

Three synthetic digests were batch-stamped through the actual application calendar module against all three live servers.
The independent Python OpenTimestamps 0.4.5 client parsed all three returned standard proofs with matching original file
digests. They remain pending receipts; this is protocol compatibility evidence, not a Bitcoin confirmation or L2 verification.

## Action pins verified through GitHub's official API

| Action tag | Resolved commit |
|---|---|
| actions/checkout v4 | 11d5960a326750d5838078e36cf38b85af677262 |
| actions/setup-node v4 | 49933ea5288caeca8642d1e84afbd3f7d6820020 |
| actions/setup-python v5 | a26af69be951a213d495a4c3e4e4022e16d87065 |
| actions/upload-artifact v4 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| actions/download-artifact v4 | d3f86a106a0bac45b974a628896c90dbdf5c8093 |

## Remaining requirements

The open operations, manual usability/screen-reader, independent audit, external reproduction, legal/domain and offline
release-signing items in `TODO.md` require people, account settings or external evidence. They are not satisfied by automated
tests or by generating a release archive. Live browser CORS on pending upgrade replies remains unresolved. Do not advertise
this work as an independently audited, signed production release. The documented workflow can publish explicitly unsigned
prereleases after its three native-runner builds agree; the release key must remain offline.

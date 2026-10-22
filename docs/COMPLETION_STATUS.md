# Completion and validation record — 2026-10-22

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

The audio regressions were observed failing before their fixes. Test fixtures now contain full 417-byte MPEG-1 Layer III
frames rather than eight-byte sync-like fragments, so frame-boundary tests exercise the container contract.

## Local evidence and limits

`npm ci --ignore-scripts` installs from the unchanged dependency lockfile. OPSEC, TypeScript and ESLint checks passed.
The final full unit/property/mutation suite passed 104 tests with the opt-in memory test skipped, then passed all 105 tests
with `UNALTERED_BIG=1` (2 GiB input with bounded memory). Reference OpenTimestamps 0.4.5 regenerated all six binary fixtures
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

# Autonomous development checkpoint — 2026-11-05 UTC

Active branch: `codex/recover-qualify-20261104` in `.development/consolidation-20261104`.
Recovered local checkpoint: `e15b756`; initial remote checkpoint: `5e1b920`.
Latest published source checkpoint: `cc41aea`; [draft PR51](https://github.com/djshellshoxxx/Unaltered/pull/51).
The top-level `main` checkout and its pre-existing lockfile modification remain intact.

## Refreshed recovery evidence

GitHub fetch/prune and CLI authentication succeeded on November 5. Main remains `1b6dd91`.
PR47 is `2592675`, PR48 `9abae9d`, PR49 `dde46ea`, and PR50 `3811638`.
All are open drafts. PR49 targets PR48's branch. PR39 and PR43–46 are ancestors of
PR47; PR47 is an ancestor of this candidate. PR47/48 diverge, so the candidate retains
PR47 and ports PR48's cancellation tests and CI controls, rather than merging its older tree.
PR50 adds only an ancestry audit, read during recovery. Source PRs remain open.
No assignees or submitted reviews appear on PR47/48; no contributor branch was modified.

Latest published release is the older prerelease `v0.3.0-build.2`. Source version remains
`0.3.1` development. No production release, deployment, tag, merge, signing or API-funded
automation activation is authorized by this checkpoint. PR41/42 stay separate.

## Executable inventory

Accepted behavior is defined in `docs/SPEC.md`, with the later decisions in
`docs/DECISIONS.md`. These classifications describe the candidate, not merged main.

| Subsystem / accepted criteria | Status and current implementation | Source / branch evidence | Remaining criteria / dependencies | Owner / risk / next task |
|---|---|---|---|---|
| Branch consolidation | INTEGRATING: PR47 plus unique PR48 cancellation/CI and PR49 URL fix recovered, including nine unpublished commits | PR39,43–50; earlier commit provenance in `docs/AUTONOMOUS_HANDOFF_20261104.md` and `docs/CONTINUOUS_PROGRESS_20261104.md` | Publish recovered commits; exact-head checks and review | Lead / high / full checks then draft PR |
| SHA-256, FR1–2 | PARTIAL qualification: streaming, bounded reads, fallback, cancellation, worker message validation implemented | `src/core/hash/`; PR38,43,47,48; real-file acceptance test | Current browser memory/deadline and real descriptor qualification | Lead / high / run unrestricted acceptance |
| OTS submission/upgrade, FR4–6 | PARTIAL qualification: nonce, calendar quorum, canonical URLs, immutable upgrades implemented | `src/core/ots/calendar.ts`, `codec.ts`; PR39,44,47 | Reference compatibility, negative lifecycle cases and live browser results | Protocol agent / high / compare pinned reference |
| Bitcoin verification, FR7–8 | PARTIAL qualification: replay, header integrity, independent-host quorum, L1 wording and L2 instructions | `src/core/ots/bitcoin.ts`, `verify.ts` | Current reference and live checks; no own-node trust claim from explorer responses | Protocol agent / high / targeted adversarial cases |
| Metadata privacy | PARTIAL qualification: JPEG/PNG/WAV/MP3 bounded structural parsers; recent PNG ordering fixes recovered | `src/core/strip/`, parser regressions | Browser decoding and longer current-source fuzz campaign | Lead / medium / seeded fuzz after source review |
| Browser/CORS, M0-3 | PARTIAL: deterministic mocks and R1 runner implemented; historical pending404 CORS limitation | `tests/e2e/`, `scripts/browser-network-check.mjs`, `r1-acceptance.sh` | Current three-engine and actual-service evidence; remote operator headers | Browser agent / high / install browser dependencies and execute |
| Offline and Pages, FR9 | PARTIAL qualification: self-contained HTML, portable archives, `/Unaltered/` smoke and manual artifact workflow | `scripts/build.mjs`, `tests/e2e/pages-base-path.spec.ts`, `.github/workflows/pages-readiness.yml` | Emitted-build offline/subpath browser checks | Browser agent / medium / current built-site test |
| Accessibility/UI, FR14 | PARTIAL: live-region, focus and superseded-upgrade fixes recovered | `src/ui/`, PR46,47; new stamp/verify lifecycle tests | Current axe/keyboard checks; human screen-reader, Spanish, usability | Browser agent + external reviewers / medium / three-engine suite |
| Supply chain/release | PARTIAL: pinned dependencies/actions, reproducible build, manifest guards, native archive CI | `scripts/build.mjs`, `.github/workflows/{ci,release}.yml` | Tag-race review, exact-candidate native checks, independent reproduction/signing | Release agent / high / executable release regression |
| Sonar security gate | READY: exact outstanding PR47 finding retrieved: S4036, `scripts/parser-fuzz.mjs:29`, Git resolved through PATH | Public Sonar issues API and check run126460511873 | Reproduce PATH shadowing, fix, passing current analysis | Lead / medium / regression before implementation |
| Toolkit | INTEGRATING: inherited PR49 custom sort and decoded paging assertions retained | `skills/paper-search/scripts/search.sh`, toolkit tests | Keep future toolkit changes separate from core | Lead / low / focused toolkit regression only |
| Operations/human acceptance | BLOCKED on external evidence and maintainer controls | `docs/TODO.md`, `docs/AUDIT.md`, `docs/RELEASE.md` | Independent audit/rebuild, screen-reader/native Spanish/usability, Tor, signing, legal/domain/account controls | Maintainer/external reviewers / high / prepare evidence; do not fabricate approval |
| Automation PR41/42 | DEFERRED: independent workstream; existing main workflow inherited | `.github/workflows/unaltered-codex-cloud.yml` | Ownership, spending and lane isolation review before activation | Maintainer / high / no competing dispatch |

## Current execution

Three bounded agents have isolated branches/worktrees from `e15b756`: OTS verification,
browser qualification, and release integrity. The lead owns hash/fuzz/integration/docs.
No overlapping source ownership. All agents use the available inherited model; no extra
OpenAI API workflow is launched. Token/cache/cost telemetry is unavailable.

Initial unrestricted `npm run check`: **PASSED**. OPSEC, TypeScript and lint passed;
Vitest **360 passed / 3 skipped**, including formerly restricted FIFO/stdout cases;
Node regression tests **124 passed / 4 skipped**. This is Linux Node24 evidence; Node22/reference/native OS and
browser qualification are separate outstanding tasks. Pinned Chromium downloaded and
loopback HTTP works; missing OS browser libraries are being installed.

GitHub branch-protection inspection returned HTTP403 `Resource not accessible by integration`;
no settings were changed and protections are not assumed absent. PR47's historical Sonar
gate is failed; other required Actions succeeded, with optional FF/WebKit large-file jobs
skipped and live-network informational failure. Historical checks do not qualify this head.

Next: finish checks, push recovered work and create/update the candidate draft; fix the
reproduced Sonar issue; integrate verified agent commits; rerun focused and broad checks;
record actual remote SHA/PR and test evidence after each milestone. Check publication
at least every20minutes and immediately after significant verified work.

## Verified implementation checkpoint — 21:02 UTC

Recovered commits are published in PR51. Published source `cc41aea` includes:

- `c138080`: absolute-system Git invocation for fuzz source evidence; hostile/empty PATH
  regressions failed before repair, all six campaign tests pass afterward. The exact
  former Sonar S4036 finding is addressed without analyzer suppression.
- `f835e79` (agent `0314c796`): unsigned32-bit Bitcoin attestation height bounds in parse
  and serialize. Twelve new cases;107 related protocol tests passed with pinned Python0.4.5.
  The current upstream0.5.0 bound is distinct from that older oracle; no upstream code copied.
- `9dc775c` / `bae1e79` (agents `9fc0395` / `a1bd3c8`): remote-tag identity recheck before
  draft creation, plus fail-closed template script/style gates. Nine regressions pass;
  build/workflow tests23pass/one PowerShell-only skip. Maintainer tag recheck remains required.
- `752ba8d` (agent `a4d5aa0`): explicit worker readiness and initialization-only10s watchdog.
  Four lifecycle tests;81 focused hash passes/two optional skips. No total-file deadline.
- `cc41aea`: live browser/calendar/explorer and same-receipt reference results in
  `docs/evidence/browser-20261105-network.json`. Alice upgraded receipt independently
  verified at block428648. All three fresh pending404 responses still lack CORS headers.

Parent integration tests for protocol/release/build:21/21 passed. Worker TypeScript/lint
checks passed. Bounded cross-agent review found no actionable Git/height defect; this is
internal review, not independent audit approval. Final broad combined checks are running.

Fresh Node22.23.4 `npm ci --ignore-scripts` passed with the original lockfile unchanged
(SHA256 `836f4e61ef6339339bbbf6f07692a31dadd141cbe3755ef5610f7980dff262df`).
Package signatures:139 registry signatures and58 attestations verified. Runtime audit:0
vulnerabilities; full audit:10 moderate findings from existing dev-only minimatch, no unsafe
override/downgrade applied. All seven Python-generated fixtures compare byte-for-byte.

Initial pinned Chromium:80passed/2failed/one optional2GiB skip. The Pages failure was a
collector incorrectly treating blob worker URLs as HTTP assets. Corrected collector and
unchanged50ms responsiveness test passed together2/2. Initial loaded-run107.7ms failure
is retained. Firefox isolated responsiveness passed. WebKit initial103ms failure is retained;
the integrated worker build `85f5bc962b80d2c4` then passed the same unchanged test. Final
three-engine functional and2GiB qualification is still running; no gate was weakened.

`ccfdc3b` adds real-browser keyboard/upgrade cancellation coverage, corrects the Pages
collector, and uses an accurate localhost URL-parsing base in the test-only loopback server.
`2998f09` prepares an official Pages-format artifact after all existing validation gates
using pinned upload-pages-artifact5.0.0. No deployment job, settings change or write/OIDC
permission was added. Hosted artifact upload remains unverified.

Next: finish fresh Node22/reference/real-file checks and seeded300s fuzz; publish browser
and Pages slices; preserve current engine failure/pass evidence; run exact-source native
CI and manual nondeployment acceptance when available. Sonar's later analysis no longer
reports S4036; its remaining test-server URL warning precedes `ccfdc3b` publication.

# Developer Guide — Unaltered

[Wiki Home](Home.md) · [User Guide](User-Guide.md) · [Contribution policy](https://github.com/djshellshoxxx/Unaltered/blob/main/CONTRIBUTING.md)

## Architecture and boundaries

- **Static client only:** no application backend, accounts, analytics or application database. Vanilla TypeScript renders four hash-routed views: Stamp, Verify (including Upgrade), About and Settings.
- `src/core/hash/` computes file fingerprints; `src/core/ots/` parses, constructs, upgrades and verifies standard OpenTimestamps receipts; `src/core/net/` is the controlled network layer; `src/core/strip/` implements bounded allowlist metadata cleaning; `src/core/reports/` handles local evidence, verification reports and batch operations; `src/core/archive/` implements experimental QR receipt transport.
- `src/ui/` contains browser flows, `src/cli/` the Node command-line verifier. `scripts/build.mjs` emits the deployable and offline artifacts. `tests/` contains unit, differential, fuzz, browser and qualification tests.
- The unrelated JUCE helper toolkit is in `shared/scripts/` and `skills/`: consult the [Toolkit Developer Guide](Toolkit-Developer-Guide.md).

[Architecture decisions](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/DECISIONS.md) and [SPEC](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/SPEC.md) govern code behavior; [threat model](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/THREAT_MODEL.md) governs verification, privacy, and adversarial input assumptions.

## Local setup and development

Requires Node.js **22+**, npm and Git; Chromium/Playwright browser tests require the Playwright browser binary. Optional reference-differential tests use a separately pinned Python OpenTimestamps environment documented in the handoffs.

```sh
git clone https://github.com/djshellshoxxx/Unaltered.git
cd Unaltered
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run check
npm run build
npm run test:e2e
```

`npm run check` runs the OPSEC gate, type checking, lint, Vitest and Node tests. `npm run test:e2e` builds and runs the configured Playwright suite; other browser/OS, large-file and reference-client qualification gates may require separate environments. Do not claim an unrun gate passed. See [fuzz testing](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/FUZZING.md), [network checks](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/NETWORK.md), and [CI qualification](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/CI_QUALIFICATION_20261106.md).

## CLI and APIs

Build first, then run `node dist/unaltered-cli-0.3.1.mjs hash <file>`, `verify <file> [receipt.ots]`, or the documented `verify-offline` mode. See [offline comparison](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/OFFLINE_VERIFICATION.md). **Draft, not on main:** extra CLI commands and JSON output in [PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71), with its [proposed CLI guide](https://github.com/djshellshoxxx/Unaltered/blob/claude/great-darwin-elcc18/docs/CLI.md).

### Receipt and batch-verification API status

The **merged main source** provides `src/core/reports/batch-pair.ts` for exact `FILENAME` ↔ `FILENAME.ots` pairing (1–50 entries, refusing duplicates and missing matching receipt names) and `batch-verify.ts` for sequential per-item results. **Current main does not refuse empty-string basenames:** it can pair an unnamed original with `.ots`. [Draft PR #76](https://github.com/djshellshoxxx/Unaltered/pull/76) contains a regression and a correction qualified by hosted CI, but the correction is **not merged**; callers must not treat a blank filename as a trustworthy pair before integration. These library functions do **not** by themselves establish a released CLI or independent Bitcoin verification; callers remain responsible for actually hashing and verifying the selected bytes and receipt. `AbortSignal` stops new items from being scheduled, and a partial array is not a complete batch verdict.

**Unmerged draft [PR #75](https://github.com/djshellshoxxx/Unaltered/pull/75)** proposes omitting a cancelled in-flight item when its verifier rejects after abort, instead of mislabeling cancellation as an `ERROR` verification result. That behavior is **not on main** and must not be documented as shipped until reviewed and integrated. Existing verified/pending/error states remain separately meaningful.

The reusable source-level interfaces live in `src/core/`. Do not introduce unreviewed network calls, unsafe script execution, or hidden upload endpoints. Respect receipt interoperability, exact digest/receipt binding, and verification levels. API/schema changes need tests and corresponding specification/ADR updates.

## Contribution, security, debugging

Read [CONTRIBUTING.md](https://github.com/djshellshoxxx/Unaltered/blob/main/CONTRIBUTING.md), [SECURITY.md](https://github.com/djshellshoxxx/Unaltered/blob/main/SECURITY.md), [OPSEC.md](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/OPSEC.md), and [dependency policy](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/DEPENDENCIES.md). Avoid `eval`, `innerHTML`, inline event handlers, telemetry, third-party scripts/CDNs, and new runtime dependencies without an accepted ADR. Use synthetic fixtures rather than actual sensitive evidence.

For unexpected verification outcomes: first establish file/receipt identity, parser status, local versus explorer-backed operation, whether sources agree, and the precise error state. Capture only sanitized reproductions. For browser faults: verify CSP, file URL versus served `dist/web/`, and installed browser engines. For network faults: distinguish external CORS/unreachability from Bitcoin verification failure.

## CI, releases, and engineering backlog

Pull requests should be isolated, tested, and reviewed. Required CI is not equivalent to independent audit, real-world print/camera testing, signing, or publication. Release artifacts, multi-OS reproducibility, checksums, signatures and deployment approval are controlled by [RELEASE.md](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/RELEASE.md) and [PAGES.md](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/PAGES.md). **Do not deploy or release based on a passing unit test alone.**

For active requirements, accepted decisions, outstanding defects and owner-held acceptance gates consult [TODO](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/TODO.md), [COMPLETION_STATUS](https://github.com/djshellshoxxx/Unaltered/blob/main/docs/COMPLETION_STATUS.md), [HANDOFF](https://github.com/djshellshoxxx/Unaltered/blob/main/HANDOFF.md), and [open PRs](https://github.com/djshellshoxxx/Unaltered/pulls). Older handoffs are historical snapshots; inspect actual branch heads and checks before treating any claim as current.

Current branch distinction (2026-11-10): main `556fc2d49a4bbc005babd0094c9233ae4ad418ad`; [PR #70](https://github.com/djshellshoxxx/Unaltered/pull/70) is a draft continuation specification; [PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71) is a separate Claude-authored draft implementing certificate-source checks and CLI parity. Neither is part of main unless later merged.


### Qualified draft receipt-dashboard chronology (not on main)

At [draft PR #77](https://github.com/djshellshoxxx/Unaltered/pull/77), source/test commit `2b5d19f4cec4a72cc5b1cb637e3bd8718e8537fe` changes `src/core/reports/receipt-dashboard.ts` to compare validated UTC timestamps chronologically (`Date.parse`), not alphabetically. Its test-first parent [failed as expected](https://github.com/djshellshoxxx/Unaltered/actions/runs/42890921332) on mixed-precision UTC input; the corrective head [passed hosted CI](https://github.com/djshellshoxxx/Unaltered/actions/runs/42901975305) and [QR qualification](https://github.com/djshellshoxxx/Unaltered/actions/runs/42901975640). The Linux unit job reports 3/3 dashboard tests passing within 580 passed / 7 skipped Vitest tests. CI also reports a separate **informational external calendar/CORS failure**, which does not establish Bitcoin verification or resolve upstream connectivity. **This change is a draft, not merged/released**, and the live wiki has not been published. Human accessibility, independent audit and release-signing gates remain open.

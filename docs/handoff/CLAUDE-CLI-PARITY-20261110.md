# Handoff: CLI parity and certificate evidence — 2026-11-10

- **Branch:** `claude/great-darwin-elcc18`, base main `556fc2d` (PR69 merged). Head: this branch's tip.
- **Scope:** continuation queue items 1 and 2 from the proposed [PR70 spec](https://github.com/djshellshoxxx/Unaltered/pull/70).
  No other agent's branch or PR was touched. No merge, release, deploy or settings change.

## Done

1. **Certificate evidence (item 1).** Main already wires quorum-verified Bitcoin evidence from Verify into the QR
   certificate, bound to the receipt SHA-256 and the selected file digest, and prints "Verified" only then. Residual
   fixed here: `createArchivalPrintSheet` counted `sourcesAgreeing.length`, so one host listed twice (or an empty name)
   passed as a two-source quorum. It now requires two distinct, non-empty hosts, compared case-insensitively.
2. **CLI parity (item 2).** New commands in `src/cli/run.ts`, documented in [docs/CLI.md](../CLI.md):
   `inspect [--json]`, `verify --json`, `batch [--json]` and `evidence`. They reuse `src/core/reports` (same JSON report,
   pairing rule, batch runner and evidence ZIP as the browser). Error output stays generic (SR-8).

## Tests (all written first and seen failing)

- `tests/unit/cli-parity.test.ts`: 15 tests (inspect, verify JSON, `--`, batch exit codes, path refusal, evidence
  overwrite/limit/mismatch). Explorers are stubbed; any stray network request fails the test.
- `tests/unit/archival-certificate-evidence.test.ts`: 3 cases for duplicate, case-duplicate and empty sources.
- `npm run check`: exit 0. Vitest 599 passed, 5 skipped (pre-existing optional gates); Node tests 128 passed, 2 skipped.
- Chromium E2E (app, certificate metadata, archival QR, archival language): 40/40 passed, `--retries=0`.
- Bundled `dist/unaltered-cli-0.3.1.mjs` run by hand on the fixtures: inspect text/JSON, evidence mismatch (3), batch
  missing receipt (8), usage text.

## Not done / next

- CLI stamp/upgrade: outside ADR-011 (CLI is a verifier). Needs an ADR first.
- Python reference differential tests were not run in this session (`UNALTERED_PYTHON` unset; they skip).
- Firefox/WebKit, physical print/camera QR qualification, human wording review: unchanged, still open.

# ChatGPT documentation maintenance — 2026-11-10

**Source:** `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. **Branch:** `chatgpt/zero-codex/docs-wiki-20261110`. **No concurrent third worker**: this work was performed sequentially within the same ChatGPT run, not by an independent agent.

## Current GitHub state

- [PR #70](https://github.com/djshellshoxxx/Unaltered/pull/70), draft, proposes the no-Codex continuation specification; not merged.
- [PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71), draft, Claude-owned, proposes CLI parity and a certificate quorum-source guard. At inspected head `c4e43c7b9ca0704bd0526a5317e49ff3749125e0`, GitHub reported CI run 42761293145 and archival QR qualification run 42761293438 **completed successfully**. This is GitHub-reported evidence, not testing executed by ChatGPT.
- Main currently provides a Node CLI with `hash`, `verify`, `verify-offline`. PR #71's `inspect`, `batch`, `evidence` and `--json` work is explicitly marked **draft/unmerged** in the Developer and User guides.

## Changes in this isolated docs branch

- Updated `docs/wiki/Home.md` to make the Unaltered application the primary documentation topic.
- Replaced `docs/wiki/User-Guide.md` with end-user setup, stamping, verification, batch and receipt preservation, digital-first QR caveats, troubleshooting, FAQ and privacy limitations.
- Replaced `docs/wiki/Developer-Guide.md` with source architecture, local setup, test/CLI commands, security policy, CI and release gates, outstanding work and cross-agent PR distinction.
- Added `docs/wiki/_Sidebar.md` linking both top-level guides prominently.
- Preserved the previously existing JUCE toolkit-focused content as separate `docs/wiki/Toolkit-User-Guide.md` and `Toolkit-Developer-Guide.md` while keeping its original `Codebase-Map.md`. The toolkit is a separate bundle, **not** Unaltered's main product.
- Added this maintenance ledger and `docs/handoff/CHATGPT_ZERO_CODEX_LATEST.md`.

## Checks and qualification

- Existing wiki files and targeted source/spec files inspected directly from main.
- **Static local-link check:** all relative `.md` references in the seven wiki-source pages resolved to filenames in `docs/wiki/` (no missing names); the Home and sidebar link both User Guide and Developer Guide.
- Build/unit/browser/Markdown rendering tests **not run** by this session. External absolute GitHub links and the live wiki publication state **not automatically verified**. This work remains **draft**.
- The GitHub connector does not offer a wiki-write action, so `docs/wiki/` contains proposed **version-controlled source only**. **No live GitHub wiki update or publication was performed.**

## Remaining gaps and next action

1. Review doc claims and rendered links in CI/PR; publish to the separate GitHub wiki through an explicitly supported channel after approval. If live wiki uses slug-only links, adapt navigation during publication.
2. The main README still calls `docs/wiki/Home.md` a toolkit wiki; update that pointer to `Toolkit-User-Guide.md` and add a primary app wiki link **after coordinating with Claude's active PR #71**, which already changes README. Do not edit its branch.
3. Reconcile `docs/CLI.md`, release notes, TODO and root HANDOFF only after PR #71's disposition; do not treat its draft as merged.
4. Review older stale historical handoff headings only with exact source and merge evidence; preserve history rather than rewriting it.
5. Maintain separate audit and development branch ownership; no release or deployment authorized.

**Last verified docs-edit commit before this ledger:** `94bc759b824714bf6f637265c0f7d2eefb9e6d08`.

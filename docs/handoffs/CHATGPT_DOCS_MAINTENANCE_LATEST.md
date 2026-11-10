# ChatGPT documentation maintenance — 2026-11-10

**Source:** `main` `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. **Branch:** `chatgpt/zero-codex/docs-wiki-20261110`. **No concurrent third worker**: this work was performed sequentially within the same ChatGPT run, not by an independent agent.

## Current GitHub state

- [PR #70](https://github.com/djshellshoxxx/Unaltered/pull/70), draft, proposes the no-Codex continuation specification; not merged.
- [PR #71](https://github.com/djshellshoxxx/Unaltered/pull/71), draft, Claude-owned, proposes CLI parity and a certificate quorum-source guard. At inspected head `c4e43c7b9ca0704bd0526a5317e49ff3749125e0`, GitHub reported CI run 42761293145 **completed with 13 successful jobs, one skipped and one failed informational live-network job**; archival QR qualification run 42761293438 succeeded. The failed live check is not evidence of a failed local/unit/CLI test; see the exact CI reconciliation below. This is GitHub-reported evidence, not testing executed by ChatGPT.
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

---
## Exact-head CI reconciliation — 2026-11-10 13:00 UTC

Main still `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. These values come from GitHub's check-runs API, not local npm or browser execution.

| Draft PR | Head SHA | Exact-head jobs | Outcome / gate |
|---|---|---|---|
| [#71](https://github.com/djshellshoxxx/Unaltered/pull/71) Claude-owned certificate and CLI work | `c4e43c7b9ca0704bd0526a5317e49ff3749125e0` | 15: 13 passed, 1 skipped, 1 failed | [CI 42761293145](https://github.com/djshellshoxxx/Unaltered/actions/runs/42761293145) failure is the **informational live check**; [QR qualification 42761293438](https://github.com/djshellshoxxx/Unaltered/actions/runs/42761293438) passed. |
| [#72](https://github.com/djshellshoxxx/Unaltered/pull/72) this documentation branch before this update | `547151f90208d71cb69474e46ae723e0dd33d9ad` | 15: 13 passed, 1 skipped, 1 failed | [CI 42813668482](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813668482) same informational live-check failure; [QR 42813668387](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813668387) passed. |
| [#73](https://github.com/djshellshoxxx/Unaltered/pull/73) audit branch before audit-ledger rotation | `39f92868ef414d5ed2aabdf626dc66b5507ef451` | 15: 12 passed, 1 skipped, 1 failed, 1 cancelled | [CI 42813674505](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813674505): informational live check failed; WebKit job cancelled during its Playwright WebKit dependency installation, **not** a demonstrated WebKit application test failure; [QR 42813674209](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813674209) passed. |

**Live check diagnosis:** downloaded job logs [#71](https://github.com/djshellshoxxx/Unaltered/actions/runs/42761293145/job/129649586816) and [#72](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813668482/job/129821179973) show `GET /timestamp/<hex>` returning HTTP 404 **without Access-Control-Allow-Origin** from Alice, Bob and Finney. The script expects pending 404s but marks the missing CORS header as FAIL. This matches the documented external limitation in `docs/NETWORK.md`; keep the verification state conservative. Do not weaken the check or claim all jobs passed.

**WebKit cancellation:** [#73 WebKit job](https://github.com/djshellshoxxx/Unaltered/actions/runs/42813674505/job/129821201155) was cancelled while downloading `playwright install --with-deps webkit` system packages; the log shows `The operation was canceled`, without a completed WebKit test verdict. A new, authorized exact-head CI result is needed before claiming full three-engine qualification of #73.

**Documentation action:** continue treating #70/#71/#72/#73 as unmerged drafts. The user/developer wiki navigation is version-controlled source, not a live wiki publication. The original README's toolkit-wiki pointer conflicts with active #71 README ownership; leave it for post-integration coordination. No new repo settings, workflows, release or Pages publication undertaken.

---
## Documentation qualification checkpoint — 2026-11-10 (current run)

**Pinned sources:** main `556fc2d49a4bbc005babd0094c9233ae4ad418ad`; previous docs PR #72 exact head `e57d5c4bd20843d9d4685dd323995f9ed54d58f8`; Claude-owned implementation PR #71 `c4e43c7b9ca0704bd0526a5317e49ff3749125e0`; read-only audit PR #73 previous head `7346395e519e904eb8a062e30fb05e1287788c18`. All remain **unmerged drafts**. No update to other owners' branches or the default branch.

**Final-hosted-check review (not local execution):**
- [Docs #72 CI 42821893615](https://github.com/djshellshoxxx/Unaltered/actions/runs/42821893615) is **completed/cancelled**: 11 successful, 1 informational live-network failure, 1 WebKit **cancelled**, 1 skipped. [QR qualification 42821893458](https://github.com/djshellshoxxx/Unaltered/actions/runs/42821893458) passed. The WebKit runner reached **92 passing E2E test entries** before GitHub cancelled the operation during the suite; there is **no completed full WebKit verdict** at this exact head. This cancellation is *not* the previous PR #73 dependency-install cancellation.
- [Audit #73 CI 42821800082](https://github.com/djshellshoxxx/Unaltered/actions/runs/42821800082) concluded **success** as a workflow, with 12 successful jobs, one skipped and the informational live-network check reporting failure. The WebKit job **passed** at this head; [QR qualification 42821800327](https://github.com/djshellshoxxx/Unaltered/actions/runs/42821800327) passed. A green workflow conclusion must not be rephrased as “all jobs passed.”
- [Implementation #71 CI 42761293145](https://github.com/djshellshoxxx/Unaltered/actions/runs/42761293145) remains 13 successful, one skipped, one informational live-network failure. [QR qualification 42761293438](https://github.com/djshellshoxxx/Unaltered/actions/runs/42761293438) passed.
- The informational live probe still gets expected pending HTTP 404s **without ACAO** from Alice/Bob/Finney; this is an unresolved external CORS limitation, not a passing browser upgrade. Do not suppress or reinterpret it as independent Bitcoin verification.

**Wiki-source checks:** fetched all seven version-controlled `docs/wiki/*.md` pages at docs head and scanned relative Markdown links: **23 local navigation links, zero missing targets**. Both `Home.md` and `_Sidebar.md` visibly link prominently to separate `User-Guide.md` and `Developer-Guide.md`. Neither the live GitHub Wiki nor rendered external links were published/verified. There was no npm, Vitest, browser or physical QR scan executed locally.

**Outstanding:** require a completed exact-head WebKit run before full three-engine documentation PR qualification; avoid overlapping PR #71 README/CLI ownership. A third distinct read-only archive-frame audit rotation is now in [audit PR #73](https://github.com/djshellshoxxx/Unaltered/pull/73) at `648041d3b84b26436bc98d22d5c6aa12a5aa32d9`; its newly triggered CI is not yet qualified. New docs-branch CI also requires reinspection after this single maintenance commit. Live wiki publication remains a separate, explicitly unperformed step.
---
## Fourth-checkpoint documentation reconciliation — 2026-11-10

**Pinned main:** `556fc2d49a4bbc005babd0094c9233ae4ad418ad`. Source changes here remain **documentation-only** on draft PR #72, head before this append `2ef1e7ff2ac644226a463d8fe4254f07dd100c49`. The seven proposed `docs/wiki/` source pages, with prominently linked top-level **User Guide** and **Developer Guide** from Home and Sidebar, remain unchanged in this checkpoint; the previously checked 23 local navigation references had zero missing targets. No live wiki publication or new external/rendered link verification occurred.

### Exact-head hosted qualification now complete
The previously queued jobs were re-read from GitHub Actions on their **exact commit heads** (not locally executed by ChatGPT):

| Draft source | Workflow results | Disposition |
|---|---|---|
| [Docs PR #72](https://github.com/djshellshoxxx/Unaltered/pull/72) `2ef1e7ff2ac644226a463d8fe4254f07dd100c49` | [CI 42830054713](https://github.com/djshellshoxxx/Unaltered/actions/runs/42830054713) completed **workflow-success**, 12 successful jobs, one skipped, one failing informational live-CORS probe; **WebKit passed**. [QR 42830054946](https://github.com/djshellshoxxx/Unaltered/actions/runs/42830054946) passed. | The earlier WebKit-cancellation gap is closed **for that head**, not for any later docs commits. An informational live HTTP 404 without CORS header remains unresolved. |
| [Audit PR #73](https://github.com/djshellshoxxx/Unaltered/pull/73) `648041d3b84b26436bc98d22d5c6aa12a5aa32d9` | [CI 42829753037](https://github.com/djshellshoxxx/Unaltered/actions/runs/42829753037) completed **workflow-success**, 12 successful jobs, one skipped, one failed informational live-CORS probe; **WebKit passed**. [QR 42829753253](https://github.com/djshellshoxxx/Unaltered/actions/runs/42829753253) passed. | All non-informational jobs completed successfully for this head; does not constitute independent security review. |

**New separate workstream:** [Draft PR #74](https://github.com/djshellshoxxx/Unaltered/pull/74) proposes an evidence ZIP buffer snapshot/regression, not part of `main` or the docs PR. Its exact head at opening is `aa2382bfeff2ea376dca7c96cc65b62447dd3ce7`; [CI 42841449237](https://github.com/djshellshoxxx/Unaltered/actions/runs/42841449237) queued and [QR 42841449238](https://github.com/djshellshoxxx/Unaltered/actions/runs/42841449238) in progress at inspection. Do **not** claim it has passed or is released. The standalone Node repro is not a repo Vitest execution. Its handoff file shares a path with this docs PR; coordinate rather than overwrite on future authorized integration.

**Current documentation action:** reconcile source status and hosted evidence, not a specification decision. Keep `README.md` untouched while Claude-owned PR #71 changes it. No npm, node project suite, browser runtime tests, or wiki publishing were run in this documentation phase. New docs-ledger commit will restart CI and must be qualified at the next checkpoint. Other agents' branches, security requirements, signing, deployment and release settings remain unchanged.

**Next:** verify exact-head docs/audit/feature CI, preserve the informational CORS failure, keep User/Developer live-wiki publication explicitly separate, and reconcile the competing handoff file only after authorized integration.

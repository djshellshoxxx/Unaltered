# Unaltered checkpoint — 2026-10-25

Owner: this task owns only `djshellshoxxx/Unaltered`. Root integrates; one inexpensive read-only worker completed contract/diff review.
No workers remain active. No other repo was changed. The README already labels this experimental client-side tool a software artwork.

- Checkpoint branch: `codex/ui-correctness-checkpoint-20261025`.
- Tested source/test SHA: `7a336258bcab55a1c37cb4d4c080497a14c17131`; the checkpoint adds documentation atop it.
- Parent/PR6 head: `0b448d887df89fab22f701810197e51285590e2b`. Main remains `8bcae50f90d08efcead4c5ff549543d4cc703af4`.
- Current task: preserve the tested U-L1/U-L2 correctness fixes and concise/detailed handoffs on the new branch for parent review.
  Verify the checkpoint's actual remote HEAD with `git ls-remote`; do not overwrite either existing branch.

Completed: reject receipts above the existing1MiB limit before whole-file allocation; capture Verify inputs/controller and suppress
superseded/cancelled completion results/errors/action changes; suppress obsolete Upgrade outputs/downloads. Thirteen browser
regressions pass after failing-before probes. OPSEC/type/lint and126 unit/property tests pass (one opt-in large test skipped).
Double build is byte-identical, all five checksums pass. Existing Chromium app suite:18 pass, offline navigation blocked by
`ERR_BLOCKED_BY_ADMINISTRATOR`. Thresholds, cryptography, trust, services and storage defaults are unchanged.

No merge is planned. This descendant lacks exact-head native acceptance; R1, unsigned checkpoints/signing, human accessibility/
Spanish/usability, audit/rebuild and release controls remain open. No PR update, CI dispatch, release, deployment, tag, credentials
or security settings changed. Inspected workflows run no CI/release on isolated-branch pushes. Only0b448d8 has the verified native
11-required-job success including three original2GiB attempts (run40111133625); its informational network check failed.

Read [detailed UI evidence and next steps](docs/LOCAL_UI_ACCEPTANCE_20261025.md) first, then
[the full historical handoff](docs/HANDOFF_20261024.md). U-N1 (language remount loses transient receipt access) is recorded as a
product ambiguity; no persistence/state-retention feature was added. Preserve all earlier successes, memory failures and archived
experiments. The missing old checkpoint`1e0fd6b3d4e1d1b89b3ad01b78cc28a4c93c08dc` has not been recovered.

Recovery: fetch the named branch, check out its exact verified commit, inspect `git status` and these notes, then use pinned
`npm ci --ignore-scripts`. Reproduce `npm run check`, `npm run build` and the focused Playwright command from the detailed note.
Parent should review the delta from0b448d8 before proposing integration and exact-head native CI. Keep all original2GiB/RSS/540s/
50ms gates; never infer live browser CORS from Node probes or add a backend/security bypass to work around R1.

# ChatGPT Zero-Codex Continuation Specification

Status: proposed; activates only by explicit owner instruction or a scheduled task configured to use this document.
Scope: Unaltered repository. This is a coordination agreement, not an enforceable identity or billing control.

## Purpose and budget
Continue useful engineering when Codex credits are unavailable. Use ChatGPT's directly available GitHub connector, reasoning, and execution tools. Do not invoke Codex CLI, Codex cloud, paid OpenAI API, or spawn credit-consuming workers. GitHub Actions and ChatGPT usage may have independent limits or charges; do not claim zero total cost. Do not infer account credit balances without a reliable source.

## Ownership and isolation
Use branch prefix `chatgpt/zero-codex/` for implementation and a dedicated handoff file `docs/handoff/CHATGPT_ZERO_CODEX_LATEST.md`. Treat this as a ChatGPT-owned workstream; other agents should not edit active branch heads. This is advisory unless repository controls enforce it. Never rewrite, rebase, merge, close, or edit another agent's active branch/PR without explicit authorization. Check main, open PRs, changed paths, and instructions at every run. Do not silently overwrite concurrent work.

## Priority queue
1. Certificate verification: finish the verified-evidence contract identified by PR #69, binding original digest and exact receipt SHA-256, validating independently verified Bitcoin block data, and rendering truthful verified/unverified states. Preserve optional document-label privacy.
2. CLI parity: inventory browser and Node CLI capabilities; add scriptable equivalents where technically applicable (receipt inspection, evidence export, batch verification, JSON output, documented exit codes) without compromising security.
3. Receipt management and batch verification: reconcile PR #61 and current main; improve pairing, bounded memory, cancellation, exports, and interoperability.
4. QR certificate quality: preserve byte-exact .ots recovery and existing PR #68 guarantees; improve accessibility, print layout and regression coverage.
5. Security and test coverage: parser, hash, network, metadata stripping, trust boundaries, malformed inputs, property/fuzz and browser tests.
6. Documentation, translations, usability and release preparation. Never claim human review, independent audit, physical print/camera qualification, signing or publication without evidence.

## Run protocol
- Read AGENTS.md and nested instructions if present, README, docs/SPEC.md, docs/TODO.md, docs/COMPLETION_STATUS.md, latest handoff, recent commits and PRs.
- Confirm no conflicting active work and select the smallest valuable independently testable slice.
- Implement using test-driven development: reproduce failing behavior, add regression, implement minimal fix, refactor and run available checks.
- Preserve client-only architecture, strict CSP, privacy, bounded resource use, standard .ots interoperability, truthful verification semantics, and pinned dependencies.
- Prefer no new runtime dependencies. Never fabricate a passing test or verified Bitcoin evidence.
- Use GitHub tools for branch/commit/PR. Run tests in available execution environment or CI if supported. If tests cannot run, state precisely which are unexecuted and keep PR draft.
- Merge only when explicitly authorized, required gates pass, no conflicts exist, and branch protection permits it. Never deploy or release without separate owner authorization.
- Update handoff on the same branch with base/head SHA, changed files, completed acceptance criteria, exact tests/results/links, known failures, conflicts, blockers and next concrete steps.
- Keep scope and token use efficient; continue on the next scheduled invocation, not by claiming background execution within one chat.

## Acceptance criteria
A task is complete only when its implementation, negative and regression tests, documentation and relevant CI gates are satisfied. Near-complete means remaining blockers are enumerated with owner, evidence and reproducible steps; do not invent percentages. Pause a lane when no safe independent work remains, and report the blocker. Do not stop the overall queue solely because one task is blocked.

## Scheduling and activation
A separate ChatGPT automation may read this specification at each invocation. The repository file alone does not start a timer or automatically detect exhausted Codex credits. Scheduling must be separately created, and any automation must respect its own frequency and tool limits.

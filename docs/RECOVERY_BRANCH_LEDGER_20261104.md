# Cached branch reconciliation — recovery checkpoint 7e8f437

Computed 45 branch records against candidate `7e8f4377fe8e40045bd0b67983a4635e0868939b` and cached main `1b6dd91be87d1a8c92725439bb87a0517b4156ba`. Remote refresh is blocked; branch/PR states are not live.

Summary: integrated: 34, intentionally excluded: 2, repair-needed: 2, superseded: 7

The JSON companion includes every unique non-merge commit, patch-duplicate SHA, changed path, identical candidate blob and historical evidence provenance. Patch uniqueness is not itself functional uniqueness. No source branch was mutated.

| Branch / PR | Head | Merge base with candidate | Unique non-merge / patch unique / patch duplicate | Disposition |
|---|---|---|---:|---|
| `origin/automation/api-funded-unaltered-cloud-20261103` | `e5c9b231565f4e15258b9cb8d4309a3ef0b2503a` | `e550b5ac83c3dee5af33701ce599f6bb2ffb09bb` | 2 / 2 / 0 | integrated |
| `origin/automation/unaltered-cloud-autointegrate-20261103` / #41 | `d35291677bf41355160b61ae9aa9b18eff782aa3` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | 1 / 1 / 0 | repair-needed |
| `origin/automation/unaltered-four-parallel-agents-20261103` / #42 | `db519a9e2c279b4f6ba58e3a4d6339723a372bd0` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | 3 / 3 / 0 | repair-needed |
| `origin/chatgpt/acceptance-cancellation-20261102` | `03f3ac80cfe6f3014162967b5e05bff95ec350b6` | `7a040323f415d0f4c1c48b84e97739451669b00f` | 3 / 3 / 0 | integrated |
| `origin/chatgpt/calendar-evidence-20261102` / #39 | `76caf3e84c940ca902540686d4c891e820862fbb` | `76caf3e84c940ca902540686d4c891e820862fbb` | 0 / 0 / 0 | integrated |
| `origin/chatgpt/paper-search-sort-parameter-20261104` / #49 | `dde46eab7d1dfdaace9579cee004053c82568412` | `d9b4fdc379b4e8d834c05ea6c7328806dc3c2fac` | 12 / 8 / 4 | superseded |
| `origin/claude/cool-einstein-ekcvh3` | `733079e3af5fe8f92bdc5cb077da78f2579aed84` | `66f67dc33fc2f4671502e60004e80b19449592cf` | 2 / 2 / 0 | superseded |
| `origin/claude/friendly-faraday-papf5c` / #25 | `c4723d4974fd03c2adbe3f0a99b4bfe30b865a49` | `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd` | 2 / 2 / 0 | integrated |
| `origin/claude/funny-lamport-2jfc0e` / #47 | `2592675cb55b58f079a3059907eba1187d7e8865` | `2592675cb55b58f079a3059907eba1187d7e8865` | 0 / 0 / 0 | integrated |
| `origin/claude/hash-stall-progress` / #31 | `0d4f465652d86bdfd41ee73447b4ce93e3be818f` | `9f06c46d061f8a0f67d8684b6c9c6cbbd163242d` | 1 / 1 / 0 | superseded |
| `origin/claude/language-switch-tests` / #33 | `4968f4026512b8fe8db0787b3c8bfcb8aebd590a` | `595fd06891346d88d9339cf7448569b023c59b68` | 2 / 2 / 0 | integrated |
| `origin/claude/peaceful-curie-u239yn` | `4c5dcc44ac0d306276c2e2af9505f02ecc4e6e8f` | `4c5dcc44ac0d306276c2e2af9505f02ecc4e6e8f` | 0 / 0 / 0 | integrated |
| `origin/claude/pending-receipt-cors` / #30 | `0151ca54868df1f95eb145f741e6b50383844065` | `595fd06891346d88d9339cf7448569b023c59b68` | 2 / 2 / 0 | integrated |
| `origin/claude/project-completion-builds-vhvag8` | `e740d90d9a71cd0754079d129b5b18b5b45da5f9` | `e740d90d9a71cd0754079d129b5b18b5b45da5f9` | 0 / 0 / 0 | integrated |
| `origin/claude/quirky-meitner-0jr3pz` / #48 | `9abae9dee38fb910116dd673cc5bcbcf6de3bac3` | `d9b4fdc379b4e8d834c05ea6c7328806dc3c2fac` | 10 / 8 / 2 | superseded |
| `origin/claude/responsiveness-flake` | `6a9fdcef3c2a4d34fc9b808ef4ba49afe1579ed3` | `6a9fdcef3c2a4d34fc9b808ef4ba49afe1579ed3` | 0 / 0 / 0 | integrated |
| `origin/claude/specs-and-plan` | `9db67d694005aec772072d7c5c223d601381ceae` | `9db67d694005aec772072d7c5c223d601381ceae` | 0 / 0 / 0 | integrated |
| `origin/claude/stoic-mccarthy-m7xpb8` | `21bf07bf99dad4a7aee3cd47aac13e2031f40160` | `21bf07bf99dad4a7aee3cd47aac13e2031f40160` | 0 / 0 / 0 | integrated |
| `origin/claude/sweet-hypatia-vp4syp` | `78c1b0cef81c67b8979a7732ee0d71c54241dc76` | `9db67d694005aec772072d7c5c223d601381ceae` | 2 / 2 / 0 | superseded |
| `origin/claude/unaltered-continuation-20261029` | `a602126c92acbc2f052c15b7992eb3c593309007` | `a602126c92acbc2f052c15b7992eb3c593309007` | 0 / 0 / 0 | integrated |
| `origin/claude/zealous-wozniak-ey71lr` | `00e390db8faa71a22aac03eb97575dbfad43fe8e` | `00e390db8faa71a22aac03eb97575dbfad43fe8e` | 0 / 0 / 0 | integrated |
| `origin/codex/accepted-gates-20261028` | `d124dd47971fdff1ef600e27e918d7421f1cbec3` | `d124dd47971fdff1ef600e27e918d7421f1cbec3` | 0 / 0 / 0 | integrated |
| `origin/codex/audit-preparation-20261030` / #34 | `926e75b41eea8735fe1fe09263f9035e7b5c5c25` | `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd` | 4 / 4 / 0 | integrated |
| `origin/codex/claude-handoff-20261028` | `d358f6c0d746193d62f92d5239b346517f728ce1` | `9e16d5bafddd207d7fa14621fe01a6d692885213` | 1 / 1 / 0 | superseded |
| `origin/codex/ordinary-fixes-20261027` | `6d600249241dc40e252ef22d053b3cb7feb1868c` | `6d600249241dc40e252ef22d053b3cb7feb1868c` | 0 / 0 / 0 | integrated |
| `origin/codex/proposal-language-presentation-20261027` | `bea5aae656cb9965563889c887c2168b5fc3b656` | `bea5aae656cb9965563889c887c2168b5fc3b656` | 0 / 0 / 0 | integrated |
| `origin/codex/read-stall-watchdog-20261027` | `0fa99d70df341c285fafe6b1dd1213593d897097` | `0fa99d70df341c285fafe6b1dd1213593d897097` | 0 / 0 / 0 | integrated |
| `origin/codex/resume-acceptance-20261024` | `0b448d887df89fab22f701810197e51285590e2b` | `0b448d887df89fab22f701810197e51285590e2b` | 0 / 0 / 0 | integrated |
| `origin/codex/ui-correctness-checkpoint-20261025` | `c0ae8e7aac344add7237b426002510386fc6a433` | `c0ae8e7aac344add7237b426002510386fc6a433` | 0 / 0 / 0 | integrated |
| `origin/codex/unaltered-consolidation-audit-20261104` / #50 | `3811638d929629a0e3cbd83a47ff8a763e2dd15b` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | 1 / 1 / 0 | superseded |
| `origin/codex/unaltered-delivery-20261030` | `f9703929426602e6cf5e7bef16088afb327b1833` | `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd` | 2 / 2 / 0 | integrated |
| `origin/codex/unaltered-signed-candidate-20261030` | `71d40bb116de574e400425249595ea9f1c1d03c8` | `71d40bb116de574e400425249595ea9f1c1d03c8` | 0 / 0 / 0 | integrated |
| `origin/codex/validated-completion` | `e4d80b67d145e940b0458bad93cc069412b39306` | `e4d80b67d145e940b0458bad93cc069412b39306` | 0 / 0 / 0 | integrated |
| `origin/dependabot/github_actions/actions/checkout-7.0.1` | `8061e011f6e9d0c330a108994f786c18785fe927` | `0f6e85a61a055004fc588a9f57a09d8549efaec3` | 1 / 1 / 0 | integrated |
| `origin/dependabot/github_actions/actions/download-artifact-8.0.2` | `4151bf9e6b3e5f4f647d254a0ef3270b31dd60cc` | `0f6e85a61a055004fc588a9f57a09d8549efaec3` | 1 / 1 / 0 | integrated |
| `origin/dependabot/npm_and_yarn/eslint-10.13.0` | `74bb024165c34ea01393e091f59bc2280a092a09` | `74bb024165c34ea01393e091f59bc2280a092a09` | 0 / 0 / 0 | integrated |
| `origin/dependabot/npm_and_yarn/vitest-5.0.5` | `ae1bf4177b71bb1ae80ad7332f14de952264f2f5` | `ae1bf4177b71bb1ae80ad7332f14de952264f2f5` | 0 / 0 / 0 | integrated |
| `origin/diag/read-stall-ab-20261027` | `6f5b6c9ece959e454dd3341f7c0f8012c4431259` | `0fa99d70df341c285fafe6b1dd1213593d897097` | 1 / 1 / 0 | intentionally excluded |
| `origin/diag/read-stall-ab-20261102` | `d77763e8ba9a52f20b22752de273aeb5058f0f4b` | `7a040323f415d0f4c1c48b84e97739451669b00f` | 5 / 5 / 0 | intentionally excluded |
| `origin/docs/readme-and-wiki` | `55ca0501821fe280b0a3888c812b82bb66bca3fa` | `55ca0501821fe280b0a3888c812b82bb66bca3fa` | 0 / 0 / 0 | integrated |
| `origin/fix/accessibility-announcement-race-20261103` / #46 | `edbdbda9f9dc51fc2556223ef832aa8cdba0dade` | `edbdbda9f9dc51fc2556223ef832aa8cdba0dade` | 0 / 0 / 0 | integrated |
| `origin/fix/hash-stall-timeout-validation-20261103` / #43 | `c795702b010e4aec3ff0d29a48dc6c313d69a0ec` | `c795702b010e4aec3ff0d29a48dc6c313d69a0ec` | 0 / 0 / 0 | integrated |
| `origin/fix/metadata-truncated-ftyp-20261103` / #45 | `e8fd5cb9d78dfda80c8933d81ca9d859ff8d33fe` | `e8fd5cb9d78dfda80c8933d81ca9d859ff8d33fe` | 0 / 0 / 0 | integrated |
| `origin/fix/proof-serialization-guard-20261103` / #44 | `7c2f958a32b55b5ea77f53995c024512c1bf40fc` | `7c2f958a32b55b5ea77f53995c024512c1bf40fc` | 0 / 0 / 0 | integrated |
| `origin/main` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | 0 / 0 / 0 | integrated |

## Per-branch functional and security disposition

### origin/automation/api-funded-unaltered-cloud-20261103

Workflow content is identical to cached main (#40) despite differing ancestry.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Its workflow file is byte-identical to `main` (merged by #40); the three-dot diff only reflects an older merge base.

### origin/automation/unaltered-cloud-autointegrate-20261103

Paid scheduled automation/automerge has unresolved governance, scope, spending and failure-backoff defects; do not integrate or enable.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Adds an integrate job that squash-merges AI-generated PRs into `main` after named checks pass, with no human review (finding F1). See the automation review below.

### origin/automation/unaltered-four-parallel-agents-20261103

Paid scheduled automation/automerge has unresolved governance, scope, spending and failure-backoff defects; do not integrate or enable.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Inherits F1. Its path allowlist misses newly added files (F2), and it fans out four paid runs twice a day with no spend cap or failure backoff (F3).

### origin/chatgpt/acceptance-cancellation-20261102

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. `awaitAbortable` and the settled guard (from #38) are present; the single normalized `postMessage` in `tests/e2e/hash-worker-evidence.ts` and the exact host/error `expect.poll` assertion in `tests/e2e/app.spec.ts` are present.

Security: SHA-256, streaming/cancellation and worker lifecycle.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): `awaitAbortable` and the settled guard (from #38) are present; the single normalized `postMessage` in `tests/e2e/hash-worker-evidence.ts` and the exact host/error `expect.poll` assertion in `tests/e2e/app.spec.ts` are present.

### origin/chatgpt/calendar-evidence-20261102

Exact head is an ancestor of recovered candidate.

Security: Workflow permissions, code execution, action pins and review controls; Dependency exact pins/integrity; preserve unrelated local lockfile edits.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor via PR47.

### origin/chatgpt/paper-search-sort-parameter-20261104

Selected unique cancellation/CI/OpenAlex changes already cherry-picked; candidate retains newer #47 source/test hardening. Historical docs/evidence remain at source.

Security: Workflow permissions, code execution, action pins and review controls; Toolkit-only; exclude from application runtime and release bundles.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

### origin/claude/cool-einstein-ekcvh3

The R1 classifier is superseded by `scripts/r1-bob-finney.mjs` and `scripts/lib/r1-calendars.mjs` with target attribution (the earlier false-PASS findings). Gate documents have newer versions. `docs/CLAUDE_TAKEOVER.md` (f7bbf0b) is a stale prompt: not imported. The D10 `NETWORK.md` hunk records an owner decision that is not evidenced: not imported.

Security: Dependency exact pins/integrity; preserve unrelated local lockfile edits.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): The R1 classifier is superseded by `scripts/r1-bob-finney.mjs` and `scripts/lib/r1-calendars.mjs` with target attribution (the earlier false-PASS findings). Gate documents have newer versions. `docs/CLAUDE_TAKEOVER.md` (f7bbf0b) is a stale prompt: not imported. The D10 `NETWORK.md` hunk records an owner decision that is not evidenced: not imported.

### origin/claude/friendly-faraday-papf5c

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. PR25 silence-based stall policy (D6) and its tests are present in a newer form in `src/core/hash/stream.ts` and `tests/unit/hash.test.ts`; the Firefox/WebKit 2 GiB job is in `ci.yml`. Handoff text is already in `HANDOFF.md`.

Security: Workflow permissions, code execution, action pins and review controls; SHA-256, streaming/cancellation and worker lifecycle.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): PR25 silence-based stall policy (D6) and its tests are present in a newer form in `src/core/hash/stream.ts` and `tests/unit/hash.test.ts`; the Firefox/WebKit 2 GiB job is in `ci.yml`. Handoff text is already in `HANDOFF.md`.

### origin/claude/funny-lamport-2jfc0e

Exact head is an ancestor of recovered candidate.

Security: Workflow permissions, code execution, action pins and review controls; SHA-256, streaming/cancellation and worker lifecycle; Proof budget/replay and independent Bitcoin evidence; fail closed; Hostile parser bounds, metadata correctness and resource limits; DOM/URL sinks, stale state, focus and accessibility; Toolkit-only; exclude from application runtime and release bundles; Dependency exact pins/integrity; preserve unrelated local lockfile edits.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Merged with `--no-ff` (two merges: `04a9c1f`, then `d9b4fdc`). PR47 stays open; PR48 supersedes it in its description only.

### origin/claude/hash-stall-progress

The progress-based test name and the `[3, 6, 7]` progress assertion exist in `tests/unit/hash.test.ts`.

Security: SHA-256, streaming/cancellation and worker lifecycle.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): The progress-based test name and the `[3, 6, 7]` progress assertion exist in `tests/unit/hash.test.ts`.

### origin/claude/language-switch-tests

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. `tests/e2e/language-switch.spec.ts` and `docs/proposals/LANGUAGE_SWITCH.md` are byte-identical to the integration tree; the seven U-N1 cases and the string-table notice are present.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): `tests/e2e/language-switch.spec.ts` and `docs/proposals/LANGUAGE_SWITCH.md` are byte-identical to the integration tree; the seven U-N1 cases and the string-table notice are present.

### origin/claude/peaceful-curie-u239yn

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/pending-receipt-cors

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. Unreadable-pending handling (`src/core/ots/calendar.ts`), verify notice, unit tests in `tests/unit/ots-flow.test.ts`, `pendingCors` E2E helper and the WebKit `corsBlockedLookup` filter in `tests/e2e/app.spec.ts` are all present. Copy wording was later consolidated.

Security: Proof budget/replay and independent Bitcoin evidence; fail closed; DOM/URL sinks, stale state, focus and accessibility.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Unreadable-pending handling (`src/core/ots/calendar.ts`), verify notice, unit tests in `tests/unit/ots-flow.test.ts`, `pendingCors` E2E helper and the WebKit `corsBlockedLookup` filter in `tests/e2e/app.spec.ts` are all present. Copy wording was later consolidated.

### origin/claude/project-completion-builds-vhvag8

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/quirky-meitner-0jr3pz

Selected unique cancellation/CI/OpenAlex changes already cherry-picked; candidate retains newer #47 source/test hardening. Historical docs/evidence remain at source.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): This branch.

### origin/claude/responsiveness-flake

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/specs-and-plan

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/stoic-mccarthy-m7xpb8

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/sweet-hypatia-vp4syp

Old foundation is superseded by the current core. The Electron shell and standalone packaging (ADR-008) are rejected by ADR-009 and ADR-011 in `docs/DECISIONS.md`.

Security: SHA-256, streaming/cancellation and worker lifecycle; Proof budget/replay and independent Bitcoin evidence; fail closed; Hostile parser bounds, metadata correctness and resource limits; Dependency exact pins/integrity; preserve unrelated local lockfile edits.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Old foundation is superseded by the current core. The Electron shell and standalone packaging (ADR-008) are rejected by ADR-009 and ADR-011 in `docs/DECISIONS.md`.

### origin/claude/unaltered-continuation-20261029

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/claude/zealous-wozniak-ey71lr

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/accepted-gates-20261028

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/audit-preparation-20261030

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. Raw evidence (`docs/evidence/consolidation-20261030*.{json,zip}`, `docs/FINAL_HANDOFF_20261030.md`) is byte-identical in the tree. The Playwright CLI change is present in `ci.yml`. The hashing commit d09c240 predates #38 and conflicts with the newer stream. Status prose is superseded, and its `SCREEN_READER_SCRIPT.md` would weaken the C.4 "Blocked" rule: not taken.

Security: Workflow permissions, code execution, action pins and review controls; SHA-256, streaming/cancellation and worker lifecycle; Proof budget/replay and independent Bitcoin evidence; fail closed; DOM/URL sinks, stale state, focus and accessibility.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Raw evidence (`docs/evidence/consolidation-20261030*.{json,zip}`, `docs/FINAL_HANDOFF_20261030.md`) is byte-identical in the tree. The Playwright CLI change is present in `ci.yml`. The hashing commit d09c240 predates #38 and conflicts with the newer stream. Status prose is superseded, and its `SCREEN_READER_SCRIPT.md` would weaken the C.4 "Blocked" rule: not taken.

### origin/codex/claude-handoff-20261028

Stale takeover prompt; its handoff section is already in `HANDOFF.md`.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Stale takeover prompt; its handoff section is already in `HANDOFF.md`.

### origin/codex/ordinary-fixes-20261027

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/proposal-language-presentation-20261027

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/read-stall-watchdog-20261027

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/resume-acceptance-20261024

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/ui-correctness-checkpoint-20261025

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/unaltered-consolidation-audit-20261104

Read-only audit advice has been executed selectively; retain source history and this refreshed ledger. PR50 association supplied by current owner, not live GitHub query.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

### origin/codex/unaltered-delivery-20261030

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. The idle-FIFO tests exist (`tests/unit/cli.test.ts`, "rejects an idle FIFO promptly", and the named-pipe case). The `src/cli/run.ts` hunk would revert the later checksum-line escaping and control-name refusal.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): The idle-FIFO tests exist (`tests/unit/cli.test.ts`, "rejects an idle FIFO promptly", and the named-pipe case). The `src/cli/run.ts` hunk would revert the later checksum-line escaping and control-name refusal.

### origin/codex/unaltered-signed-candidate-20261030

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/codex/validated-completion

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/dependabot/github_actions/actions/checkout-7.0.1

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. Every workflow already pins `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, the same SHA as the bump.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Every workflow already pins `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, the same SHA as the bump.

### origin/dependabot/github_actions/actions/download-artifact-8.0.2

Historical content reconciliation plus current blob comparisons; source patch identity alone is not authoritative. `ci.yml` and `release.yml` already pin `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2`.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): `ci.yml` and `release.yml` already pin `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2`.

### origin/dependabot/npm_and_yarn/eslint-10.13.0

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/dependabot/npm_and_yarn/vitest-5.0.5

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/diag/read-stall-ab-20261027

Diagnostic workflows/experiments remain on their source branches; evidence is historical only.

Security: Workflow permissions, code execution, action pins and review controls.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Adds only a do-not-merge diagnostic workflow and holds no evidence files.

### origin/diag/read-stall-ab-20261102

Diagnostic workflows/experiments remain on their source branches; evidence is historical only.

Security: Workflow permissions, code execution, action pins and review controls; SHA-256, streaming/cancellation and worker lifecycle.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Its README requires the workflow and its records to stay on the diagnostic branch, so they are not copied. `docs/diagnostics/read-stall-ab-20261102.md` summarizes the frozen design and records the location, Git blob and SHA-256 of the README and manifest at 98ad3d5 (unchanged at the tip). The source/test commits (a net no-op against the tree) are not taken. Results: run 41561857747.

### origin/docs/readme-and-wiki

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Tip is an ancestor of the integration head.

### origin/fix/accessibility-announcement-race-20261103

Exact head is an ancestor of recovered candidate.

Security: DOM/URL sinks, stale state, focus and accessibility.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor via PR47.

### origin/fix/hash-stall-timeout-validation-20261103

Exact head is an ancestor of recovered candidate.

Security: SHA-256, streaming/cancellation and worker lifecycle.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor via PR47.

### origin/fix/metadata-truncated-ftyp-20261103

Exact head is an ancestor of recovered candidate.

Security: Hostile parser bounds, metadata correctness and resource limits.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor via PR47.

### origin/fix/proof-serialization-guard-20261103

Exact head is an ancestor of recovered candidate.

Security: Proof budget/replay and independent Bitcoin evidence; fail closed.

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor via PR47.

### origin/main

Exact head is an ancestor of recovered candidate.

Security: No new security-sensitive content established beyond inherited tree; source history retained..

Tests: No branch-specific tests executed by this read-only reconciliation worker. Recovered candidate prior handoff reports 313 passing selected unit tests; parent is rerunning baseline.

Cached historical evidence (not a new test result): Ancestor of the integration head.

## Confirmed automation findings (main, PR41 and PR42)

- Main scope guard uses `git ls-files -m -o`, omitting staged-only and deleted changes; privileged publisher does not repeat the allowlist. Agent instructions are not an enforcement boundary.
- PR42 publisher applies a patch without `--index`, then checks only `git diff --name-only`; new files are untracked and invisible. A new `scripts/` or `src/` out-of-lane file is later staged by broad `git add -A -- src tests scripts`. Include untracked and staged/deleted paths, use NUL-delimited output and repeat exact per-lane checks after applying at publisher boundary.
- PR41 and PR42 directly call `gh pr merge` after named check conclusions. No explicit human-review/risk-tier approval validation appears; repository protection may block the call but is not independently verified here. Remove automated merging or require a reviewed maintainer gate; do not rely on author/branch-name matching.
- Runner timeouts and concurrency prevent overlap but are not API token/dollar caps. No measured API usage accounting or persisted failure backoff is implemented. Fail closed for paid runs unless an external project budget plus enforceable per-run budget is established; prefer manual dispatch while unresolved.
- PR42 fans out four paid lanes twice daily and does not add hard spending controls; keep excluded. No workflow was enabled/dispatched by this review.

Suggested separate repair: branch from current main, disable schedules by default and remove integrate job; fail closed on scope mismatches including new/deleted/staged paths at both boundaries, create draft PRs only, retain exact trusted-base binding and exact-head CI, require bounded execution/usage evidence and failure backoff before paid scheduling. Parent must verify any proposed repair before publication.

## Range-diff verification

`git range-diff --no-patch 2592675..9abae9d 2592675..7e8f437` confirms `3c63dda = 9cbc925` and `1f44905 = 0716e69`. The remaining #48-only nonmerge commits are docs/evidence/status. Post-divergence #47 security fixes and recovered fixes stay on the candidate.

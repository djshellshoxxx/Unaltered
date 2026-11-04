# Remote branch and PR reconciliation — 2026-11-04 (UTC)

Integration branch: `claude/quirky-meitner-0jr3pz` (draft [PR48](https://github.com/djshellshoxxx/Unaltered/pull/48)).
Base: the head of draft [PR47](https://github.com/djshellshoxxx/Unaltered/pull/47), `claude/funny-lamport-2jfc0e` at
`d9b4fdc379b4e8d834c05ea6c7328806dc3c2fac`, merged with `--no-ff` on top of `main` `1b6dd91` plus the consolidation
prompt commit `8319087`. No branch was deleted, rebased or force-pushed. No PR was closed, merged or edited except the
description of PR48. This ledger supersedes [BRANCH_LEDGER_20261030.md](BRANCH_LEDGER_20261030.md) where they disagree.

## Method and counts

`git fetch origin --prune` found 43 `origin/*` refs. For every ref the sweep ran `git rev-parse`,
`git merge-base --is-ancestor <ref> HEAD`, `git rev-list --count --no-merges HEAD..<ref>` and `git cherry HEAD <ref>`.
Every non-ancestor commit was then read (`git show`, content comparison against the integration tree, scratch-worktree
cherry-pick trials) and given a verdict. Patch IDs often differ after earlier consolidations, so verdicts compare content,
not patch IDs. The coordinator re-checked the decisive claims (action pins, FIFO tests, byte-identical E2E files,
cancellation helpers) before recording them.

- 26 refs are ancestors of the integration head (0 unique commits).
- 17 refs are not ancestors. They hold 35 patch-unique commits. One evidence record was taken; every other commit is
  already present in different form, superseded, or must not be integrated.
- Open PRs on 2026-11-04: #48 (this branch), #47, #46, #45, #44, #43, #42, #41, #39.

## Branches with unique commits

| Remote branch | Exact tip SHA | Unique commits / patches | Disposition | Evidence |
|---|---|---:|---|---|
| `claude/language-switch-tests` | `4968f4026512b8fe8db0787b3c8bfcb8aebd590a` | 2 / 2 | already integrated (content) | `tests/e2e/language-switch.spec.ts` and `docs/proposals/LANGUAGE_SWITCH.md` are byte-identical to the integration tree; the seven U-N1 cases and the string-table notice are present. |
| `claude/pending-receipt-cors` | `0151ca54868df1f95eb145f741e6b50383844065` | 2 / 2 | already integrated (content) | Unreadable-pending handling (`src/core/ots/calendar.ts`), verify notice, unit tests in `tests/unit/ots-flow.test.ts`, `pendingCors` E2E helper and the WebKit `corsBlockedLookup` filter in `tests/e2e/app.spec.ts` are all present. Copy wording was later consolidated. |
| `claude/cool-einstein-ekcvh3` | `733079e3af5fe8f92bdc5cb077da78f2579aed84` | 2 / 2 | superseded; takeover prompt kept as history only | The R1 classifier is superseded by `scripts/r1-bob-finney.mjs` and `scripts/lib/r1-calendars.mjs` with target attribution (the earlier false-PASS findings). Gate documents have newer versions. `docs/CLAUDE_TAKEOVER.md` (f7bbf0b) is a stale prompt: not imported. The D10 `NETWORK.md` hunk records an owner decision that is not evidenced: not imported. |
| `chatgpt/acceptance-cancellation-20261102` | `03f3ac80cfe6f3014162967b5e05bff95ec350b6` | 3 / 3 | already integrated (content) | `awaitAbortable` and the settled guard (from #38) are present; the single normalized `postMessage` in `tests/e2e/hash-worker-evidence.ts` and the exact host/error `expect.poll` assertion in `tests/e2e/app.spec.ts` are present. |
| `codex/audit-preparation-20261030` | `926e75b41eea8735fe1fe09263f9035e7b5c5c25` | 4 / 4 | already integrated / stale status dropped | Raw evidence (`docs/evidence/consolidation-20261030*.{json,zip}`, `docs/FINAL_HANDOFF_20261030.md`) is byte-identical in the tree. The Playwright CLI change is present in `ci.yml`. The hashing commit d09c240 predates #38 and conflicts with the newer stream. Status prose is superseded, and its `SCREEN_READER_SCRIPT.md` would weaken the C.4 "Blocked" rule: not taken. |
| `codex/unaltered-delivery-20261030` | `f9703929426602e6cf5e7bef16088afb327b1833` | 2 / 2 | already integrated (content) | The idle-FIFO tests exist (`tests/unit/cli.test.ts`, "rejects an idle FIFO promptly", and the named-pipe case). The `src/cli/run.ts` hunk would revert the later checksum-line escaping and control-name refusal. |
| `codex/claude-handoff-20261028` | `d358f6c0d746193d62f92d5239b346517f728ce1` | 1 / 1 | superseded; history only | Stale takeover prompt; its handoff section is already in `HANDOFF.md`. |
| `claude/friendly-faraday-papf5c` | `c4723d4974fd03c2adbe3f0a99b4bfe30b865a49` | 2 / 2 | already integrated (content) | PR25 silence-based stall policy (D6) and its tests are present in a newer form in `src/core/hash/stream.ts` and `tests/unit/hash.test.ts`; the Firefox/WebKit 2 GiB job is in `ci.yml`. Handoff text is already in `HANDOFF.md`. |
| `claude/hash-stall-progress` | `0d4f465652d86bdfd41ee73447b4ce93e3be818f` | 1 / 1 | superseded; leftover test already present | The progress-based test name and the `[3, 6, 7]` progress assertion exist in `tests/unit/hash.test.ts`. |
| `claude/sweet-hypatia-vp4syp` | `78c1b0cef81c67b8979a7732ee0d71c54241dc76` | 2 / 2 | superseded / rejected by ADR | Old foundation is superseded by the current core. The Electron shell and standalone packaging (ADR-008) are rejected by ADR-009 and ADR-011 in `docs/DECISIONS.md`. |
| `dependabot/github_actions/actions/checkout-7.0.1` | `8061e011f6e9d0c330a108994f786c18785fe927` | 1 / 1 | already integrated (content) | Every workflow already pins `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, the same SHA as the bump. |
| `dependabot/github_actions/actions/download-artifact-8.0.2` | `4151bf9e6b3e5f4f647d254a0ef3270b31dd60cc` | 1 / 1 | already integrated (content) | `ci.yml` and `release.yml` already pin `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2`. |
| `diag/read-stall-ab-20261027` | `6f5b6c9ece959e454dd3341f7c0f8012c4431259` | 1 / 1 | diagnostic; code never integrated | Adds only a do-not-merge diagnostic workflow and holds no evidence files. |
| `diag/read-stall-ab-20261102` | `d77763e8ba9a52f20b22752de273aeb5058f0f4b` | 5 / 5 | diagnostic; evidence summarized, not copied | Its README requires the workflow and its records to stay on the diagnostic branch, so they are not copied. `docs/diagnostics/read-stall-ab-20261102.md` summarizes the frozen design and records the location, Git blob and SHA-256 of the README and manifest at 98ad3d5 (unchanged at the tip). The source/test commits (a net no-op against the tree) are not taken. Results: run 41561857747. |
| `automation/unaltered-cloud-autointegrate-20261103` (PR41) | `d35291677bf41355160b61ae9aa9b18eff782aa3` | 1 / 1 | **not integrated: owner decision** | Adds an integrate job that squash-merges AI-generated PRs into `main` after named checks pass, with no human review (finding F1). See the automation review below. |
| `automation/unaltered-four-parallel-agents-20261103` (PR42) | `db519a9e2c279b4f6ba58e3a4d6339723a372bd0` | 3 / 3 | **not integrated** | Inherits F1. Its path allowlist misses newly added files (F2), and it fans out four paid runs twice a day with no spend cap or failure backoff (F3). |
| `automation/api-funded-unaltered-cloud-20261103` | `e5c9b231565f4e15258b9cb8d4309a3ef0b2503a` | 2 / 2 | no-op (identical to main) | Its workflow file is byte-identical to `main` (merged by #40); the three-dot diff only reflects an older merge base. |

## Branches already contained (ancestry)

| Remote branch | Exact tip SHA | Unique commits / patches | Disposition | Evidence |
|---|---|---:|---|---|
| `main` | `1b6dd91be87d1a8c92725439bb87a0517b4156ba` | 0 / 0 | base | Ancestor of the integration head. |
| `claude/funny-lamport-2jfc0e` (PR47) | `d9b4fdc379b4e8d834c05ea6c7328806dc3c2fac` | 0 / 0 | contained in integration | Merged with `--no-ff` (two merges: `04a9c1f`, then `d9b4fdc`). PR47 stays open; PR48 supersedes it in its description only. |
| `claude/quirky-meitner-0jr3pz` (PR48) | integration branch | — | integration branch | This branch. |
| `fix/accessibility-announcement-race-20261103` (PR46) | `edbdbda9f9dc51fc2556223ef832aa8cdba0dade` | 0 / 0 | contained in integration | Ancestor via PR47. |
| `fix/metadata-truncated-ftyp-20261103` (PR45) | `e8fd5cb9d78dfda80c8933d81ca9d859ff8d33fe` | 0 / 0 | contained in integration | Ancestor via PR47. |
| `fix/proof-serialization-guard-20261103` (PR44) | `7c2f958a32b55b5ea77f53995c024512c1bf40fc` | 0 / 0 | contained in integration | Ancestor via PR47. |
| `fix/hash-stall-timeout-validation-20261103` (PR43) | `c795702b010e4aec3ff0d29a48dc6c313d69a0ec` | 0 / 0 | contained in integration | Ancestor via PR47. |
| `chatgpt/calendar-evidence-20261102` (PR39) | `76caf3e84c940ca902540686d4c891e820862fbb` | 0 / 0 | contained in integration | Ancestor via PR47. |
| `claude/peaceful-curie-u239yn` | `4c5dcc44ac0d306276c2e2af9505f02ecc4e6e8f` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/project-completion-builds-vhvag8` | `e740d90d9a71cd0754079d129b5b18b5b45da5f9` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/responsiveness-flake` | `6a9fdcef3c2a4d34fc9b808ef4ba49afe1579ed3` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/specs-and-plan` | `9db67d694005aec772072d7c5c223d601381ceae` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/stoic-mccarthy-m7xpb8` | `21bf07bf99dad4a7aee3cd47aac13e2031f40160` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/unaltered-continuation-20261029` | `a602126c92acbc2f052c15b7992eb3c593309007` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `claude/zealous-wozniak-ey71lr` | `00e390db8faa71a22aac03eb97575dbfad43fe8e` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/accepted-gates-20261028` | `d124dd47971fdff1ef600e27e918d7421f1cbec3` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/ordinary-fixes-20261027` | `6d600249241dc40e252ef22d053b3cb7feb1868c` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/proposal-language-presentation-20261027` | `bea5aae656cb9965563889c887c2168b5fc3b656` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/read-stall-watchdog-20261027` | `0fa99d70df341c285fafe6b1dd1213593d897097` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/resume-acceptance-20261024` | `0b448d887df89fab22f701810197e51285590e2b` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/ui-correctness-checkpoint-20261025` | `c0ae8e7aac344add7237b426002510386fc6a433` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/unaltered-signed-candidate-20261030` | `71d40bb116de574e400425249595ea9f1c1d03c8` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `codex/validated-completion` | `e4d80b67d145e940b0458bad93cc069412b39306` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `dependabot/npm_and_yarn/eslint-10.13.0` | `74bb024165c34ea01393e091f59bc2280a092a09` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `dependabot/npm_and_yarn/vitest-5.0.5` | `ae1bf4177b71bb1ae80ad7332f14de952264f2f5` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |
| `docs/readme-and-wiki` | `55ca0501821fe280b0a3888c812b82bb66bca3fa` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of the integration head. |

## Development lanes (2026-11-04)

Each lane worked in its own worktree on a local `worker/<lane>-20261104` branch off `459cded` and was merged with `--no-ff`
after review. The worker branches were not pushed; their commits are in this branch's history.

| Lane | Head | Result |
|---|---|---|
| W-cancel | `3c63dda9fbf5cf1c4fbca6480bf0c850cca475dc` | Mapped every abortable await in `src/core/hash/stream.ts` and `hasher.ts` to a test. Two paths had no abort test: the non-Blob BYOB read and the yield between chunks. Added `tests/unit/hash-cancel-residual.test.ts` (2 tests). Both pass on current code and both fail when the matching guard is removed (checked locally, not committed). No source change. The worker itself is not abortable mid-read; it is terminated on abort, as already documented. |
| W-deps | `f587b2d7bfaca45e78763df762ea213c5c006b56` | `npm audit`: 11 moderate, all dev-only via `minimatch@10.2.6` (GHSA-g3hv-75wg-m249). `npm audit --omit=dev`: 0. Every latest lint-chain release still declares `minimatch ^10`, so no exact-pin upgrade resolves it. Lockfile unchanged; dated re-verification row added to `docs/DEPENDENCIES.md`. |
| W-ci | `1f44905fd5036ff0ee38b21c658430418b3943d5` | Measured: when runners are free, a full CI run takes about 3.5 minutes. On pull requests the critical path is the Chromium 2 GiB memory job (about 3 minutes). On `main` pushes and dispatches the Firefox/WebKit 2 GiB completion jobs, which are skipped on pull requests, are slightly longer (3m26s–3m43s in runs 102 and 111). Waiting for runners dominates: in run 122 for PR47 (`04a9c1f`), jobs waited up to 85 minutes for a runner. Its Linux build-test job failed on a sha256sum interop test, and the run was cancelled by the concurrency group when `d9b4fdc` was pushed, about 87 minutes after it started. Runs 114–121 were cancelled the same way, superseded by newer pushes. Change: cancel superseded runs only for `push` and `pull_request`; manual dispatches get their own group; `timeout-minutes` on every job. Not changed on purpose: `paths-ignore` (tests and scripts read `docs/*.md`, and a path-skipped required check would stay pending), and the per-push Windows/macOS jobs (they feed the byte-identical cross-platform gate). No job, step or test removed. |
| W-fuzz | see below | The worker returned no report and made no commit. The coordinator ran the campaign instead. |

## Automation review (read-only; nothing integrated or changed)

Scope: PR41, PR42, `automation/api-funded-unaltered-cloud-20261103`, and `.github/workflows/unaltered-codex-cloud.yml` as
already merged to `main` by #40. Line numbers refer to that file on each branch. This is an AI-assisted review, not an
independent audit. Branch protection, rulesets, the token scope of `UNALTERED_GITHUB_TOKEN` and the OpenAI project
spend limit could not be read and are unverified.

| ID | Severity | Where | Finding | Suggested remediation (owner decision) |
|---|---|---|---|---|
| F1 | high | PR41 L11–43; PR42 inherits | An `integrate` job with `contents: write` and `pull-requests: write` runs `gh pr merge --squash --delete-branch` on non-draft `codex/unaltered-cloud-*` PRs once 11 named checks pass. AI-written changes would reach `main` with no human review. The token falls back from `secrets.UNALTERED_GITHUB_TOKEN` to `github.token`. An admin PAT can bypass branch protection when admins are not enforced. | Remove the job, or allow auto-merge only behind a required human approving review or ruleset with no bypass; use a fine-grained token with minimal scope; add CODEOWNERS for `src/core`, `scripts` and `docs/OPSEC.md`. |
| F2 | high | PR42 L259–276 | The lane path allowlist reads `git diff --name-only` after `git apply`, which does not list new untracked files; `git add -A -- src tests scripts` then commits them. A patch can add files outside its lane, and they are pushed and opened as a PR. | Derive the path list from the patch itself (`git apply --numstat`) or from `git status --porcelain`; repeat the check just before packaging. |
| F3 | medium | PR42 L5, L48–53 | Twice a day × 4 lanes = up to 8 paid agent runs per day (65 minutes each). A lane that fails is retried on every schedule with no backoff, and there is no hard spend cap in the workflow. | Set a hard spend limit on the API project; add a consecutive-failure cooldown; start with one lane or one run per day. |
| F4 | medium | `main` L76–108 (also the api-funded branch and PR41) | The protected-path scope check runs **before** `npm run check`. Agent-written tests or scripts executed by the check can still modify protected files afterwards. Packaging and publish do not re-check. The result is still a PR for humans to review. | Repeat the scope check after `npm run check`, and check `git apply --numstat` against the allow and protect lists in the publish job. |
| F5 | low | `main` L45–50, L97–121 | `setup-node` with `cache: npm` saves its cache after agent-controlled code ran in the same job, so the cache could be poisoned. Agent output is uploaded as artifacts that anyone can download from a public repo. | Use restore-only caching (or none) in the agent job; scrub the report before upload; shorten retention. |
| F6 | low | `main` L38 | The run gate counts any PR whose head name starts with `codex/unaltered-cloud-`, including PRs from forks, so anyone can suppress runs. This affects availability only, not cost. The prompt asks the agent to read PR text, which anyone can write. | Filter by head repository and author, as PR41 does; treat PR text as untrusted in the prompt. |
| F7 | low | PR42 L209–282 | The publish checkout keeps persisted credentials while it applies an agent-supplied patch, and it runs under `if: always()`. | Use `persist-credentials: false` and an explicit push token; narrow the condition. |

Good practice found: every action is pinned to a commit SHA; the workflows trigger only on `schedule` and `workflow_dispatch`
(no `pull_request_target` or `issue_comment`); top-level `permissions: {}`; no `${{ github.event.* }}` interpolated into
`run:`; the API key is passed only as an action input, never echoed or put on a command line; timeouts and a concurrency group are set. The GitHub token (`secrets.UNALTERED_GITHUB_TOKEN || github.token`) is exported as `GH_TOKEN` to `run:` steps that call `gh` (on `main`, L169), which is the usual pattern but makes it readable to any command in those steps.

Recommendation: do not integrate PR41 or PR42 without an owner decision on F1. PR42 needs F2 fixed first. The api-funded
branch adds nothing. F4–F6 are standing low-to-medium risks already on `main`. They are reported here and not changed: the
automation workflow is outside this consolidation's scope.

## Owner actions this ledger cannot take

- Decide F1 (autonomous merge to `main`) and set an API spend limit before enabling PR41/PR42 in any form.
- Close or keep the superseded branches and PRs listed above. Nothing was closed or deleted.
- Merge PR48 to `main` (or not) after review. PR47 can then be closed as superseded.

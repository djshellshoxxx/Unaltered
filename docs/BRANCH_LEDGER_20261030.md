# Remote branch and PR reconciliation — 2026-10-30 (America/Los_Angeles)

Base/main: `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd`. Local starting `work` was clean at that same SHA. The parent refreshed all remote heads using Git fetch; this review inspected all 28 `origin/*` refs, including old branches. No branches, PRs, source, index or history were changed by this review.

## Method and counts

For every ref: exact `rev-parse`, `merge-base --is-ancestor <ref> origin/main`, `log origin/main..<ref>`, `cherry origin/main <ref>` and `diff origin/main...<ref>`. `+` counts below are patch-unique non-merge commits reported by `git cherry`, not claims that the resulting content is absent from main. The two old Dependabot patches are the counterexample: distinct patch IDs, same action pins already present on main. All 18 ancestor refs have no unique commits or patches. Ten refs are not ancestors; all were inspected.

| Remote branch | Exact tip SHA | Unmerged commits / unique patches | Disposition | Reason |
|---|---|---:|---|---|
| `claude/cool-einstein-ekcvh3` | `733079e3af5fe8f92bdc5cb077da78f2579aed84` | 2 / 2 | selected selectively / deferred | Selected refreshed human-gate materials; R1 classifier deferred after concrete false-PASS review findings; stale takeover prompt superseded (details below). |
| `claude/friendly-faraday-papf5c` | `c4723d4974fd03c2adbe3f0a99b4bfe30b865a49` | 3 / 2 | selected | PR25 continuation: silence-based hash watchdog, partial-byte resume regressions, Firefox/WebKit completion gate; keep current main action pins and both historical handoffs. |
| `claude/hash-stall-progress` | `0d4f465652d86bdfd41ee73447b4ce93e3be818f` | 1 / 1 | selected selectively / superseded | PR31 overlapping implementation superseded by PR25; retain unique progress assertion and clearer timeout comments. |
| `claude/language-switch-tests` | `4968f4026512b8fe8db0787b3c8bfcb8aebd590a` | 3 / 2 | selected | PR33 seven-case language preservation coverage, upgraded notice from string table, proposal evidence. |
| `claude/peaceful-curie-u239yn` | `4c5dcc44ac0d306276c2e2af9505f02ecc4e6e8f` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/pending-receipt-cors` | `0151ca54868df1f95eb145f741e6b50383844065` | 3 / 2 | selected | PR30 conservative unreadable pending handling, unit tests, realistic CORS mocks and scoped WebKit error handling; reconcile shared helper with PR33. |
| `claude/project-completion-builds-vhvag8` | `e740d90d9a71cd0754079d129b5b18b5b45da5f9` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/responsiveness-flake` | `6a9fdcef3c2a4d34fc9b808ef4ba49afe1579ed3` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/specs-and-plan` | `9db67d694005aec772072d7c5c223d601381ceae` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/stoic-mccarthy-m7xpb8` | `21bf07bf99dad4a7aee3cd47aac13e2031f40160` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/sweet-hypatia-vp4syp` | `78c1b0cef81c67b8979a7732ee0d71c54241dc76` | 2 / 2 | superseded / deferred | Older foundation is superseded by implemented current core; Electron desktop shell and standalone packaging conflict with accepted ADR009/011 and add unrelated runtime/distribution scope. |
| `claude/unaltered-continuation-20261029` | `a602126c92acbc2f052c15b7992eb3c593309007` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `claude/zealous-wozniak-ey71lr` | `00e390db8faa71a22aac03eb97575dbfad43fe8e` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/accepted-gates-20261028` | `d124dd47971fdff1ef600e27e918d7421f1cbec3` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/claude-handoff-20261028` | `d358f6c0d746193d62f92d5239b346517f728ce1` | 1 / 1 | superseded | Documentation-only takeover prompt carried by f7bbf0b on cool-einstein, exact prompt blob identical; current request replaces old ownership/merge advice. |
| `codex/ordinary-fixes-20261027` | `6d600249241dc40e252ef22d053b3cb7feb1868c` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/proposal-language-presentation-20261027` | `bea5aae656cb9965563889c887c2168b5fc3b656` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/read-stall-watchdog-20261027` | `0fa99d70df341c285fafe6b1dd1213593d897097` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/resume-acceptance-20261024` | `0b448d887df89fab22f701810197e51285590e2b` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/ui-correctness-checkpoint-20261025` | `c0ae8e7aac344add7237b426002510386fc6a433` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `codex/validated-completion` | `e4d80b67d145e940b0458bad93cc069412b39306` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `dependabot/github_actions/actions/checkout-7.0.1` | `8061e011f6e9d0c330a108994f786c18785fe927` | 1 / 1 | already integrated (content) | Unique patch ID due old context; exact checkout3d3c42e target applied on every use by21bf07b (PR26), including later R1 job. |
| `dependabot/github_actions/actions/download-artifact-8.0.2` | `4151bf9e6b3e5f4f647d254a0ef3270b31dd60cc` | 1 / 1 | already integrated (content) | Unique patch ID due old context; exact download-artifact9000827 target applied on every use by21bf07b (PR26). |
| `dependabot/npm_and_yarn/eslint-10.13.0` | `74bb024165c34ea01393e091f59bc2280a092a09` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `dependabot/npm_and_yarn/vitest-5.0.5` | `ae1bf4177b71bb1ae80ad7332f14de952264f2f5` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `diag/read-stall-ab-20261027` | `6f5b6c9ece959e454dd3341f7c0f8012c4431259` | 1 / 1 | diagnostic-only | Workflow explicitly says DO NOT MERGE; historical eight-shard baseline/watchdog comparison only, with old source/pins. Keep isolated; repeat candidate comparison without shipping diagnostic workflow. |
| `docs/readme-and-wiki` | `55ca0501821fe280b0a3888c812b82bb66bca3fa` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |
| `main` | `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd` | 0 / 0 | already integrated (ancestry) | Tip is an ancestor of current main; zero unique unmerged work. |

## Unique work inspected and overlap resolution

- PR25: `73fc82e` product/tests/workflow plus `92e2420` historical handoff; `c4723d4` merges current main. Select the richer silence/partial/resume implementation. Its added CI block uses old checkout/setup-node/upload pins; transplant the block with current verified full-SHA pins. Firefox/WebKit completion is not memory-ceiling evidence.
- PR31: `0d4f465` changes only hash stream and unit tests. Its implementation overlaps PR25; retain its progress assertion and comments by reconciliation, without applying both hash loops. The PR notes buffer retention and cancellation latency; those are review inputs requiring demonstrated-defect investigation.
- PR30: `c98f121` pending-network handling/tests/docs, `fcb51cd` merge main, `0151ca5` narrowly recognizes WebKit page errors from intentionally blocked calendar CORS. `NET_FAILED` is ambiguous; no outage may become confirmed or VERIFIED, and failed receipts must stay unchanged.
- PR33: `e399a25` adds three receipt/upgrade language-switch cases to four existing ones, `db2f75b` merge, `4968f40` uses the authoritative upgraded-receipt string. Its helpers share network mocks with PR30; final combined tests are required.
- `118be50` on sweet-hypatia: inspected the 39-file early foundation (lock/config, byte/error helpers, stub hash/net/OTS/strip APIs, tests and imported upstream fixtures). Current main has the implemented APIs, newer exact reviewed toolchain, stricter allowlist and synthetic reference corpus. Do not restore old stubs, obsolete npm peer override, fourth calendar or foreign-licensed fixture copies. Existing R1 uses upstream examples only in scratch according to the documented procedure.
- `78c1b0c` on sweet-hypatia: inspected the eight-file Electron shell, scheme/request/path policy, Windows portable runtime builder and tests. Accepted ADR009/011 explicitly reject native wrappers; defer the whole shell/test/builder family until a separately authorized ADR. No missing applicable product fix was found.
- `8061e01` and `4151bf9`: old-context full-SHA action updates. Main `21bf07b` already applied their exact targets consistently to CI/release; no missing action use remains. Keep full-SHA pinning when adding PR25 job.
- `6f5b6c9`: diagnostic-only eight-shard A/B workflow restores baseline `0b448d8` hash source. Preserve it as historical diagnostic evidence. It must not enter production workflows; repeat with candidate SHA on a separate diagnostic branch when authorized/available.
- `d358f6c` and `f7bbf0b`: historical takeover/handoff preservation. `docs/CLAUDE_TAKEOVER.md` has identical blob `448f628bde76e8baec849941f1cf5e7cd68f1af2` in both. Preserve old notes as dated history if imported; do not use their stale PR28-before-PR29 plan or ownership instructions as today's status.
- Existing unapplied diagnostic patches `docs/diagnostics/minimum-read-experiment.patch`, `pending-cancel-fixtures.patch`, `unapplied-delay-experiment.patch` remain unapplied; do not turn old failed experiments into production changes.

### Additional compatible work discovered on `733079e`

This remote branch was absent from the request's starting evidence and contains two unique commits. Its new files are useful audit-preparation material, not completed acceptance:

| File/group | Suggested treatment | Reason / residual |
|---|---|---|
| `docs/gates/SCREEN_READER_SCRIPT.md` | Select and refresh | Executable human accessibility/usability test script; does not close human gates. It currently mentions phone-photo fixture; advise synthetic throwaway fixture to follow repository fixture/privacy policy. |
| `docs/gates/SPANISH_STRINGS_20261030.md` | Select and refresh | 162-key EN/ES review table based on main595fd06, with PR30 unreadable string in proposed section. Final candidate needs refreshed source/wording; every Spanish string remains native-unreviewed. |
| `scripts/lib/r1-calendars.mjs`, `scripts/r1-bob-finney.mjs`, `tests/r1/r1-calendars.test.mjs`, package test entry | Deferred, diagnostic-only on original branch | Opt-in no-submission runner wraps existing real-browser R1 once and reports Bob/Finney per-host outcomes; four offline tests. Diagnostic parser uses host byte-search precheck, not proof validation; receipt and confirmed semantics come from app/reference acceptance. Do not equate HTTP200 alone with Bitcoin confirmation. |
| `docs/R1_BOB_FINNEY_TEMPLATE.md` | Deferred with the runner | Makes residual evidence/next action concrete. Its old "waits for owner to ask" text is superseded by current explicit acceptance authorization; availability of an old-enough Bob/Finney receipt remains a real input constraint. |
| `docs/NETWORK.md` D10 section | Reconcile with current request | Branch records an owner decision accepting pending404 CORS as known limitation. This review cannot independently authenticate that conversation. Preserve as dated historical branch evidence; current request itself requires conservative pending and honest open residuals. |
| `docs/CLAUDE_TAKEOVER.md`, historical HANDOFF section | Superseded by current handoff | Same stale prompt as d358f6c; no product code. Preserve historical evidence in original refs; avoid making stale refs authoritative. |

## PR reviews and CI refreshed through GitHub connector

All four PRs are open drafts. Review submission and inline review-thread APIs returned empty lists for each. CodeRabbit comments on25/30/33 say draft PRs were not reviewed automatically. This is not independent audit acceptance. No bot review was requested and no paid API was used.

| PR | Exact source head | Actions run (PR event) | Combined commit statuses | Other evidence |
|---|---|---|---|---|
| [25](https://github.com/djshellshoxxx/Unaltered/pull/25) | `c4723d4974fd03c2adbe3f0a99b4bfe30b865a49` | [41063402505](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505), success | Snyk success | Sonar comment reports C security rating on new code, quality gate failed; issue details unavailable through this connector. FF/WebKit2GiB explicitly skipped. |
| [30](https://github.com/djshellshoxxx/Unaltered/pull/30) | `0151ca54868df1f95eb145f741e6b50383844065` | [41061412548](https://github.com/djshellshoxxx/Unaltered/actions/runs/41061412548), success | Snyk success | Sonar comment says passed. |
| [31](https://github.com/djshellshoxxx/Unaltered/pull/31) | `0d4f465652d86bdfd41ee73447b4ce93e3be818f` | [41004188309](https://github.com/djshellshoxxx/Unaltered/actions/runs/41004188309), success | Empty list | Sonar comment says passed. |
| [33](https://github.com/djshellshoxxx/Unaltered/pull/33) | `4968f4026512b8fe8db0787b3c8bfcb8aebd590a` | [41062162123](https://github.com/djshellshoxxx/Unaltered/actions/runs/41062162123), success | Snyk success | Sonar comment says passed. |

Each Actions run has success for11 required jobs (OPSEC, secret scan, Linux, Windows, macOS, cross-OS byte identity, Chromium/Firefox/WebKit E2E, Chromium2GiB, reference differential); R1 informational job also success; live-service informational job failure. Job statuses alone do not show absence of retries. Only PR25 selected logs were inspected for retries here (see below). Combined commit status is a different API from Actions checks; its Snyk-only/empty result cannot establish CI acceptance.

PR25 [Sonar failed comment](https://github.com/djshellshoxxx/Unaltered/pull/25#issuecomment-6523973775) is an unresolved external review signal. Direct `gh api .../check-runs` attempted with supported network path returned Forbidden; no secret inspection or bypass was attempted. Owner can inspect Sonar issue details on that PR or obtain check-run annotations using an authorized GitHub API path. Do not mark it resolved merely because Actions succeeded.

### Exact executed SHA from inspected PR25 logs

Logs show checkout of GitHub synthetic merge `a1c27a8437420b52fa55a98e1d5a9073da3053e5` = headc4723d4 merged into baseda9b0a3. Thus tests are PR-context evidence at that merge, not literal standalone head acceptance, and never acceptance of the new consolidation candidate.

- [Linux124088535392](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088535392):160 Vitest passes,2 skips (reference not configured in that job, optional Node2GiB); five Node regressions pass; provenance and double build pass.
- [Chromium124088535900](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088535900), [Firefox124088536022](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088536022), [WebKit124088536047](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088536047):56 passes/1 optional2GiB skip each; no retry/flaky markers in inspected logs. CI config still permits one ordinary E2E retry generally.
- [Chromium2GiB124088535946](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088535946):three passes with `--repeat-each=3 --retries=0 --max-failures=1`; unchanged540s and<200MiB gate. FF/WebKit completion job124088537686 is skipped by event condition.
- [R1 browser/reference124088536397](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088536397):real browser `classification=PASS`; Python on same downloaded receipt reports `digestMatches=true`, `verifiedTime=1473227803`, `ok=true`, block428648. Alice-only historical context; Bob/Finney remain unestablished. This is not candidate R1 evidence.
- [Live check124088536236](https://github.com/djshellshoxxx/Unaltered/actions/runs/41063402505/job/124088536236):three failed checks, informational. It runs from Node and cannot prove browser CORS success.

## Existing integrated PRs / historical dispositions

Main ancestry verifies PR28 (`1112c66`), PR29 (`595fd06`), PR32 (`da9b0a3`) integrated. The same ancestry includes PR26 pins (`9f06c46`), PR27 TypeScript-ESLint (`3ee0144`), PR18 ESLint, PR21 Vitest, PR22 axe/Playwright, PR23 Playwright, PR24 language/pins/docs context, PR11 watchdog integration, PR8 ordinary fixes, PR7 UI correctness and PR6 baseline integration. Prior diagnostic PR12 remains historical/closed, not integrated production content. Desktop proposal remains superseded by ADR009/011. No PRs were closed or merged in this task.

## Evidence files

`branches-initial.json` retains every ref, exact unique commit list, cherry results and changed-file stat. `pr-discussions.json` retains refreshed discussion bodies without HTML; `pr-ci-reviews.json` retains job/step and review-thread data; `pr-ci-summary.json` is compact job data. Selected raw logs are `job-124088*.txt` (JSON-wrapped connector log payload). These are scratch evidence for the integrator to preserve or summarize into the final handoff.

Independent work on this task is complete. Final disposition of selectively recommended files and all final-candidate tests/CI must be recorded by the integrator, who owns source modifications and publication.

## Final integration decisions

Selected #25/#30/#33 changes, and #31 comments plus full progress-assertion test. Main full-SHA pins were retained in
#25 added job. Kept its non-PR Firefox/WebKit completion condition; manual dispatch is still required for that gate.

Selected only the two human gate documents from733079e, using synthetic fixtures and current163-key strings with the
clarified outage/pending notice. They prepare human work and close no human acceptance.

Deferred the optional Bob/Finney scripts/helper/tests, package test entry and result template. Independent review
reproduced a false PASS: a malformed HTTP200 rejected by the app for Bob could be labeled CONFIRMED_READABLE when
Alice independently made the overall app run pass. A valid but still-pending200 body also lacks per-target confirmation
attribution. These diagnostics need target-specific accepted Bitcoin-attestation evidence before they can claim that
target's confirmed path. Their original branch/history is intact; none of that runner enters this candidate. Use the
existing R1_ACCEPTANCE procedure with an appropriate pre-existing target receipt and independent verification instead.

The historical PR25 handoff sections are preserved in HANDOFF.md, with the current consolidation status prepended.
The older takeover prompt remains in its original refs, superseded rather than copied into current instructions.
Current source/test SHA, actual candidate acceptance, residual owners and recovery are in CONSOLIDATION_20261030.md.

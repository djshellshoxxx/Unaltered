# Branch consolidation ledger — 2026-11-19 continuation

Recorded 2026-11-20 UTC by the fresh second code-audit worker. Comparison candidate:
`53f62eb70d83f92ce174e30412a4ff2ab95a85ac` on the local completion branch. This is a local, pinned comparison;
it is not a claim that the candidate has been pushed, merged, deployed, or qualified on remote CI.
The machine-readable companion is [branch-inventory-20261119.json](../evidence/branch-inventory-20261119.json).
It records full branch heads, merge bases, changed paths, identical/differing path lists, and the disposition for every row.

## Scope and result

There are **94 actual remote branches**, plus the symbolic `origin/HEAD -> origin/main` reference. The initial
95-entry inventory counted that symbolic reference as a branch: `%(refname:short)` can render it as `origin`, so
filtering only the string `origin/HEAD` does not exclude it. Full ref names and `%(symref)` establish the corrected count.

| Relationship to the pinned candidate | Branches | Meaning |
|---|---:|---|
| Ancestor heads | 41 | The branch head is contained by ancestry; do not replay it. |
| Nonancestor, every changed-file blob identical | 6 | Squash/rebase history differs, while every path changed by the branch already has the same candidate blob. |
| Nonancestor, only documentation/history blobs differ | 12 | Includes one historical deployment template; source/test changes are represented and the template is reviewed separately. |
| Nonancestor, some source/test/workflow/dependency blobs differ | 35 | Requires semantic review; a differing blob alone does not establish missing functionality. |
| **Total actual branches** | **94** | All are listed below and pinned in the companion JSON. |

The review found one small missing Pages preparation change: PR53's npm dependency cache. It is recovered in
`b554ea8`, with matching installed/template preparation steps and their explicit contract updated in `2eb0c12`.
The security worker recovered the separately identified PR52 scope guard in `681eedd` and the offline cloud policy
from `75ac0e9` in `b748441`. No missing applicable app behavior was found in the other reviewed differences.
Older feature branches are represented by current implementations, while historical reports, diagnostic workflows,
new automation activation, native-wrapper proposals, and unqualified dependency bumps retain separate dispositions.

This review did not delete branches, bulk-merge their old trees, or change remote PR state. PR close/merge decisions
must refer to the integrated and qualified candidate, not merely this ledger.

## Method and evidence limits

1. Enumerate `refs/remotes/origin` with full ref names and symbolic targets; exclude symbolic refs before counting.
2. Pin the candidate and each head. Check `git merge-base --is-ancestor <head> <candidate>` independently.
3. For nonancestors, compute the merge base and list branch changes with `git diff --name-only <base> <head>`.
   Compare the branch and candidate blobs for each changed path. A deletion is an explicit missing-blob comparison.
   Compare file modes/types as well; no changed-path mode/type differences were found for existing files in this snapshot.
4. Inspect differing source, tests, workflows, and documents against current behavior and the earlier
   [PR backlog ledger](PR_BACKLOG_20261111.md). For selected nonancestor product branches, use the read-only
   `git merge-tree --write-tree --name-only <candidate> <head>` preview to distinguish conflict/history from remaining content.
5. Recover only demonstrated missing changes, with focused regression or contract checks. Preserve other unique content
   on its existing branch and record why it is not part of this candidate.

`git cherry` patch-id uniqueness is insufficient here because earlier work was often squash-merged. Conversely,
"Superseded" below is a source/test review conclusion, not a formal semantic equivalence proof. It means the intended
applicable behavior found in that branch's reviewed changes is represented by the later candidate. Differences limited
to historical handoffs are retained as history rather than overwriting current completion status. The complete original
heads remain recoverable from their named branches and full IDs in the companion file.

The comparison baseline intentionally stays `53f62eb`. The new recovery/repair commits named below are **follow-up
local commits**, so table blob counts describe the baseline before those repairs. Other worker test results are explicitly
attributed. This worker did not rerun a full typecheck, native-browser matrix, hosted Pages deployment, or remote CI.

## Per-branch disposition

Branch names are relative to `origin/`. `Same/different` counts apply only to paths changed from that branch's merge
base to its head, compared with the pinned candidate. `—` means ancestry already proves containment. Evidence keys
refer to the review notes below; full hashes and exact path lists are in the companion JSON.

| Branch | Head | Same/different | Disposition | Evidence |
|---|---|---:|---|---|
| `automation/api-funded-unaltered-cloud-20261103` | `e5c9b2315` | 1/0 | Equivalent | Changed workflow blob is identical. This is an inventory finding, not an activation or dispatch. E1. |
| `automation/unaltered-cloud-autointegrate-20261103` | `d35291677` | 0/1 | Deferred | PR41 has a unique automation workflow; keep separate from product consolidation and do not activate. A1. |
| `automation/unaltered-four-parallel-agents-20261103` | `db519a9e2` | 0/1 | Deferred | PR42 adds the four-agent automation variant; keep separate and do not activate. A1. |
| `chatgpt/acceptance-cancellation-20261102` | `03f3ac80c` | 2/7 | Superseded | Later hash streaming, cancellation, and stall controls cover the reviewed fixes; replay conflicts with current implementation. H1. |
| `chatgpt/accessibility-help-20261112` | `804b38321` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/archival-qr-optimizer-20261108` | `cb703a470` | 6/15 | Superseded | QR planning, printing, recovery, and fixtures have later integrated implementations with stricter bounds. Q1. |
| `chatgpt/archival-qr-protocol-phase1-20261108` | `ab46b7ae6` | 0/3 | Superseded | Initial frame transport is represented by the current guarded frame protocol and independent vectors. Q1. |
| `chatgpt/browser-compat-20261112` | `010d6b028` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/calendar-evidence-20261102` | `76caf3e84` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/cli-docs-20261112` | `9ae07434d` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/context-help-language-menu-20261108` | `9eacdd93e` | 0/7 | Superseded | PR64 help behavior restored in `41e6314`; radio language controls retain the documented WebKit/CSP compatibility decision. U1. |
| `chatgpt/docs-refresh-20261112` | `29a828df8` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/evidence-report-phase1-20261108` | `4a2b253e3` | 2/18 | Superseded | Reports, batch matching, dashboard, and capability features are present with later snapshot, cancellation, and bounds fixes. R1. |
| `chatgpt/localization-20261112` | `0b9169116` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/modern-ui-refresh-20261108` | `3a0a4b07b` | 2/1 | Superseded | Two changed blobs are identical; only earlier CSS differs. Later presentation retains product behavior. U1. |
| `chatgpt/pages-beta-ux-20261108` | `9ca6454a0` | 0/5 | Superseded | PR58 landing/process guide/help intent is represented by current Pages presentation and contextual help. U1. |
| `chatgpt/pages-presentation-preserve-features-20261112` | `c8d87770b` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/pages-readiness-npm-cache-20261105` | `092829b8a` | 0/1 | Recovered | PR53 contained one missing cache setting; recovered in `b554ea8` and kept consistent across publication/template steps in `2eb0c12`. C1. |
| `chatgpt/pages-release-automation-20261112` | `d11a1c66f` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/paper-search-sort-parameter-20261104` | `dde46eab7` | 6/6 | Superseded | Search sort script and regression test are among six identical changed blobs; other differences are earlier CI/hash tests and notes. R2. |
| `chatgpt/qr-recovery-favicon-integration-20261108` | `177cd3298` | 25/29 | Superseded | QR recovery/favicon stack has later integrated hardened implementations; 25 changed blobs already identical. Q1. |
| `chatgpt/repeat-file-selection-fix-20261108` | `72c796707` | 0/2 | Superseded | Current dropZone resets input before callbacks and retains repeat-selection regression coverage. U1. |
| `chatgpt/seo-hardening-20261112` | `7fddeb6a7` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `chatgpt/unaltered-cdl-seo-20261108` | `311ec0242` | 0/4 | Superseded | PR63 visual identity and hosted metadata intent represented by later presentation/SEO work; portable archives remain portable. U1. |
| `chatgpt/zero-codex-continuation-spec-20261109` | `5b03393f9` | 1/0 | Equivalent | The sole changed continuation-spec file is identical. E1. |
| `chatgpt/zero-codex/audit-png-20261110` | `3f3086e4f` | 1/0 | Equivalent | The sole changed audit-ledger file is identical. E1. |
| `chatgpt/zero-codex/batch-cancel-result-20261110` | `64a7a8213` | 2/1 | Represented | Both source/test blobs identical; only rolling historical handoff differs. R1. |
| `chatgpt/zero-codex/batch-empty-names-20261110` | `6dfcfdfd6` | 2/1 | Represented | Both source/test blobs identical; only rolling historical handoff differs. R1. |
| `chatgpt/zero-codex/dashboard-time-order-20261110` | `a2f0c62d0` | 2/1 | Represented | Both source/test blobs identical; only rolling historical handoff differs. R1. |
| `chatgpt/zero-codex/docs-wiki-20261110` | `260719ebe` | 3/5 | Superseded | Three changed files identical; five wiki/handoff files differ from later maintained documentation. Preserve old history. D1. |
| `chatgpt/zero-codex/evidence-zip-snapshot-20261110` | `aa2382bfe` | 2/1 | Represented | Both source/test blobs identical; only rolling historical handoff differs. R1. |
| `chatgpt/zero-codex/qr-plan-page-limit-20261110` | `90031b315` | 2/1 | Represented | Both planner/test blobs identical; only rolling historical handoff differs. Q1. |
| `claude/busy-albattani-o9cgal` | `05f9628fe` | 31/24 | Superseded | Earlier QR consolidation stack is represented by current modules; 31 changed blobs already identical. Q1. |
| `claude/cool-einstein-ekcvh3` | `733079e3a` | 0/10 | Superseded | Later calendar parser and per-target reference evidence replace older global/byte-search diagnostics. N1. |
| `claude/docs-screenshots` | `903e425a8` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/friendly-faraday-papf5c` | `c4723d497` | 0/5 | Superseded | Original silence-based watchdog behavior is retained with later cancellation/read protections. H1. |
| `claude/funny-lamport-2jfc0e` | `2592675cb` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/great-darwin-elcc18` | `c4e43c7b9` | 2/8 | Represented | PR71 CLI implementation and parity test blobs identical; current certificate source validation additionally normalizes URLs and rejects sparse arrays. R2/Q1. |
| `claude/hash-stall-progress` | `0d4f46565` | 0/2 | Superseded | Progress-aware stall semantics retained in current streaming implementation and later regression coverage. H1. |
| `claude/hopeful-franklin-r1ey6w` | `560bb400a` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/integration-branch-setup-kfre6o` | `9d07238f3` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/language-switch-tests` | `4968f4026` | 2/0 | Equivalent | Both changed test files are identical. E1. |
| `claude/peaceful-curie-u239yn` | `4c5dcc44a` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/pending-receipt-cors` | `0151ca548` | 1/6 | Superseded | Current unreadable-pending wording and canary evidence avoid false pending claims; later reference fallback retained. N1. |
| `claude/project-completion-builds-vhvag8` | `e740d90d9` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/quirky-meitner-0jr3pz` | `d74bb6167` | 4/4 | Represented | Four changed blobs identical; only four historical handoff/dependency/fuzzing/TODO notes differ. D1. |
| `claude/responsiveness-flake` | `6a9fdcef3` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/specs-and-plan` | `9db67d694` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/stoic-mccarthy-m7xpb8` | `21bf07bf9` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/sweet-hypatia-vp4syp` | `78c1b0cef` | 0/46 | Architecture deferred | Native wrapper/standalone executable conflicts with accepted ADR009/011; no missing applicable product fix found in reviewed foundation. D2. |
| `claude/tender-maxwell-pqw6jc` | `18cfbdd97` | 0/10 | Historical | Ten stopped-run notes/partial patches explicitly unreviewed; preserve for provenance, do not apply unfinished patches. D1. |
| `claude/unaltered-continuation-20261029` | `a602126c9` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `claude/zealous-wozniak-ey71lr` | `00e390db8` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/accepted-gates-20261028` | `d124dd479` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/audit-preparation-20261030` | `926e75b41` | 11/16 | Superseded | Earlier integration and qualification work is represented by later hash/OTS/verification/gate implementations. H1/Q1/N1. |
| `codex/audit-sweep-20261105` | `63861fc18` | 7/2 | Represented | Seven changed blobs identical; codec merge preview has no source delta, and current reference test covers qualified 0.4.5/0.5.0 semantics. R2. |
| `codex/automation-scope-guards-20261104` | `269118949` | 0/4 | Security recovery | PR52 unique scope guard recovered/hardened in `681eedd`; security worker owns integration and verification. A2. |
| `codex/bugs-sweep-20261105` | `211daca21` | 7/4 | Superseded | Seven changed blobs identical; remaining UI source evolved with retained behaviors and current tests. U1. |
| `codex/certificate-context-20261109` | `c8805ec3f` | 6/3 | Superseded | Six changed blobs identical; current certificate context validation and input/proof lifecycles replace earlier variants. Q1/U1. |
| `codex/claude-handoff-20261028` | `d358f6c0d` | 0/2 | Historical | Two unique earlier takeover/handoff documents retained on their branch; do not replace current handoff with stale state. D1. |
| `codex/cloud-policy-20261106` | `75ac0e972` | 0/6 | Security recovery | Offline admission policy source/tests recovered in `b748441`; remains unwired to paid execution and requires explicit opt-in. A2. |
| `codex/native-ci-20261106` | `666491320` | 2/0 | Equivalent | Both changed native-CI-related files are identical. E1. |
| `codex/ordinary-fixes-20261027` | `6d6002492` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/pages-preparation-20261105` | `5d587bcdd` | 2/1 | Superseded | Two changed files identical; current deployment template includes later preflight and metadata checks. C1. |
| `codex/proposal-language-presentation-20261027` | `bea5aae65` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/qr-certificate-review-20261109` | `788bed35a` | 7/11 | Superseded | Seven changed blobs identical; later certificate escaping, opt-in metadata, language controls, and stale-proof handling retained. Q1/U1. |
| `codex/read-stall-watchdog-20261027` | `0fa99d70d` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/recover-qualify-20261104` | `a2f224e0a` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/resume-acceptance-20261024` | `0b448d887` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/security-sweep-20261105` | `74a0cc0e1` | 2/0 | Equivalent | Both changed security source/test files are identical. E1. |
| `codex/ui-correctness-checkpoint-20261025` | `c0ae8e7aa` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/unaltered-completion-20261119` | `abc6ff24c` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/unaltered-consolidation-audit-20261104` | `3811638d9` | 0/1 | Historical | One unique earlier audit report retained for provenance; conclusions are time-bound. D1. |
| `codex/unaltered-delivery-20261030` | `f97039294` | 1/1 | Superseded | One changed blob identical; current CLI contains later safe error/control-name/file-read handling. R2. |
| `codex/unaltered-signed-candidate-20261030` | `71d40bb11` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `codex/validated-completion` | `e4d80b67d` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `dependabot/github_actions/actions/checkout-7.0.1` | `8061e011f` | 0/2 | Represented | Current action pin matches; read-only merge preview produces no product-file delta. P1. |
| `dependabot/github_actions/actions/download-artifact-8.0.2` | `4151bf9e6` | 0/2 | Represented | Current action pin matches; read-only merge preview produces no product-file delta. P1. |
| `dependabot/github_actions/peter-evans/create-pull-request-8.1.2` | `d7998cb2a` | 0/1 | Deferred | PR91 is a genuinely pending automation dependency bump; retain separate until its exact head is qualified. P1. |
| `dependabot/npm_and_yarn/eslint-10.13.0` | `74bb02416` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `dependabot/npm_and_yarn/eslint-10.14.0` | `4533947bc` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `dependabot/npm_and_yarn/playwright/test-1.65.0` | `9280ced35` | 0/2 | Deferred | PR92 is a genuinely pending browser-tool dependency bump; exact-head Firefox qualification remains unresolved. P1. |
| `dependabot/npm_and_yarn/vitest-5.0.5` | `ae1bf4177` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `dependabot/npm_and_yarn/vitest-5.1.0` | `bffb0fea8` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `diag/read-stall-ab-20261027` | `6f5b6c9ec` | 0/1 | Historical | Unique diagnostic workflow is separate investigation tooling; do not activate through product consolidation. H1. |
| `diag/read-stall-ab-20261102` | `d77763e8b` | 2/10 | Historical | Later diagnostic workflow plus superseded hash patches; preserve investigation history without activation. H1. |
| `docs/readme-and-wiki` | `55ca05018` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `fix/accessibility-announcement-race-20261103` | `edbdbda9f` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `fix/hash-stall-timeout-validation-20261103` | `c795702b0` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `fix/metadata-truncated-ftyp-20261103` | `e8fd5cb9d` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `fix/proof-serialization-guard-20261103` | `7c2f958a3` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `integration/recover-pages-and-cli-20261116` | `0fca4a876` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `main` | `d48b08a57` | — | Included | Head is an ancestor of the comparison candidate; replay is unnecessary. A0. |
| `security/red-team-audit-20261115` | `1467fc7cf` | 0/5 | Historical/reconciled | Five unique reports retained; current repairs and residual measurement work mapped below rather than copying stale all-open status. S1. |

## Review notes

### A0 / E1 — Containment and exact changed-file equivalence

The ancestry rows are complete inclusion evidence at the pinned candidate. In particular, the heads associated with
PR84, PR85, PR90, PR93, and PR94 are ancestors, as are the integrated Pages/browser/accessibility/localization/CLI
branches and the remote completion head `abc6ff2`. This does not by itself close those PRs or establish current CI.

For the six E1 rows, every branch-changed path has the identical blob in the candidate. The comparison makes no claim
that the entire branch tree equals the candidate; the candidate contains additional work. The zero-codex cancellation,
empty-name, dashboard ordering, evidence ZIP, and QR page-limit fixes likewise have identical source/test blobs, with
only a rolling handoff differing. Those diffs should not be replayed just to import an old status note.

### C1 — Pages preparation cache recovered without changing publication behavior

PR53's original `092829b8a57e01acaf4c2ca257c79ed5c311906e` adds `cache: npm` to the existing pinned setup-node
step. The baseline still lacked it. `b554ea8` takes that exact change. `2eb0c12` applies the same setting to
`.github/workflows/pages-deployment.yml` and `docs/templates/pages-deployment.yml` because the existing preparation
contract requires these steps to match readiness. `tests/unit/pages-preparation-template.test.ts` now explicitly expects
the intended cache input; the authorization/preflight contract and preparation comparisons remain intact.

The workflows retain their manual triggers, publication authorization, action pins, and validation stages. The older
`codex/pages-preparation-20261105` template lacks later preflight/metadata checks and is superseded, not a template to
copy wholesale. Focused readiness/preparation tests passed alongside the QR checks recorded below.

### Q1 — QR, certificate, and evidence review

Reviewed the first worker's `6a82b13` and `a3f245f` against the actual producers:
`tests/qualification/qr-independent.spec.ts`, `tests/qualification/qr-cert.ts`, `tests/archival/zxing_qr.py`,
`src/core/archive/frames.ts`, `qr-plan.ts`, `qr-print.ts`, and the certificate generator. The pinned Python decoder and
Poppler probes fail required qualification when unavailable; optional development-test skipping does not count as
qualification. The evidence gate independently requires exactly 15 cases:

- A4: fixture sizes 200, 3000, and 12000 at each explicit L/M/Q/H level (12 cases).
- Auto level for fixture 3000 on A4 and Letter (two cases), and fixture 12000/H on Letter (one case).
- The generated fixture receipt lengths are 325, 3145, and 12217 bytes. The cover carries up to two symbols,
  continuation pages up to four, and the appendix none; the gate agrees with the producer's page accounting.

A second-round regression demonstrated that jointly increasing a printed frame length and its matching decoded
report length could pass the gate despite unchanged original bytes. `d1f98de` requires the sum of frame payload lengths
(each frame's bytes minus its 80-byte header) to equal the saved receipt length. The new test failed before the repair
(expected exit 1, received 0) and passes after it. Existing PDF/receipt hash binding, decoder status/provenance, case
coverage, label/symbol agreement, and page evidence checks remain in force.

The `a3f245f` recovery repair correctly snapshots the first frame's header before any asynchronous hash check;
payloads were already copied. Its mutation tests cover both changing a valid header and attempting to repair an invalid
header after entry. There was no new defect found in that repair.

Older QR branches contain initial transport/planning/recovery/certificate implementations now replaced by the guarded
modules and their current tests, including bounds, full receipt appendix, distinct normalized evidence sources, and
input/proof lifecycle handling. The current CLI parity source/test blobs from PR71 are identical; the old certificate
check is represented by the later normalized-source check, including rejection of sparse inputs.

**Evidence limit:** the JSON gate is a consistency and completeness check over reports produced by the trusted test
pipeline. It is not an independent signature or a decoder of arbitrary submitted PDF files. Unit fixtures are deliberately
synthetic. The integrated exact-head 15-case print/raster/decode run remains required; this worker did not manufacture
or substitute its result. Local Chromium could not reach assertions because the environment denied its socket setup.

### H1 — Hash cancellation/stalls and diagnostic branches

Current `src/core/hash` streaming/cancellation code and `tests/unit/hash-*` cover the reviewed older watchdog fixes:
progress/partial reads, silence-based stall timing, cancellation and unreadable/error outcomes. Replaying the older
worker/stall trees would displace later controls. The diagnostic A/B workflows are historical investigation tools;
their unique workflow files do not establish an incomplete shipping feature or a reason to enable them.

### R1 / R2 — Reports, CLI, OTS reference behavior, and paper search

Current `src/core/reports` source and tests include batch name validation, cancellation results, timestamp ordering,
report generation, and snapshots of evidence ZIP inputs before asynchronous hashing. The small zero-codex fix branches
have exact source/test matches. Earlier phase-one report code is therefore superseded by the fixed implementation.

PR71's `src/cli/run.ts` and `tests/unit/cli-parity.test.ts` blobs match the candidate; maintained `docs/CLI.md` describes
the current interface. Older delivery error/file handling is represented by later CLI controls. The audit-sweep codec
preview adds no source delta; its old reference-test expectations have been updated to the qualified 0.4.5/0.5.0
semantics while retaining rejection checks. The paper-search sort script and its regression test are identical among
that branch's six matching files; unrelated older qualification notes and hash tests do not make the sort fix missing.

### U1 — UI, accessibility, language controls, and hosted metadata

Current presentation and help work represents the reviewed intent of PR58/63/64. Root's `41e6314` restores visible
English/Spanish help and accessible file/network descriptions with focused coverage. Language radios retain the
recorded WebKit/CSP compatibility behavior; an older native-select implementation is not a missing product feature.
`src/ui/dom.ts` resets file selection before callbacks, retaining repeat-file selection behavior. Later certificate/proof
lifecycle checks and UI states supersede older source variants. Current hosted build metadata includes the hosted
canonical/social/robots behavior while leaving offline/portable artifacts portable. Whole older UI trees should not be
merged merely to make their branch histories ancestors.

### N1 — Calendar and pending receipt evidence

Current `scripts/lib/r1-calendars.mjs` uses bounded parsing, per-target evidence isolation and proof/header binding,
plus reference verification. It supersedes earlier broad byte-search and global `VERIFIED` diagnostics. Current
pending/unreadable wording and canary handling preserve uncertainty when CORS or endpoint behavior prevents a
successful read. These code comparisons do not assert that external calendar services currently satisfy their browser
contract; live operator/CORS evidence remains a separate qualification question.

### A1 / A2 — Automation scope and offline admission policy

PR41/42 describe unique automation activation/parallelism and remain separate. Nothing in this branch review dispatches
or enables those workflows. An identical existing workflow blob in E1 is an inventory result only.

The security worker identified and reviewed two applicable source recoveries:

| Source branch | Recovery | Reported focused verification | Integration boundary |
|---|---|---|---|
| PR52 / `269118949` | `681eedd` | 22 scope-guard tests | Guard trusted paths/results without expanding the existing automation's execution scope. |
| `codex/cloud-policy-20261106` / `75ac0e9` | `b748441` | 24 admission-policy tests; two toolkit wrapper tests run both suites | Policy remains offline/unwired to paid execution; explicit `owner_opt_in` remains required. |

These results were reported by the security worker; this code worker did not rerun them. See that worker's
`docs/handoff/SECURITY-20261119-ROUND2.md` at `66af20a` for exact implementation/testing details. Source recovery and
synthetic CI tests do not activate new schedules, grant execution permission, or consume an API budget.

### P1 — Dependency branches

The checkout 7.0.1 and download-artifact 8.0.2 pins already match the candidate. Their clean synthetic merges produce
no product-file delta despite differing complete workflow blobs. The open create-pull-request 8.1.2 and Playwright 1.65.0
bumps are different: these are pending dependency changes, not silently included upgrades. Keep them separate until
qualified on their exact heads. The parent reported a Firefox `locator.dispatchEvent: Page crashed` failure on the
Playwright PR while other jobs succeeded; that observation is not a root-cause diagnosis or permission to relax the test.
This worker did not independently run its native/browser matrix or query live PR status.

### D1 / D2 — Historical notes and the native-wrapper proposal

Preserve unique takeover/audit/stopped-run documents on their pinned original branches. Do not overwrite current
status with older handoffs or blindly apply the stopped-run partial patches; their own README records unfinished,
unreviewed work. Older wiki/template variants are superseded by maintained docs and the later deployment contract.

The native Windows/Electron proposal on `claude/sweet-hypatia-vp4syp` adds architecture and distribution scope that
accepted ADR009/011 in `docs/DECISIONS.md` rejects in favor of offline HTML and archives. Earlier branch ledgers make
the same distinction. Retaining that branch preserves the proposal without undoing the accepted product architecture.

### S1 — Reconciliation of the November 15 red-team reports

All five reports on `security/red-team-audit-20261115` were read. They are historical observations against their pinned
source and should remain attributable to that point in time. Their relevant findings map to current work as follows:

| Finding | Current disposition |
|---|---|
| RT01: template symlinks could copy outside the template source | Repaired in round-one `16d19c0`; source containment is enforced. |
| RT02: password input via argv/persistence | Repaired in round-one `16d19c0` by rejecting password parameters; review current handling rather than importing the old open status. |
| RT03: cloud path guard too broad | Security worker recovered/hardened PR52 in `681eedd`; follow its verification record. |
| RT04: QR image decode peak-memory availability concern | Remaining measurement question; the old report is source inference, not a reproduced OOM. Existing image bounds/worker/timeout controls do not substitute for measurement. |
| RT05: unbounded parallel stamp-file work | Candidate implements 50-file/two-worker limits; round-one work additionally repairs abort/resource release. |

Archive hardening suggested for hypothetical future dynamic entry names and the distinction between explorer quorum
and Bitcoin consensus remain design considerations with their stated scope, not newly reproduced candidate exploits.

## Verification performed by this code worker

The new QR payload-total regression was run before the repair and failed for the intended reason. After the repair,
this focused command passed **5 files, 54 tests**:

```sh
node node_modules/vitest/vitest.mjs run \
  tests/unit/qr-qualification-evidence.test.ts \
  tests/unit/qr-required-decoder.test.ts \
  tests/unit/archival-qr-frames.test.ts \
  tests/unit/pages-readiness-workflow.test.ts \
  tests/unit/pages-preparation-template.test.ts --maxWorkers=1
```

The complete companion inventory was independently revalidated against Git: all 94 pinned heads, ancestry results,
branch-changed path lists, candidate blob classifications, and existing-file mode/type comparisons agree.
Focused ESLint on the changed JavaScript/TypeScript files and `git diff --check` passed. No assertions were removed,
no browser retries added, and no gate weakened. The cache contract's explicit action input expectation was updated to
the intended new input while retaining all other input and step-equality checks. Full typechecking was not repeated
under the host's observed memory pressure; it remains an integrated-candidate gate. The local browser failure occurred
before product assertions and supplies no browser qualification result.

## Recommended next decisions and fresh-worker handoff

| Item | Next action |
|---|---|
| `b554ea8`, `2eb0c12`, `d1f98de` | Integrate the three code commits, then this ledger/evidence commit. |
| `681eedd`, `b748441` | Integrate through the security worker's complete handoff; preserve its trust and no-activation boundaries. |
| PR84/85/90/93/94 | Already contained by ancestry at the pinned candidate; after integrated qualification, reconcile their PR state/descriptions without replaying source. |
| PR58/63/64/71 | Applicable intent/code represented by later implementation; reconcile as superseded only against the integrated qualified candidate. |
| PR53 | Missing cache recovered locally; reconcile after the local recovery is incorporated and qualified. |
| PR52 | Applicable guard recovery belongs to the security round; reconcile using that worker's exact commits and tests. |
| PR41/42 | Keep separate automation activation decisions; no activation here. |
| PR91/92 | Keep pending dependency changes separately reviewable and qualified. |
| Historical notes/diagnostics/native wrapper | Preserve original branch content and the dispositions above; no sweeping deletion. |
| Exact-head qualification | Run mandatory 15-case independent QR print/raster/decode with saved reports, full required typecheck/checks, and native/browser gates in a capable environment. |
| QR image peak memory | Measure accepted input behavior under the existing bounds before claiming the availability question resolved. |

A fresh code worker should start from the fully integrated candidate, read the paired machine inventory and this
ledger, and inspect the new payload-sum check against real 15-case reports. It should confirm source/test recovery
commits are present and review actual remaining differences, without repeating a full branch replay or inferring
unique features from patch IDs. Re-enumerate remote refs if repository state has changed; this inventory is a pinned
snapshot. Remaining external service behavior, deployment approval, and new paid automation are separate from
whether the local product source has been consolidated.

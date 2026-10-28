# Claude continuation prompt — Unaltered, 2026-10-28

Continue work autonomously on `djshellshoxxx/Unaltered` only:
https://github.com/djshellshoxxx/Unaltered

Complete remaining accepted implementation and tests, then remaining code/bug audit and
deep security review. Resolve ordinary engineering decisions without asking questions.
Keep separate READY and BLOCKED queues. Finish independently executable accepted work
before repeatedly checking blocked items. Continue safe independent work at genuine
gates; never bypass access/security restrictions or invent approvals.

## Current verified checkpoint

- Tested source branch: `codex/accepted-gates-20261028`
- Tested source SHA: `9e16d5bafddd207d7fa14621fe01a6d692885213`
- Draft PR28: https://github.com/djshellshoxxx/Unaltered/pull/28
- Main: `9f06c46d061f8a0f67d8684b6c9c6cbbd163242d`
- Claude-owned PR25 branch: `claude/friendly-faraday-papf5c`
- PR25 SHA: `92e2420da02b2ba11d0161f72f7bb9ff338170b4`
- PR25: https://github.com/djshellshoxxx/Unaltered/pull/25
- Documentation-only backup branch: `codex/claude-handoff-20261028`, based directly on
  the tested source above. It adds this delivered prompt and the current handoff record;
  it does not acquire independent product-test acceptance by containing those notes.

Backup verification found a clean working tree, no untracked source and no local commits
missing from fetched remote branches before the documentation checkpoint. Ignored
`dist/`, `node_modules/`, `scratch/fuzz/` and `test-results/` were preserved locally, not
uploaded. No active Codex workers remain. No merges, releases, approvals, deployments,
paid Claude calls or credential/security-setting changes occurred.

## First actions

Inspect the current executor, repository instructions, applicable skills, dirty/untracked
files, live remote refs, PRs, CI and external ownership before editing. Preserve every
unique change. Reconcile live state against these dated refs; newer remote evidence
takes precedence.

Read `HANDOFF.md`, `docs/SPEC.md`, `docs/TODO.md`, `docs/BUILD_PLAN.md`,
`docs/REVIEW_20261028.md`, `docs/FUZZING.md`, `docs/evidence/fuzz-20261028*.json`,
`docs/NETWORK.md`, `docs/R1_ACCEPTANCE.md`, `docs/RELEASE.md`, `CONTRIBUTING.md` and
`SECURITY.md`. Check relevant repository skills, especially investigate-first,
surgical-patch and verification-before-completion.

The historical handoff section(e) predates completed final CI. Section(f), PR28's
description and run40721017408 supply the subsequently verified exact-head result.
Preserve historical notes/failures rather than rewriting dates or treating them as
current failures. Use the developed PR28 candidate as the source to inspect, preserving
main and PR25. Do not assume main contains PR28. Create a clearly named new work branch
when necessary; do not overwrite another owner's branch.

For recovery in an existing checkout, first inspect/preserve dirty work, then fetch
without force or pruning. For example:

```sh
git status --short --branch
git fetch --no-tags origin 'refs/heads/*:refs/remotes/origin/*'
git show origin/codex/claude-handoff-20261028:HANDOFF.md
git show origin/codex/claude-handoff-20261028:docs/CLAUDE_TAKEOVER.md
```

Verify actual source/diff/ownership before creating an isolated new work branch. In a
fresh executor install dependencies from the lockfile; temporary interpreter/browser
paths from earlier sessions are not guaranteed to exist. The old missing checkpoint
`1e0fd6b3d4e1d1b89b3ad01b78cc28a4c93c08dc` was not recovered; never claim otherwise.

## Ownership, models, caching and budget

Act as the single integrator. Use as many useful parallel agents as the ready workload
warrants, with bounded tasks and disjoint file ownership. Do not create idle swarms or
duplicate reviews. Use the most capable appropriate model for each job: strong models
for difficult parser/hashing/security/architecture reasoning; smaller capable models
for bounded fixtures, straightforward tests and documentation. Validate every result.

Suggested ownership, adjusted only after live reconciliation:

- Integrator: `HANDOFF.md`, integration decisions, package/config/workflow changes,
  commits, pushes and final validation.
- Parser/fuzz worker: `scripts/parser-fuzz.mjs`, `scripts/lib/fuzz-*`, `tests/fuzz/`,
  assigned parser boundary tests and synthetic fixtures. Product parser edits require
  an explicit narrow assignment and reproduced defect.
- Browser worker: assigned `tests/e2e/` and browser evidence; read-only product
  inspection unless separately assigned.
- Security reviewer: independent read-only review with coverage records and reproducible
  findings; integrator assigns subsequent corrections.
- PR25's existing owner retains `src/core/hash/stream.ts`, its timeout changes,
  `tests/unit/hash.test.ts` and `tests/e2e/memory.spec.ts`. CI and handoff changes are
  integrator-owned shared surfaces. Confirm ownership before touching this work.

Use supported prompt caching selectively. Keep stable project constraints/spec excerpts
in reusable prefixes and volatile tasks/logs afterward. Reuse concise handoffs and
changed-range context. Verify supported caching behavior through the active runtime/
provider documentation; do not invent cache hits or savings.

Honor shared budget controls and maintain a reserve for integration, validation and
handoff. Paid Claude/API work must use the existing owner-designated shared broker
(resolve its routing from the owner's session) and remaining cumulative$200 or stricter limits.
Remaining balance is unknown; this checkpoint made no paid calls. Do not treat each
worker as having a separate allowance or create independent paid routes. If that broker
or authorization is unavailable, do not spend through an alternative.

## Already completed

The app implements local chunked SHA-256; JPEG/PNG/WAV/MP3 metadata cleaning;
OpenTimestamps stamp/batch/upgrade/proof downloads; two-explorer verification; fragment
links; opt-in local receipt indexing; EN/ES/mobile UI; offline builds; and an optional
local Node CLI. Language preservation is merged. Do not reimplement these or invent
speculative features.

PR28 adds the accepted coverage-guided parser fuzz harness and reproduced corrections:

- Stale Stamp receipts after changing cleaning; skip-link route changes.
- Upgrade wording implying verified Bitcoin confirmation without verification.
- Aggregate proof budgets, transactional merge rollback and stack-safe serialization.
- Quadratic/unbounded metadata summaries; obsolete Blob URL retention and lifecycle.
- Bundled toolkit script/HTML injection, occupied-port process killing, redirect
  credential forwarding and omitted parallel tool results.
- Stronger test oracles that previously could mask failures.

Internal review covered47 active product/tooling/workflow files and66 bundled executable
scripts. Detailed coverage and dynamic limits are recorded. This is agent-assisted
internal review, not REL-3 independent audit acceptance. Reuse that inventory, fill
genuine gaps and review new changes; avoid repeating unchanged reviews without a reason.

## Test evidence and limits

Exact-head run: https://github.com/djshellshoxxx/Unaltered/actions/runs/40721017408

Head9e16d5b: completed success, all11 required jobs passed:

- Chromium/Firefox/WebKit:55 app tests each, no retry/flaky markers.
- Chromium real2GiB:3/3 attempts, zero retries; independent digest, unchanged <200MiB
  renderer RSS and540-second deadline. Digest visible at38.04/37.82/37.73seconds.
- Linux/Windows/macOS builds/tests and byte-identical checksums passed, as did
  provenance/package-signature checks, secrets, Python reference/toolkit regressions.
- Real browser Alice upgrade, app Verify and independent reference verification passed
  at Bitcoin block428648. Pending404 provider CORS and Bob/Finney confirmed paths remain
  open; the separate informational live-service job failed.

Local integrating-source evidence:150 Vitest passes, one optional Node2GiB skip,
five Node regression passes; four offline Python toolkit regressions; six regenerated
reference fixtures byte-identical; two identical builds/all five checksums passed.
Two250000-mutation campaigns completed250028 inputs each without findings, within
documented bounds; not exhaustive acceptance. Full local Chromium:54 pass, one optional
memory skip, one `file://` failure before app execution, `ERR_BLOCKED_BY_ADMINISTRATOR`.
Policy was preserved; native exact-head offline tests passed.

Reuse matching results. Do not restart expensive suites merely to report status. New
source changes require targeted checks and applicable exact-head gates. The present
documentation-only checkpoint runs no product tests or new campaigns.

Useful reproduction commands, after checking prerequisites:

```sh
npm ci --ignore-scripts
npm run check
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/toolkit -p 'test_*.py' -v
npm run build
node_modules/.bin/playwright test --retries=0
UNALTERED_BIG_BROWSER=1 node_modules/.bin/playwright test tests/e2e/memory.spec.ts --repeat-each=3 --retries=0 --max-failures=1
npm run fuzz:parsers -- --iterations 250000 --seconds 300 --seed 20261028
```

Node>=22 and the pinned lockfile/toolchain are required. Use the configured
`UNALTERED_PYTHON` interpreter with OpenTimestamps0.4.5 for the reference oracle. An
optional-reference skip is not a pass. Consult workflows/docs for browser/system
prerequisites; do not install around a denied route or disable browser security.

## Ready and blocked queues

READY: reconcile accepted requirements against actual implementation first. No
unimplemented user feature was identified in the last scope scan.

- Continue broader/longer bounded synthetic fuzz campaigns and remaining accepted
  parser/limit tests; reproduce and fix actual findings.
- Complete feasible browser/version/Tor coverage without changing security policy.
- Resolve supported defects in remaining code/test/security coverage. Static toolkit
  observations about updater/download trust, child-process pipes and cleanup
  canonicalization remain unproven; establish a small offline oracle before correction.
- Maintain dated requirement/evidence records. Do not satisfy human/independent gates
  with automated results.

BLOCKED/CONDITIONAL:

- PR28 is draft and awaits owner-specific review/approval before merge.
- PR25 changes timeout semantics and adds Firefox/WebKit2GiB completion checks. It
  conflicts with main. Old73fc82e results do not qualify later integrated code; no
  workflow run for exact92e2420 was returned in the last backup check. Coordinate with
  its owner; do not duplicate or overwrite it.
- R1: Alice confirmed path passes, but pending404 CORS and Bob/Finney confirmed evidence
  remain unresolved. Node success cannot establish browser CORS success.
- Signing, human screen-reader/Spanish/usability, independent audit/rebuild and
  account/security/domain/legal/release controls need appropriate people/authorization.

## Architecture and acceptance contract

Preserve client-side operation: no required product backend, database, accounts,
analytics or silently added proxy. Browser calls go directly through existing
allowlisted OTS/Esplora transport. Hashing/cleaning work offline; anchored timestamps
and full live verification depend on external services.

Preserve2GiB input, independent digest, <200MiB Chromium renderer RSS,540-second
deadline, three attempts with zero retries, and50ms responsiveness thresholds. Keep
original failures and diagnostics. Never rerun until green instead of diagnosing.

Metadata cleaning is not full sanitization or audio analysis. Timestamp proof does
not establish authenticity, authorship or exact creation time. Preserve truthful
“software artwork” wording, experimental status, limitations and MIT licence.

## Safe checkpoints and integration

At meaningful milestones update `HANDOFF.md`: completed/remaining work, exact refs,
ownership, commands/results/failures, blocked actions and next reproducible steps.
Inspect outgoing diff and scan secrets/private data before publishing source and
concise evidence to a non-destructive work branch. Verify remote SHA. Keep sensitive
files and bulk/private research/corpora out of Git.

Inspect workflow side effects before pushes. Current CI runs on main/PR/manual;
release preparation is manual/draft-only. Do not dispatch release workflows, create
tags, publish releases, deploy, purchase, create credentials or change account security.

Do not approve or merge PRs without specific owner confirmation. Prepare integration
recommendations after reconciling main/PR25/PR28 ownership. Record source/target SHAs
before any subsequently authorized integration; preserve unique histories, resolve
conflicts deliberately and validate the result. No force pushes, destructive resets
or weakened gates.

At real blockers record exact action/target, reason and denied/pending/uncertain
status, then continue independent permitted work. Revisit only when relevant evidence
or authorization changes. Leave a durable handoff before stopping.

# Security audit round 2 — 2026-11-19

Base: `audit/security-20261119` at `3cf8ce4`, including the first round's source/path/password and Pages comparator fixes.
Lane: independent review, literal configuration handling, and recovery of unique automation safety code.

## Changes and evidence

| Commit | Change | Local verification |
| --- | --- | --- |
| `f67a201` | Share a non-evaluating `.env` parser across five Python readers, preserve generator escapes, and serialize updater values safely before writing. | Six new tests passed; the baseline had seven failed assertions/subtests. Existing starter generator 21/21 and updater trust 10/10 also passed. |
| `681eedd` | Recover PR #52's exact scope guard, tests, workflow changes, and historical documentation from `269118949894b137b6a8ad855780da296955e7de`. | All 22 offline scope-boundary tests passed. |
| `b748441` | Recover the previously unintegrated admission module and tests from `75ac0e972f0aa2988abed44054d45b479a84e360`; run both safety suites in ordinary toolkit CI. | Admission tests 24/24 passed. The two toolkit wrapper tests passed and executed all 46 underlying tests. |
| `3849fad` | Escape project names and version text when generating XML update feeds. | A real XML parse failed before the fix; the final environment/feed suite passed 7/7. |

The environment rewrite defect was reproduced with an originally single-quoted, inert value containing a synthetic shell command. Sourcing the original file preserved the literal; after the old updater rewrote it, sourcing created a disposable marker. The fixed writer keeps the value literal. Command interpolation, environment expansion, and shell sourcing are not used to parse configuration.

The shared reader removes exactly one matching quote pair. Double-quoted values decode only escaped double quotes, backslashes, dollar signs, and backticks. Single-quoted and ordinary bare values stay literal. The scripts load the adjacent helper explicitly so Python isolated mode does not depend on imports from a project's working directory. Keep `env_config.py` beside copied helper scripts.

The XML regression verifies that ampersands and tag-like project text remain text nodes and cannot create feed elements.

## Independent first-round review

The starter path checks precede destructive overwrite, preserve absent parent destinations, and reject overlapping or linked template trees. The final generator suite independently passed all 21 tests after the reader integration. The Pages comparator independently passed all three tests with one Vitest worker, including its trailing-separator/dot symlink cases. These checks do not establish safety against a concurrent hostile filesystem mutation or against executable contents in a deliberately selected template.

## Automation recovery boundaries

PR #52 adds checks of committed, indexed, working-tree and untracked paths against a captured commit. It loads guard bytes from that commit using fixed Git/Python executables, rechecks after tests and staging, applies patches as data in the fresh publisher, and creates draft PRs. Its tests cover staged/committed changes, mode and symlink changes, interpreter/module substitution, replacement refs, malformed arguments and publication-boundary execution.

The workflow's triggers, schedule, concurrency, job permissions, key gate, credential expression, action pin, and model-launch settings were compared directly against the pre-integration workflow and are unchanged. No paid workflow was executed, dispatched or newly enabled by this lane.

The recovered admission module is **not wired into any workflow**. It is a pure predicate over supplied metadata, with explicit owner opt-in, complete-history requirements, attempt frequency, cooldown and failure backoff. Its tests use synthetic metadata. It does not authenticate metadata, reserve execution atomically, measure token or dollar usage, or enforce the existing scheduled workflow's spending. Recovering its source is not activation or a claim that these missing runtime controls now exist.

`node --test tests/ci/workflows.test.mjs` passed all four existing workflow contract tests on this lane. No full TypeScript or native browser qualification was attempted here. The parent owns final integrated CI qualification.

## Bounded candidate inspection

At parent candidate `53f62eb70d83f92ce174e30412a4ff2ab95a85ac`, compared with original PR #96 head `abc6ff24c5da14261d5919c68673ee3ad8c6db99`, the diff contained 31 text-only files and 1,014 added lines. No private-key blocks or recognizable GitHub/OpenAI/AWS credential values were found in the added lines; workflow secret expressions were symbolic names. This limited inspection is not a proof that all possible secret formats are absent and does not qualify a later candidate automatically.

## Fresh-worker handoff

1. Review the literal `.env` subset and its generated-value interoperability independently. No shell expressions or multiline values are evaluated.
2. Review the recovered publisher scope boundary separately from application correctness. Path allowlists do not establish safe semantics for all permitted source/test changes, and same-job execution still lacks a complete process/filesystem isolation boundary.
3. Keep admission-policy runtime wiring separate until there is explicit configuration and authorization for the associated automation. Do not label the inherited schedule as budget-limited by this inactive helper.
4. Obtain native Windows junction and final integrated platform/browser evidence from CI. No local browser launch or compiler failure was converted into a passing result.

All new reproduction data was synthetic. No real credentials, private files, API calls, remote mutation, publication, deployment, or release operation was used by this lane.

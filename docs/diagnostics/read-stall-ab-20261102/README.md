# Native Chromium read-stall comparison — prepared 2026-11-02

**Diagnostic only.** Keep this workflow and its records on
**diag/read-stall-ab-20261102**. Do not merge them into a product or release branch.
Preparation does not establish that a native failure was reproduced or that either arm passed.

## Frozen question and inputs

The question is whether the historical hashing family can reproduce a native pending-read
failure under the same current scaffold on which the candidate completes. This comparison
changes the hashing family as a unit, including recovery, cancellation and worker error
handling. It cannot isolate one patch's contribution or prove Chromium's internal root cause.

| Input | Frozen identity |
|---|---|
| Candidate | 03f3ac80cfe6f3014162967b5e05bff95ec350b6 |
| Candidate tree | 67c86f899132e64005cf46e37375f027cfdafd54 |
| Historical baseline | 0b448d887df89fab22f701810197e51285590e2b |
| Node / npm | 22.23.4 / 10.9.9 |
| Playwright | 1.64.1, from the unchanged lockfile |
| Chromium and headless shell | 156.0.8078.4, Playwright revision 1248 |
| Host | Existing standard GitHub-hosted ubuntu-latest; actual image/version recorded per job |

[manifest.json](manifest.json) records the exact source hashes, acceptance limits and Action
commit pins. Runtime versions match the completed candidate Linux and Chromium jobs in
[run 41558939415](https://github.com/djshellshoxxx/Unaltered/actions/runs/41558939415);
subsequent follow-ups change only test-helper argument forwarding and ordinary calendar-host
assertions. Production, build and large-file acceptance inputs are unchanged from the qualified
928cf8b4d97ade63d20479da03d57a7713dc8910 head. The new frozen head still requires its own hosted
qualification before this diagnostic is published.

The baseline arm restores exactly these three files from the historical commit:

- src/core/hash/stream.ts
- src/core/hash/hasher.ts
- src/core/hash/hasher.worker.ts

All other product, build and test files stay at the candidate. In particular, both arms
retain current src/core/errors.ts, bytes helpers, package files, build scripts,
playwright.config.ts, memory.spec.ts, hash-io-diagnostics.ts and hash-worker-evidence.ts.
The current error taxonomy only adds INPUT_UNREADABLE to the original taxonomy and is
a compatible superset. Both module families expose the APIs and worker completion
payload used by the common harness.

Restoring only the historical stream would leave new imports and options in the current
hasher unresolved. Restoring the old error file, unit tests, workflow Action pins or the
rest of the historical application would introduce unrelated changes. None is done here.
The diagnostic compile includes production sources and the common acceptance harness;
it deliberately does not pretend the historical implementation satisfies newer cancellation
unit tests. Normal candidate CI remains a separate prerequisite.

## Experiment and resource bounds

The matrix has eight independent shards for each of two arms, with three planned attempts
per job: **48 planned attempts, 24 per arm**. Each job uses one Playwright worker, zero retries
and max-failures=1, preserving the accepted first-failure stop rule. A first failure therefore
leaves later planned attempts skipped or unreported. Those attempts are never counted as passes.
Matrix fail-fast is disabled so another arm or shard can retain its own observations.

The common acceptance test requires a real browser-readable 2 GiB zero-filled sparse file,
successful worker completion with the full byte count and independent Node SHA-256 digest,
the existing 540-second digest wait, 600-second test timeout and strictly less than 200 MiB
extra renderer RSS. Neither the test nor its worker-evidence assertions is edited. The
4 MiB chunk size and current 64 MiB cross-check policy also remain unchanged.

Each matrix job is capped at 40 minutes. Tests start only if preparation finished within
five minutes of that job's first step. The test process has a 31-minute GNU timeout and
15-second termination grace, inside a 32-minute step; the final log exporter has two minutes.
An over-budget setup is environmental/incomplete evidence and starts no browser attempt.
This leaves headroom before the outer cap even if all three tests consume their full limits.
The longer outer cap replaces the old diagnostic's 15-minute cap so three slow but allowed
attempts need not lose their evidence to a whole-job timeout.

The conservative configured ceiling is **650 runner-minutes per workflow invocation**:
16 jobs at 40 minutes plus a 10-minute scope check. Normal completion or first failure ends
jobs earlier. This is a resource ceiling, not a price quote. Only existing standard hosted
runners are used; there is no larger runner, new service, artifact upload or dependency cache.
No purchase or spending authorization is implied by this preparation.

The host label does not pin one physical machine or image revision. Record and compare the
actual image, kernel and architecture from every job; do not call differently provisioned
runs an exact environment match. Both arms use an isolated pinned browser cache. An explicit
empty CHROMIUM_PATH bypasses the optional preinstalled-browser fallback while retaining
Playwright's normal pinned headless-browser choice.

## Evidence retained in existing job logs

Input identities, source hashes, exact tool/browser versions and build-output hashes are
printed before the test. Installation, typecheck, build and test console output stream
directly into the existing job log. The test's browser-launch debug output identifies the
chosen executable. No synthetic file content, browser cache or build binary is uploaded.

An always-run finalizer emits:

- A structured outcome record with the run ID/attempt, arm, shard, step outcomes,
  reported result statuses, retry counts and unreported planned attempts.
- The raw Playwright JSON, including its inline worker-completion and last-I/O attachments.
- The frozen manifest, effective source/runtime record, baseline diff, diagnostic typecheck
  configuration and test/log exit codes.
- Byte counts and SHA-256 hashes for exported files and the already-streamed console logs.

Markers begin with BEGIN READ_STALL and end with END READ_STALL. Each exported raw file
has a 2 MiB log budget. Missing, invalid or oversized result JSON makes evidence incomplete
and the finalizer fails; it does not silently substitute a summary. The sparse input file
is temporary and removed by the existing test.

An always-run step cannot survive a destroyed runner, forced job termination or exhausted
outer timeout. In those cases the earlier streamed log remains the available evidence;
missing final markers or JSON mean an incomplete observation. Logs follow the repository's
existing retention settings. Preserve the relevant logs before they expire; no new storage
settings are configured.

## Interpretation

The original comparison is [run 40617290194](https://github.com/djshellshoxxx/Unaltered/actions/runs/40617290194)
at diagnostic head 6f5b6c9ece959e454dd3341f7c0f8012c4431259. Baseline shards 1/2/4/7/8 failed,
3/5/6 passed, and all watchdog shards passed. A reported read's pending duration is
observation.now minus observation.since; the latter is an absolute timestamp.

A baseline native pending read with candidate completion supports recovery under the
observed conditions. A candidate pass alone qualifies only that tested candidate. Both
arms passing is non-reproduction, not resolution of the historical failure. An RSS,
integrity, worker-completion, setup or infrastructure failure must retain its actual
classification; it is not automatically a read stall. Never mix cohorts, retries or
different source/image identities to improve the apparent result.

## Publication boundary and preparation checks

Only three new paths are permitted above the frozen candidate: this README, manifest.json
and .github/workflows/diag-read-stall-ab-20261102.yml. The first CI job enforces that scope,
the recorded source hashes, fixed runtime versions, metadata hygiene and the repository's
current pinned secret scan. Actions use the existing full-SHA pins, the token has only
contents: read, credentials are not persisted, and no secret or account setting is added.

Publishing or updating the named branch starts this workflow automatically. It has no
pull-request, default-branch or dispatch trigger. Keep any review separate from a production
merge. A later rerun or branch update is a new cohort and may consume the full resource
ceiling again; cancel-in-progress is false to preserve an already running cohort.

The prepared branch is based on the frozen candidate and contains no diagnostic commit
until the lead deliberately publishes it. The lead must first complete candidate qualification,
review these three files and preserve the signing/OPSEC requirements before that publication.
This preparation performed no browser experiment, remote write, workflow run or infrastructure
change. Local production-plus-harness compilation is a compatibility check, not native
stall evidence. Exact preparation checks and any later run results belong in the review
record and must not be inferred from this design.

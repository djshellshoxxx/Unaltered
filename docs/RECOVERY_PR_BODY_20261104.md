Recovers unpublished candidate `7e8f437` and retains its selected PR47/48/49 integration and PR39 corrections.
Reconciles all 45 cached branches with ancestry, patch identity and explicit dispositions; current remote state still
requires refresh because this executor cannot resolve GitHub.

Adds regression-backed fixes for worker message-deserialization fallback and cleanup timers, receipt-upgrade cancellation
and overlapping requests, keyboard focus through those controls, PNG structural headers and bounded self-check reads,
and offline CSP hashing with CRLF input files. Keeps API automation changes on a separate branch.

Recovered 313-test qualification reproduced on Node 22.23.4. Final available units: 334 passed/5 skipped; the unfiltered
check retains four restricted subprocess failures (333 passed/3 skipped); full green qualification remains open.
Genuine descriptor-backed file hashing through 2 GiB+1
passed independent digest/read/RSS checks; generated CLI matched system sha256sum. Package/executor/workflow tests:
28 passed/1 platform skip. Two final builds are byte-identical, build code `0fe9be8834c6d1f0`; release checksums pass.
Clean dependency install succeeded from the existing cache with install scripts disabled.
Live dependency audit remains unavailable. See `docs/RECOVERY_PROGRESS_20261104.md` for final exact-head totals,
reproducibility evidence, commands, all blocked/failed checks and recovery bundles.

No browser/platform/reference, SonarCloud, audit, signing or human gate is claimed complete. Local server binding and
some subprocess operations remain denied. Pages preparation remains artifact-only. No merge, release or deployment.

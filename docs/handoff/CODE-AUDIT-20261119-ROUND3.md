# Code audit round 3 — 2026-11-19

Reviewed candidate: `4a14f31`, whose application source is `e5efcba`.
Lane: fresh review of the integrated fixes, qualification contracts, current dependency advisory data,
and the second code worker's complete branch ledger. The integration coordinator owns publication
and final qualification.

## Review result

No additional reproducible application defect was found in this scope. The installed Pages workflow
had a misleading three-line header claiming that it was an inactive document template. The header now
describes the installed, explicitly authorized manual workflow. Its executable YAML, triggers,
permissions, authorization expressions and checks are unchanged. The separate documentation template
retains its accurate inactive-template notice.

The review checked the following relationships against their actual producers and consumers:

- The QR evidence gate requires the complete 15-case matrix, the expected fixture byte lengths,
  independent zxing-cpp 3.1.1 recovery at 150 DPI, receipt and PDF hashes, matching symbol metadata,
  and the two-symbol cover/four-symbol continuation/empty-appendix page layout.
- The new payload-total check correctly subtracts the 80-byte frame header from each symbol before
  comparing the sum with the original receipt length. The reference recovery tool also verifies the
  recovered receipt bytes; the static report checker is not itself an independent decoder.
- Required-decoder mode propagates from the QR workflow to the qualification helper and cannot
  silently skip absent tools. The post-browser evidence gate runs before artifact upload.
- Readiness, installed publication and template preparation steps agree. Publication still requires
  manual authorization, the exact reviewed default-branch SHA, successful preparation, and the
  same-run official Pages artifact.
- All five Verify file pickers retain the contextual help restored in round one. Both batch input
  callbacks retain `stopBatch(null)` from round two. The evidence export uses captured input references,
  operation ownership and abort-aware waits. The fresh bug worker owns further lifecycle and native
  regression work, including retained error localization.
- The five bundled Python consumers use the shared literal configuration reader through adjacent-file
  loading. The fresh security worker owns further configuration and filesystem portability review.

These are bounded source-review findings, not a formal equivalence proof or new native-browser evidence.
The complete 94-branch inventory remains attributable to the pinned comparison in
[BRANCH-LEDGER-20261119.md](BRANCH-LEDGER-20261119.md).

## Refreshed dependency advisory result

`npm audit --json` completed with exit status **1** and valid advisory data. The saved unmodified report is
[npm-audit-20261119-round3.json](../evidence/npm-audit-20261119-round3.json).
It reports **nine moderate affected package entries**, zero high or critical entries. This is nine
package entries, **not nine distinct advisories**. Every listed installed node is marked `dev: true`
in the audited lockfile.

All nine entries trace to [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
minimatch globparts amplification. The installed minimatch version is `10.2.6`; the report identifies
`>=7.0.0 <11.0.1` as affected. The paths run through ESLint/config-array and the typescript-eslint family.
The older status documents' count of eleven no longer describes this candidate.

The registry reports `eslint@10.15.0` and `typescript-eslint@8.73.0` as nonmajor fixes, plus a fix for
the affected config-array entry. This worker did not change dependencies or test those proposed upgrades.
Availability in the audit response is not proof that an updated lockfile or toolchain is qualified.
The result is limited to the registry's advisory data at this check; it is not a claim that all possible
dependency defects are absent.

## Verification performed

This focused command passed **four files, 45 tests**:

```sh
node node_modules/vitest/vitest.mjs run \
  tests/unit/pages-preparation-template.test.ts \
  tests/unit/pages-readiness-workflow.test.ts \
  tests/unit/qr-qualification-evidence.test.ts \
  tests/unit/qr-required-decoder.test.ts --maxWorkers=1
```

`git diff --check` passed. The Pages header correction changes comments only, and the semantic workflow
comparison still passes. No assertion was removed or gate relaxed. Full typechecking, full lint, full
unit tests and builds are coordinated centrally rather than duplicated by this worker.

The read-only GitHub query for CI run `44660341153` still showed all first-wave jobs queued, with only
the optional 2 GiB completion matrix skipped. QR run `44660341142` was queued too. These runs qualify
the previously published checkpoint if they pass; they do not qualify this later local candidate.
No local native browser launch was attempted after the coordinator established the environment's
socket restriction.

## Fresh-worker handoff

1. Review the final integrated source and the bug/security workers' new commits, then use exact-source
   hosted and native qualification results. Do not reuse an earlier checkpoint's green status as the
   final candidate's result.
2. If dependency maintenance proceeds, qualify a separate concrete lockfile update for the current
   minimatch advisory. Preserve exact pins and do not infer success from `fixAvailable` alone.
3. Keep PR92's Playwright bump separate until its exact-head Firefox settings journey is qualified.
   The previously reported page crash has not been diagnosed by this lane.
4. The mandatory printed PDF/raster/independent-decoder matrix, native platform checks and QR image
   peak-memory measurement remain distinct evidence needs. Static contract tests cannot supply them.

No remote mutation, dispatch, deployment, release, new automation activation or paid API execution was
performed by this worker.

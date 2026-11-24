# Consolidation and continuation — 2026-11-19

This is the current continuation record for [PR96](https://github.com/djshellshoxxx/Unaltered/pull/96),
`codex/unaltered-completion-20261119`. Dates in this heading use America/Los_Angeles. Older dated handoffs
remain historical evidence. The product version remains 0.3.1.

## Outcome and source identity

Four successive sets of separate code-audit, bug-hunt and security workers completed their reviews. Findings
were reproduced where applicable, repaired in isolated commits, integrated, and handed to fresh reviewers.
This is an internal development review; it does not satisfy the independent human audit or second-person
rebuild required for release.

The continuation recovered all seven fixes described as lost or unuploaded in the previous PR96 handoff:
contextual help, starter source validation and password rejection, cancellation during Blob preprocessing,
live canary evidence, mandatory independent QR evidence, missing-parent destination support, and comparator
root normalization. Further rounds repaired evidence-export ownership, batch state/localization, mutable QR
headers, literal configuration handling, update-feed escaping and cross-version Windows link detection.

The final source/test/workflow/dependency checkpoint used for central validation is local commit
`49ea5ad67eb9fd1950cf4dfa5514befaf06c6d4d`, tree `9528b242b8909c986b0f049d1ecffe25a8fa65af`.
Subsequent changes in this continuation are documentation and evidence. The PR description records the
published head. When ordinary Git HTTPS credentials were unavailable, commits were published through the
authenticated GitHub connector; each created tree must equal its local commit tree before the branch advances.
Local and remote commit hashes can differ because commit metadata differs. Source equivalence is established
by tree equality, not by assuming those commit hashes are interchangeable.

The initial recovered checkpoint is already published as `fe260d924beaeb34102c0bafa236cca6ff9a921c`,
tree `0d23539a03eb11127d8fe0fc362e951cffa3e664`, equal to the earlier local `53f62eb` checkpoint.
The original `abc6ff2` PR checkpoint and its source-parent history are preserved.

## Consolidation decisions

The [complete branch ledger](BRANCH-LEDGER-20261119.md) and its
[machine-readable inventory](../evidence/branch-inventory-20261119.json) account for **94 actual remote branches**.
The symbolic `origin/HEAD` is not a 95th branch. At the ledger's pinned comparison point, 41 heads were ancestors,
six nonancestor branches matched every changed-file blob, 12 differed only in documentation/history, and 35
required semantic review. Those categories describe that snapshot, not a claim that every nonancestor branch
should be merged.

- The existing PR96 parents preserve the integrations of PR84, PR85, PR90, PR93 and PR94 above merged PR95.
- PR53's missing npm cache was recovered and kept consistent across Pages readiness, publication and its template.
- PR52's scope guard and trusted-base publication checks were recovered. The separate cloud admission helper
  and tests were also preserved, but the helper remains unwired to execution.
- Older app implementations are represented by later reviewed behavior. Unique historical notes and original
  branch heads remain preserved; the ledger records the reason for each disposition.
- PR41/42 automation activation, PR91's automation action update and PR92's Playwright update remain separate.
  The Playwright proposal has an unresolved native Firefox page-crash result; it was not silently accepted.
- Semantic replacement PRs should be closed only after this candidate lands. No branch deletion or force-push
  is part of this continuation.

## Implemented repairs

| Area | Result |
|---|---|
| Contextual help | English/Spanish file-picker help and network-setting descriptions are visible and connected through accessible descriptions. |
| Stamp preprocessing | Aborting detection or cleaning abandons pending native Blob waits promptly and releases the bounded preprocessing queue. Item-owned status follows the current language. |
| Evidence export | An export captures its original inputs and operation owner; cancellation or replacement cannot download stale data. Duplicate starts are blocked. The size bound is explained before reading files and relabels correctly. |
| Batch verification | Cancellation, replacement, pairing errors, progress and retained results use explicit state and translate without repeating reads or network work. |
| Native lifecycle regression coverage | Ten browser journeys cover the repaired export/batch flows, including an actual saved ZIP and its manifest hashes. Collection and compilation are distinct from browser assertion execution. |
| Archival QR | Asynchronous recovery snapshots the first header. Qualification requires the independent decoder, all 15 evidence cases, consistent receipt/PDF hashes, page and symbol metadata, and payload totals equal to the saved receipt length. |
| Starter generator | Validate the source and destinations before overwrite, preserve ordinary missing parents, reject copied links/nonregular files and Windows reparse points, and reject the legacy persisted-password option. |
| Toolkit configuration | A shared non-evaluating parser agrees with generated shell literals. Readers and rewrites preserve quoted values, Unicode separators and UTF-8. XML feed text is escaped. |
| Pages comparison | Normalize root paths before rejecting symlinks, including trailing slash and dot forms. |
| Cloud publication guard | Use the captured trusted-base checker and recheck in the publishing phase. Admission-policy code is retained as offline source/tests without activation. |
| Native Windows qualification | The existing Windows job requires the two real junction regressions on Python 3.11; wrong platform/version, missing tests, skips or failures cannot count as qualification. |
| Dependencies | Supported ESLint 10.15.0 and typescript-eslint 8.73.0 releases resolve minimatch 11.0.9 without overrides. Production dependency records are unchanged. |

Native Blob reads are abandoned on cancellation, not forcibly cancelled. Synchronous cleaner work is not
interruptible midway through a call. These bounds remain explicit rather than promising stronger cancellation.

## Central verification

The [consolidated validation evidence](../evidence/consolidation-20261119.json) records commands, source identity,
results and qualification limits. Local validation uses Linux, Node 24.22.3 and Python 3.12.14; native CI uses its
declared platform/runtime matrix.

| Check | Result |
|---|---|
| Fresh `npm ci --ignore-scripts --no-audit --no-fund` | Passed against the updated lockfile. |
| Full TypeScript and ESLint | Passed with a 384 MiB heap. |
| Full Vitest | **771 passed, 2 opt-in large-file tests skipped**, zero failures; 94 files passed and one opt-in file skipped. |
| Full Node script suite | **140 passed, 3 environment-specific tests skipped**, zero failures. The skips require PowerShell, root ownership changes, or root plus an isolated hostname namespace. |
| Python toolkit | **68 passed, 2 native Windows tests skipped**, zero failures. The final candidate retains these exact Python source/test files and adds required native execution in Windows CI. |
| Independent archival Python tests | **9 passed**, zero failures. |
| Reproducible Linux builds | Two builds produced **13 byte-identical files**; all five published artifact checksums passed. This is same-machine evidence, not cross-platform or second-person reproduction. |
| Identity/metadata scan | Passed. Two unchanged historical ZIP archives are explicitly listed as uninspected. Final staged documentation and added commits are scanned again before publication. |
| New lifecycle browser journeys | **10 tests collected and typechecked**; native assertions await hosted execution. |

The [60-second seeded parser campaign](../evidence/fuzz-20261119.json) executed **15,746 inputs**, including
15,643 mutations, across QR frames, QR image headers, trusted headers and receipt storage. It completed its time
budget with no finding. Its source was clean local `3059236`; later changes affect test typing, CI qualification,
development lint dependencies and documentation, not those parser implementations. The campaign is bounded
regression evidence, not exhaustive coverage or native image-decoder qualification.

The latest [full](../evidence/npm-audit-20261119-round4.json) and
[runtime-only](../evidence/npm-runtime-audit-20261119-round4.json) npm reports contain zero vulnerabilities.
The [dependency evidence](../evidence/dependency-upgrade-20261119.json) records declared upstream ranges,
the narrow lockfile change and successful verification of 141 registry signatures and 59 attestations.
This supersedes the historical accepted-risk decision for the minimatch advisory in
[DEPENDENCIES.md](../DEPENDENCIES.md).

### Failures retained and resolved

- An earlier full typecheck was killed with exit 137 during host resource pressure. A later bounded-heap run
  passed; the killed process is not counted as a pass.
- The first full integrated Vitest run had 768 passes, two failures and two skips. Both failures were stale
  one-argument mock expectations after adding cancellation signals. The repair preserves the original warning,
  acknowledgement, target-file and call-count checks and additionally verifies shared signal ownership/abort.
- A fresh compiler found five TS2352 errors in the new browser test's probe casts. The fix declares an optional
  Window property and narrows it before access, preserving the lifecycle assertions. It uses no `any` or double cast.
- Local Chromium could not launch because the executor denied its singleton socket before any browser assertion.
  No browser security restriction was bypassed. The native result remains a hosted qualification requirement.

## Work that remains

| Gate | Required evidence or action |
|---|---|
| Final published-head CI | Passing type/lint/unit, native platforms, Chromium/Firefox/WebKit, provenance, package checksums and cross-platform reproducibility for the final source. Earlier green runs cannot qualify later repairs. |
| QR print/raster/decode | All 15 actual certificate cases must pass with the independent decoder and strengthened evidence gate. Unit tests of the gate do not substitute for this matrix. |
| Native Windows junctions | The Windows log must show both real junction cases executed and passed on Python 3.11. Linux skips are explicitly insufficient. |
| Large-file acceptance | The optional Firefox/WebKit 2 GiB completion job needs its opt-in/manual qualification run; completion does not measure a memory ceiling. |
| Calendar CORS and liveness | Informational CI now captures live canary evidence, including failures. An unreadable pending lookup can remain an upstream CORS issue; liveness does not establish receipt confirmation. Sending the upstream proposal remains a separate communication decision. |
| Physical QR and human review | Real printers, phone cameras/scanner, screen-reader work, native Spanish review, usability and relevant native-browser/Tor checks. |
| Release controls | Independent audit, second-person rebuild, signing keys, owner/account/domain/operational/legal controls and an explicit release/deployment decision. |

The first published recovery checkpoint's CI runs were
[44660341153](https://github.com/djshellshoxxx/Unaltered/actions/runs/44660341153) and
[44660341142](https://github.com/djshellshoxxx/Unaltered/actions/runs/44660341142). They were queued during the
development reviews and concern `fe260d9`, not the later source. Consult PR96 for the final checkpoint's runs.
Keep the PR draft while required exact-source qualification is pending. A source publication is not a release,
deployment, signed artifact or external-audit acceptance.

## Fresh-worker continuation

Start with the current PR96 head and this record. Confirm tree identity, read its actual CI/QR results, and
investigate any concrete failing assertion without weakening gates or adding retries to hide it. Use an isolated
worktree and hand findings back with exact source, reproduction, fix and validation. If all code gates pass,
proceed to the authorized consolidation decision; external and human release controls retain their own evidence
requirements. Further work should follow an actionable finding or an outstanding qualification gate.

The final worker records are [code](CODE-AUDIT-20261119-ROUND4.md),
[bugs](BUG-HUNT-20261119-ROUND4.md) and [security](SECURITY-20261119-ROUND4.md). Earlier round reports preserve
the discovery and regression evidence. No task in this record claims that the account's remaining credits were
observable, measured or exhausted.

# Unaltered branch consolidation audit — 2026-11-04

GitHub comparisons against main:

| PR | Ahead | Behind | Files | Scope |
|---|---:|---:|---:|---|
| #39 | 2 | 1 | 6 | calendar acceptance |
| #41 | 1 | 0 | 1 | API-funded automation |
| #42 | 3 | 0 | 1 | parallel agents |
| #43 | 2 | 0 | 2 | hash timeout |
| #44 | 2 | 0 | 2 | OTS codec |
| #45 | 2 | 0 | 2 | file type detection |
| #46 | 2 | 0 | 2 | accessibility announcements |
| #47 | 136 | 0 | 99 | integrated hardening |
| #48 | 96 | 0 | 73 | consolidation, cancellation, CI, fuzz |
| #49 | 98 | 0 | 74 | #48 plus OpenAlex sort fix |

Cross-comparisons:
- #43→#47, #44→#47, #45→#47 and #46→#47 each show #47 ahead by 134 and behind by 0. Their branch histories are ancestors of #47. Do not merge all separately.
- #48→#49: ahead 2, behind 0, two changed files (skills/paper-search/scripts/search.sh and tests/toolkit/test_search_sort_20261104.py). #49 stacks directly on #48.
- #47→#48: diverged, ahead 15, behind 55; ten files differ in comparison. #48 is not a simple descendant of #47.

## Gated integration order

1. Check actual PR base branches, active ownership, and CI for #47, #48, #49. Compare the ten #47/#48 file differences and preserve nonduplicated cancellation tests, CI timeouts, fuzz evidence and handoff material.
2. Treat #47 as the primary hardening integration candidate; confirm its acceptance tests, build, and review status. Do not separately merge #43–#46 without a reason.
3. Reconcile #48's unique changes against #47 on an isolated integration branch, then incorporate #49's two-commit OpenAlex fix with focused toolkit tests.
4. Review #39's calendar acceptance attribution against integrated tests and documentation.
5. Keep #41/#42 automation workflow changes independent of application consolidation. Verify budget controls, task isolation, secret handling, and guarded integration before activation.
6. Run full CI, unit, accessibility, metadata, hash, OTS, cancellation, fuzz and toolkit checks as available. Record exact results and unresolved blockers.
7. Merge only when GitHub's required checks and review rules permit; do not close source PRs merely based on their titles.

This audit records comparisons and integration priorities. It does not claim source-code consolidation or test execution.

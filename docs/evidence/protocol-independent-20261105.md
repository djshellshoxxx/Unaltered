# Pending calendar upgrade lifecycle — 2026-11-05 UTC

Reviewed from `210e3df8e05220d65fc7fa31cc78a8d3a5b3102a` in an isolated worktree. This completes the known FR-6
residual described as “Leftover duplicate pending after upgrade is cosmetic; not changed” in the historical
`ULTRA_RUN_BOARD.md` lane-A table. It is not classified as a newly discovered vulnerability or an accepted ADR deferral.

The previous implementation deduplicated pending entries by normalized calendar URI and commitment, retaining only
one target node. Consequently, equivalent URI spellings on one node or distinct valid operation paths converging on
the same commitment left stale pending attestations after a successful lookup. Repeating upgrade could issue another
request for a confirmation already received.

The calendar client now retains every matching pending target while sharing one lookup. The existing iterative merge
engine accepts several roots in one transaction, checks all root identities before mutation, shares its work limit and
rollback snapshots, then validates the complete proof once. A combined response that exceeds the receipt budget rolls
back every affected branch. The existing single-root merge API delegates to this engine unchanged.

## Evidence

- Before implementation: seven existing network/calendar test files passed **84/84**. The initial regression file
  then failed **3/5** cases: converging branches, equivalent URI spellings, and combined confirmation budget rejection.
  Its pending-response and cancellation cases already passed.
- After implementation: nine focused files passed **114/114** with installed `opentimestamps==0.5.0`, including the
  existing codec differential and a new independent reference parse of both upgraded branches. The focused new file
  also passed **7/7** against the pinned installed `opentimestamps==0.4.5` oracle.
- TypeScript and ESLint checks pass. Vitest used `--no-cache --no-fsModuleCache --configLoader runner --maxWorkers 1
  --no-file-parallelism`; no dependency installation or shared cache write was requested.

Focused files: `protocol-independent-upgrade-fanout`, `net`, `net-body`, `net-policy-bounds`, `ots-calendar-guards`,
`ots-continuation-calendar-url`, `ots-flow`, `proof-budget`, and `codec` under `tests/unit/`.

## Research and limits

No fresh endpoint research or live requests were needed. Existing receipt-bound CORS evidence was read before review:
[`cors-continuation-20261105.md`](cors-continuation-20261105.md) and its adjacent JSON retain the source revisions,
maintenance information and inspected LGPL-3.0-or-later notices. The locally inspected current reference library is
`opentimestamps==0.5.0`; the existing source record pins `python-opentimestamps` to
`8c3dc6fbdf6fcba054e78643e9df5eccd8c9fce4`. Reference libraries were read and executed as test oracles; no external
implementation or dependency was incorporated.

All new receipts and transport replies were synthetic. The active browser environment, original files, application
allowlist/CSP and shared dependencies were untouched. No browser was launched and no server port was opened. The
previously observed unreadable pending-calendar GET responses remain an external CORS blocker; these unit results do
not qualify live confirmed upgrades or independently establish Bitcoin verification.

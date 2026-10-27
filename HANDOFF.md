# Unaltered checkpoint — 2026-10-27

Owner: this task owns only `djshellshoxxx/Unaltered`. Root integrates; no workers are active. No other repo was changed.

- Checkpoint branch: `codex/ui-correctness-checkpoint-20261025` (fast-forward only; never force-push).
- Tested source/test SHA: `03fc5ac` (this handoff commit sits on top of it). Previous checkpoint: `800b9cc` (source `7a33625`).
- Parent/PR6 head: `0b448d887df89fab22f701810197e51285590e2b`. Main remains `8bcae50f90d08efcead4c5ff549543d4cc703af4`.

## 2026-10-27 continuation

Integration review of `7a33625` against `0b448d8` (production diff is `src/ui/views/verify.ts` only): receipt size is checked
before any read or hash, Verify/Upgrade completions are generation-checked after every await, and Cancel aborts.
One finding was fixed in `03fc5ac`: an input change invalidated the running verification but did not abort its controller,
so a superseded hash worker (up to the 2GiB input) kept running beside a new run, and its requests stayed live.
`resetVerification()` now aborts the controller it discards, matching Cancel. Five new browser regressions
(`a superseded verification is aborted after …`) failed before the fix for receipt/file/fingerprint/remove (cancel already passed) and pass after.
Upgrade still lets issued calendar requests finish (no signal is threaded through `upgrade()`); its stale results are ignored. Not changed.

Tests run at `03fc5ac` (local, Node 22.22.0, pinned deps via `npm ci --ignore-scripts`, Playwright Chrome Headless Shell 156):
- `npm run check`: OPSEC/type/lint pass; 126 unit/property pass, 1 opt-in large test skipped.
- `npm run build` twice: full `dist` tree byte-identical; `sha256sum -c SHA256SUMS` all five OK.
- Full Playwright suite, retries 0: 37 passed, 1 skipped (opt-in memory spec). Offline `file://` passed in this environment.
- Known flake, not a regression: the 50ms main-thread responsiveness test failed once at `800b9cc` (84ms gap at
  `change-dispatched`) and once on unmodified `0b448d8` in a separate worktree; it passed 5/5 isolated and in later full runs. Threshold unchanged.
- Not run: Firefox/WebKit, 2GiB browser/Node memory acceptance, live network, release workflow. Hash/trust/transport source,
  workflows, gates and lockfile are unchanged versus `0b448d8` (`git diff --stat` empty for those paths).

## Still open

No exact-head native CI exists for this branch (CI runs only on main pushes, PRs or manual dispatch). Getting it needs a draft PR
or a dispatch on this head; see the PR note in the final status. R1 (live upgrade + reference verification), unsigned commits/signing,
human accessibility/Spanish/usability, audit/rebuild and release controls remain open as in `docs/HANDOFF_20261024.md`.
U-N1 (language remount discards transient receipts; old operations are not aborted on remount) is still a product decision.
The missing old checkpoint `1e0fd6b3d4e1d1b89b3ad01b78cc28a4c93c08dc` has not been recovered. No merge, release, tag or deployment.

Detail: [UI evidence](docs/LOCAL_UI_ACCEPTANCE_20261025.md), then [historical handoff](docs/HANDOFF_20261024.md).
Recovery: fetch the branch, check out the verified commit, `npm ci --ignore-scripts`, `npm run check`, `npm run build`,
then `node_modules/.bin/playwright test --retries=0` (set `CHROMIUM_PATH` if a system Chromium is used).
Keep the original 2GiB/<200MiB RSS/540s/50ms gates; never infer live browser CORS from Node probes or add a backend to work around R1.

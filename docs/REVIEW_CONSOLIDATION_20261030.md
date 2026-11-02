# Consolidated candidate changed-range review

Review date: 2026-10-31 UTC (executor date). Reviewer: `/root/candidate_review`, with a focused independent R1 subreview by `/root/candidate_review/r1_review`. This is internal agent review for audit preparation, not REL-3 independent security-audit evidence.

Read-only scope: uncommitted tracked diff against main `da9b0a3626e702381f2ad1d1b1d4cd3128fde2dd`, plus untracked human-gate documents and opt-in Bob/Finney diagnostic. Read `CONTRIBUTING.md`, the consolidation plan and relevant SPEC requirements. No applicable AGENTS.md was present in this repository/parents. Applied Engineering Suite code-review-and-quality guidance. No source, repository index, branch, commit or browser changes were made by this reviewer; scratch reproductions are under `/workspace/work/unaltered/`.

## Findings reported to root

### P2 — Pending/unreadable notice promises unchanged bytes even when another calendar extends the pending proof

- Location at initial review: `src/ui/views/verify.ts:219`, using `src/ui/strings.ts:114` and the Spanish equivalent.
- Trigger: a receipt names Alice and Bob; Alice returns a valid richer timestamp tree that is still pending, while Bob's browser read fails with NET_FAILED.
- Result: `upgrade()` legitimately returns `status: pending`, `changed: true`, and an unreadable calendar. The view displays both an upgraded-receipt download and the added notice saying “Your receipt is unchanged and still pending.” The unchanged claim is false in this mixed result.
- Concrete reproduction: `/workspace/work/unaltered/repro-review-pending.ts`, bundled to `.mjs` with the locked esbuild and executed with Node22.22.0. Output: `{"status":"pending","changed":true,"unreadable":true,"oldBytes":176,"newBytes":236}`. The proof starts with Alice+Bob pending attestations on a synthetic digest. Alice returns an append(09) child with another Alice pending attestation; Bob throws TypeError.
- Recommended correction: use neutral copy that the receipt remains pending without claiming unchanged bytes, and add the mixed readable-pending/unreadable browser regression. Root implemented this correction; the real-browser mixed-result regression failed on the old copy and passed after neutral EN/ES wording.

### P2 — New Bob/Finney diagnostic can declare a confirmed path PASS after that calendar's body was rejected

- Location at initial review: `scripts/lib/r1-calendars.mjs:30`, `:42` (new untracked file).
- Trigger: Alice supplies a successful upgrade so the overall app run is PASS/VERIFIED, while Bob responds HTTP200/ACAO* with a malformed body. The app reports Bob in `upgrade.failedCalendars`, but browser requestfailed has no transport failure for this readable200.
- Result: `classifyCalendars()` ignores the app's per-calendar failure and calls Bob CONFIRMED_READABLE. `overall()` then reports PASS. A readable200 containing only pending data also lacks per-target confirmed-proof attribution. Global VERIFIED can come entirely from Alice.
- Concrete reproduction: `/workspace/work/unaltered/repro-review-r1.mjs` passed under Node22.22.0 using a report with `classification: PASS`, `verify.state: VERIFIED`, Bob in `upgrade.failedCalendars`, and Bob's request status200/ACAO*. Output includes `result: CONFIRMED_READABLE` and overall PASS. Focused subreview evidence: `/workspace/work/unaltered/r1-review.md`.
- Recommended correction if retained: require structured target-specific confirmed-proof evidence; at minimum reject any failed target and do not equate200 alone with confirmation. Root instead chose the simpler bounded resolution: omit the newly imported optional diagnostic/scripts/tests/package test addition/template and record that branch material as deferred. This fully removes the new false-positive surface while preserving source branch/history.

## Other inspected changes

- Hash partial bytes are immediately digested and included in `done`; a reopened slice starts at the unhashed offset and retains its original slice end. Progress/yield cadence remains per accumulated chunk. EOF uses a separate one-byte view and checks extra bytes. New cancellation polls cover final data/EOF/progress/yield boundaries and hashBlob's WebCrypto return boundary.
- Root's abandoned-data-reader count limits unresolved or failed cancellation promises despite intervening successful progress. Only fulfilled cancellations release the budget; EOF-only one-byte probes do not count as full hashing buffers. Detailed independent hash review and controlled retention/cancellation reproductions are in `/workspace/work/unaltered/hash-review.md`.
- `NET_FAILED` is marked unreadable only on Upgrade, stays `ok:false`, and does not create a Bitcoin attestation or VERIFIED result. Readable404 remains ordinary pending. Timeout/HTTP/parser failures retain their own failure paths. No allowlist/CSP/runtime-dependency changes were introduced.
- Pending CORS mocks now exercise actual browser rejection, while confirmed responses retain permissive CORS. The added WebKit pageerror allowance is a fully anchored regex limited to the three allowlisted timestamp paths and64-hex commitments; it is not blanket pageerror suppression. Successful upgrade/Verify checks still follow.
- Language cases retain created receipts and pending network work, verify downloadable receipt contents, and assert unchanged calendar counts across language switches. These supplement the existing no-repeat hashing/verification cases.
- Browser memory test keeps540000ms digest wait and Chromium `<200 MiB` extra renderer RSS. Firefox/WebKit runs explicitly annotate that RSS is not measured. The new non-PR completion job runs3 repeats with retries0; every new Action reference is a full40-hex SHA matching existing main pins. The WebKit Worker.evaluate exception is explicit rather than catch-all diagnostic suppression.
- Human-gate documents are test scripts/draft Spanish strings, not claimed completed human evidence. Root is preparing authoritative current status separately; dated historical network statements are not new acceptance evidence.

No additional important changed-range defect found during this review. `git diff --check` passed at initial inspection. Full check/build/browser/memory acceptance belongs to root and is not duplicated by this review.

## Unresolved limitations and acceptance boundaries

- The main-thread fallback cannot interrupt a still-pending native read merely by polling. Blob BYOB cancellation may wait for the30s watchdog plus bounded cleanup. Pre-existing `readCrossCheckInput()` slice.arrayBuffer reads have no timeout/AbortSignal and can remain pending after abort; the hash reviewer demonstrated this in a controlled model. Root explicitly deferred a new cross-check design. Do not call fallback cancellation universally immediate or complete.
- The abandoned-reader budget assumes fulfilled cancellation releases the backend buffer. It bounds the model tested, not every possible browser/native backend allocation.
- Controlled synthetic stream models do not establish the original native stall cause. Native baseline/candidate A/B remains a separate evidence requirement if the baseline does not reproduce on this executor.
- Browser R1 plus reference verification must concern the same actual receipt. Network/TLS/proxy failures are blocked evidence, never confirmation. Bob/Finney confirmed compatibility remains unestablished after omitting the optional diagnostic.
- Root's frozen tested source SHA, final artifact identities, exact-head CI and actual human/native gates are required for final handoff. This review cannot substitute for them.

## Integrator resolution at source freeze

Both P2 findings are resolved in d09c240: neutral pending copy and the real-browser mixed-result regression; complete
omission of the new Bob/Finney diagnostic/scripts/tests/template/package entry. No other important finding remained in
this bounded changed-range review. Deferred existing cancellation/native/human limits above remain in the acceptance ledger.

## Final workflow correction

Sonar's d09c240 annotation was recovered from the public GitHub check page: ci.yml:175, implicit unpinned package fetch
through npx. f2e7d24017171475be23f9e069a91ae195fea2c3 replaces the new job's two Playwright invocations with the installed
CLI path. CLI version1.64.1 and memory-test collection executed; product/test bytes are unchanged from d09c240. Fresh
final-head automated review/CI remains distinct from the initial source evidence.

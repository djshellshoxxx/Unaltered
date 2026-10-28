# Local UI correctness checkpoint — 2026-10-25

Status: tested source/test commit `7a336258bcab55a1c37cb4d4c080497a14c17131`, prepared for the newly authorized checkpoint branch
`codex/ui-correctness-checkpoint-20261025`. Documentation-only checkpoint follows that source. No PR update or CI dispatch is planned.
Parent baseline and PR6 head: `0b448d887df89fab22f701810197e51285590e2b`, PR6 draft.
Native run40111133625 at that exact head passed all11 required jobs including three unchanged2GiB cases;
the informational network job failed. Those results do not certify this local descendant.

## Reproduced gaps and narrow changes

- **U-L2, receipt allocation:** both Verify and Upgrade read a1MiB+1 receipt via `File.arrayBuffer()` before the core rejected it.
  The browser oracle counted the call despite the displayed size error. Exactly1MiB was read and rejected by the parser for
  its synthetic invalid contents, establishing that the existing cap was not lowered. Both UI paths now check `File.size`
  against `LIMITS.maxInputBytes` before allocation, reusing `PROOF_TOO_LARGE` and its existing safe text. Core checks remain.
- **U-L1, completion ownership:** a pending receipt read completed into the visible Verify result after Cancel, new receipt,
  new source file, changed fragment fingerprint or removal of that fingerprint. A new verification could not start while
  the stale operation owned `busy`. An older Upgrade replaced a newer malformed-receipt error; a held calendar completion
  could even replace it with a download for the previous receipt. These were actual local Chromium observations, not static claims.
  The fix captures inputs/controller per Verify operation and checks generation/connection after each asynchronous boundary
  and before publishing, reporting errors or clearing actions. Explicit Cancel aborts its controller and resets the local UI.
  Input changes invalidate local ownership and clear old output. Upgrade uses independent selection/start generations.
  Already-issued requests may finish; obsolete results are ignored. No new remote-cancellation policy, persistence or service.
- **U-N1, language remount:** independent read-only review confirmed `onLang -> mountAll`, fresh view state and URL revocation.
  FR-14 requires translation but does not state transient receipt preservation. No implementation change made for this ambiguity.
  A future product decision must address both proof state and download URL lifetime without weakening opt-in storage defaults.

## Reproduction and verification

The new `tests/e2e/verify-boundaries.spec.ts` uses synthetic receipts, finite held File reads and synthetic held fetch responses.
It establishes UI ownership, not live CORS, calendar anchoring, trustworthiness of real headers or a security audit.
Before the fix, against the original baseline build (`3eca1bc11c262ee2`):

- Both over-limit read-count assertions failed (`['boundary.ots']` versus `[]`); both exact-limit checks passed.
- Five Cancel/input/fingerprint invalidation cases failed because `.verify-result` was not empty after the held read completed.
- Superseding Verify could not find an enabled Check action; a bounded follow-up network case reproduced the same busy ownership.
- After correcting an initial test-only expected-message typo, the isolated older-Upgrade oracle failed on its **post-release**
  assertion: the current error disappeared. A separate held-network Upgrade oracle failed the same post-release assertion.

Reproducible commands from `/workspace/Unaltered`:

```sh
npm run check
npm run build
CHROMIUM_PATH=/usr/bin/chromium XDG_CACHE_HOME=/tmp/unaltered-cache XDG_CONFIG_HOME=/tmp/unaltered-config node_modules/.bin/playwright test tests/e2e/verify-boundaries.spec.ts --retries=0
```

Fresh results (local Chromium154, Node24.19.0, pinned installed dependencies):

| Check | Actual result |
|---|---|
| `npm run check` | Exit0; OPSEC/type/lint pass;126 unit/property tests pass, optional Node2GiB case skipped |
| New browser command above, retries0 | All13 cases pass,6.4s |
| `playwright test tests/e2e/app.spec.ts --retries=0` with the same environment prefix |18 pass,1 fail,14.6s; offline `page.goto(file://...)` reports `ERR_BLOCKED_BY_ADMINISTRATOR` before app execution |
| Two builds, full `dist` tree SHA256 lists compared using `cmp` | Exit0, byte-identical; build id`12d81f84de619533`,35.0KiB gzip |
| `(cd dist && sha256sum -c SHA256SUMS)` | All five distributables pass |
| Original hash/memory fixtures, production hashing and workflows compared to0b448d8 | `git diff --exit-code` exit0; no gate or hash-source changes |
| Gitleaks8.30.1 staged source/test scan | No leaks; binary archive matches the existing CI SHA256 pin |

One `gpt-6-luna` worker reviewed the contract and production diff without edits and found no blocking issue; root owns all
implementation, browser execution and integration. No workers remain active. The final handoff scan and remote verification
are performed by root before reporting the checkpoint; no raw private research or real user file is included.

## Remaining / next slice

The owner subsequently authorized GitHub checkpointing. Publish only the named new branch after outgoing-diff/private-data/secret
review; verify `git ls-remote` equals the committed HEAD. Both existing main and PR6 heads must remain unchanged.
The inspected CI runs only for main pushes, PRs or manual dispatch; release workflow is manual only. No deployment workflow exists.
No automatic CI is expected for the isolated branch and none is dispatched; no new exact-head native result is claimed.
Merge is inappropriate: this source has no new native engine/OS/provenance/offline/memory acceptance, signing/R1/manual gates
remain open, and parent integration review is still required. No merge attempt or target change is planned.
Preserve the original memory acceptance and failure records in `HANDOFF_20261024.md`; do not restart a stale delayed-memory CI plan.
R1 remains open: native Alice/Finney submission succeeded but pending reads were not readable, Bob timed out, two explorer checks
passed; confirmed live upgrade plus independent reference verification remains unproved. Local environment tunnel/browser-policy
limits, signing, human accessibility/Spanish/usability, independent audit/rebuild and release controls remain as recorded there.

For integration review, compare source commit7a33625 with parent0b448d8. Then, when authorized, exercise the new13 browser cases
on pinned Chromium/Firefox/WebKit, unchanged full app/offline suite and original acceptance workflow on the exact proposed head.
This continuation did not rerun live services, registry provenance, optional Node2GiB or browser2GiB: hashing/trust/transport source
is unchanged and the historical native results are explicitly tied to0b448d8. Confirm U-N1's desired behavior before any related code.

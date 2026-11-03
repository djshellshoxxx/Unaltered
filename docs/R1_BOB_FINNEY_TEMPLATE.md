# Optional Bob/Finney diagnostic: target attribution and the same-receipt reference check

**Live Bob and Finney confirmed-path evidence remains BLOCKED.** This diagnostic and its offline synthetic tests do
not supply an existing anchored Bob/Finney receipt, a readable confirmed response, or independent verification.
They repair the false-PASS attribution described in [BRANCH_LEDGER_20261030.md](BRANCH_LEDGER_20261030.md).
The authoritative acceptance procedure remains [R1_ACCEPTANCE.md](R1_ACCEPTANCE.md), with actual results recorded in
[NETWORK.md](NETWORK.md). The Alice result does not establish either target.

The preserved diagnostic on `733079e` treated a readable HTTP200 plus the app's global PASS as confirmation for a
calendar. That could credit Bob for a malformed or still-pending response while Alice supplied the Bitcoin proof.
The repaired helper uses the app's capped receipt parser, and the runner requires both target-specific browser
acceptance and an independent check of exactly the receipt downloaded during that capture.

## Inputs and preparation

Use an original file and an existing receipt containing a pending attestation for the selected target. The commitment
must already exist at that calendar; an old-enough receipt that the target has anchored is needed for a confirmed-path
PASS. The bundled `.ots` test fixtures and the synthetic diagnostic tests are not such evidence. Run Bob and Finney
separately. Do not edit a receipt to invent a pending target or make a new calendar submission to satisfy this gate.

Use the repository's locked dependencies, build the current checkout, and provide its pinned Playwright Chromium
(or record the explicitly selected `CHROMIUM_PATH` browser). The diagnostic does not install dependencies, build the
app, download fixtures or headers, or change networking. Use the existing Python reference environment with
`opentimestamps==0.4.5` for the second step. Record the source commit and browser/version alongside the output.

## Step 1: capture the selected target through the existing R1 browser runner

```sh
npm run build
node scripts/r1-bob-finney.mjs bob /private/file /private/existing.ots /private/r1-results
# Run finney separately, with a receipt that actually contains Finney's pending attestation.
```

Before opening the browser, the diagnostic parses the receipt and derives a separate target-only input. It retains
only the selected target's existing pending attestations and the operation paths leading to them. It removes other
calendars and all pre-existing Bitcoin attestations, prunes empty branches, preserves the file digest, and checks that
digest against the supplied file. The original receipt is retained unchanged in the private evidence directory.
This is pruning existing proof branches; it creates no commitment and submits nothing.

The existing `scripts/r1-acceptance.mjs` runs once on that derived input under the app's real CSP and network rules.
For browser acceptance the capture must have the selected target's clean GET/200 response, no other calendar request,
no app/calendar/CSP failure, a newly downloaded valid receipt containing a Bitcoin attestation at the reported block,
and the app's Verify result `VERIFIED`. HTTP200 alone is never sufficient. Pending responses, malformed receipts,
unsupported receipts, missing inputs, missing browser/runtime/build, and network failures cannot PASS.

The command writes a fresh `bob-*` or `finney-*` directory containing `packet.json`, original/derived receipts, browser
output, and the captured download if one exists. The packet binds the source file, both input receipts, browser report
and downloaded receipt with SHA-256. It prints `browserAccepted`, the block height when available, and the directory.
**This step always exits 2 with status `BLOCKED`**, because the independent reference check is still required. A
successful browser capture reports `INDEPENDENT_REFERENCE_REQUIRED`; it does not close the target's acceptance gate.

## Step 2: verify that exact download independently, offline

Obtain the 80-byte header for the reported block from your own node or a source independent of the app's explorers,
as described in the authoritative R1 procedure. Save only its 160 hexadecimal characters in a local file. The
diagnostic fetches no header. Supply an accurate source description; the tool records this description but cannot
authenticate its provenance or independently establish membership in the Bitcoin chain.

```sh
UNALTERED_PYTHON=/path/to/reference-environment/bin/python \
  node scripts/r1-bob-finney.mjs --reference /private/r1-results/bob-XXXXXX \
  /private/file /private/header.hex 'own-node: operator-recorded source'
```

This checks every packet binding again, verifies that the supplied source file matches the browser input, and
reassesses the target-only capture. It invokes the existing `tests/differential/verify_reference.py` on a byte-identical
copy of the bound browser download. It requires the pinned reference version, successful process exit, matching file
digest, `ok: true`, a verified Bitcoin attestation at the browser's reported height, and the hash of the supplied header.
The source file and reference receipt are re-hashed after verification. A reference result about a different receipt,
file, height or header cannot satisfy this gate. Reference output is generated afresh; the old `--from-json` shortcut
is rejected.

Each oracle execution writes a new `reference-*` directory with the exact receipt/header used, reference output and
`result.json`; earlier preflight failures report `BLOCKED` without invoking the oracle. Only this second step can exit
0 with `PASS`. Other outcomes exit 2 with `BLOCKED` and the unmet reason. A PASS records the automated evidence checks
for the selected target and supplied receipt on that run; it is not a general guarantee about all calendar
responses, future availability, pending404 CORS, or other browsers. Hash bindings detect accidental substitution and
mixed runs; they are not signatures and do not authenticate a deliberately edited packet or dishonest source label.

The existing R1 procedure also requires the reference `verifiedTime` to equal the block time displayed by the app.
The existing browser runner records the height but does not expose that displayed time in its JSON, so this diagnostic
cannot automate the comparison. The operator must compare and record those two times before closing the acceptance
gate. A diagnostic `PASS` alone does not complete that manual check or establish the independent header's provenance;
keep full R1 acceptance **BLOCKED** while either item lacks evidence.

Every diagnostic result, including preflight errors and an automated `PASS`, explicitly reports
`scope: "automated-target-proof-and-reference-checks"`, `fullR1Acceptance: "BLOCKED"`, and
`remainingManualChecks: ["APP_DISPLAYED_TIME_COMPARISON", "INDEPENDENT_HEADER_PROVENANCE"]`. The automated component
may exit 0 after both code-based checks succeed; it never marks full R1 acceptance complete. The unchanged raw
browser/oracle outputs are retained separately as source evidence, not reclassified as full-gate results.

Keep the evidence private: it contains receipt bytes, digests, source metadata and local paths. Publish only reviewed,
non-sensitive evidence needed for the acceptance record. No production app code, CSP, endpoint, parser cap, browser
bypass, performance threshold, or existing R1 acceptance rule changes in this diagnostic.

## Offline checks and remaining acceptance

```sh
node --test tests/r1/r1-calendars.test.mjs
```

The negative controls cover the historical malformed200/other-calendar PASS and pending200/other-calendar PASS,
misleading URI bytes, target isolation, absent or invalid downloads, unchanged/pre-confirmed inputs, foreign requests,
CSP and transport failures, file/height mismatches, reference-input substitution, and missing/failed independent
verification. Positive tests use explicitly synthetic policy envelopes to test the decision logic. They provide no
live Bitcoin, browser, calendar, header-source, or R1 evidence. The suite also runs in the existing Node test command
under `npm test` and `npm run check`; running it performs no live calendar check.

| Target | Genuine pre-existing pending receipt | Target-only app/Bitcoin acceptance | Reference on same download | Status |
|---|---|---|---|---|
| Bob | Not supplied for this repair | Not run | Not run | **BLOCKED** |
| Finney | Not supplied for this repair | Not run | Not run | **BLOCKED** |

Once genuine inputs are available, run the two steps on an approved host with the app's existing network policy.
Record the exact source checkout, browser report, target, matching artifact hashes, independent header source,
reference output, displayed-time comparison, and remaining transport/CORS limits in the main acceptance record. Keep the existing R1 procedure
authoritative if this optional diagnostic and the acceptance documentation disagree.

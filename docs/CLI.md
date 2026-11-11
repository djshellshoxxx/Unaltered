# Command-line verifier

`dist/unaltered-cli-<version>.mjs` runs on Node.js 22 or newer and uses the same `src/core` code as the browser app.
It reads files locally. Only `verify` and `batch` contact the network: the two default block explorers, for Bitcoin
headers. `inspect`, `evidence`, `hash` and `verify-offline` make no network request. The CLI does not stamp or upgrade
receipts (ADR-011 scopes it to verification).

```sh
node dist/unaltered-cli-0.3.1.mjs <command> ...
```

## Commands

| Command | What it does | Browser equivalent |
|---|---|---|
| `hash <file>` | Prints the SHA-256 fingerprint as a `sha256sum`-compatible line | Fingerprint shown on Stamp |
| `verify [--json] <file> [receipt.ots]` | Verifies the receipt (default `<file>.ots`) against the file and an explorer quorum | Verify |
| `batch [--json] <file>...` | Verifies 1 to 50 files, each against `<file>.ots`, one at a time | Verify multiple files |
| `inspect [--json] <receipt.ots>` | Summarises a receipt offline: its SHA-256, size, the file fingerprint it was made for, claimed Bitcoin heights and pending calendars | Receipt details |
| `evidence <file> <receipt.ots> <out.zip>` | Writes the same evidence ZIP as the browser (`manifest.json`, `original.bin`, `receipt.ots`) | Download evidence bundle |
| `verify-offline ...` | Compares the receipt with a Bitcoin header you supply ([guide](OFFLINE_VERIFICATION.md)) | None |

Options go after the command and before the paths. `--json` prints JSON on standard output. `--` ends the options,
so a path after it may start with `--`. Any other argument that starts with `--` is a usage error.

## Exit codes

| Command | Codes |
|---|---|
| `verify` | 0 verified, 2 pending, 3 file differs, 4 invalid receipt, 5 sources disagree, 6 unreachable, 1 usage/other |
| `batch` | 0 every file verified, 2 nothing failed but at least one is pending, 8 at least one not verified, 1 usage/other |
| `inspect` | 0 receipt readable (this is **not** a verification), 4 invalid receipt, 1 usage/other |
| `evidence` | 0 bundle written, 3 receipt was made for another file, 4 invalid receipt, 1 usage/other |
| `verify-offline` | See the [offline guide](OFFLINE_VERIFICATION.md) |

Error messages go to standard error. They never include lower-layer messages, paths or stack traces.

## JSON formats

- `verify --json` prints `UNALTERED-VERIFICATION-REPORT/1`, the format the browser's **Download verification report**
  button produces. Bitcoin block evidence appears only for `VERIFIED`.
- `batch --json` prints `UNALTERED-BATCH-VERIFICATION/1`: one item per file in input order with `file`, `receipt`,
  `status`, and either `report` (an `UNALTERED-VERIFICATION-REPORT/1` object) or `error` (a generic message). The
  `summary` counts `verified`, `pending` and `notVerified`.
- `inspect --json` prints `UNALTERED-RECEIPT-INSPECTION/1` with `verification: "NOT_PERFORMED"`. Its status is
  `PENDING` or `BITCOIN_ATTESTATION_UNVERIFIED`. Heights are claims made by the receipt; run `verify` to check them.

None of these outputs is a signature. Keep the original file and the `.ots` receipt.

## Safety rules

- `batch` refuses duplicate paths, more than 50 files, and any path containing a control character, newline or
  carriage return, before it reads anything. One failed item never hides another item's result.
- `evidence` refuses an invalid receipt, a receipt made for a different file, and inputs above 16 MiB combined (the
  browser's limit). It never overwrites: an existing output file is an error, and a failed write removes the partial
  file. The manifest records `verification: NOT_PERFORMED`.
- `inspect` and `evidence` contact no server.

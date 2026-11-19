# Unaltered command-line interface

The CLI is built from the same core as the browser app. **Node.js 22 or newer** is required. This guide describes source functionality, not a signed release.

## Build and discover commands

```sh
npm ci --ignore-scripts
npm run check
npm run build
node dist/unaltered-cli-0.3.1.mjs
```

Use the actual filename emitted by your version's build. The no-argument invocation prints usage.

## Commands

```sh
node dist/unaltered-cli-0.3.1.mjs hash "example.pdf"
node dist/unaltered-cli-0.3.1.mjs verify "example.pdf" "example.pdf.ots"
node dist/unaltered-cli-0.3.1.mjs verify --json "example.pdf" "example.pdf.ots"
node dist/unaltered-cli-0.3.1.mjs inspect --json "example.pdf.ots"
node dist/unaltered-cli-0.3.1.mjs batch --json "a.txt" "b.txt"
node dist/unaltered-cli-0.3.1.mjs evidence "example.pdf" "example.pdf.ots" "evidence.zip"
node dist/unaltered-cli-0.3.1.mjs verify-offline "example.pdf" "example.pdf.ots" 850000 BLOCK_HASH header.hex
```

- **hash:** compute the local SHA-256 digest. Does not create a timestamp.
- **verify:** check file/receipt binding and available Bitcoin evidence. Defaults to `<file>.ots` if receipt is omitted. `--json` provides machine-readable results.
- **inspect:** parse and summarize receipt data offline. A successful inspection is **not** verification.
- **batch:** verify 1–50 files independently; each needs an exact matching `<file>.ots` receipt. JSON is available.
- **evidence:** create a ZIP containing the selected evidence and manifest, subject to the combined 16 MiB limit. Never overwrites an existing output. Exporting does not prove validity.
- **verify-offline:** compare the file and receipt with caller-supplied trusted block-header evidence; does not establish Bitcoin chain consensus. Replace `BLOCK_HASH` and `header.hex` with actual independently trusted evidence.

For `verify`, `batch`, and `inspect`, put `--json` before paths. Use `--` to terminate option parsing when a path starts with `--`.

## Exit codes

| Command | Code | Meaning |
|---|---|---|
| verify | 0 | VERIFIED |
| verify | 2 | PENDING |
| verify | 3 | NO_MATCH_FILE |
| verify | 4 | INVALID_PROOF |
| verify | 5 | SOURCES_DISAGREE |
| verify | 6 | UNREACHABLE |
| batch | 0 | All verified |
| batch | 2 | None failed, some pending |
| batch | 8 | One or more not verified |
| inspect | 0 | Receipt readable, not verified |
| inspect | 4 | Invalid receipt |
| evidence | 0 | Bundle written |
| evidence | 3 | Receipt belongs to another file |
| evidence | 4 | Invalid receipt |
| verify-offline | 0 | Supplied trusted header matches |
| verify-offline | 2–7 | Pending, mismatch or invalid evidence |
| any | 1 | Usage or other error |

## Automation practices

Treat exit status as authoritative rather than searching text output for "verified". Preserve stdout JSON as evidence, record the tool build code and exact source SHA, and distinguish PENDING/UNREACHABLE from INVALID_PROOF. Do not log sensitive file paths, receipt contents or JSON payloads to public CI logs.

The CLI cannot recreate a lost original file or receipt, and it cannot turn a pending proof into confirmed Bitcoin anchoring without additional evidence. Consult [offline verification](OFFLINE_VERIFICATION.md), [release requirements](RELEASE.md), and [threat model](THREAT_MODEL.md).

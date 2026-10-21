# Network facts (M0-3)

Status: **API shapes confirmed from primary sources; live browser CORS NOT yet confirmed.** The build environment used to
write this code cannot reach the calendars or explorers (egress is blocked), so nothing below was observed live.
`scripts/network-check.mjs` and the `network-check` CI job do that check from a networked machine. Paste the table it
prints into section 3 and update SPEC section 9. **Do not call risk R1 closed until that table says PASS.**

## 1. Calendar servers (OpenTimestamps)

Source: `opentimestamps/calendar.py` (python-opentimestamps 0.4.5) and `otsclient/cmds.py` (client 0.7.2).

| Operation | Request | Response |
|---|---|---|
| Submit | `POST <base>/digest`, body = the 32-byte commitment, `Accept: application/vnd.opentimestamps.v1` | `200`, a serialised timestamp tree (no file header) rooted at the commitment, normally one pending attestation |
| Upgrade | `GET <base>/timestamp/<lowercase hex commitment>`, same `Accept` | `200` tree with the Bitcoin attestation, or `404` while still pending |

The browser sends no custom headers beyond `Accept` (a CORS-safelisted header) and, for POST, no `Content-Type`, so no preflight is expected.

The commitment submitted is `sha256(fileDigest || 16 random bytes)` (per-file nonce, `os.urandom(16)` in the reference client),
or the root of a Merkle tree over several such values for batches. The calendar never sees the file digest.

## 2. Block explorers (Esplora API)

`mempool.space` and `blockstream.info` expose the Esplora API: `GET /api/block-height/<h>` returns the block hash as text;
`GET /api/block/<hash>/header` returns the 80-byte header as hex. The app reads the Merkle root (bytes 36-68, internal byte order,
which is what OpenTimestamps commits to) and the time (bytes 68-72, little-endian) from the header itself, and rejects a header
whose double-SHA-256 does not equal the hash the explorer claimed. The parser is tested against the real Bitcoin genesis block header
(`tests/unit/ots-flow.test.ts`).

## 3. Live results

Not yet recorded. Run `npm run network-check` on a networked machine (or read the `network-check` job summary in CI) and paste here:

| Host | Check | Status | Access-Control-Allow-Origin | Detail | Preflight | Result |
|---|---|---|---|---|---|---|
| (pending) | | | | | | |

## 4. If a host blocks browser calls (R1)

Options, in order of preference (SPEC section 9): (a) remove that host from `src/core/net/allowlist.ts` (the CSP is generated from
it) and use only hosts that allow CORS, provided at least two calendars and two explorers remain; (b) ship a CLI for stamping and keep
the browser for hashing and verification; (c) an optional relay, which adds a trusted party and needs its own ADR.

# Receipt-bound browser CORS qualification — 2026-11-05 UTC

The existing `browser-network-check.mjs` queried the originally submitted random root after POST. Calendar responses
attach pending attestations to transformed node commitments. A root lookup could therefore measure an unrelated
unknown-commitment404. The repaired standard probe validates/replays each POST body, follows its actual pending node,
and refuses proof-named calendars outside the unchanged application policy before any GET. It shares bounded transport
and protocol helpers with the optional research probe. Neither HTTP200 nor Bitcoin metadata establishes verification.

Run the existing emitted-app-CSP probe after a build:

```sh
node scripts/browser-network-check.mjs
```

The optional research harness separately permits only source-documented candidate hosts. It is not emitted-app
compatibility evidence and does not modify the app CSP or endpoint allowlist:

```sh
node scripts/cors-calendar-check.mjs --include-reference-pools
```

Both commands submit random protocol commitments only. Output omits commitments/proof bodies; requests omit credentials,
referrers and custom Content-Type, refuse redirects, cap bodies at256KiB and time out after15seconds. Parsed replies can
trigger at most four unique pending lookups. The research harness labels pool-identity overrides explicitly.

## Findings

- At22:11:20Z, actual Chromium156 research POSTs succeeded on Alice, Bob, Finney and all three official reference pools.
  Every receipt-bound pending GET failed browser reading with `TypeError`; separate header-only requests returned404
  without ACAO. `Accept: */*` did not help. Direct pool lookups of the same commitment also failed; pool POST proofs
  named the corresponding Alice/Bob/Finney calendar. No identity override is proposed for the app.
- Catallaxy's browser POST was unreadable. A separate random32-byte POST at22:15:58Z returned200 without ACAO; this is
  header-only evidence, not browser success. No candidate was promoted and no confirmed/reference claim is made here.
- A source-derived trailing-slash negative control returned400 at22:11:04Z. The server parses the entire path suffix
  as hexadecimal commitment bytes, so adding a slash changes the request into an invalid commitment.
- The corrected emitted-app-CSP probe at22:14:12Z reproduced unreadable pending lookups for the current three calendars.
  Both browser explorer genesis checks and header integrity checks passed; no CSP violation occurred.

The current [server routes](https://github.com/opentimestamps/opentimestamps-server/blob/1e955ea3b036453bf795505d923f2643f773810c/otsserver/rpc.py)
emit404 for pending or absent commitments. Its published [nginx example](https://github.com/opentimestamps/opentimestamps-server/blob/1e955ea3b036453bf795505d923f2643f773810c/contrib/nginx/a.pool.opentimestamps.org)
sets ACAO without `always`. Official [nginx documentation](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)
explains that this omits the header on404. This is consistent with the observed replies; private deployment configuration
was not inspected. The next operational step is operator-side CORS headers on error/pending responses, followed by the
receipt-bound browser probe and existing same-receipt confirmed-upgrade/reference acceptance. No operator was contacted.

The four reference defaults came from pinned [client source](https://github.com/opentimestamps/opentimestamps-client/blob/f3a9e92e4dcb89ed93396d71ec808b3290a438c4/otsclient/cmds.py#L186).
Exact commits, current maintenance dates, inspected LGPL-3.0-or-later license texts and live results are in the adjacent
JSON. No external implementation was copied into Unaltered. Seven focused Playwright tests, typecheck and lint passed.
The external CORS qualification remains failed; it is not reclassified as passing because submission worked.

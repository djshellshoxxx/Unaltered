# Proposal: CORS header on every calendar reply (`opentimestamps-server`)

Status: **prepared for the owner; not submitted.** No upstream issue or pull request was opened and no operator was
contacted. Prepared 2026-11-11 UTC for risk R1 ([NETWORK.md](../NETWORK.md), [ADR-014](../DECISIONS.md#adr-014-calendar-liveness-canary-for-unreadable-pending-upgrades)).

## Problem

A browser can read a cross-origin reply only if it carries `Access-Control-Allow-Origin`. The calendars answer
`GET /timestamp/<commitment>` for a pending or unknown commitment with `404` and **no** such header, while a completed
commitment's `200` carries `Access-Control-Allow-Origin: *`
([evidence](../evidence/cors-continuation-20261105.md), [Bob/Finney](../evidence/r1-targets-20261105.json),
[Alice](../evidence/browser-20261105-network.json)). A web client therefore sees the pending reply as an opaque
`TypeError`, the same signal as an outage. Non-browser clients are not affected.

## Cause (public source, pinned)

Repository `opentimestamps/opentimestamps-server`, commit `1e955ea3b036453bf795505d923f2643f773810c`:

- [`contrib/nginx/a.pool.opentimestamps.org`, lines 22–23](https://github.com/opentimestamps/opentimestamps-server/blob/1e955ea3b036453bf795505d923f2643f773810c/contrib/nginx/a.pool.opentimestamps.org#L22-L23)
  (file SHA-256 `1933092f0c0670611ebab76ca02edf062cefd4be2c4230d7d37bf282365d357e`):

  ```nginx
          add_header 'Access-Control-Allow-Origin' '*';
          add_header 'Access-Control-Allow-Methods' 'POST GET';
  ```

  Line 20 of the same block already uses `always` for `X-Proxy-Cache`, so the pattern is established in this file.
- [`otsserver/rpc.py`, lines 157–192](https://github.com/opentimestamps/opentimestamps-server/blob/1e955ea3b036453bf795505d923f2643f773810c/otsserver/rpc.py#L157-L192)
  (file SHA-256 `02acf866b49e76138ba9b18064fff9b881a4d88a1dfd402bd8f69344d8af8f32`) answers a pending or unknown
  commitment with `404`; lines 194–208 answer a completed one with `200`.

The [nginx `add_header` documentation](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header) states
that the header is added only when the response code is 200, 201, 204, 206, 301, 302, 303, 304, 307 or 308, and that
with the `always` parameter (nginx 1.7.5 and later) it is added regardless of the response code. That matches the
observed replies exactly. The configuration of the live Alice, Bob and Finney deployments was **not** inspected; the
published example is the only public source, so the fix below is a proposal for whoever operates each calendar.

## Minimal change

```diff
--- a/contrib/nginx/a.pool.opentimestamps.org
+++ b/contrib/nginx/a.pool.opentimestamps.org
@@ -19,8 +19,8 @@
         proxy_cache otsd;
         add_header X-Proxy-Cache $upstream_cache_status always;
 
-        add_header 'Access-Control-Allow-Origin' '*';
-        add_header 'Access-Control-Allow-Methods' 'POST GET';
+        add_header 'Access-Control-Allow-Origin' '*' always;
+        add_header 'Access-Control-Allow-Methods' 'POST GET' always;
 
         proxy_pass http://127.0.0.1:14788;
         proxy_set_header Host $host;
```

Only the first line is required for reading a pending `404`. The second is optional and shown for consistency.
No other directive, route or status code changes.

**Why this is safe.** The API is public and unauthenticated; `*` never allows credentials. The `404` bodies
(`Pending confirmation in Bitcoin blockchain`, `Not found`) are already readable by any non-browser client. With
`always`, error replies that nginx itself produces (for example `502` while the backend restarts) also become readable,
which lets web clients report them accurately instead of as an opaque failure.

**How to check after deployment** (any host, no submission):

```sh
curl -sS -o /dev/null -D - https://<calendar>/timestamp/00 | grep -i '^access-control-allow-origin'
```

An unknown commitment then shows `access-control-allow-origin: *` on its `404`. In this repository, the receipt-bound
browser probe (`node scripts/browser-network-check.mjs` after `npm run build`) should then read the pending lookups.

## Short neutral note an operator could act on

> Browser-based OpenTimestamps clients cannot read `GET /timestamp/<commitment>` replies for pending commitments:
> the `404` has no `Access-Control-Allow-Origin`, because nginx's `add_header` omits headers on 4xx/5xx unless
> `always` is set (nginx `ngx_http_headers_module` documentation). Completed `200` replies already carry `*`.
> Adding `always` to the existing `add_header 'Access-Control-Allow-Origin' '*';` line (as in
> `contrib/nginx/a.pool.opentimestamps.org`, lines 22–23 at commit `1e955ea`) would let web clients tell "still
> pending" from "server unreachable". The change exposes nothing that non-browser clients cannot already read.

## What the app does meanwhile

Until operators change this, Unaltered keeps such receipts pending and adds a per-calendar liveness hint from one fixed
public canary lookup ([ADR-014](../DECISIONS.md#adr-014-calendar-liveness-canary-for-unreadable-pending-upgrades)).
That hint says "probably still waiting for Bitcoin" at most; it never states that a receipt is pending as fact.

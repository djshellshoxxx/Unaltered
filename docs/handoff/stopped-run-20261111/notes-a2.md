# A2 notes — upstream CORS proposal document

Brief: `$SCRATCH_ROOT/briefs/A2.md`. Owned path: `docs/proposals/OTS_SERVER_CORS.md` only.
Worktree branch: `ws/a-proposal`, base `6ff1cbd`.

## Log

- Start: branch had no commits beyond 6ff1cbd and no NOTES.md, so this is a fresh start (no earlier agent).
- Read COMMON.md, A2.md, the prompt sections, cors-continuation-20261105.{md,json}, NETWORK.md, LANGUAGE_SWITCH.md
  (style reference for docs/proposals), scripts/opsec-check.sh.

## Plan

1. Fetch upstream sources at commit 1e955ea3b036453bf795505d923f2643f773810c (contrib/nginx/*, otsserver/rpc.py)
   and the nginx add_header documentation. Save raw copies under `$SCRATCH/sources/` (not committed).
2. Write the document in the brief's section order. Quote line numbers only from fetched files.
3. Commit, run `bash scripts/opsec-check.sh` and `npm run check`.

## Sources fetched (all read-only, anonymous; raw copies under `$SCRATCH/sources`, clones under `$SCRATCH/upstream`, `$SCRATCH/nginx-org`)

- `curl https://raw.githubusercontent.com/opentimestamps/opentimestamps-server/1e955ea3.../contrib/nginx/a.pool.opentimestamps.org`
  -> HTTP 200, 1805 bytes, sha256 1933092f0c0670611ebab76ca02edf062cefd4be2c4230d7d37bf282365d357e.
- same for `otsserver/rpc.py` -> HTTP 200, 21803 bytes, sha256 02acf866b49e76138ba9b18064fff9b881a4d88a1dfd402bd8f69344d8af8f32.
- `git fetch --depth 1 https://github.com/opentimestamps/opentimestamps-server.git 1e955ea3...` worked anonymously
  (public repo, read-only). Commit date 2026-11-03T17:06:16Z matches the repository evidence JSON. Blobs equal the raw
  downloads byte for byte. `contrib/nginx/` holds exactly ONE file: `a.pool.opentimestamps.org`
  (blob e4a695fa70fe7c650d2e60780ed2d9aa03dd4d08).
- api.github.com for that repo -> 403 ("GitHub access to this repository is not enabled for this session"). Not needed,
  did not call add_repo (session-level change outside my brief; anonymous git fetch already gives the tree).
- nginx.org: curl -> CONNECT 403 (egress policy); WebFetch -> ENOTFOUND (host not allowed). NOT fetched. Do not retry.
  Fallback that worked: the page's source in the website repository,
  `git fetch --depth 1 --filter=blob:none https://github.com/nginx/nginx.org.git HEAD` -> commit
  8422f139ba3026beb8fea388298a05a4b65c15da (2026-11-10), file `xml/en/docs/http/ngx_http_headers_module.xml`
  (sha256 551e793a...), whose `link` attribute is `/en/docs/http/ngx_http_headers_module.html`.

## Facts established from fetched files (line numbers are from the fetched files)

- nginx example, line 20: `add_header X-Proxy-Cache $upstream_cache_status always;` (already uses `always`).
- line 22: `add_header 'Access-Control-Allow-Origin' '*';` (no `always`) <- the line to change.
- line 23: `add_header 'Access-Control-Allow-Methods' 'POST GET';` (no `always`; only matters for preflight; leave).
- lines 18-27 are the `location /` block; line 19 `proxy_cache otsd;`, line 25 `proxy_pass http://127.0.0.1:14788;`.
- File is space-indented (no tabs).
- rpc.py: `get_timestamp` line 144; 400 at 150 (non-hex, max-age=31536000 at 152); 404 at 160 on KeyError;
  pending branch 163-170 (`Cache-Control: public, max-age=60` at 170, body = is_pending reason);
  unknown branch 172-188 (max-age=60 at 187, body `Not found` at 188); 200 at 194 (max-age=31536000 at 202).
- rpc.py never sets any Access-Control header; whole tree grep: only contrib/nginx lines 22-23.
- stamper.py 581-608 `is_pending`: reasons "Pending confirmation in Bitcoin blockchain" (587, 599) or
  "Timestamped by transaction %s; waiting for %d confirmations" (605-606).
- README.md 82-84: otsd needs a reverse proxy; "example configuration for nginx is provided under contrib/nginx".
- nginx doc source lines 56-61: header added only for 200, 201 (1.3.10), 204, 206, 301, 302, 303, 304,
  307 (1.1.16, 1.0.13), 308 (1.13.0). Lines 72-75: `always` (1.7.5) adds it regardless of the response code.
  Lines 63-70: inheritance only if no add_header on the current level.

## More sources (all fetched in this run, read-only)

- Reference library `opentimestamps/python-opentimestamps` at 8c3dc6fbdf6fcba054e78643e9df5eccd8c9fce4,
  `opentimestamps/calendar.py`: `get_timestamp` 100-119 (200 -> parse, 404 -> CommitmentNotFoundError with the first
  160 bytes of the body, line 32). Reads status and body only -> an extra response header changes nothing for it.
- Reference client `opentimestamps/opentimestamps-client` at f3a9e92e4dcb89ed93396d71ec808b3290a438c4:
  `otsclient/cmds.py` 328 debug line "Checking calendar %s for %s" (hex commitment), 333-334 warning with the 404
  reason; `otsclient/args.py` 34-35 `-v`; `otsclient/ots.py` 24-25 verbosity > 0 -> DEBUG. So `ots -v upgrade FILE.ots`
  prints the commitment it asks for. NOT executed here (no live calendar; did not run third-party code).
- nginx source `nginx/nginx` tag release-1.30.6 = commit fb0e979c6dd63c018958b41eeb844947c5c21264:
  `src/http/modules/ngx_http_headers_filter_module.c` 217-235 (the ten status codes), 247-249 (skip unless `always`).
  `src/http/ngx_http_upstream.c` 5117-5140 (`max-age` sets cache validity, any status), 3411-3455 (stores the
  upstream header), 1079-1126 + `src/http/ngx_http_file_cache.c` 1657 (`ngx_http_send_header` on a cache hit, so
  header filters incl. add_header run on hits too).
- Fetch standard source `whatwg/fetch` at 59afe349913d56898c947576216f1c2579308be7, `fetch.bs`:
  CORS check 7270-7303 (missing header -> failure 7277-7282; `*` only without credentials 7286-7287);
  failure -> network error 5884-5886; network error -> fetch() rejects with TypeError 9709-9710;
  header "get" joins repeated headers with ", " 689-699; preflight needs CORS check success AND ok status 7082-7083,
  else network error 7159; ok status = 200-299 line 1474; CORS-safelisted response-header names 1165-1178;
  "Basic safe CORS protocol setup" 10057-10080; "CORS protocol and HTTP caches" 10083-10113 (no Vary for `*`).
- Python stdlib http.server (local 3.13): no `do_<METHOD>` -> 501. rpc.py defines only do_POST (210) and do_GET (224).

## Diff

- Generated with `git diff` in `$SCRATCH/upstream` (checkout of the pinned commit, line 22 edited):
  `index e4a695f..1e57457`, 1 insertion, 1 deletion. Saved as `$SCRATCH/sources/proposed.diff`.
- `git apply --check` passes as generated AND with the two blank context lines stripped of their single space
  (so the doc can avoid trailing whitespace). GNU `patch -p1 --dry-run` passes too.

## Pitfalls / decisions

- DENIED by the session's permission classifier ("Code from External"): running nginx's `auto/configure` to build a
  local nginx for an end-to-end reproduction. I did NOT work around it. Consequence: the patched config was not
  exercised against a running nginx in this run -> state it in the doc and under UNVERIFIED. Claims about nginx
  behaviour rest on the documentation source and on reading the nginx 1.30.6 source.
- nginx.org is not reachable (curl 403 from the egress proxy, WebFetch ENOTFOUND). The nginx.org URL from the
  repository evidence is marked "not verified in this run"; the page's XML source in `nginx/nginx.org` was fetched.
- Do not cite line numbers of `src/core/ots/calendar.ts` in the doc: agent A1 is editing that file on another branch.
- Do not write `repo@sha` forms in the doc (opsec email regex needs a dotted tail, a bare sha would not match, but
  avoid the pattern anyway).
- `curl -I` (HEAD) is not the right check; use GET (`curl -i`). (nginx converts HEAD to GET when caching is on, so I
  make no claim about HEAD at all.)

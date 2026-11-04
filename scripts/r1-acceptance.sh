#!/usr/bin/env bash
# Opt-in R1 acceptance (docs/R1_ACCEPTANCE.md): app upgrade + verify in Chromium, then the reference implementation
# against a header from a third source. Uses an upstream receipt anchored in 2016; makes no new calendar submission.
# Run after `npm run build`. Exit 0 only if both steps pass.
set -euo pipefail
work="${1:-$(mktemp -d)}"
mkdir -p "$work"
work="$(cd "$work" && pwd)" # absolute: node and the reference step get exact paths, wherever the caller stood
# fetch <max-bytes> <curl args...>: every third-party fetch is bounded in time and size (curl has no overall timeout
# of its own, so a slow-drip or endless reply would otherwise hang the run or fill the work directory).
fetch() { local cap="$1"; shift; curl -fsS --connect-timeout 20 --max-time 120 --max-filesize "$cap" "$@"; }
base=https://raw.githubusercontent.com/opentimestamps/opentimestamps-client/master/examples
fetch $((1024 * 1024)) -o "$work/incomplete.txt" "$base/incomplete.txt"
fetch $((1024 * 1024)) -o "$work/incomplete.txt.ots" "$base/incomplete.txt.ots"
(cd "$work" && sha256sum -c - <<'SUMS'
05c4f616a8e5310d19d938cfd769864d7f4ccdc2ca8b479b10af83564b097af9  incomplete.txt
95673f2878cbcfdddded530bd2ad5f3fb04e13d2e659760d7c1386346fdd036c  incomplete.txt.ots
SUMS
)
status=0
node scripts/r1-acceptance.mjs "$work/incomplete.txt" "$work/incomplete.txt.ots" "$work/out" > "$work/browser.json" || status=$?
cat "$work/browser.json"
if [ "$status" -ne 0 ]; then
  echo "R1 browser step did not pass; reference step skipped." >&2
  exit "$status"
fi
# One value per line, so a path with spaces stays whole (and a JSON file read, not require()d as a module name).
report="$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(r.verify.upgradedReceiptPath ?? "");console.log(r.verify.block ?? "")' "$work/browser.json")"
NL=$'\n'; upgraded="${report%%$NL*}"; block="${report#*$NL}"
if [ -z "$upgraded" ] || ! [[ "$block" =~ ^[0-9]+$ ]]; then
  echo "R1 browser report names no downloaded receipt or block height; reference step skipped." >&2
  exit 1
fi
python3 -m venv "$work/venv" && "$work/venv/bin/pip" install -q opentimestamps==0.4.5
# Third source, independent of the app's explorers (mempool.space, blockstream.info). An own node is better.
# Caps: 32 MiB for the block JSON (it lists every transaction), 16 MiB for the raw block as hex (a block is <= 4 MB).
hash=$(fetch $((32 * 1024 * 1024)) "https://blockchain.info/block-height/$block?format=json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["blocks"][0]["hash"])')
if ! [[ "$hash" =~ ^[0-9a-f]{64}$ ]]; then
  echo "blockchain.info returned no usable block hash; reference step skipped." >&2
  exit 1
fi
# Download fully, then truncate: piping curl into head under pipefail makes curl exit 23 (SIGPIPE).
fetch $((16 * 1024 * 1024)) -o "$work/rawblock.hex" "https://blockchain.info/rawblock/$hash?format=hex"
header=$(head -c 160 "$work/rawblock.hex")
"$work/venv/bin/python" tests/differential/verify_reference.py "$work/incomplete.txt" "$upgraded" "$header"

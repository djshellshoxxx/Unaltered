#!/usr/bin/env bash
# Opt-in R1 acceptance (docs/R1_ACCEPTANCE.md): app upgrade + verify in Chromium, then the reference implementation
# against a header from a third source. Uses an upstream receipt anchored in 2016; makes no new calendar submission.
# Run after `npm run build`. Exit 0 only if both steps pass.
set -euo pipefail
work="${1:-$(mktemp -d)}"
mkdir -p "$work"
base=https://raw.githubusercontent.com/opentimestamps/opentimestamps-client/master/examples
curl -fsS -o "$work/incomplete.txt" "$base/incomplete.txt"
curl -fsS -o "$work/incomplete.txt.ots" "$base/incomplete.txt.ots"
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
read -r upgraded block < <(node -e 'const r=require(process.argv[1]);console.log(r.verify.upgradedReceiptPath, r.verify.block)' "$work/browser.json")
python3 -m venv "$work/venv" && "$work/venv/bin/pip" install -q opentimestamps==0.4.5
# Third source, independent of the app's explorers (mempool.space, blockstream.info). An own node is better.
hash=$(curl -fsS "https://blockchain.info/block-height/$block?format=json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["blocks"][0]["hash"])')
# Download fully, then truncate: piping curl into head under pipefail makes curl exit 23 (SIGPIPE).
curl -fsS -o "$work/rawblock.hex" "https://blockchain.info/rawblock/$hash?format=hex"
header=$(head -c 160 "$work/rawblock.hex")
"$work/venv/bin/python" tests/differential/verify_reference.py "$work/incomplete.txt" "$upgraded" "$header"

#!/usr/bin/env bash
# opsec-check.sh: flag identity and metadata leaks before they are committed or pushed.
# Run locally before every push; CI runs it too. Exit code 1 if any finding.
#
# Checks:
#   1. Effective git identity looks like a no-reply address
#   2. Commit author/committer emails in history are no-reply addresses
#   3. Tracked text files contain no personal email addresses
#   4. Tracked text files contain no personal home-directory paths
#   5. package.json has no "author" field
#   6. Tracked images/PDFs carry no embedded metadata (needs exiftool; falls back to a crude scan)
#
# Allow-listed emails: *@users.noreply.github.com, noreply@*, *@example.com, *@example.org, *@*.invalid
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repository"; exit 2; }

findings=0
fail() { echo "  [FAIL] $*"; findings=$((findings + 1)); }
warn() { echo "  [warn] $*"; }
ok()   { echo "  [ ok ] $*"; }

EMAIL_RE='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
is_allowed_email() {
  case "$1" in
    *@users.noreply.github.com|noreply@*|*@example.com|*@example.org|*@*.invalid) return 0 ;;
    *) return 1 ;;
  esac
}

SELF="scripts/opsec-check.sh"

echo "== 1. git identity (effective for this repo)"
name="$(git config user.name || true)"
email="$(git config user.email || true)"
if [ -z "$email" ]; then
  warn "no user.email set"
elif is_allowed_email "$email"; then
  ok "user.email is a no-reply address"
else
  fail "user.email is not a no-reply address (set it with: git config user.email 'handle@users.noreply.github.com')"
fi
[ -n "$name" ] && echo "       user.name = $name  (confirm this is your project handle, not your real name)"

echo "== 2. commit history emails"
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  bad=0
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "history contains non-no-reply email: $e"; bad=1; fi
  done < <(git log --all --format='%ae%n%ce' | sort -u)
  [ "$bad" -eq 0 ] && ok "all author/committer emails are no-reply"
else
  ok "no commits yet"
fi

echo "== 3. emails in tracked text files"
bad=0
while IFS= read -r -d '' f; do
  [ "$f" = "$SELF" ] && continue
  file --mime "$f" 2>/dev/null | grep -q 'charset=binary' && continue
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "$f contains email: $e"; bad=1; fi
  done < <(grep -Eoh "$EMAIL_RE" "$f" 2>/dev/null | sort -u)
done < <(git ls-files -z)
[ "$bad" -eq 0 ] && ok "no personal emails found"

echo "== 4. personal paths in tracked text files"
bad=0
while IFS= read -r -d '' f; do
  [ "$f" = "$SELF" ] && continue
  file --mime "$f" 2>/dev/null | grep -q 'charset=binary' && continue
  if grep -Eqn '(/home/[A-Za-z0-9._-]+/|/Users/[A-Za-z0-9._-]+/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+)' "$f" 2>/dev/null; then
    fail "$f contains a home-directory path"; bad=1
  fi
done < <(git ls-files -z)
[ "$bad" -eq 0 ] && ok "no home-directory paths found"

echo "== 5. package.json author"
if [ -f package.json ] && grep -Eq '"(author|contributors|maintainers)"[[:space:]]*:' package.json; then
  fail "package.json has an author/contributors/maintainers field; remove it"
else
  ok "no author fields"
fi

echo "== 6. embedded metadata in tracked images/PDFs"
media=()
while IFS= read -r -d '' f; do media+=("$f"); done < <(git ls-files -z -- '*.jpg' '*.jpeg' '*.png' '*.tif' '*.tiff' '*.heic' '*.webp' '*.gif' '*.pdf' '*.mp4' '*.mov')
if [ "${#media[@]}" -eq 0 ]; then
  ok "no media files tracked"
elif command -v exiftool >/dev/null 2>&1; then
  for f in "${media[@]}"; do
    # Report any tag outside a tiny structural allow-list.
    extra="$(exiftool -s -G1 -a "$f" 2>/dev/null \
      | grep -Evi '^\[(System|File|Composite|JFIF|PNG|PDF)\]|ExifTool|ImageSize|Megapixels' || true)"
    if [ -n "$extra" ]; then fail "$f has embedded metadata:"; echo "$extra" | head -5 | sed 's/^/         /'; fi
  done
else
  warn "exiftool not installed; doing a crude scan only (install exiftool for a real check)"
  for f in "${media[@]}"; do
    if grep -aqE 'Exif|GPS|<x:xmpmeta|Photoshop 3\.0' "$f" 2>/dev/null; then
      fail "$f appears to contain EXIF/GPS/XMP data"
    fi
  done
fi

echo
if [ "$findings" -eq 0 ]; then
  echo "opsec-check: PASS"
  exit 0
else
  echo "opsec-check: $findings finding(s). Fix before pushing."
  exit 1
fi

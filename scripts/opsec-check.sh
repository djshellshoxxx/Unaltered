#!/usr/bin/env bash
# opsec-check.sh: flag identity and metadata leaks before they are committed or pushed.
# Run locally before every push; CI runs it too. Exit code 1 if any finding; 2 if git cannot be read (never a PASS).
#
# Checks:
#   1. Effective author and committer identity (as `git var` resolves it) is a no-reply address
#   2. Commit author/committer emails in history are no-reply addresses
#   3. Tracked text files contain no personal email addresses
#   4. Tracked text files contain no personal home-directory paths
#   5. package.json has no "author" field
#   6. Tracked images/PDFs carry no embedded metadata (needs exiftool; falls back to a crude scan)
#
# Allow-listed emails: *@users.noreply.github.com, noreply@*, *@example.com, *@example.org, *@*.invalid
set -u

# Exit 2 (never PASS) whenever git cannot answer: every check below reads git, and an empty answer looks clean.
die() { echo "opsec-check: $*" >&2; echo "opsec-check: INCOMPLETE, not a pass (exit 2)." >&2; exit 2; }
top="$(git rev-parse --show-toplevel 2>/dev/null)" || top=""
{ [ -n "$top" ] && cd "$top"; } || die "not inside a usable git repository (not a repository, dubious ownership or a broken worktree)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/opsec-check.XXXXXX")" || die "cannot create a private temporary directory"
trap 'rm -rf "$tmp"' EXIT
# git_to <file> <git args...>: run git into <file>; any failure stops the run with exit 2.
git_to() {
  local out="$1"; shift
  git "$@" > "$out" 2> "$tmp/git.err" || die "'git $*' failed: $(head -c 300 "$tmp/git.err" | tr '\n' ' ')"
}

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
# Vendored third-party agent tooling (not part of the app, never shipped): font licences and docs legitimately contain
# third-party contact addresses. Everything that is built from src/ is still checked.
VENDORED_RE='^(skills|shared)/'

echo "== 1. git identity (effective for this repo)"
# `git var` resolves what a commit would record: GIT_AUTHOR_*/GIT_COMMITTER_* and EMAIL, author.*/committer.*
# and user.* config, else an auto-derived login@hostname. Reading user.email alone misses all of those overrides.
for role in author committer; do
  if [ "$role" = author ]; then ident_var=GIT_AUTHOR_IDENT; else ident_var=GIT_COMMITTER_IDENT; fi
  if ! ident="$(git var "$ident_var" 2>/dev/null)"; then
    warn "git has no $role identity, so it refuses to commit (set: git config user.email 'handle@users.noreply.github.com')"
    continue
  fi
  name="${ident%% <*}"; email="${ident#*<}"; email="${email%%>*}"
  if is_allowed_email "$email"; then
    ok "$role email is a no-reply address"
  else
    fail "$role email is not a no-reply address: $email (git takes it from ${ident_var%_IDENT}_EMAIL, EMAIL, $role.email, user.email or login@hostname; set: git config user.email 'handle@users.noreply.github.com')"
  fi
  echo "       $role name = $name  (confirm this is your project handle, not your real name)"
done

echo "== 2. commit history emails"
git_to "$tmp/history" log --all --format='%ae%n%ce'
if [ -s "$tmp/history" ]; then
  bad=0
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "history contains non-no-reply email: $e"; bad=1; fi
  done < <(sort -u "$tmp/history")
  [ "$bad" -eq 0 ] && ok "all author/committer emails are no-reply"
else
  ok "no commits yet"
fi

git_to "$tmp/tracked" ls-files -z
git_to "$tmp/media" ls-files -z -- '*.jpg' '*.jpeg' '*.png' '*.tif' '*.tiff' '*.heic' '*.webp' '*.gif' '*.pdf' '*.mp4' '*.mov'

echo "== 3. emails in tracked text files"
bad=0
while IFS= read -r -d '' f; do
  [ "$f" = "$SELF" ] && continue
  [[ "$f" =~ $VENDORED_RE ]] && continue
  file --mime "$f" 2>/dev/null | grep -q 'charset=binary' && continue
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "$f contains email: $e"; bad=1; fi
  done < <(grep -Eoh "$EMAIL_RE" "$f" 2>/dev/null | sort -u)
done < "$tmp/tracked"
[ "$bad" -eq 0 ] && ok "no personal emails found"

echo "== 4. personal paths in tracked text files"
bad=0
while IFS= read -r -d '' f; do
  [ "$f" = "$SELF" ] && continue
  [[ "$f" =~ $VENDORED_RE ]] && continue
  file --mime "$f" 2>/dev/null | grep -q 'charset=binary' && continue
  if grep -Eqn '(/home/[A-Za-z0-9._-]+/|/Users/[A-Za-z0-9._-]+/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+)' "$f" 2>/dev/null; then
    fail "$f contains a home-directory path"; bad=1
  fi
done < "$tmp/tracked"
[ "$bad" -eq 0 ] && ok "no home-directory paths found"

echo "== 5. package.json author"
if [ -f package.json ] && grep -Eq '"(author|contributors|maintainers)"[[:space:]]*:' package.json; then
  fail "package.json has an author/contributors/maintainers field; remove it"
else
  ok "no author fields"
fi

echo "== 6. embedded metadata in tracked images/PDFs"
media=()
while IFS= read -r -d '' f; do [[ "$f" =~ $VENDORED_RE ]] && continue; media+=("$f"); done < "$tmp/media"
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

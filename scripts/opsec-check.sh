#!/usr/bin/env bash
# opsec-check.sh: flag identity and metadata leaks before they are committed or pushed.
# Run locally before every push; CI runs it too. Exit code 1 if any finding; 2 if git cannot be read (never a PASS).
#
# Checks:
#   1. Effective author and committer identity (as `git var` resolves it) is a no-reply address
#   2. History emails are no-reply addresses: commit authors/committers, annotated-tag taggers, commit/tag messages
#   3. Tracked text files contain no personal email addresses
#   4. Tracked text files contain no personal home-directory paths
#      (3 and 4 read HEAD, the index and changed working-tree files as git stores them; symlinks by their target)
#   5. package.json has no "author" field
#   6. Tracked images, documents, audio and video (any extension case) carry no embedded metadata
#      (needs exiftool: without it every tracked media file is a finding; a crude scan names obvious markers).
#      Other binary files are listed as not inspected.
#
# Allow-listed emails: *@users.noreply.github.com, noreply@*, *@example.com, *@example.org, *@*.invalid
set -u
export LC_ALL=C # byte-wise matching: grep never skips a non-UTF-8 text file as "binary"

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
# A home directory with a user name: /home/name, /Users/name (trailing slash optional), and C:\Users\name with
# single, escaped (JSON/JS "C:\\Users\\name") or forward slashes.
HOME_RE='(/home/[A-Za-z0-9._-]+|/Users/[A-Za-z0-9._-]+|[A-Za-z]:(\\+|/)Users(\\+|/)[A-Za-z0-9._-]+)'
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

echo "== 2. history emails (commit authors/committers, tag taggers, commit and tag messages)"
git_to "$tmp/history" log --all --format='%ae%n%ce'
git_to "$tmp/taggers" for-each-ref --format='%(taggeremail)'
git_to "$tmp/messages" log --all --format='%B'
git_to "$tmp/tag-messages" for-each-ref --format='%(contents)' refs/tags
if [ -s "$tmp/history" ] || [ -s "$tmp/taggers" ]; then
  bad=0
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "history contains non-no-reply email: $e"; bad=1; fi
  done < <(sort -u "$tmp/history")
  while IFS= read -r e; do
    e="${e#<}"; e="${e%>}"
    [ -z "$e" ] && continue
    if ! is_allowed_email "$e"; then fail "annotated tag tagger email is not a no-reply address: $e"; bad=1; fi
  done < <(sort -u "$tmp/taggers")
  # Messages are pushed too (Co-authored-by:/Signed-off-by: trailers, prose). GitHub App bots sign off as
  # "name[bot] <address>"; that address is the service's, not a person's.
  while IFS= read -r e; do
    if ! is_allowed_email "$e"; then fail "a commit or tag message contains email: $e (find it: git log --all -F --grep='$e'; git tag -n99)"; bad=1; fi
  done < <(cat "$tmp/messages" "$tmp/tag-messages" | sed -E 's/\[bot\] <[^>]*>/[bot]/g' | grep -aEoh "$EMAIL_RE" | sort -u)
  [ "$bad" -eq 0 ] && ok "all author/committer/tagger emails and emails in messages are no-reply"
else
  ok "no commits yet"
fi

# Content checks 3, 4 and 6 read what can be pushed or committed, as git stores it: every blob in HEAD and in the index
# (so a symlink is read as its stored target, never followed), plus working-tree files that differ from the index.
# Each distinct (content, path) is copied once to files[n] (keeping a lower-case extension for exiftool); labels[n]
# names it in findings and links[n]=1 marks a symlink (its content is a target path, never media).
git_to "$tmp/index" ls-files -s -z
if git rev-parse -q --verify HEAD >/dev/null 2>&1; then git_to "$tmp/head" ls-tree -r -z --full-tree HEAD; else : > "$tmp/head"; fi
git_to "$tmp/changed" diff-files --name-only -z
mkdir "$tmp/items" || die "cannot create $tmp/items"
NL=$'\n'; TAB=$'\t'
n=0; seen="$NL"; files=(); labels=(); links=(); exts=(); binary=()
skip_path() { [ "$1" = "$SELF" ] || [[ "$1" =~ $VENDORED_RE ]]; }
set_ext() { # set_ext <path>: lower-case extension of the file name in $ext ("" if none)
  local base="${1##*/}"; ext=""
  case "$base" in ?*.*) ext="${base##*.}" ;; esac
  case "$ext" in *[A-Z]*) ext="$(printf '%s' "$ext" | tr 'A-Z' 'a-z')" ;; esac
  case "$ext" in *[!a-z0-9]*) ext="" ;; esac
}
next_item() { # next_item <path> <label> <is_link>: reserve files[n] for the content about to be written
  set_ext "$1"
  files[n]="$tmp/items/$n${ext:+.$ext}"; labels[n]="$2"; links[n]="$3"; exts[n]="$ext"
}
add_blob() { # add_blob <sha> <path> <label> <mode>
  case "$seen" in *"$NL$1 $2$NL"*) return 0 ;; esac
  seen="$seen$1 $2$NL"
  if [ "$4" = 120000 ]; then next_item "$2" "$3" 1; else next_item "$2" "$3" 0; fi
  git cat-file blob "$1" > "${files[n]}" 2> "$tmp/git.err" || die "'git cat-file blob $1' ($2) failed: $(head -c 300 "$tmp/git.err" | tr '\n' ' ')"
  n=$((n + 1))
}
while IFS= read -r -d '' rec; do # <mode> <sha> <stage>\t<path>
  path="${rec#*$TAB}"; meta="${rec%%$TAB*}"; mode="${meta%% *}"; sha="${meta#* }"; sha="${sha%% *}"
  skip_path "$path" && continue
  [ "$mode" = 160000 ] && continue # submodule commit, not content
  add_blob "$sha" "$path" "$path" "$mode"
done < "$tmp/index"
while IFS= read -r -d '' rec; do # <mode> <type> <sha>\t<path>
  path="${rec#*$TAB}"; meta="${rec%%$TAB*}"; mode="${meta%% *}"; type="${meta#* }"; sha="${type#* }"; type="${type%% *}"
  skip_path "$path" && continue
  [ "$type" = blob ] || continue
  add_blob "$sha" "$path" "$path (committed in HEAD)" "$mode"
done < "$tmp/head"
while IFS= read -r -d '' path; do
  skip_path "$path" && continue
  if [ -L "$path" ]; then
    next_item "$path" "$path (working tree)" 1
    readlink -- "$path" > "${files[n]}" || die "cannot read the symlink $path"
  elif [ -f "$path" ]; then
    sha="$(git hash-object -- "$path" 2>/dev/null)" || die "cannot read $path"
    case "$seen" in *"$NL$sha $path$NL"*) continue ;; esac
    seen="$seen$sha $path$NL"
    next_item "$path" "$path (working tree)" 0
    cat -- "$path" > "${files[n]}" || die "cannot read $path"
  else
    continue # deleted in the working tree; its index and HEAD content were read above
  fi
  n=$((n + 1))
done < "$tmp/changed"
i=0
while [ "$i" -lt "$n" ]; do
  if file --mime "${files[i]}" 2>/dev/null | grep -q 'charset=binary'; then binary[i]=1; else binary[i]=0; fi
  i=$((i + 1))
done
# Media for check 6, by extension in any case (IMG_0001.JPG, .HEIC, .MOV): images, camera raw, documents, audio, video.
MEDIA_EXT=' jpg jpeg jpe jfif png apng gif tif tiff webp heic heif avif jxl dng cr2 cr3 nef arw orf rw2 raf psd
  pdf doc docx xls xlsx ppt pptx odt ods odp rtf epub mp3 m4a aac wav flac ogg oga opus aif aiff wma
  mp4 m4v mov qt avi mkv webm 3gp wmv '
OPAQUE_EXT=' ots ' # OpenTimestamps receipts: digests, operations and calendar URLs; no metadata fields
in_list() { [ -n "$1" ] && case "$2" in *[[:space:]]"$1"[[:space:]]*) true ;; *) false ;; esac; }
media=(); unread=()
i=0
while [ "$i" -lt "$n" ]; do
  if [ "${links[i]}" -eq 0 ] && in_list "${exts[i]}" "$MEDIA_EXT"; then media+=("$i")
  elif [ "${binary[i]}" -eq 1 ] && [ -s "${files[i]}" ] && ! in_list "${exts[i]}" "$OPAQUE_EXT"; then unread+=("$i"); fi
  i=$((i + 1))
done

# scan <regex> <file>: write the matches to $tmp/found; status 1 if none. A read error stops the run (exit 2).
scan() {
  grep -aEoh -- "$1" "$2" > "$tmp/found"
  case $? in 0) return 0 ;; 1) return 1 ;; *) die "cannot read the copy of a tracked file ($2)" ;; esac
}

echo "== 3. emails in tracked text files (HEAD, index and working tree)"
bad=0; i=0
while [ "$i" -lt "$n" ]; do
  if [ "${binary[i]}" -eq 0 ] && scan "$EMAIL_RE" "${files[i]}"; then
    while IFS= read -r e; do
      if ! is_allowed_email "$e"; then fail "${labels[i]} contains email: $e"; bad=1; fi
    done < <(sort -u "$tmp/found")
  fi
  i=$((i + 1))
done
[ "$bad" -eq 0 ] && ok "no personal emails found"

echo "== 4. personal paths in tracked text files (HEAD, index and working tree)"
bad=0; i=0
while [ "$i" -lt "$n" ]; do
  if [ "${binary[i]}" -eq 0 ] && scan "$HOME_RE" "${files[i]}"; then
    fail "${labels[i]} contains a home-directory path"; bad=1
  fi
  i=$((i + 1))
done
[ "$bad" -eq 0 ] && ok "no home-directory paths found"

echo "== 5. package.json author"
if [ -f package.json ] && grep -Eq '"(author|contributors|maintainers)"[[:space:]]*:' package.json; then
  fail "package.json has an author/contributors/maintainers field; remove it"
else
  ok "no author fields"
fi

echo "== 6. embedded metadata in tracked images, documents, audio and video (HEAD, index and working tree)"
if [ "${#media[@]}" -eq 0 ]; then
  ok "no media files tracked"
elif command -v exiftool >/dev/null 2>&1; then
  # Report any tag outside a tiny structural allow-list of exact [group] tag names. Whole groups are never allowed:
  # [PDF] and [PNG] also hold Author/Creator/Producer/Title/Comment, and [File] holds a JPEG Comment.
  # Anything unexpected, including [ExifTool] Error/Warning lines and stderr, is a finding (fail closed).
  ALLOW='^\[System\][[:space:]]'
  ALLOW="$ALLOW|^\[ExifTool\][[:space:]]+ExifToolVersion[[:space:]]*:"
  ALLOW="$ALLOW|^\[File\][[:space:]]+(FileType|FileTypeExtension|MIMEType|ImageWidth|ImageHeight|EncodingProcess|BitsPerSample|ColorComponents|YCbCrSubSampling|ExifByteOrder)[[:space:]]*:"
  ALLOW="$ALLOW|^\[JFIF\][[:space:]]+(JFIFVersion|ResolutionUnit|XResolution|YResolution)[[:space:]]*:"
  ALLOW="$ALLOW|^\[PNG(-pHYs|-cHRM)?\][[:space:]]+(ImageWidth|ImageHeight|BitDepth|ColorType|Compression|Filter|Interlace|Palette|Transparency|BackgroundColor|SignificantBits|Gamma|SRGBRendering|PixelsPerUnitX|PixelsPerUnitY|PixelUnits|WhitePointX|WhitePointY|RedX|RedY|GreenX|GreenY|BlueX|BlueY|AnimationFrames|AnimationPlays)[[:space:]]*:"
  ALLOW="$ALLOW|^\[PDF\][[:space:]]+(PDFVersion|Linearized|PageCount)[[:space:]]*:"
  ALLOW="$ALLOW|^\[Composite\][[:space:]]+(ImageSize|Megapixels)[[:space:]]*:"
  for i in "${media[@]}"; do
    out="$(exiftool -s -G1 -a "${files[i]}" 2>&1)"; rc=$?
    extra="$(printf '%s\n' "$out" | grep -Ev "$ALLOW")"
    if [ "$rc" -ne 0 ] || ! printf '%s\n' "$out" | grep -Eq '^\[ExifTool\][[:space:]]+ExifToolVersion[[:space:]]*:'; then
      fail "${labels[i]}: exiftool could not read it (exit $rc), so embedded metadata cannot be ruled out:"
    elif [ -n "$extra" ]; then
      fail "${labels[i]} has embedded metadata:"
    else
      continue
    fi
    [ -n "$extra" ] && printf '%s\n' "$extra" | head -n 5 | sed 's/^/         /'
  done
else
  # Fail closed: a byte scan cannot rule metadata out (a TIFF GPS IFD is numeric, PDF Info can sit in a compressed
  # object stream), so without exiftool every tracked media file is a finding. The scan only names obvious markers.
  warn "exiftool not installed: each tracked media file counts as a finding until exiftool checks it (apt install libimage-exiftool-perl, brew install exiftool)"
  CRUDE_RE='[Ee][Xx][Ii][Ff]|GPS|xmpmeta|ns\.adobe\.com/xap|Photoshop 3\.0|tEXt|iTXt|zTXt|/(Author|Creator|Producer|Title|Subject|Keywords)|ID3|INFOI[A-Z]{3}'
  for i in "${media[@]}"; do
    if scan "$CRUDE_RE" "${files[i]}"; then
      fail "${labels[i]}: embedded metadata found (marker '$(head -n 1 "$tmp/found")'); exiftool is needed for a full check"
    else
      fail "${labels[i]}: embedded metadata cannot be ruled out without exiftool"
    fi
  done
fi
if [ "${#unread[@]}" -gt 0 ]; then
  list=""; for i in "${unread[@]}"; do list="$list${list:+, }${labels[i]}"; done
  warn "not inspected by any check (binary, not a known media type; e.g. archives): $list"
fi

echo
if [ "$findings" -eq 0 ]; then
  echo "opsec-check: PASS"
  exit 0
else
  echo "opsec-check: $findings finding(s). Fix before pushing."
  exit 1
fi

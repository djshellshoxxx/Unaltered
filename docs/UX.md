# UX (UX-1)

Four hash-routed views: **Stamp** (`#stamp`), **Verify** (`#verify`, includes Upgrade), **About** (`#about`), **Settings** (`#settings`).
A share link is `…/index.html#h=<64 hex>`; it opens Verify with the fingerprint pre-filled (FR-11). It never contains a file name.

## Stamp
1. Choose one or more files (drop zone is a labelled native file input, fully keyboard operable).
2. Per file: type detected by magic bytes. JPEG/PNG: "Remove hidden data" is **on**; the cleaned copy must be downloaded before **Create receipt** enables; a photo stored rotated needs an explicit acknowledgement. Everything else (and cleaning turned off): "This file type may contain hidden data we cannot remove" plus a required acknowledgement. PDFs get a specific warning. Damaged images are refused.
3. The fingerprint (of the cleaned copy where one exists) is shown in groups of eight with Copy.
4. **Create receipt** (or "Create N receipts"): one request per calendar. Result: calendar list with ✔/✖, the pending notice, the "keep this receipt" notice, the receipt download, share link, and (opt-in) a label field.

## Verify
Inputs: the file (or a fingerprint from a link) and the `.ots` receipt. Output is one of six states, each with icon + text + colour (never colour alone):

| State | Icon | Title |
|---|---|---|
| VERIFIED | ✔ | Verified |
| PENDING | ⏳ | Not yet confirmed |
| NO_MATCH_FILE | ✖ | No match: this file is different |
| INVALID_PROOF | ✖ | The receipt is not valid |
| SOURCES_DISAGREE | ⚠ | Do not trust: sources disagree |
| UNREACHABLE | ⚠ | Could not check |

VERIFIED always shows, on the same screen: block height, "no later than about <UTC time>", the agreeing explorers, **Trust level L1**, and the collapsible L2 instructions.
Upgrade (below Verify): choose a pending receipt, press "Check for confirmation"; a changed receipt is offered as a **new download**.

## About
What a receipt proves / does not prove, how it works, time semantics, privacy (Tor), limits of stripping, independent verification (L2), keep-your-receipt, anti-phishing.

## Settings
Language (English, Español), opt-in receipt list, advanced: choose among the built-in calendars/explorers and M, with the banner "Custom endpoints change who sees your activity." and one-click restore. Nothing is persisted except the receipt list when the user turns it on.

## Mandatory copy (SPEC section 11)
Present verbatim in `src/ui/strings.ts` and asserted by `tests/unit/ui.test.ts`.
**Open (UT-1):** a usability test with 3-5 non-technical people has not been done; the wording is unreviewed by non-technical readers.

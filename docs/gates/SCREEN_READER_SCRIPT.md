# Screen-reader and usability test script (human gate)

For a human tester. Automated checks (axe WCAG 2.2 AA, keyboard-only Playwright flows, 44 px targets, 360 px layout) pass in
CI, but they do not show that a person using a screen reader, or a non-technical person, can complete the tasks. This script
covers that gap (SPEC FR-14, SPEC section 11, UX.md "Open (UT-1)"). It needs no account, no network setup and no private files.

## Setup

- Build: `npm ci --ignore-scripts && npm run build`, then open `dist/web/index.html` (offline) or serve `dist/web` locally.
  Record the commit (`git rev-parse HEAD`).
- Screen readers, at least two: NVDA + Firefox on Windows; VoiceOver + Safari on macOS or iOS. TalkBack + Chrome on Android
  if available. Record names and versions.
- Test files (synthetic, nothing private): one small `.txt`, one generated JPEG with synthetic EXIF and rotation,
  one PNG. A second `.txt` that differs by one character. For Verify: use `tests/fixtures/ots/confirmed.ots` with its file
  if the maintainer supplies the pair, or a receipt made in step A.
- Stamping contacts the public calendars. Use throwaway files only. For sensitive use the app recommends Tor Browser.

## Record for every step

`Pass` / `Problem` / `Blocked`, what was announced (quote it), and anything confusing. Severity: **blocker** (cannot finish),
**serious** (finished only with help or by guessing), **minor**. No personal data in notes.

## A. Stamp (screen reader)

1. Load the page. Is the page title and the main heading announced? Does "Skip to content" work and keep the current view?
2. Move through the top navigation (Stamp, Verify, About, Settings). Is the current view announced?
3. Reach the file chooser with Tab only. Is it announced as a button/file input with a meaningful label? Choose the `.txt`.
4. Is the detected type and the fingerprint announced? Can you reach and use **Copy** for the fingerprint?
5. Is it clear that the file did not leave the device ("Your file stays on your device. Only its fingerprint is used.")?
6. Activate **Create receipt**. Is progress announced? Is each calendar result (✔/✖) announced in words, not only by symbol?
7. Is "Pending is not proof yet." announced? Is "Keep your receipt. We don't store it." announced near the download?
8. Download the receipt. Is the download link's purpose clear? Is the share link explained?

## B. Cleaning (JPEG)

1. Choose the JPEG. Is "Remove hidden data" announced as on, and is it clear why **Create receipt** is not yet available?
2. If the photo is stored rotated, is the acknowledgement checkbox reachable and understandable?
3. Download the cleaned copy. Does **Create receipt** become available, and is that change announced?
4. Ask: does the tester understand that cleaning removes some hidden data but is not full sanitization?

## C. Verify

1. Go to Verify. Choose the original `.txt` and its receipt; activate **Check**.
2. Is the result state announced with its title (e.g. "Not yet confirmed", "Verified") and not by colour or icon alone?
3. Repeat with the one-character-different `.txt`. Is "No match: this file is different" announced and understood?
4. For a confirmed receipt: are block height, "no later than about …" time, agreeing explorers and **Trust level L1**
   announced? Can the collapsible independent-check (L2) instructions be opened and read?
5. Ask: does the tester understand the receipt shows the file existed unchanged by a time, and does **not** prove who made
   it, when exactly it was created, or that its content is true?

## D. Upgrade

1. Below Verify, choose a pending receipt and activate **Check for confirmation**.
2. If still pending: is "pending, check later" announced and understood as "not an error, try later"?
3. If upgraded: is the new receipt offered as a new download, and is that announced?

## E. Settings and language

1. Switch to Español. Is the language change announced? Does focus stay sensible? Do results already on screen survive?
2. Repeat A.6–A.8 in Spanish (also feeds the Spanish review gate).
3. Turn on the receipt list. Is it clear what is stored, where (this browser only), and how to remove an entry?
4. Open the advanced endpoints. Is the banner "Custom endpoints change who sees your activity." announced? Does one-click
   restore work by keyboard?

## F. Usability (3–5 non-technical people, no screen reader required)

Give each person only the task, not instructions:
1. "Make a receipt for this file and keep it." 2. "Check whether this other file is the same one." 3. "Check later whether
the receipt is confirmed." Then ask them to explain, in their own words, what the receipt proves and what it does not.
Record time taken, where they hesitated, and any wording they misread. Do not correct them during the task.

## Hand back

The filled record per tester, screen reader/browser versions, the commit, and a list of problems by severity. Fixes are made
in code afterwards; this script does not change the app.

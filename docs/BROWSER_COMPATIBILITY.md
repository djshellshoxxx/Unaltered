# Browser compatibility qualification

The CI browser matrix runs the Playwright end-to-end suite in **Chromium, Firefox and WebKit**. The added smoke tests verify that the existing Stamp, Verify, About and Settings routes remain available, that native English/Spanish radio controls work, and that navigation produces no uncaught page errors.

## Manual browser acceptance

- Edge (Chromium): test navigation, file selection, stamping, receipt download, verify, upgrade, and QR print/recovery.
- Firefox: repeat the workflow and inspect download behavior and strict CSP diagnostics.
- Safari (WebKit): verify focus, language radios, file selection, PDF printing, and QR scanning. Avoid replacing native radios with a select until WebKit's documented style-src-attr behavior is resolved.
- Mobile Safari and Android Chrome: check touch targets, overflow, viewport zoom, upload from Files/Photos, and QR camera-image import.
- Offline: after the page is loaded, fingerprinting and local QR recovery must not require calendar or explorer access; online verification is expected to report network unavailability without false VERIFIED outcomes.

Automated browser-engine tests are not proof of physical-device testing. Record device, browser version, test SHA, results, and any failures before claiming mobile support. Do not relax CSP, verification criteria or retries to make tests pass.

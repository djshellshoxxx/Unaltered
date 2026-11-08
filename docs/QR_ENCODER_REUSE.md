# QR encoder reuse evaluation — November 2026

## Preferred upstream: Project Nayuki QR-Code-generator

- Source: https://github.com/nayuki/QR-Code-generator
- TypeScript implementation: `typescript-javascript/qrcodegen.ts`
- License: MIT (copyright Project Nayuki; preserve upstream copyright and permission notice)
- Features documented upstream: QR Model 2 versions 1–40, four error-correction levels, binary byte-mode segments, mask selection, deterministic module matrix.
- Recommendation: vendor a **pinned upstream revision** or use a controlled local dependency; retain MIT attribution, upstream URL, revision, local modifications, and tests. Avoid rewriting Reed–Solomon encoding or QR placement.
- Critical integration detail: use `QrSegment.makeBytes(frame)` and `QrCode.encodeSegments(...)` rather than text APIs. Verify returned QR version and ECC against the print planner and reject any unexpected automatic ECC boost. The printed mask identifier must be read from the actual generated symbol.
- Nayuki's MIT-licensed TypeScript encoder has now been vendored at `src/vendor/qrcodegen.ts` with its upstream license notice preserved. `src/core/archive/qr-encode.ts` now generates actual QR matrices and printable SVGs. An independent QR **decoder**, PDF integration and printed certificate are not yet implemented.

## Alternative: soldair/node-qrcode

- Source: https://github.com/soldair/node-qrcode
- License: MIT (package metadata)
- Provides browser rendering and byte segments; has a larger dependency surface and less direct access to low-level QR mask metadata than Nayuki.
- Suitable as a fallback if Nayuki integration fails qualification.

## Current implementation

`src/core/archive/qr-plan.ts` provides a conservative, deterministic printable QR plan for versions 10, 20, 30 and 40, accounting for the 80-byte archival header, four-module quiet zones, A4/Letter space, frame and page limits. Default correction is automatic; manual L/M/Q/H is honored. It is **planning only** and must not be presented as an encoded or scannable QR.

Before production: validate every planned capacity against the chosen encoder, implement real matrix generation and printed labels (including mask), integrate QR rendering, add decode/roundtrip interoperability tests, then PDF generation and offline scanning. The current optimizer intentionally samples four QR versions; it is not yet globally optimal over versions 1–40. The upstream TypeScript implementation has been copied with its MIT notice; review and CI qualification remain pending.

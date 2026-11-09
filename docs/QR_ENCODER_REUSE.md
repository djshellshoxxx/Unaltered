# QR encoder reuse evaluation — November 2026

## Preferred upstream: Project Nayuki QR-Code-generator

- Source: https://github.com/nayuki/QR-Code-generator
- TypeScript implementation: `typescript-javascript/qrcodegen.ts`
- License: MIT (copyright Project Nayuki; preserve upstream copyright and permission notice)
- Features documented upstream: QR Model 2 versions 1–40, four error-correction levels, binary byte-mode segments, mask selection, deterministic module matrix.
- Recommendation: vendor a **pinned upstream revision** or use a controlled local dependency; retain MIT attribution, upstream URL, revision, local modifications, and tests. Avoid rewriting Reed–Solomon encoding or QR placement.
- Critical integration detail: use `QrSegment.makeBytes(frame)` and `QrCode.encodeSegments(...)` rather than text APIs. Verify returned QR version and ECC against the print planner and reject any unexpected automatic ECC boost. The printed mask identifier must be read from the actual generated symbol.
- Nayuki's MIT-licensed TypeScript encoder has now been vendored at `src/vendor/qrcodegen.ts` with its upstream license notice preserved. `src/core/archive/qr-encode.ts` generates actual QR matrices rendered as local canvas symbols. The integration described below adds an independent QR decoder, printed certificates and browser PDF output.

## Alternative: soldair/node-qrcode

- Source: https://github.com/soldair/node-qrcode
- License: MIT (package metadata)
- Provides browser rendering and byte segments; has a larger dependency surface and less direct access to low-level QR mask metadata than Nayuki.
- Suitable as a fallback if Nayuki integration fails qualification.

## Historical planning prototype

`src/core/archive/qr-plan.ts` provides a conservative, deterministic printable QR plan for versions 10, 20, 30 and 40, accounting for the 80-byte archival header, four-module quiet zones, A4/Letter space, frame and page limits. Default correction is automatic; manual L/M/Q/H is honored. It is **planning only** and must not be presented as an encoded or scannable QR.

The original prototype still required work to validate every planned capacity against the chosen encoder, implement real matrix generation and printed labels (including mask), integrate QR rendering, add decode/roundtrip interoperability tests, then PDF generation and offline scanning. The current optimizer intentionally samples four QR versions; it is not yet globally optimal over versions 1–40. The upstream TypeScript implementation has been copied with its MIT notice; review and CI qualification remain pending.

## Completed integration path

The completion branch combines the existing Nayuki encoder with exact-version-pinned Apache-2.0 jsQR 1.4.0 for independent image decoding. Full source/license references and qualification limits are in `docs/DEPENDENCIES.md` and `docs/ARCHIVAL_QR_PROTOCOL.md`. Runtime files are bundled locally, never downloaded from a QR service. Recovery uses byte arrays, and both checksums and the standard .ots parser must succeed. The original draft's sampled QR versions have been replaced by all 40 versions and fixed physical print dimensions.

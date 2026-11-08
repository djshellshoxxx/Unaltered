import type { ArchivalQrSymbol } from './qr-encode';
import type { QrPaper } from './qr-plan';

/**
 * Offline printable archival sheet. Uses DOM construction rather than HTML
 * injection. Browser Print / Save as PDF is the current PDF export path.
 * This is a developer integration primitive, not yet wired into the app UI.
 */
export function createArchivalPrintSheet(
  symbols: readonly ArchivalQrSymbol[],
  receiptSha256: string,
  receiptBytes: number,
  paper: QrPaper = 'a4',
): HTMLElement {
  if (!symbols.length || !/^[0-9a-f]{64}$/i.test(receiptSha256))
    throw new Error('Invalid archival certificate data');
  if (!Number.isSafeInteger(receiptBytes) || receiptBytes < 1)
    throw new Error('Invalid receipt length');
  if (paper !== 'a4' && paper !== 'letter')
    throw new Error('Unsupported paper size');
  const root = document.createElement('section');
  root.className = 'unaltered-archival-sheet';
  root.dataset.paper = paper;
  const title = document.createElement('h1');
  title.textContent = 'UNALTERED — Archival Timestamp Proof';
  root.append(title);
  const description = document.createElement('p');
  description.textContent = 'Prove it existed. Prove it is unchanged. This sheet preserves an OpenTimestamps .ots receipt, not the original file. Independent verification also requires the original file.';
  root.append(description);
  const checksum = document.createElement('p');
  checksum.textContent = 'Receipt SHA-256: ' + receiptSha256.toLowerCase();
  root.append(checksum);
  const count = document.createElement('p');
  count.textContent = `Receipt: ${receiptBytes} bytes; QR symbols: ${symbols.length}; framing: UNALTERED-OTS-QR/1.`;
  root.append(count);
  for (const symbol of symbols) {
    const article = document.createElement('article');
    article.className = 'unaltered-archival-symbol';
    const heading = document.createElement('h2');
    heading.textContent = `Symbol ${symbol.index + 1} of ${symbol.total}`;
    article.append(heading);
    const canvas = document.createElement('canvas');
    const modulePixels = 6;
    const side = symbol.modules + 8;
    canvas.width = side * modulePixels;
    canvas.height = side * modulePixels;
    canvas.setAttribute('aria-label', `QR symbol ${symbol.index + 1} of ${symbol.total}`);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < symbol.modules; y++)
      for (let x = 0; x < symbol.modules; x++)
        if (symbol.matrix[y * symbol.modules + x] === 1)
          ctx.fillRect((x + 4) * modulePixels, (y + 4) * modulePixels, modulePixels, modulePixels);
    article.append(canvas);
    const metadata = document.createElement('p');
    metadata.textContent = `ISO/IEC 18004 QR Model 2; version ${symbol.version}; ${symbol.modules}×${symbol.modules} modules; ECC ${symbol.level}; mask ${symbol.mask}; byte mode; ${symbol.frame.length} encoded frame bytes; UNALTERED-OTS-QR/1; sequence ${symbol.index + 1}/${symbol.total}.`;
    article.append(metadata);
    root.append(article);
  }
  const instructions = document.createElement('p');
  instructions.textContent = 'Recovery: decode each QR in binary byte mode, parse the UNALTERED-OTS-QR/1 frame header, sort by frame index, concatenate payload bytes, and compare the SHA-256 digest above. Save the result as .ots and verify it with the original file using an independent OpenTimestamps client. Specification: github.com/djshellshoxxx/Unaltered/blob/main/docs/ARCHIVAL_QR_PROTOCOL.md (may move before release).';
  root.append(instructions);
  return root;
}

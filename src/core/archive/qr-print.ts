import type { ArchivalQrSymbol } from './qr-encode';
import type { QrPaper } from './qr-plan';
import { MAX_QR_PRINT_SYMBOLS } from './qr-limits';
import { el } from '../../ui/dom';

export interface CertificateContext {
  /** Optional, user-approved display label; never part of the receipt or QR payload. */
  documentLabel?: string;
  generatedAt?: string;
  verificationStatus?: 'not-checked' | 'pending' | 'verified';
  verifiedBitcoin?: { height: number; blockHash: string; blockTimeUtc: string; sourcesAgreeing: readonly string[] };
  appVersion?: string;
  buildId?: string;
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** Printable transport of exact .ots bytes, not an unsigned claim of Bitcoin verification. */
export function createArchivalPrintSheet(symbols: readonly ArchivalQrSymbol[], receiptSha256: string,
  receiptBytes: number, paper: QrPaper = 'a4', fileSha256?: string, context: CertificateContext = {}): HTMLElement {
  if (!symbols.length || symbols.length > MAX_QR_PRINT_SYMBOLS || !/^[0-9a-f]{64}$/i.test(receiptSha256) ||
      !Number.isSafeInteger(receiptBytes) || receiptBytes < 1 || !['a4', 'letter'].includes(paper) ||
      (fileSha256 !== undefined && !/^[0-9a-f]{64}$/i.test(fileSha256))) throw new Error('Invalid archival certificate data');
  if (context.documentLabel !== undefined && (context.documentLabel.length > 160 ||
      /[\\x00-\\x1f\\x7f]/.test(context.documentLabel))) throw new Error('Invalid certificate label');
  if (context.verificationStatus === 'verified' && (!context.verifiedBitcoin ||
      !Number.isSafeInteger(context.verifiedBitcoin.height) || context.verifiedBitcoin.height < 0 ||
      !/^[0-9a-f]{64}$/i.test(context.verifiedBitcoin.blockHash) ||
      !Number.isFinite(Date.parse(context.verifiedBitcoin.blockTimeUtc)) ||
      context.verifiedBitcoin.sourcesAgreeing.length < 2)) throw new Error('Verified certificate requires validated block evidence');
  if (context.verifiedBitcoin && context.verificationStatus !== 'verified') throw new Error('Unverified certificate cannot claim block evidence');
  for (const [index, symbol] of symbols.entries()) {
    if (symbol.index !== index || symbol.total !== symbols.length || !Number.isInteger(symbol.version) ||
        symbol.version < 1 || symbol.version > 40 || symbol.modules !== symbol.version * 4 + 17 ||
        symbol.matrix.length !== symbol.modules * symbol.modules || symbol.matrix.some(v => v !== 0 && v !== 1) ||
        symbol.frame.length < 81 || symbol.frame.length > 2953 || !['L', 'M', 'Q', 'H'].includes(symbol.level) ||
        !Number.isInteger(symbol.mask) || symbol.mask < 0 || symbol.mask > 7 ||
        hex(symbol.frame.subarray(44, 76)) !== receiptSha256.toLowerCase()) throw new Error('Inconsistent archival QR symbol metadata');
  }
  const id = hex(symbols[0]!.frame.subarray(12, 28));
  const totalPages = 2 + Math.ceil(Math.max(0, symbols.length - 2) / 4);
  const root = el('section', { class: 'unaltered-archival-sheet', 'data-paper': paper, 'aria-label': 'Archival receipt certificate' });
  const page = (number: number): HTMLElement => {
    const sheet = el('section', { class: 'archival-page', 'data-paper': paper, 'data-page': number },
      el('p', { class: 'archival-page-id' }, `UNALTERED / ${id} / Page ${number} of ${totalPages}`));
    root.appendChild(sheet);
    return sheet;
  };
  const footer = (sheet: HTMLElement): void => { sheet.appendChild(el('p', { class: 'archival-footer' },
    'Experimental beta · OpenTimestamps protocol by Peter Todd and contributors · Bitcoin · Independent receipt verification required.')); };
  const makeSymbol = (symbol: ArchivalQrSymbol): HTMLElement => {
    const side = symbol.modules + 8;
    const canvas = el('canvas', { width: side * 4, height: side * 4,
      'data-archival-frame': symbol.index, 'aria-label': `QR symbol ${symbol.index + 1} of ${symbol.total}` });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < symbol.modules; y++) for (let x = 0; x < symbol.modules; x++)
      if (symbol.matrix[y * symbol.modules + x] === 1) ctx.fillRect((x + 4) * 4, (y + 4) * 4, 4, 4);
    return el('article', { class: 'unaltered-archival-symbol' },
      el('h2', {}, `QR ${symbol.index + 1} / ${symbol.total}`), canvas,
      el('p', {}, `QR Model 2 (ISO/IEC 18004). V${symbol.version}; ${symbol.modules} × ${symbol.modules} modules; ECC ${symbol.level}; mask ${symbol.mask}; byte mode; ${symbol.frame.length} frame bytes.`),
      el('p', {}, `UNALTERED-OTS-QR/1; sequence ${symbol.index + 1}/${symbol.total}; compression 0 (none); 72 mm including 4-module quiet zone.`));
  };
  let sheet = page(1);
  sheet.appendChild(el('h1', {}, 'UNALTERED'));
  sheet.appendChild(el('h2', {}, 'Archival receipt certificate — not independently verified'));
  sheet.appendChild(el('p', { class: 'archival-digital-guidance' },
    el('strong', {}, 'Save the digital .ots receipt whenever possible. '),
    'These QR codes represent its exact original bytes as an extra backup. Keep the original document separately for verification. A receipt or printed certificate alone does not establish Bitcoin confirmation.'));
  if (context.documentLabel) sheet.appendChild(el('p', {}, 'Document label (user supplied, not authenticated): ' + context.documentLabel));
  sheet.appendChild(el('p', {}, 'Certificate generated (device clock, UTC): ' + (context.generatedAt ?? new Date().toISOString())));
  sheet.appendChild(el('p', {}, 'Verification at certificate generation: ' +
    (context.verificationStatus === 'verified' ? 'Verified against matching original file and independent Bitcoin header quorum' :
      context.verificationStatus === 'pending' ? 'Pending; no Bitcoin confirmation established' : 'Not independently checked; no Bitcoin confirmation established')));
  if (context.appVersion || context.buildId) sheet.appendChild(el('p', {},
    'Unaltered version: ' + (context.appVersion ?? 'unknown') + ' · build: ' + (context.buildId ?? 'unknown')));
  if (context.verifiedBitcoin) {
    sheet.appendChild(el('p', {}, 'Bitcoin block height: ' + context.verifiedBitcoin.height));
    sheet.appendChild(el('p', { class: 'archival-hash' }, 'Bitcoin block hash: ' + context.verifiedBitcoin.blockHash));
    sheet.appendChild(el('p', {}, 'Bitcoin block header time (UTC, miner supplied; not file creation time): ' + context.verifiedBitcoin.blockTimeUtc));
    sheet.appendChild(el('p', {}, 'Independent header sources agreeing: ' + context.verifiedBitcoin.sourcesAgreeing.join(', ')));
  } else sheet.appendChild(el('p', {}, 'Bitcoin block height, block hash and block time: unavailable — no independently verified Bitcoin anchor was supplied.'));
  if (fileSha256) sheet.appendChild(el('p', { class: 'archival-hash' }, 'File SHA-256 recorded in receipt: ' + fileSha256));
  sheet.appendChild(el('p', { class: 'archival-hash' }, 'Receipt SHA-256: ' + receiptSha256.toLowerCase()));
  sheet.appendChild(el('p', {}, `${receiptBytes} receipt bytes · ${symbols.length} symbols · All ${totalPages} pages belong to this certificate. Print at 100% scale with browser headers/footers disabled.`));
  let grid = el('div', { class: 'archival-grid' }); sheet.appendChild(grid);
  for (const symbol of symbols) {
    if (symbol.index === 2 || (symbol.index > 2 && (symbol.index - 2) % 4 === 0)) {
      footer(sheet); sheet = page(2 + Math.floor((symbol.index - 2) / 4));
      sheet.appendChild(el('h2', {}, 'Receipt data — retain every symbol'));
      grid = el('div', { class: 'archival-grid' }); sheet.appendChild(grid);
    }
    grid.appendChild(makeSymbol(symbol));
  }
  footer(sheet);
  const appendix = page(totalPages);
  appendix.appendChild(el('h2', {}, 'Offline recovery specification'));
  appendix.appendChild(el('p', {}, 'Decode each symbol as QR Code Model 2, byte mode. Preserve every decoded byte (including NUL and values above 127); do not convert payloads through Unicode text. The symbol includes its own version, error-correction and mask information. The printed labels are cross-checks, not replacement data.'));
  appendix.appendChild(el('p', { class: 'archival-hash' }, 'Proof identifier: ' + id + '. Receipt SHA-256: ' + receiptSha256.toLowerCase()));
  appendix.appendChild(el('pre', { class: 'archival-spec' }, [
    'UNALTERED-OTS-QR/1 · 80-byte header · unsigned big-endian integers',
    'Offset / bytes / meaning',
    '0 / 8 / ASCII UOTSQR01 (hex 55 4f 54 53 51 52 30 31)',
    '8 / 1 / version = 1', '9 / 1 / flags = 0', '10 / 1 / compression = 0 (none)',
    '11 / 1 / reserved = 0', '12 / 16 / proof identifier', '28 / 4 / frame index (zero-based)',
    '32 / 4 / total frame count', '36 / 4 / original receipt byte length',
    '40 / 4 / encoded byte length (equal to original)', '44 / 32 / SHA-256 of original receipt',
    '76 / 4 / this frame payload byte length', '80 / remaining / contiguous receipt payload bytes',
  ].join('\n')));
  appendix.appendChild(el('ol', {},
    el('li', {}, 'Group by proof identifier; require all repeated headers and full receipt hashes to agree. Reject unknown flags, version or compression. Frame index must be less than frame count; payload lengths must match actual bytes.'),
    el('li', {}, 'Sort by zero-based frame index and concatenate payloads. Identical duplicates may be ignored. Missing frames, conflicting duplicates and mixed certificates must not produce a receipt.'),
    el('li', {}, 'Require exactly the declared original byte length. Recompute SHA-256 and compare all 32 bytes with the header and the full printed checksum.'),
    el('li', {}, 'Recompute the identifier: SHA-256 of ASCII "UNALTERED-OTS-QR/1", one zero byte, then the original receipt bytes; compare its first 16 bytes.'),
    el('li', {}, 'Save the recovered bytes unchanged as receipt.ots. This transport does not modify the standard OpenTimestamps format. Verify with the original file and an independent OpenTimestamps implementation.')));
  appendix.appendChild(el('pre', { class: 'archival-spec' }, 'ots info receipt.ots\nots upgrade receipt.ots\nots verify --file ORIGINAL_FILE receipt.ots'));
  appendix.appendChild(el('p', {}, 'Reference tools: opentimestamps.org · github.com/opentimestamps/opentimestamps-client. Unaltered protocol source: github.com/djshellshoxxx/Unaltered, docs/ARCHIVAL_QR_PROTOCOL.md. Protocol v1 limits: 4096 frames, 2953 bytes per frame, 16 MiB receipt; this print interface limits output to 64 symbols.'));
  appendix.appendChild(el('p', {}, 'A damaged or missing QR cannot be restored from its label alone. Keep duplicate prints and the digital .ots file. QR error-correction percentages describe approximate codeword recovery, not guaranteed physical damage recovery. A pending receipt may need upgrading before Bitcoin verification; block time is not an exact file-creation time.'));
  footer(appendix);
  return root;
}

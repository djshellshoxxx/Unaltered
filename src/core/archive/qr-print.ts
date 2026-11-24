import type { ArchivalQrSymbol } from './qr-encode';
import type { QrPaper } from './qr-plan';
import { MAX_QR_PRINT_SYMBOLS } from './qr-limits';
import { archiveText } from '../../ui/archive-strings';
import { el } from '../../ui/dom';

export interface CertificateContext {
  /** Optional, user-approved display label; never part of the receipt or QR payload. */
  documentLabel?: string | undefined;
  generatedAt?: string;
  verificationStatus?: 'not-checked' | 'pending' | 'verified';
  verifiedBitcoin?: { height: number; blockHash: string; blockTimeUtc: string; sourcesAgreeing: readonly string[] } | undefined;
  appVersion?: string;
  buildId?: string;
}

/** A header quorum needs two different hosts; whitespace and letter case cannot create another source. */
function distinctSources(sources: readonly string[]): boolean {
  const hosts = new Set<string>();
  for (const source of sources) {
    const host = typeof source === 'string' ? source.trim().toLowerCase() : '';
    if (!host) return false;
    hosts.add(host);
  }
  return hosts.size >= 2;
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** Printable transport of exact .ots bytes, not an unsigned claim of Bitcoin verification. */
export function createArchivalPrintSheet(symbols: readonly ArchivalQrSymbol[], receiptSha256: string,
  receiptBytes: number, paper: QrPaper = 'a4', fileSha256?: string, context: CertificateContext = {}): HTMLElement & { relabel(): void } {
  if (!symbols.length || symbols.length > MAX_QR_PRINT_SYMBOLS || !/^[0-9a-f]{64}$/i.test(receiptSha256) ||
      !Number.isSafeInteger(receiptBytes) || receiptBytes < 1 || !['a4', 'letter'].includes(paper) ||
      (fileSha256 !== undefined && !/^[0-9a-f]{64}$/i.test(fileSha256))) throw new Error('Invalid archival certificate data');
  if (context.documentLabel !== undefined && (context.documentLabel.length > 160 ||
      Array.from(context.documentLabel).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) throw new Error('Invalid certificate label');
  if (context.verificationStatus === 'verified' && (!context.verifiedBitcoin ||
      !Number.isSafeInteger(context.verifiedBitcoin.height) || context.verifiedBitcoin.height < 0 ||
      !/^[0-9a-f]{64}$/i.test(context.verifiedBitcoin.blockHash) ||
      !Number.isFinite(Date.parse(context.verifiedBitcoin.blockTimeUtc)) ||
      !distinctSources(context.verifiedBitcoin.sourcesAgreeing))) throw new Error('Verified certificate requires validated block evidence');
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
  // Change the print language without redrawing any QR canvases or refreshing the generation time.
  const updates: Array<() => void> = [];
  type Key = Parameters<typeof archiveText>[0];
  type Values = Parameters<typeof archiveText>[1];
  const text = (key: Key, values?: Values): Text => {
    const node = document.createTextNode(archiveText(key, values));
    updates.push(() => { node.data = archiveText(key, values); });
    return node;
  };
  const label = (element: HTMLElement, key: Key, values?: Values): void => {
    const update = (): void => element.setAttribute('aria-label', archiveText(key, values));
    update();
    updates.push(update);
  };
  const root = el('section', { class: 'unaltered-archival-sheet', 'data-paper': paper });
  label(root, 'print.name');
  const page = (number: number): HTMLElement => {
    const sheet = el('section', { class: 'archival-page', 'data-paper': paper, 'data-page': number },
      el('p', { class: 'archival-page-id' }, text('print.page', { id, page: number, total: totalPages })));
    root.appendChild(sheet);
    return sheet;
  };
  const footer = (sheet: HTMLElement): void => { sheet.appendChild(el('p', { class: 'archival-footer' },
    text('print.footer'))); };
  const makeSymbol = (symbol: ArchivalQrSymbol): HTMLElement => {
    const side = symbol.modules + 8;
    const canvas = el('canvas', { width: side * 4, height: side * 4,
      'data-archival-frame': symbol.index });
    label(canvas, 'print.symbol', { index: symbol.index + 1, total: symbol.total });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < symbol.modules; y++) for (let x = 0; x < symbol.modules; x++)
      if (symbol.matrix[y * symbol.modules + x] === 1) ctx.fillRect((x + 4) * 4, (y + 4) * 4, 4, 4);
    return el('article', { class: 'unaltered-archival-symbol' },
      el('h2', {}, `QR ${symbol.index + 1} / ${symbol.total}`), canvas,
      el('p', {}, text('print.qr', { version: symbol.version, modules: symbol.modules, level: symbol.level, mask: symbol.mask, bytes: symbol.frame.length })),
      el('p', {}, text('print.transport', { index: symbol.index + 1, total: symbol.total })));
  };
  let sheet = page(1);
  sheet.appendChild(el('h1', {}, 'UNALTERED'));
  sheet.appendChild(el('h2', {}, text(context.verificationStatus === 'verified' ? 'print.name' : 'print.unverifiedTitle')));
  sheet.appendChild(el('p', { class: 'archival-digital-guidance' },
    el('strong', {}, text('archive.digitalFirst'), ' '),
    text('print.guidance')));
  if (context.documentLabel) sheet.appendChild(el('p', {}, text('print.label', { label: context.documentLabel })));
  sheet.appendChild(el('p', {}, text('print.generated', { date: context.generatedAt ?? new Date().toISOString() })));
  sheet.appendChild(el('p', {}, text('print.status'), ' ',
    text(context.verificationStatus === 'verified' ? 'print.verified' :
      context.verificationStatus === 'pending' ? 'print.pending' : 'print.unchecked')));
  if (context.appVersion || context.buildId) sheet.appendChild(el('p', {},
    text('print.build', { version: context.appVersion ?? '—', build: context.buildId ?? '—' })));
  if (context.verifiedBitcoin) {
    sheet.appendChild(el('p', {}, text('print.height', { value: context.verifiedBitcoin.height })));
    sheet.appendChild(el('p', { class: 'archival-hash' }, text('print.hash', { value: context.verifiedBitcoin.blockHash })));
    sheet.appendChild(el('p', {}, text('print.blockTime', { value: context.verifiedBitcoin.blockTimeUtc })));
    sheet.appendChild(el('p', {}, text('print.sources', { value: context.verifiedBitcoin.sourcesAgreeing.join(', ') })));
  } else sheet.appendChild(el('p', {}, text('print.noAnchor')));
  if (fileSha256) sheet.appendChild(el('p', { class: 'archival-hash' }, text('print.file', { value: fileSha256 })));
  sheet.appendChild(el('p', { class: 'archival-hash' }, text('print.receipt', { value: receiptSha256.toLowerCase() })));
  sheet.appendChild(el('p', {}, text('print.summary', { bytes: receiptBytes, symbols: symbols.length, pages: totalPages })));
  let grid = el('div', { class: 'archival-grid' }); sheet.appendChild(grid);
  for (const symbol of symbols) {
    if (symbol.index === 2 || (symbol.index > 2 && (symbol.index - 2) % 4 === 0)) {
      footer(sheet); sheet = page(2 + Math.floor((symbol.index - 2) / 4));
      sheet.appendChild(el('h2', {}, text('print.extra')));
      grid = el('div', { class: 'archival-grid' }); sheet.appendChild(grid);
    }
    grid.appendChild(makeSymbol(symbol));
  }
  footer(sheet);
  const appendix = page(totalPages);
  appendix.appendChild(el('h2', {}, text('print.appendix')));
  appendix.appendChild(el('p', {}, text('print.decode')));
  appendix.appendChild(el('p', { class: 'archival-hash' }, text('print.proofId', { id, sha: receiptSha256.toLowerCase() })));
  appendix.appendChild(el('pre', { class: 'archival-spec' }, text('print.layout')));
  appendix.appendChild(el('ol', {},
    el('li', {}, text('print.group')),
    el('li', {}, text('print.sort')),
    el('li', {}, text('print.digest')),
    el('li', {}, text('print.id')),
    el('li', {}, text('print.save'))));
  appendix.appendChild(el('pre', { class: 'archival-spec' }, 'ots info receipt.ots\nots upgrade receipt.ots\nots verify --file ORIGINAL_FILE receipt.ots'));
  appendix.appendChild(el('p', {}, text('print.reference')));
  appendix.appendChild(el('p', {}, text('print.damage')));
  footer(appendix);
  return Object.assign(root, {
    relabel(): void {
      for (const update of updates) update();
    },
  });
}

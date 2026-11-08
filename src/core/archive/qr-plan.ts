import { QR_BYTE_CAPACITY } from './qr-capacities';
import { MAX_QR_PRINT_SYMBOLS } from './qr-limits';

export type QrLevel = 'L' | 'M' | 'Q' | 'H';
export type QrPreference = 'auto' | QrLevel;
export type QrPaper = 'a4' | 'letter';
export interface QrPlan {
  version: number;
  modules: number;
  level: QrLevel;
  byteCapacity: number;
  framePayloadCapacity: number;
  symbols: number;
  symbolsPerPage: number;
  pages: number;
  moduleSizeMm: number;
  paper: QrPaper;
}
export interface QrPlanningOptions {
  preference?: QrPreference;
  paper?: QrPaper;
  minModuleMm?: number;
  maxPages?: number;
}
const LEVELS: readonly QrLevel[] = ['L', 'M', 'Q', 'H'];
/** The renderer uses two 72 mm symbols on the cover and four per continuation page.
 * One complete recovery-specification appendix is always included in the page count.
 */
export function planArchivalQr(receiptBytes: number, options: QrPlanningOptions = {}): QrPlan {
  const { preference = 'auto', paper = 'a4', minModuleMm = .35, maxPages = 18 } = options;
  if (!Number.isSafeInteger(receiptBytes) || receiptBytes < 1 || receiptBytes > 16 * 1024 * 1024)
    throw new Error('Invalid receipt byte length');
  if (!['auto', ...LEVELS].includes(preference) || !['a4', 'letter'].includes(paper))
    throw new Error('Invalid QR preference or paper');
  if (!Number.isFinite(minModuleMm) || minModuleMm < .25 || minModuleMm > 2 ||
      !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000)
    throw new Error('Invalid QR print limits');
  const candidates: QrPlan[] = [];
  for (let version = 1; version <= 40; version++) {
    const modules = version * 4 + 17;
    const moduleSizeMm = 72 / (modules + 8);
    if (moduleSizeMm < minModuleMm) continue;
    for (const [index, level] of LEVELS.entries()) {
      if (preference !== 'auto' && preference !== level) continue;
      const byteCapacity = QR_BYTE_CAPACITY[version - 1]![index]!;
      const framePayloadCapacity = byteCapacity - 80;
      if (framePayloadCapacity <= 0) continue;
      const symbols = Math.ceil(receiptBytes / framePayloadCapacity);
      const pages = 2 + Math.ceil(Math.max(0, symbols - 2) / 4);
      if (symbols > MAX_QR_PRINT_SYMBOLS || pages > maxPages) continue;
      candidates.push({ version, modules, level, byteCapacity, framePayloadCapacity,
        symbols, symbolsPerPage: 4, pages, moduleSizeMm, paper });
    }
  }
  if (!candidates.length) throw new Error('Receipt exceeds the 64-symbol print limit; keep the digital .ots file instead');
  candidates.sort((a, b) => a.pages - b.pages || LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) ||
    a.symbols - b.symbols || a.version - b.version);
  return candidates[0]!;
}

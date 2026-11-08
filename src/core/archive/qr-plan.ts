/**
 * Conservative printable QR planning. Capacities are ISO/IEC 18004 Model 2
 * byte-mode capacities; include byte-mode overhead, not archival frame headers.
 * This module does not render QR matrices. The eventual encoder must verify
 * exact capacity for each frame and expose the selected mask pattern.
 */
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
const FRAME_HEADER_BYTES = 80;
const LEVELS: readonly QrLevel[] = ['H', 'Q', 'M', 'L'];
const CAPACITIES: ReadonlyArray<{version:number; L:number; M:number; Q:number; H:number}> = [
  {version:10,L:271,M:213,Q:151,H:119},
  {version:20,L:858,M:666,Q:482,H:382},
  {version:30,L:1732,M:1370,Q:982,H:742},
  {version:40,L:2953,M:2331,Q:1663,H:1273},
];
export interface QrPlanningOptions {
  preference?: QrPreference;
  paper?: QrPaper;
  minModuleMm?: number;
  maxPages?: number;
}
export function planArchivalQr(receiptBytes: number, options: QrPlanningOptions = {}): QrPlan {
  const { preference = 'auto', paper = 'a4', minModuleMm = 0.35, maxPages = 100 } = options;
  if (!Number.isSafeInteger(receiptBytes) || receiptBytes < 1 || receiptBytes > 16 * 1024 * 1024)
    throw new Error('Invalid receipt byte length');
  if (!['auto','L','M','Q','H'].includes(preference) || !['a4','letter'].includes(paper))
    throw new Error('Invalid QR preference or paper');
  if (!Number.isFinite(minModuleMm) || minModuleMm < 0.25 || minModuleMm > 2)
    throw new Error('Invalid minimum module size');
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000)
    throw new Error('Invalid page limit');
  const width = paper === 'a4' ? 210 : 215.9;
  const height = paper === 'a4' ? 297 : 279.4;
  const printableWidth = width - 30;
  const printableHeight = height - 55;
  const plans: QrPlan[] = [];
  for (const entry of CAPACITIES) {
    const modules = 4 * entry.version + 17;
    const symbolWidth = (modules + 8) * minModuleMm; // four-module quiet zone each side
    // 20 mm per symbol reserved for technical label, with 5 mm gap.
    const columns = Math.floor(printableWidth / (symbolWidth + 5));
    const rows = Math.floor(printableHeight / (symbolWidth + 25));
    const symbolsPerPage = columns * rows;
    if (symbolsPerPage < 1) continue;
    for (const level of LEVELS) {
      if (preference !== 'auto' && preference !== level) continue;
      const byteCapacity = entry[level];
      const framePayloadCapacity = byteCapacity - FRAME_HEADER_BYTES;
      if (framePayloadCapacity <= 0) continue;
      const symbols = Math.ceil(receiptBytes / framePayloadCapacity);
      if (symbols > 4096) continue;
      const pages = Math.ceil(symbols / symbolsPerPage);
      if (pages > maxPages) continue;
      plans.push({ version:entry.version, modules, level, byteCapacity,
        framePayloadCapacity, symbols, symbolsPerPage, pages,
        moduleSizeMm:minModuleMm, paper });
    }
  }
  if (!plans.length) throw new Error('Receipt cannot fit within QR print limits');
  // Auto: prioritize page count, then resilient correction, then fewer symbols.
  // A single extra page may be worthwhile for stronger correction; this
  // policy chooses minimum pages first and is intentionally documented.
  const resilience = (level: QrLevel): number => LEVELS.indexOf(level);
  plans.sort((a,b) => a.pages-b.pages || resilience(a.level)-resilience(b.level) ||
    a.symbols-b.symbols || a.version-b.version);
  return plans[0]!;
}

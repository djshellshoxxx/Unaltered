import type { ArchivalQrSymbol } from '../../src/core/archive/qr-encode';
export function qrRaster(symbol: ArchivalQrSymbol, scale = 4): { data: Uint8ClampedArray; width: number; height: number } {
  const width = (symbol.modules + 8) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < symbol.modules; y++) for (let x = 0; x < symbol.modules; x++) {
    if (!symbol.matrix[y * symbol.modules + x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const at = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
      data[at] = data[at + 1] = data[at + 2] = 0;
    }
  }
  return { data, width, height: width };
}

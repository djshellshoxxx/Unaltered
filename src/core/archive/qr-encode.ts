import { qrcodegen } from '../../vendor/qrcodegen';
import { encodeReceiptFrames } from './frames';
import { planArchivalQr, type QrLevel, type QrPlanningOptions } from './qr-plan';

const ECC: Record<QrLevel, qrcodegen.QrCode.Ecc> = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};
export interface ArchivalQrSymbol {
  index: number;
  total: number;
  version: number;
  level: QrLevel;
  mask: number;
  modules: number;
  frame: Uint8Array;
  /** Row-major matrix, 1=dark, 0=light; excludes four-module quiet zone. */
  matrix: Uint8Array;
}
export async function encodeArchivalQr(receipt: Uint8Array, options: QrPlanningOptions = {}):
  Promise<{ symbols: ArchivalQrSymbol[]; plan: ReturnType<typeof planArchivalQr> }> {
  const plan = planArchivalQr(receipt.length, options);
  const frames = await encodeReceiptFrames(receipt, plan.byteCapacity);
  const symbols: ArchivalQrSymbol[] = frames.map((frame, index) => {
    const qr = qrcodegen.QrCode.encodeSegments(
      [qrcodegen.QrSegment.makeBytes([...frame])],
      ECC[plan.level], plan.version, plan.version, -1, false,
    );
    if (qr.version !== plan.version || qr.errorCorrectionLevel !== ECC[plan.level])
      throw new Error('QR encoder did not honor selected version/error correction');
    const matrix = new Uint8Array(qr.size * qr.size);
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++)
        matrix[y * qr.size + x] = qr.getModule(x, y) ? 1 : 0;
    return { index, total: frames.length, version: qr.version,
      level: plan.level, mask: qr.mask, modules: qr.size, frame, matrix };
  });
  return { symbols, plan };
}


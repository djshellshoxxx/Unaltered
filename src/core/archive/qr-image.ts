import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE } from './qr-limits';

export const MAX_QR_IMAGE_BYTES = 12 * 1024 * 1024;

/** Read bounded PNG/JPEG dimensions before asking the browser to allocate a decoded raster. */
export function qrImageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const checked = (width: number, height: number): { width: number; height: number } => {
    if (width < 21 || height < 21 || width > MAX_QR_IMAGE_SIDE || height > MAX_QR_IMAGE_SIDE ||
        width * height > MAX_QR_IMAGE_PIXELS) throw new Error('Unsupported QR image dimensions');
    return { width, height };
  };
  if (bytes.length < 12 || bytes.length > MAX_QR_IMAGE_BYTES) throw new Error('Unsupported QR image size');
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452)
      throw new Error('Invalid PNG header');
    return checked(view.getUint32(16), view.getUint32(20));
  }
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Choose a PNG or JPEG image');
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 255) throw new Error('Invalid JPEG marker');
    while (offset < bytes.length && bytes[offset] === 255) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++]!;
    // FF 00 is a stuffed data byte, not a segment: decoders resynchronise on the next marker, so skipping it by a
    // length would let a hidden frame header decide the decoded size while this gate reads a later decoy.
    if (marker === 0x00) throw new Error('Invalid JPEG marker');
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('Truncated JPEG segment');
    if (frameMarkers.has(marker)) {
      if (length < 8) throw new Error('Invalid JPEG frame');
      return checked(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset += length;
  }
  throw new Error('JPEG dimensions were not found');
}

// File type detection by magic bytes. Never trusts the extension (STR-1).
export type FileKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'wav' | 'mp3' | 'heic' | 'pdf' | 'video' | 'zip' | 'other';

const startsWith = (b: Uint8Array, sig: number[], off = 0): boolean => sig.every((v, i) => b[off + i] === v);
const ascii = (b: Uint8Array, off: number, s: string): boolean => [...s].every((c, i) => b[off + i] === c.charCodeAt(0));

export function detectKind(head: Uint8Array): FileKind {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(head, 0, 'GIF87a') || ascii(head, 0, 'GIF89a')) return 'gif';
  if (ascii(head, 0, 'RIFF') && ascii(head, 8, 'WEBP')) return 'webp';
  if (ascii(head, 0, 'RIFF') && ascii(head, 8, 'WAVE')) return 'wav';
  if (ascii(head, 0, 'RF64') && ascii(head, 8, 'WAVE')) return 'wav';
  if (ascii(head, 0, 'ID3')) return 'mp3';
  if (head[0] === 0xff && ((head[1] ?? 0) & 0xe6) === 0xe2) return 'mp3'; // MPEG-1/2/2.5 Layer III frame sync
  if (ascii(head, 0, '%PDF-')) return 'pdf';
  if (ascii(head, 4, 'ftyp')) {
    const brand = String.fromCharCode(head[8] ?? 0, head[9] ?? 0, head[10] ?? 0, head[11] ?? 0);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'heic';
    return 'video';
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]) || ascii(head, 0, 'OggS')) return 'video';
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'zip'; // also .docx/.xlsx/.pptx
  return 'other';
}

export async function detectBlob(blob: Blob): Promise<FileKind> {
  return detectKind(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
}

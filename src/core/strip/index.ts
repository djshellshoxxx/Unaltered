// stripMetadata (SPEC 5.2): allowlist rewriters for JPEG and PNG. Digest must be computed over `output`.
import { detectKind } from './detect';
import { cleanMp3, cleanWav, selfCheckAudio } from './audio';
import { cleanJpeg } from './jpeg';
import { cleanPng } from './png';

export type CleanFormat = 'jpeg' | 'png' | 'wav' | 'mp3';

export const MIME: Record<CleanFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg' };

export type StripOutcome =
  | { kind: 'cleaned'; format: CleanFormat; output: Blob; removed: string[]; orientation?: number }
  | { kind: 'unsupported'; reason: string } // caller MUST warn the user
  | { kind: 'rejected'; reason: string }; // malformed: caller MUST refuse

export const MAX_STRIP_BYTES = 256 * 1024 * 1024;

export async function stripMetadata(blob: Blob): Promise<StripOutcome> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const kind = detectKind(head);
  if (kind !== 'jpeg' && kind !== 'png' && kind !== 'wav' && kind !== 'mp3') {
    return { kind: 'unsupported', reason: 'This file type may contain hidden data we cannot remove.' };
  }
  if (blob.size > MAX_STRIP_BYTES) return { kind: 'rejected', reason: 'This image is too large to clean safely in the browser.' };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (kind === 'wav' || kind === 'mp3') {
    const r = kind === 'wav' ? cleanWav(bytes) : cleanMp3(bytes);
    if (r.kind !== 'cleaned') return r;
    const bad = selfCheckAudio(kind, r.output);
    if (bad) return { kind: 'rejected', reason: bad };
    return { kind: 'cleaned', format: kind, output: new Blob([r.output as BlobPart], { type: MIME[kind] }), removed: r.removed };
  }
  if (kind === 'jpeg') {
    const r = cleanJpeg(bytes);
    if (r.kind !== 'cleaned') return r;
    const base = { kind: 'cleaned' as const, format: 'jpeg' as const, output: new Blob([r.output as BlobPart], { type: 'image/jpeg' }), removed: r.removed };
    return r.orientation === undefined ? base : { ...base, orientation: r.orientation };
  }
  const r = cleanPng(bytes);
  if (r.kind !== 'cleaned') return r;
  return { kind: 'cleaned', format: 'png', output: new Blob([r.output as BlobPart], { type: 'image/png' }), removed: r.removed };
}

export { detectBlob, detectKind } from './detect';
export type { FileKind } from './detect';
export { cleanMp3, cleanWav, selfCheckAudio } from './audio';
export { cleanJpeg, selfCheckJpeg } from './jpeg';
export { cleanPng, selfCheckPng, crc32 } from './png';

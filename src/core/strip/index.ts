// STUB: implemented by the stripping workstream (FR-3, SPEC 8). Signature is normative (SPEC 5.2).
export type DetectedType = 'jpeg' | 'png' | 'apng' | 'gif' | 'webp' | 'heic' | 'pdf' | 'tiff' | 'unknown';

export type StripOutcome =
  | {
      kind: 'cleaned';
      format: 'jpeg' | 'png';
      output: Blob;
      /** Human-readable names of removed parts, e.g. "EXIF (APP1)". */
      removed: string[];
      /** JPEG EXIF Orientation of the original if present and not 1 (Q4: UI must warn). */
      orientation: number | null;
    }
  | { kind: 'unsupported'; detected: DetectedType; reason: string }
  | { kind: 'rejected'; reason: string };

export function detectType(_head: Uint8Array): DetectedType {
  throw new Error('not implemented');
}

export function stripMetadata(_blob: Blob): Promise<StripOutcome> {
  throw new Error('not implemented');
}

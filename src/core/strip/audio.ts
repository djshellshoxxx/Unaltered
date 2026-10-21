// Audio allowlist rewriters: WAV (RIFF chunk allowlist) and MP3 (ID3v2 / APEv2 / ID3v1 tag removal).
// Same contract as jpeg.ts/png.ts: fail closed on malformed input; the caller hashes only the cleaned output.
import { concat } from '../bytes';

export type AudioResult =
  | { kind: 'cleaned'; output: Uint8Array; removed: string[] }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'rejected'; reason: string };

const rej = (reason: string): AudioResult => ({ kind: 'rejected', reason });
const tag4 = (b: Uint8Array, o: number): string => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const putTag = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

// Chunks needed to play the audio. Musical loop/cue data (smpl, inst, cue) is kept; free-text and identity chunks
// (LIST/INFO, bext originator, iXML, id3, _PMX XMP, ...) are removed.
const WAV_KEEP = new Set(['fmt ', 'data', 'fact', 'smpl', 'inst', 'cue ']);
const WAV_NAMES: Record<string, string> = { LIST: 'text tags (LIST)', bext: 'broadcast info (bext)', iXML: 'iXML metadata', 'id3 ': 'ID3 tag', ID3: 'ID3 tag', _PMX: 'XMP metadata' };

export function cleanWav(input: Uint8Array): AudioResult {
  const n = input.length;
  if (n >= 4 && tag4(input, 0) === 'RF64') return { kind: 'unsupported', reason: 'RF64 audio files cannot be cleaned safely.' };
  if (n < 12) return rej('Not a WAV file.');
  if (tag4(input, 0) !== 'RIFF' || tag4(input, 8) !== 'WAVE') return rej('Not a WAV file.');
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const riffEnd = Math.min(n, 8 + dv.getUint32(4, true));
  const parts: Uint8Array[] = [];
  const removed: string[] = [];
  const note = (s: string): void => {
    if (!removed.includes(s)) removed.push(s);
  };
  let pos = 12;
  let sawFmt = false;
  let sawData = false;
  while (pos + 8 <= riffEnd) {
    const id = tag4(input, pos);
    const len = dv.getUint32(pos + 4, true);
    const end = pos + 8 + len;
    if (end > riffEnd) return rej('A WAV chunk has an invalid length.');
    const padded = end + (len & 1);
    if (id === 'fmt ') {
      if (sawFmt || sawData || len < 16) return rej('The WAV header is malformed.');
      sawFmt = true;
    } else if (id === 'data') {
      if (!sawFmt || sawData) return rej('The WAV header is malformed.');
      sawData = true;
    }
    if (WAV_KEEP.has(id)) {
      // Pad bytes are re-emitted as zero so content cannot ride in them.
      parts.push(input.subarray(pos, end));
      if (len & 1) parts.push(Uint8Array.of(0));
    } else {
      note(WAV_NAMES[id] ?? `unknown chunk (${/^[\x20-\x7e]{4}$/.test(id) ? id.trim() : '?'})`);
    }
    pos = padded;
  }
  if (!sawFmt || !sawData) return rej('The WAV file is missing its format or audio data.');
  if (pos < n) note('data after the end of the file');
  const body = concat(...parts);
  const head = new Uint8Array(12);
  head.set(putTag('RIFF'), 0);
  new DataView(head.buffer).setUint32(4, 4 + body.length, true);
  head.set(putTag('WAVE'), 8);
  return { kind: 'cleaned', output: concat(head, body), removed };
}

const syncsafe = (b: Uint8Array, o: number): number => ((b[o]! & 0x7f) << 21) | ((b[o + 1]! & 0x7f) << 14) | ((b[o + 2]! & 0x7f) << 7) | (b[o + 3]! & 0x7f);
const isSync = (b: Uint8Array, o: number): boolean => o + 4 <= b.length && b[o] === 0xff && (b[o + 1]! & 0xe0) === 0xe0 && (b[o + 1]! & 0x18) !== 0x08 && (b[o + 1]! & 0x06) !== 0;

export function cleanMp3(input: Uint8Array): AudioResult {
  let start = 0;
  let end = input.length;
  const removed: string[] = [];
  let guard = 0;
  while (start + 10 <= end && tag4(input, start).startsWith('ID3') && input[start + 3]! < 0xff && guard++ < 8) {
    if ((input[start + 6]! | input[start + 7]! | input[start + 8]! | input[start + 9]!) & 0x80) return rej('The ID3 tag is malformed.');
    const size = 10 + syncsafe(input, start + 6) + (input[start + 5]! & 0x10 ? 10 : 0);
    if (start + size > end) return rej('The ID3 tag is malformed.');
    start += size;
    if (!removed.includes('ID3v2 tags (title, artist, comments, cover art)')) removed.push('ID3v2 tags (title, artist, comments, cover art)');
  }
  // Padding of zero bytes sometimes follows a tag; skip it so the first frame is found.
  let p = start;
  if (removed.length > 0) while (p < end && input[p] === 0) p++;
  if (!isSync(input, p)) return rej('No MP3 audio was found where expected.');
  start = p;
  if (end - start >= 128 && tag4(input, end - 128).startsWith('TAG')) {
    end -= 128;
    removed.push('ID3v1 tag');
  }
  if (end - start >= 32 && String.fromCharCode(...input.subarray(end - 32, end - 24)) === 'APETAGEX') {
    const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
    const size = dv.getUint32(end - 20, true) + (dv.getUint32(end - 12, true) & 0x80000000 ? 32 : 0);
    if (size < 32 || size > end - start) return rej('The APE tag is malformed.');
    end -= size;
    removed.push('APEv2 tag');
  }
  return { kind: 'cleaned', output: input.slice(start, end), removed };
}

export function selfCheckAudio(format: 'wav' | 'mp3', out: Uint8Array): string | null {
  if (format === 'mp3') return isSync(out, 0) ? null : 'Cleaned MP3 does not start with an audio frame.';
  const r = cleanWav(out);
  if (r.kind !== 'cleaned') return 'Cleaned WAV failed validation.';
  return r.removed.length === 0 && r.output.length === out.length ? null : 'Cleaned WAV is not stable.';
}

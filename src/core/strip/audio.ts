// Audio allowlist rewriters: WAV (RIFF chunk allowlist) and MP3 (ID3v2 / APEv2 / ID3v1 tag removal).
// Same contract as jpeg.ts/png.ts: fail closed on malformed input; the caller hashes only the cleaned output.
import { concat, concatParts } from '../bytes';

export type AudioResult =
  | { kind: 'cleaned'; output: Uint8Array; removed: string[] }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'rejected'; reason: string };

const rej = (reason: string): AudioResult => ({ kind: 'rejected', reason });
const tag4 = (b: Uint8Array, o: number): string => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const putTag = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

// Chunks needed to play the audio. Musical loop/cue data (smpl, inst, cue) is kept; free-text and identity chunks
// (LIST/INFO, bext originator, iXML, id3, _PMX XMP, ...) are removed. Kept bytes a decoder ignores would survive cleaning
// unseen, so one of each kept chunk is copied, reduced to its defined fields (wavFields).
const WAV_KEEP = new Set(['fmt ', 'data', 'fact', 'smpl', 'inst', 'cue ']);
// Formats whose decoders read only the 16 PCMWAVEFORMAT bytes: PCM, IEEE float, A-law, mu-law.
const PLAIN_FORMATS = new Set([1, 3, 6, 7]);
// Bytes 4-15 of the WAVE_FORMAT_EXTENSIBLE SubFormat GUID shared by those formats.
const SUBFORMAT_TAIL = [0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
const WAV_NAMES: Record<string, string> = { LIST: 'text tags (LIST)', bext: 'broadcast info (bext)', iXML: 'iXML metadata', 'id3 ': 'ID3 tag', 'ID3 ': 'ID3 tag', _PMX: 'XMP metadata' };
const MAX_REMOVAL_SUMMARY_LABELS = 64;
const REMOVAL_SUMMARY_OVERFLOW = 'Additional metadata chunks';

export function cleanWav(input: Uint8Array): AudioResult {
  const n = input.length;
  if (n >= 4 && tag4(input, 0) === 'RF64') return { kind: 'unsupported', reason: 'RF64 audio files cannot be cleaned safely.' };
  if (n < 12) return rej('Not a WAV file.');
  if (tag4(input, 0) !== 'RIFF' || tag4(input, 8) !== 'WAVE') return rej('Not a WAV file.');
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const riffEnd = 8 + dv.getUint32(4, true);
  if (riffEnd < 12 || riffEnd > n) return rej('The WAV container has an invalid length.');
  const parts: Uint8Array[] = [];
  const removed: string[] = [];
  const removedSet = new Set<string>();
  const note = (s: string): void => {
    if (removedSet.has(s)) return;
    if (removed.length < MAX_REMOVAL_SUMMARY_LABELS) {
      removedSet.add(s);
      removed.push(s);
    } else if (!removedSet.has(REMOVAL_SUMMARY_OVERFLOW)) {
      // Retain at most 64 specific labels and one generic overflow note.
      removedSet.add(REMOVAL_SUMMARY_OVERFLOW);
      removed.push(REMOVAL_SUMMARY_OVERFLOW);
    }
  };
  let pos = 12;
  let sawFmt = false;
  let sawData = false;
  const kept = new Set<string>();
  while (pos + 8 <= riffEnd) {
    const id = tag4(input, pos);
    const len = dv.getUint32(pos + 4, true);
    const end = pos + 8 + len;
    if (end > riffEnd) return rej('A WAV chunk has an invalid length.');
    const padded = end + (len & 1);
    if (padded > riffEnd) return rej('A WAV chunk is missing its pad byte.');
    if (id === 'fmt ') {
      if (sawFmt || sawData || len < 16) return rej('The WAV header is malformed.');
      // XMA's format chunk has no cbSize, so where its fields end cannot be checked.
      if (dv.getUint16(pos + 8, true) === 0x0165) return { kind: 'unsupported', reason: 'XMA audio files cannot be cleaned safely.' };
      sawFmt = true;
    } else if (id === 'data') {
      if (!sawFmt || sawData) return rej('The WAV header is malformed.');
      sawData = true;
    }
    if (WAV_KEEP.has(id)) {
      const body = input.subarray(pos + 8, end);
      const fields = kept.has(id) ? undefined : id === 'data' ? body : wavFields(id, body); // fmt/data repeats were rejected above
      if (fields === undefined) note(`duplicate chunk (${id.trim()})`);
      else if (fields === null) note(`malformed chunk (${id.trim()})`);
      else {
        kept.add(id);
        // Dropped or zeroed bytes are reported unless they were all zero.
        if (fields !== body && body.some((b, i) => b !== (fields[i] ?? 0))) note(id === 'smpl' ? 'sampler ID and private data (smpl)' : `extra data (${id.trim()})`);
        const head = input.slice(pos, pos + 8);
        new DataView(head.buffer).setUint32(4, fields.length, true);
        parts.push(head, fields);
        // Pad bytes are re-emitted as zero so content cannot ride in them.
        if (fields.length & 1) parts.push(Uint8Array.of(0));
        if (len & 1 && input[end] !== 0) note('non-zero chunk padding');
      }
    } else {
      note(WAV_NAMES[id] ?? `unknown chunk (${/^[\x20-\x7e]{4}$/.test(id) ? id.trim() : '?'})`);
    }
    pos = padded;
  }
  if (pos !== riffEnd) return rej('The WAV file ends with a partial chunk header.');
  if (!sawFmt || !sawData) return rej('The WAV file is missing its format or audio data.');
  if (pos < n) note('data after the end of the file');
  const body = concatParts(parts);
  const head = new Uint8Array(12);
  head.set(putTag('RIFF'), 0);
  new DataView(head.buffer).setUint32(4, 4 + body.length, true);
  head.set(putTag('WAVE'), 8);
  return { kind: 'cleaned', output: concat(head, body), removed };
}

/**
 * The defined fields of a kept fmt/fact/smpl/inst/cue chunk body, or null when they do not fit (the chunk is then dropped).
 * Bytes after the fields are dropped, PLAIN_FORMATS keep no format extension, and smpl loses its sampler-specific data and
 * its manufacturer/product IDs. The values of the fields that remain are not interpreted.
 */
function wavFields(id: string, body: Uint8Array): Uint8Array | null {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const n = body.length;
  if (id === 'fmt ') {
    if (n < 18) return body.subarray(0, 16); // cleanWav rejects fmt shorter than 16
    const tag = dv.getUint16(0, true);
    const cbSize = dv.getUint16(16, true);
    if (PLAIN_FORMATS.has(tag)) return cbSize === 0 ? body.subarray(0, 18) : concat(body.subarray(0, 16), new Uint8Array(2));
    if (tag === 0xfffe && cbSize >= 22 && n >= 40 && PLAIN_FORMATS.has(dv.getUint32(24, true)) && SUBFORMAT_TAIL.every((b, i) => body[28 + i] === b)) {
      if (cbSize === 22) return body.subarray(0, 40);
      const out = body.slice(0, 40);
      out.set([22, 0], 16);
      return out;
    }
    // Other codecs read cbSize bytes of extension data, which is kept; a short extension is kept as it is.
    return 18 + cbSize <= n ? body.subarray(0, 18 + cbSize) : body;
  }
  if (id === 'fact') return n >= 4 ? body.subarray(0, 4) : null; // dwSampleLength
  if (id === 'inst') return n >= 7 ? body.subarray(0, 7) : null; // note, fine tune, gain, note and velocity range
  // cue: point count, then 24 bytes per point. smpl: 36-byte header with the loop count at 28, then 24 bytes per loop.
  const [header, countAt] = id === 'cue ' ? [4, 0] : [36, 28];
  if (n < header) return null;
  const size = header + 24 * dv.getUint32(countAt, true);
  if (size > n) return null;
  if (id === 'cue ') return body.subarray(0, size);
  const out = body.slice(0, size);
  out.fill(0, 0, 8); // dwManufacturer, dwProduct: the sampler that wrote the file
  out.fill(0, 32, 36); // cbSamplerData: its private data is not copied
  return out;
}

const syncsafe = (b: Uint8Array, o: number): number => ((b[o]! & 0x7f) << 21) | ((b[o + 1]! & 0x7f) << 14) | ((b[o + 2]! & 0x7f) << 7) | (b[o + 3]! & 0x7f);
const isSync = (b: Uint8Array, o: number): boolean => o + 4 <= b.length && b[o] === 0xff && (b[o + 1]! & 0xe0) === 0xe0 && (b[o + 1]! & 0x18) !== 0x08 && (b[o + 1]! & 0x06) !== 0;

// MPEG Layer III frame sizes are defined by the header, not by scanning for the next sync word:
// a sync-like byte sequence can also occur inside the compressed audio payload.
const MPEG1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function validateMp3Frames(input: Uint8Array, start: number, end: number): AudioResult | null {
  if (start >= end) return rej('The MP3 contains no audio frames.');
  for (let pos = start; pos < end;) {
    if (pos + 4 > end || !isSync(input, pos) || (input[pos + 1]! & 0x06) !== 0x02) {
      return rej('The MP3 contains malformed audio or unrecognised trailing data.');
    }
    const version = (input[pos + 1]! >> 3) & 3;
    const bitrateIndex = input[pos + 2]! >> 4;
    const rateIndex = (input[pos + 2]! >> 2) & 3;
    if (bitrateIndex === 15 || rateIndex === 3) return rej('An MP3 frame has a reserved bitrate or sample rate.');
    if (bitrateIndex === 0) return { kind: 'unsupported', reason: 'Free-format MP3 cannot be cleaned safely.' };
    const bitrate = (version === 3 ? MPEG1_BITRATES : MPEG2_BITRATES)[bitrateIndex]!;
    const rate = [44100, 48000, 32000][rateIndex]! / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const length = Math.floor((version === 3 ? 144000 : 72000) * bitrate / rate) + ((input[pos + 2]! >> 1) & 1);
    if (pos + length > end) return rej('An MP3 audio frame is truncated.');
    pos += length;
  }
  return null;
}

export function cleanMp3(input: Uint8Array): AudioResult {
  let start = 0;
  let end = input.length;
  const removed: string[] = [];
  let guard = 0;
  while (start + 10 <= end && tag4(input, start).startsWith('ID3') && input[start + 3]! < 0xff && guard++ < 8) {
    const version = input[start + 3]!;
    const flags = input[start + 5]!;
    if (![2, 3, 4].includes(version)) return rej('The ID3 tag version is unsupported.');
    const allowedFlags = version === 2 ? 0xc0 : version === 3 ? 0xe0 : 0xf0;
    if (input[start + 4] === 0xff || (flags & ~allowedFlags) !== 0) return rej('The ID3 tag is malformed.');
    if ((input[start + 6]! | input[start + 7]! | input[start + 8]! | input[start + 9]!) & 0x80) return rej('The ID3 tag is malformed.');
    const footerBytes = version === 4 && (flags & 0x10) ? 10 : 0;
    const size = 10 + syncsafe(input, start + 6) + footerBytes;
    if (start + size > end) return rej('The ID3 tag is malformed.');
    if (footerBytes) {
      const footer = start + size - 10;
      if (input[footer] !== 0x33 || input[footer + 1] !== 0x44 || input[footer + 2] !== 0x49) return rej('The ID3 footer is malformed.');
      for (let i = 3; i < 10; i++) if (input[footer + i] !== input[start + i]) return rej('The ID3 footer does not match its header.');
    }
    start += size;
    if (!removed.includes('ID3v2 tags (title, artist, comments, cover art)')) removed.push('ID3v2 tags (title, artist, comments, cover art)');
  }
  // Padding of zero bytes sometimes follows a tag; skip it so the first frame is found.
  let p = start;
  if (removed.length > 0) while (p < end && input[p] === 0) p++;
  if (!isSync(input, p)) return rej('No MP3 audio was found where expected.');
  start = p;
  // Trailing tags never begin with a sync word, so a frame chain that already reaches `end` leaves no room for one.
  // Checking before each removal never cuts a complete final frame; the end-of-input check below decides what remains.
  const framesReachEnd = (): boolean => validateMp3Frames(input, start, end) === null;
  if (!framesReachEnd() && end - start >= 128 && tag4(input, end - 128).startsWith('TAG')) {
    end -= 128;
    removed.push('ID3v1 tag');
  }
  if (!framesReachEnd() && end - start >= 32 && String.fromCharCode(...input.subarray(end - 32, end - 24)) === 'APETAGEX') {
    const size = apeTagLength(input, start, end);
    if (size === null) return rej('The APE tag is malformed.');
    end -= size;
    removed.push('APEv2 tag');
  }
  // A frame chain can also reach `end` because a truncated final frame's declared length covers a real tag. Tag-like
  // bytes still at the end are then either audio or metadata; refuse rather than keep a possible tag or drop audio.
  if (endsWithTagLikeBytes(input, start, end)) return rej('The end of the MP3 could be audio or a metadata tag, so it cannot be cleaned safely.');
  const bad = validateMp3Frames(input, start, end);
  if (bad) return bad;
  return { kind: 'cleaned', output: input.slice(start, end), removed };
}

/**
 * Length of the APEv2 tag whose footer ends at `end`, or null. The footer's size field alone could reach back over complete
 * audio frames, so a flagged header must be where the footer says and the items must fill the space before the footer exactly.
 * The stored item count is not a bound: writers get it wrong, and mutagen and TagLib stop at the end of the items instead.
 */
function apeTagLength(input: Uint8Array, start: number, end: number): number | null {
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const footer = end - 32;
  const size = dv.getUint32(footer + 12, true); // items + footer, excluding any header
  const count = dv.getUint32(footer + 16, true);
  const header = dv.getUint32(footer + 20, true) & 0x80000000 ? 32 : 0;
  if (size < 32 || header + size > end - start) return null;
  const tagStart = end - size - header;
  if (header && (String.fromCharCode(...input.subarray(tagStart, tagStart + 8)) !== 'APETAGEX' || dv.getUint32(tagStart + 12, true) !== size || dv.getUint32(tagStart + 16, true) !== count)) return null;
  let p = tagStart + header;
  while (p < footer) {
    // Item: value size, flags, printable-ASCII key of 2-255 bytes, NUL, value. Each item advances p, so this is bounded.
    if (p + 8 > footer) return null;
    const keyStart = p + 8;
    let k = keyStart;
    while (k < footer && k - keyStart <= 255 && input[k]! >= 0x20 && input[k]! <= 0x7e) k++;
    if (k >= footer || input[k] !== 0 || k - keyStart < 2 || k - keyStart > 255) return null;
    p = k + 1 + dv.getUint32(p, true);
    if (p > footer) return null;
  }
  return p === footer ? header + size : null;
}

function endsWithTagLikeBytes(input: Uint8Array, start: number, end: number): boolean {
  return (end - start >= 128 && tag4(input, end - 128).startsWith('TAG')) || (end - start >= 32 && String.fromCharCode(...input.subarray(end - 32, end - 24)) === 'APETAGEX');
}

export function selfCheckAudio(format: 'wav' | 'mp3', out: Uint8Array): string | null {
  if (format === 'mp3') {
    if (!isSync(out, 0)) return 'Cleaned MP3 does not start with an audio frame.';
    if (endsWithTagLikeBytes(out, 0, out.length)) return 'Cleaned MP3 still ends with tag-like bytes.';
    const bad = validateMp3Frames(out, 0, out.length);
    return bad && bad.kind !== 'cleaned' ? bad.reason : null;
  }
  const r = cleanWav(out);
  if (r.kind !== 'cleaned') return 'Cleaned WAV failed validation.';
  return r.removed.length === 0 && r.output.length === out.length ? null : 'Cleaned WAV is not stable.';
}

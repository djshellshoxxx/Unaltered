// Synthetic audio fixtures for the metadata-stripping tests.
const enc = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const u32le = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const syncsafe = (n: number): number[] => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const chunk = (id: string, body: number[]): number[] => [...enc(id), ...u32le(body.length), ...body, ...(body.length & 1 ? [0] : [])];

export const PCM = [1, 2, 3, 4, 5, 6, 7, 8];

export function makeWav(opts: { extra?: boolean; trailing?: string; oddPad?: number } = {}): Uint8Array {
  const fmt = chunk('fmt ', [1, 0, 1, 0, ...u32le(44100), ...u32le(88200), 2, 0, 16, 0]);
  const parts: number[][] = [fmt];
  if (opts.extra) {
    parts.push(chunk('LIST', [...enc('INFO'), ...chunk('IART', enc('SECRET-ARTIST\0'))]));
    parts.push(chunk('bext', enc('SECRET-ORIGINATOR')));
    parts.push(chunk('iXML', enc('<SECRET-IXML/>')));
    parts.push(chunk('smpl', new Array(36).fill(0)));
  }
  parts.push(chunk('data', opts.oddPad ? PCM.slice(0, opts.oddPad) : PCM));
  const body = [...enc('WAVE'), ...parts.flat()];
  return Uint8Array.from([...enc('RIFF'), ...u32le(body.length), ...body, ...enc(opts.trailing ?? '')]);
}

// MPEG-1 Layer III, 128 kbit/s, 44100 Hz, no padding: floor(144 * 128000 / 44100) = 417 bytes.
export const FRAME = [0xff, 0xfb, 0x90, 0x00, ...new Array<number>(413).fill(0)];

export function makeMp3(opts: { id3v2?: boolean; id3v1?: boolean; ape?: boolean } = {}): Uint8Array {
  const out: number[] = [];
  if (opts.id3v2) {
    const frames = [...enc('TIT2'), 0, 0, 0, 15, 0, 0, 0, ...enc('SECRET-TITLE\0\0')];
    out.push(...enc('ID3'), 3, 0, 0, ...syncsafe(frames.length + 4), ...frames, 0, 0, 0, 0);
  }
  out.push(...FRAME, ...FRAME);
  if (opts.ape) {
    const item = enc('SECRET-APE-ITEM');
    out.push(...enc('APETAGEX'), ...u32le(2000), ...u32le(32 + item.length), ...u32le(1), ...u32le(0x80000000), ...new Array(8).fill(0), ...item, ...enc('APETAGEX'), ...u32le(2000), ...u32le(32 + item.length), ...u32le(1), ...u32le(0x80000000), ...new Array(8).fill(0));
  }
  if (opts.id3v1) out.push(...enc('TAG'), ...enc('SECRET-V1'), ...new Array(128 - 3 - 9).fill(0));
  return Uint8Array.from(out);
}

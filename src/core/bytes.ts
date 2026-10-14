import { UnalteredError } from './errors';

const HEX = '0123456789abcdef';

export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += HEX[x >> 4]! + HEX[x & 15]!;
  return s;
}

export function fromHex(h: string): Uint8Array {
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) throw new UnalteredError('INPUT_INVALID', 'Invalid hexadecimal text.');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

/** Lexicographic comparison, shorter-prefix first. */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i]! - b[i]!;
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

export function reversed(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b[b.length - 1 - i]!;
  return out;
}

/** 8 hex characters per block, for human reading (FR-2). */
export function groupHex(hex: string, size = 8): string {
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += size) parts.push(hex.slice(i, i + size));
  return parts.join(' ');
}

/** Bounds-checked sequential reader for untrusted input. */
export class Reader {
  pos = 0;
  constructor(
    readonly buf: Uint8Array,
    private readonly errCode: 'PROOF_MALFORMED' | 'INPUT_INVALID' = 'PROOF_MALFORMED',
  ) {}

  private fail(msg: string): never {
    throw new UnalteredError(this.errCode, msg);
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }

  eof(): boolean {
    return this.pos >= this.buf.length;
  }

  u8(): number {
    if (this.pos >= this.buf.length) this.fail('The receipt ends unexpectedly.');
    return this.buf[this.pos++]!;
  }

  bytes(n: number): Uint8Array {
    if (!Number.isSafeInteger(n) || n < 0 || n > this.remaining) this.fail('The receipt ends unexpectedly.');
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /** LEB128-style unsigned integer as used by the OpenTimestamps format. Limited to 2^49. */
  varuint(): number {
    let value = 0;
    let scale = 1;
    for (let i = 0; i < 8; i++) {
      const b = this.u8();
      value += (b & 0x7f) * scale;
      if ((b & 0x80) === 0) return value;
      scale *= 128;
    }
    return this.fail('A number in the receipt is too large.');
  }

  varbytes(maxLen: number, minLen = 0): Uint8Array {
    const n = this.varuint();
    if (n > maxLen || n < minLen) this.fail('A field in the receipt has an invalid length.');
    return this.bytes(n);
  }
}

export function writeVaruint(n: number): number[] {
  if (!Number.isSafeInteger(n) || n < 0) throw new UnalteredError('INPUT_INVALID', 'Invalid number.');
  const out: number[] = [];
  let v = n;
  while (v >= 128) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

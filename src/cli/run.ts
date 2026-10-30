// Command-line verifier (SPEC "CLI verifier"): same core as the web app, for scripts and for checking a receipt
// without a browser. Pure of process globals so it can be tested; main.ts wires it to the real process.
import { open } from 'node:fs/promises';
import { groupHex } from '../core/bytes';
import { hashSource, type ChunkSource } from '../core/hash/stream';
import { defaultVerifyConfig, LIMITS, verify, type VerifyState } from '../core/ots';

export interface CliIO {
  out(text: string): void;
  err(text: string): void;
}

export const EXIT: Record<VerifyState, number> = {
  VERIFIED: 0,
  PENDING: 2,
  NO_MATCH_FILE: 3,
  INVALID_PROOF: 4,
  SOURCES_DISAGREE: 5,
  UNREACHABLE: 6,
};
const USAGE = `unaltered <command>
  hash <file>                 print the SHA-256 fingerprint
  verify <file> [receipt.ots] verify a receipt (default: <file>.ots)
exit codes for verify: 0 verified, 2 pending, 3 file differs, 4 invalid receipt, 5 sources disagree, 6 unreachable, 1 usage/other
`;

const NOT_REGULAR = 'not a regular file';
const SIZE_CHANGED = 'the file size changed while reading';
const cliError = (code: string): Error => Object.assign(new Error(code), { code });

/** Streams a file in chunks so memory stays flat regardless of size (FR-1). */
async function hashFile(path: string): Promise<{ hex: string; digest: Uint8Array }> {
  const fh = await open(path, 'r');
  try {
    const info = await fh.stat();
    // Pipes and devices report a size that is not their content length; hashing that many bytes would print the
    // fingerprint of empty or partial input as if it were the file's. Procfs files and files that grow while
    // being read pass this check and are caught by the end-of-file probe below.
    if (!info.isFile()) throw cliError(NOT_REGULAR);
    const size = info.size;
    const src: ChunkSource = {
      size,
      slice: (start, end) => ({
        arrayBuffer: async () => {
          const buf = new Uint8Array(end - start);
          let got = 0;
          while (got < buf.length) {
            const { bytesRead } = await fh.read(buf, got, buf.length - got, start + got);
            if (bytesRead === 0) throw cliError(SIZE_CHANGED);
            got += bytesRead;
          }
          return buf.buffer;
        },
      }),
    };
    const r = await hashSource(src);
    if (!r) throw new Error('cancelled');
    if ((await fh.read(new Uint8Array(1), 0, 1, size)).bytesRead !== 0) throw cliError(SIZE_CHANGED);
    return { hex: r.hex, digest: r.digest };
  } finally {
    await fh.close();
  }
}

/**
 * Reads a receipt without loading more than one byte past the parser limit, like the browser's size check:
 * an oversized receipt reaches the core with `maxInputBytes + 1` bytes and is rejected there with its usual message.
 */
export async function readReceipt(path: string): Promise<Uint8Array> {
  const fh = await open(path, 'r');
  try {
    const buf = new Uint8Array(LIMITS.maxInputBytes + 1);
    let got = 0;
    while (got < buf.length) {
      const { bytesRead } = await fh.read(buf, got, buf.length - got, got);
      if (bytesRead === 0) break;
      got += bytesRead;
    }
    return buf.subarray(0, got);
  } finally {
    await fh.close();
  }
}

export async function run(argv: readonly string[], io: CliIO): Promise<number> {
  const [cmd, file, receipt] = argv;
  try {
    if (cmd === 'hash' && file && argv.length === 2) {
      const { hex } = await hashFile(file);
      io.out(`${hex}  ${file}\n`);
      return 0;
    }
    if (cmd === 'verify' && file && argv.length <= 3) {
      // Receipt first, as in the browser: a missing or oversized receipt is reported before a long hash.
      const ots = await readReceipt(receipt ?? `${file}.ots`);
      const { hex, digest } = await hashFile(file);
      const report = await verify(digest, ots, defaultVerifyConfig());
      io.out(`file sha-256: ${groupHex(hex)}\nresult: ${report.state}\n${report.detail}\n`);
      if (report.bitcoin) io.out(`bitcoin block ${report.bitcoin.height}, ${report.bitcoin.blockTimeUtc} (no later than about this time)\nsources: ${report.bitcoin.sourcesAgreeing.join(', ')}\n`);
      if (report.pendingCalendars?.length) io.out(`pending at: ${report.pendingCalendars.join(', ')}\n`);
      return EXIT[report.state];
    }
  } catch (e) {
    // Generic message only (SR-8): never echo paths or stack traces from lower layers.
    const code = e instanceof Error && 'code' in e ? (e as { code?: string }).code : undefined;
    const known = code === NOT_REGULAR || code === SIZE_CHANGED ? code : undefined;
    io.err(`error: ${code === 'ENOENT' ? 'file not found' : known ?? 'could not complete the operation'}\n`);
    return 1;
  }
  io.err(USAGE);
  return 1;
}

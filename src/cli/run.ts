// Command-line verifier (SPEC "CLI verifier"): same core as the web app, for scripts and for checking a receipt
// without a browser. Pure of process globals so it can be tested; main.ts wires it to the real process.
import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { fromHex, groupHex } from '../core/bytes';
import { hashSource, type ChunkSource } from '../core/hash/stream';
import { defaultVerifyConfig, LIMITS, verify, type VerifyState } from '../core/ots';
import { checkTrustedHeader, verifyWithTrustedHeader, type TrustedHeaderEvidence, type TrustedHeaderState } from '../core/ots/trusted-header';

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
  verify-offline <file> <receipt.ots> <height> <block-hash> <header.hex>
                             compare with explicitly trusted header evidence; no network or chain check
exit codes for verify: 0 verified, 2 pending, 3 file differs, 4 invalid receipt, 5 sources disagree, 6 unreachable, 1 usage/other
exit codes for verify-offline: 0 supplied header matched, 2 pending, 3 file differs, 4 invalid receipt,
  5 header Merkle root differs, 6 supplied height absent, 7 invalid header evidence, 1 usage/other
`;

const OFFLINE_EXIT: Record<TrustedHeaderState, number> = {
  MATCHED_TRUSTED_HEADER: 0, PENDING: 2, NO_MATCH_FILE: 3, INVALID_PROOF: 4,
  NO_MATCH_HEADER: 5, MISSING_HEADER: 6, INVALID_HEADER: 7,
};

const NOT_REGULAR = 'not a regular file';
const SIZE_CHANGED = 'the file size changed while reading';
const CHANGED = 'the file changed while reading';
const CONTROL_NAME = 'the file name contains control characters';
const cliError = (code: string): Error => Object.assign(new Error(code), { code });

/**
 * A `hash` output line that GNU `sha256sum -c` reads back as the same name. A name from a shell glob is
 * attacker-controlled: printed raw, a newline would add a forged checksum line and a carriage return could overwrite
 * the fingerprint on the terminal. These are escaped as sha256sum does: the line starts with `\`, and `\`, newline and
 * CR become `\\`, `\n`, `\r`. Any other name is printed as is, because `sha256sum -c` reads a line without the leading
 * `\` literally: a Windows path keeps its `\` separators and the line starts with the fingerprint.
 */
function checksumLine(hex: string, name: string): string {
  if (!name.includes('\n') && !name.includes('\r')) return `${hex}  ${name}\n`;
  return `\\${hex}  ${name.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r')}\n`;
}

/**
 * `sha256sum -c` reads no escape for the other C0 controls, DEL or U+0080–U+009F, and skips a line it cannot read with
 * only a warning and exit status 0, so a checksum list would leave that file unchecked. Printed raw, a backspace or
 * escape sequence could rewrite the fingerprint on the terminal. Such a name is refused before the file is read. TAB
 * is printed as is, like sha256sum does; it cannot move the cursor back over the fingerprint.
 */
function printableName(name: string): boolean {
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    if ((c < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') || (c >= 0x7f && c <= 0x9f)) return false;
  }
  return true;
}

/** An idle FIFO blocks a normal open before fstat can reject it. Check the opened descriptor without waiting for a writer. */
async function openRegular(path: string): Promise<FileHandle> {
  const fh = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    if (!(await fh.stat()).isFile()) throw cliError(NOT_REGULAR);
    return fh;
  } catch (e) {
    await fh.close();
    throw e;
  }
}

/** Streams a file in chunks so memory stays flat regardless of size (FR-1). */
async function hashFile(path: string): Promise<{ hex: string; digest: Uint8Array }> {
  const fh = await openRegular(path);
  try {
    const info = await fh.stat({ bigint: true });
    // Pipes and devices report a size that is not their content length; hashing that many bytes would print the
    // fingerprint of empty or partial input as if it were the file's. Procfs files and files that grow while
    // being read pass this check and are caught by the end-of-file probe below.
    if (!info.isFile()) throw cliError(NOT_REGULAR);
    const size = Number(info.size);
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
    // A same-size rewrite during the read passes both checks above and would yield the fingerprint of a mix of old and
    // new bytes that never existed as one file. Its write changes mtime/ctime (browsers' File reads fail the same way).
    const now = await fh.stat({ bigint: true });
    if (now.mtimeNs !== info.mtimeNs || now.ctimeNs !== info.ctimeNs || now.size !== info.size) throw cliError(CHANGED);
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
  return readBounded(path, LIMITS.maxInputBytes);
}

/** One extra byte detects oversized regular files without unbounded allocation or waiting on an idle FIFO. */
async function readBounded(path: string, limit: number): Promise<Uint8Array> {
  const fh = await openRegular(path);
  try {
    const buf = new Uint8Array(limit + 1);
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
      if (!printableName(file)) throw cliError(CONTROL_NAME);
      const { hex } = await hashFile(file);
      io.out(checksumLine(hex, file));
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
    if (cmd === 'verify-offline' && file && receipt && argv.length === 6) {
      const [, , , height, hashHex, headerPath] = argv;
      if (!height || !/^(?:0|[1-9][0-9]{0,9})$/.test(height) || !hashHex || !headerPath) {
        io.err(USAGE); return 1;
      }
      const bytes = await readBounded(headerPath, 162); // 160 hex characters plus optional CRLF.
      let evidence: TrustedHeaderEvidence;
      try {
        const hex = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
        if (bytes.length > 162 || !/^[0-9a-fA-F]{160}$/.test(hex)) throw new Error('invalid header text');
        evidence = { height: Number(height), hashHex, raw: fromHex(hex) };
        checkTrustedHeader(evidence);
      } catch {
        io.err('error: invalid trusted header evidence\n'); return 7;
      }
      const ots = await readReceipt(receipt);
      const { hex, digest } = await hashFile(file);
      const report = verifyWithTrustedHeader(digest, ots, evidence);
      io.out(`file sha-256: ${groupHex(hex)}\nresult: ${report.state}\ntrust: ${report.trust}\n${report.detail}\n`);
      if (report.bitcoin) io.out(`supplied header ${report.bitcoin.height}, ${report.bitcoin.hashHex}, ${report.bitcoin.blockTimeUtc} (miner time)\n`);
      return OFFLINE_EXIT[report.state];
    }
  } catch (e) {
    // Generic message only (SR-8): never echo paths or stack traces from lower layers.
    const code = e instanceof Error && 'code' in e ? (e as { code?: string }).code : undefined;
    const known = code === NOT_REGULAR || code === SIZE_CHANGED || code === CHANGED || code === CONTROL_NAME ? code : undefined;
    io.err(`error: ${code === 'ENOENT' ? 'file not found' : known ?? 'could not complete the operation'}\n`);
    return 1;
  }
  io.err(USAGE);
  return 1;
}

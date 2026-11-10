// Command-line verifier (SPEC "CLI verifier"): same core as the web app, for scripts and for checking a receipt
// without a browser. Pure of process globals so it can be tested; main.ts wires it to the real process.
import { constants } from 'node:fs';
import { open, unlink, type FileHandle } from 'node:fs/promises';
import { sha256 } from '@noble/hashes/sha2.js';
import { equalBytes, fromHex, groupHex, toHex } from '../core/bytes';
import { UnalteredError } from '../core/errors';
import { hashSource, type ChunkSource } from '../core/hash/stream';
import { collectAttestations, defaultVerifyConfig, LIMITS, parseProof, verify, type DetachedProof, type VerifyReport, type VerifyState } from '../core/ots';
import { checkTrustedHeader, verifyWithTrustedHeader, type TrustedHeaderEvidence, type TrustedHeaderState } from '../core/ots/trusted-header';
import { pairEvidenceFiles } from '../core/reports/batch-pair';
import { verifyBatch } from '../core/reports/batch-verify';
import { createEvidenceZip } from '../core/reports/evidence-zip';
import { createVerificationReportJson } from '../core/reports/verification';

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
  batch <file>...             verify 1-50 files, each against <file>.ots, independently
  inspect <receipt.ots>       summarise a receipt offline; does not check the file or Bitcoin
  evidence <file> <receipt.ots> <out.zip>
                             write the browser's evidence ZIP (16 MiB limit); never overwrites; no verification
  verify-offline <file> <receipt.ots> <height> <block-hash> <header.hex>
                             compare with explicitly trusted header evidence; no network or chain check
options for verify, batch and inspect, before the paths: --json prints JSON (verify: the browser's report format);
  -- ends options, so a following path may start with --
exit codes for verify: 0 verified, 2 pending, 3 file differs, 4 invalid receipt, 5 sources disagree, 6 unreachable, 1 usage/other
exit codes for batch: 0 every file verified, 2 none failed but some pending, 8 one or more not verified, 1 usage/other
exit codes for inspect: 0 receipt readable (not a verification), 4 invalid receipt, 1 usage/other
exit codes for evidence: 0 bundle written, 3 receipt is for another file, 4 invalid receipt, 1 usage/other
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
const OUTPUT_EXISTS = 'the output file already exists';
const EVIDENCE_LIMIT = 'evidence inputs exceed 16 MiB combined';
const DUPLICATE_PATHS = 'duplicate file paths are ambiguous';
const BATCH_SIZE = 'choose between 1 and 50 files';
const KNOWN = new Set([NOT_REGULAR, SIZE_CHANGED, CHANGED, CONTROL_NAME, OUTPUT_EXISTS, EVIDENCE_LIMIT, DUPLICATE_PATHS, BATCH_SIZE]);
const cliError = (code: string): Error => Object.assign(new Error(code), { code });
/** Same bound as the browser's evidence download (src/core/reports/evidence-zip.ts). */
const EVIDENCE_MAX_BYTES = 16 * 1024 * 1024;
const BATCH_MAX = 50;

/** Generic message only (SR-8): never echo paths or stack traces from lower layers. */
function safeError(e: unknown): string {
  const code = e instanceof Error && 'code' in e ? (e as { code?: string }).code : undefined;
  if (code === 'ENOENT') return 'file not found';
  if (code === 'EEXIST') return OUTPUT_EXISTS;
  return code !== undefined && KNOWN.has(code) ? code : 'could not complete the operation';
}

/** Parser messages are fixed, path-free text shared with the browser; anything else stays generic. */
function receiptError(e: unknown): string {
  return e instanceof UnalteredError ? e.message : 'The receipt could not be read.';
}

/**
 * Leading `--json` and `--` for commands that take them. Any other `--` option is a usage error rather than a path, so
 * a typo cannot silently be read as a file name; `--` lets a following path start with `--`.
 */
function options(args: readonly string[]): { json: boolean; rest: string[] } | null {
  let json = false;
  let i = 0;
  for (; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--') { i++; break; }
    if (a === '--json' && !json) { json = true; continue; }
    if (a.startsWith('--')) return null;
    break;
  }
  return { json, rest: args.slice(i) };
}

/** Batch lines name each file, so a newline or carriage return could forge another file's result line. */
const lineSafe = (name: string): boolean => printableName(name) && !name.includes('\n') && !name.includes('\r');

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

function bitcoinLine(report: VerifyReport): string {
  return report.bitcoin ? `bitcoin block ${report.bitcoin.height}, ${report.bitcoin.blockTimeUtc} (no later than about this time)\nsources: ${report.bitcoin.sourcesAgreeing.join(', ')}\n` : '';
}

async function verifyCommand(args: readonly string[], io: CliIO): Promise<number | null> {
  const parsed = options(args);
  if (!parsed || parsed.rest.length < 1 || parsed.rest.length > 2) return null;
  const [file, receipt] = parsed.rest as [string, string | undefined];
  // Receipt first, as in the browser: a missing or oversized receipt is reported before a long hash.
  const ots = await readReceipt(receipt ?? `${file}.ots`);
  const { hex, digest } = await hashFile(file);
  const report = await verify(digest, ots, defaultVerifyConfig());
  if (parsed.json) {
    io.out(createVerificationReportJson(hex, report));
    return EXIT[report.state];
  }
  io.out(`file sha-256: ${groupHex(hex)}\nresult: ${report.state}\n${report.detail}\n`);
  io.out(bitcoinLine(report));
  if (report.pendingCalendars?.length) io.out(`pending at: ${report.pendingCalendars.join(', ')}\n`);
  return EXIT[report.state];
}

async function batchCommand(args: readonly string[], io: CliIO): Promise<number | null> {
  const parsed = options(args);
  if (!parsed || parsed.rest.length === 0) return null;
  const files = parsed.rest;
  if (files.length > BATCH_MAX) throw cliError(BATCH_SIZE);
  if (files.some((f) => !lineSafe(f) || !lineSafe(`${f}.ots`))) throw cliError(CONTROL_NAME);
  let pairs: { fileName: string; receiptName: string }[];
  try {
    pairs = pairEvidenceFiles(files, files.map((f) => `${f}.ots`));
  } catch {
    throw cliError(DUPLICATE_PATHS);
  }
  const hexes = new Map<string, string>();
  const results = await verifyBatch(pairs, async (pair) => {
    try {
      const ots = await readReceipt(pair.receiptName);
      const { hex, digest } = await hashFile(pair.fileName);
      hexes.set(pair.fileName, hex);
      return await verify(digest, ots, defaultVerifyConfig());
    } catch (e) {
      throw new Error(safeError(e), { cause: e });
    }
  });
  const verified = results.filter((r) => r.status === 'VERIFIED').length;
  const pending = results.filter((r) => r.status === 'PENDING').length;
  const notVerified = results.length - verified - pending;
  if (parsed.json) {
    io.out(JSON.stringify({
      format: 'UNALTERED-BATCH-VERIFICATION/1',
      items: results.map((r) => r.status === 'ERROR'
        ? { file: r.input.fileName, receipt: r.input.receiptName, status: 'ERROR', error: r.error }
        : { file: r.input.fileName, receipt: r.input.receiptName, status: r.status,
            report: JSON.parse(createVerificationReportJson(hexes.get(r.input.fileName)!, r.report)) as unknown }),
      summary: { verified, pending, notVerified },
      warning: 'Each item is checked independently. This summary is not a cryptographic signature and does not replace the original files or .ots receipts.',
    }, null, 2) + '\n');
  } else {
    for (const r of results) {
      if (r.status === 'ERROR') {
        io.out(`${r.input.fileName}: ERROR (${r.error})\n`);
        continue;
      }
      io.out(`${r.input.fileName}: ${r.status}\n  ${r.report.detail}\n`);
      if (r.report.bitcoin) io.out(`  ${bitcoinLine(r.report).trimEnd().replace('\n', '\n  ')}\n`);
    }
    io.out(`summary: ${verified} verified, ${pending} pending, ${notVerified} not verified\n`);
  }
  return notVerified > 0 ? 8 : pending > 0 ? 2 : 0;
}

async function inspectCommand(args: readonly string[], io: CliIO): Promise<number | null> {
  const parsed = options(args);
  if (!parsed || parsed.rest.length !== 1) return null;
  const ots = await readReceipt(parsed.rest[0]!);
  let proof: DetachedProof;
  try {
    proof = parseProof(ots);
  } catch (e) {
    io.err(`error: ${receiptError(e)}\n`);
    return 4;
  }
  const atts = collectAttestations(proof.root);
  if (atts.length === 0) {
    io.err('error: The receipt does not commit to anything.\n');
    return 4;
  }
  const heights = [...new Set(atts.flatMap((a) => (a.attestation.kind === 'bitcoin' ? [a.attestation.height] : [])))].sort((a, b) => a - b);
  const pending = [...new Set(atts.flatMap((a) => (a.attestation.kind === 'pending' ? [a.attestation.uri] : [])))];
  const status = heights.length ? 'BITCOIN_ATTESTATION_UNVERIFIED' : 'PENDING';
  const receiptSha256 = toHex(sha256(ots));
  const fileSha256 = toHex(proof.digest);
  if (parsed.json) {
    io.out(JSON.stringify({
      format: 'UNALTERED-RECEIPT-INSPECTION/1',
      receiptSha256, receiptBytes: ots.length, fileSha256, status,
      bitcoinHeights: heights, pendingCalendars: pending,
      verification: 'NOT_PERFORMED',
      warning: 'This inspection reads the receipt only. It does not check the original file or the Bitcoin blockchain; Bitcoin heights are unverified claims made by the receipt. Use verify, or the reference client with your own Bitcoin node.',
    }, null, 2) + '\n');
    return 0;
  }
  io.out(`receipt sha-256: ${groupHex(receiptSha256)}\nreceipt size: ${ots.length} bytes\n` +
    `file sha-256: ${groupHex(fileSha256)} (the file this receipt was made for)\nstatus: ${status}\n`);
  if (heights.length) io.out(`bitcoin attestation heights (claimed, not verified): ${heights.join(', ')}\n`);
  if (pending.length) io.out(`pending at: ${pending.join(', ')}\n`);
  io.out('note: inspection reads the receipt only; the file and the Bitcoin blockchain are not verified. Use verify.\n');
  return 0;
}

/** Reads at most `limit` bytes; one more byte means the input is over the limit. */
async function readEvidenceOriginal(path: string, limit: number): Promise<Uint8Array> {
  const fh = await openRegular(path);
  try {
    if ((await fh.stat()).size > limit) throw cliError(EVIDENCE_LIMIT);
  } finally {
    await fh.close();
  }
  const bytes = await readBounded(path, limit);
  if (bytes.length > limit) throw cliError(EVIDENCE_LIMIT);
  return bytes;
}

/** Creates the file exclusively; a failed write removes the partial file so no truncated bundle is left behind. */
async function writeNew(path: string, data: Uint8Array): Promise<void> {
  const fh = await open(path, 'wx');
  try {
    await fh.writeFile(data);
    await fh.close();
  } catch (e) {
    await fh.close().catch(() => undefined);
    await unlink(path).catch(() => undefined);
    throw e;
  }
}

async function evidenceCommand(args: readonly string[], io: CliIO): Promise<number | null> {
  if (args.length !== 3) return null;
  const [file, receipt, out] = args as [string, string, string];
  if (!printableName(out) || out.includes('\n') || out.includes('\r')) throw cliError(CONTROL_NAME);
  const ots = await readReceipt(receipt);
  let proof: DetachedProof;
  try {
    proof = parseProof(ots);
  } catch (e) {
    io.err(`error: ${receiptError(e)}\n`);
    return 4;
  }
  if (ots.length >= EVIDENCE_MAX_BYTES) throw cliError(EVIDENCE_LIMIT);
  const original = await readEvidenceOriginal(file, EVIDENCE_MAX_BYTES - ots.length);
  if (!equalBytes(sha256(original), proof.digest)) {
    io.err('error: the receipt was made for a different file\n');
    return 3;
  }
  const zip = await createEvidenceZip(original, ots);
  await writeNew(out, zip);
  io.out(`wrote evidence bundle: ${out} (${zip.length} bytes)\n` +
    `original sha-256: ${groupHex(toHex(proof.digest))}\nreceipt sha-256: ${groupHex(toHex(sha256(ots)))}\n` +
    'verification: NOT_PERFORMED\nnote: the bundle holds exact copies and checksums; it does not establish a Bitcoin timestamp. Verify the original and receipt independently.\n');
  return 0;
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
    const rest = argv.slice(1);
    const handled = cmd === 'verify' ? await verifyCommand(rest, io)
      : cmd === 'batch' ? await batchCommand(rest, io)
        : cmd === 'inspect' ? await inspectCommand(rest, io)
          : cmd === 'evidence' ? await evidenceCommand(rest, io)
            : null;
    if (handled !== null) return handled;
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
    io.err(`error: ${safeError(e)}\n`);
    return 1;
  }
  io.err(USAGE);
  return 1;
}

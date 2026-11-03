// Optional per-calendar R1 diagnostic. Browser/reference runners remain authoritative.
// HTTP status and a global VERIFIED result never establish a target's Bitcoin proof.
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const TARGETS = Object.freeze({
  bob: 'bob.btc.calendar.opentimestamps.org',
  finney: 'finney.calendar.eternitywall.com',
});
export const REFERENCE_VERSION = '0.4.5';
export const DIAGNOSTIC_SCOPE = Object.freeze({
  scope: 'automated-target-proof-and-reference-checks',
  fullR1Acceptance: 'BLOCKED',
  remainingManualChecks: Object.freeze(['APP_DISPLAYED_TIME_COMPARISON', 'INDEPENDENT_HEADER_PROVENANCE']),
});
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const norm = (uri) => {
  let end = uri.length;
  while (uri[end - 1] === '/') end--;
  return uri.slice(0, end);
};

// Reuse the app's bounded parser and allowlist; no alternate proof parser or new dependency.
let codecPromise;
export function loadCodec() {
  codecPromise ??= (async () => {
    const temp = await mkdtemp(join(tmpdir(), 'unaltered-r1-codec-'));
    try {
      const { build } = await import('esbuild');
      const result = await build({
        stdin: { contents: 'export * from "./src/core/ots/codec.ts"; export { LIMITS } from "./src/core/ots/types.ts"; export { ENDPOINTS } from "./src/core/net/allowlist.ts";', resolveDir: ROOT, loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
      });
      const path = join(temp, 'codec.mjs');
      await writeFile(path, result.outputFiles[0].contents, { mode: 0o600 });
      return await import(pathToFileURL(path).href);
    } finally { await rm(temp, { recursive: true, force: true }); }
  })();
  return codecPromise;
}

export function isolateTarget(bytes, target, codec) {
  if (!Object.hasOwn(TARGETS, target)) throw new Error('Select bob or finney.');
  const proof = codec.parseProof(bytes);
  const uri = `https://${TARGETS[target]}`;
  const copies = new Map();
  const work = [{ node: proof.root, visited: false }];
  while (work.length) {
    const { node, visited } = work.pop();
    if (!visited) {
      work.push({ node, visited: true });
      for (const child of node.children) work.push({ node: child.node, visited: false });
      continue;
    }
    const attestations = node.attestations.filter((a) => a.kind === 'pending' && norm(a.uri) === uri);
    const children = node.children.flatMap((child) => {
      const copy = copies.get(child.node);
      return copy ? [{ op: child.op, node: copy }] : [];
    });
    copies.set(node, attestations.length || children.length ? { msg: node.msg, attestations, children } : null);
  }
  const root = copies.get(proof.root);
  if (!root) throw new Error('Receipt has no existing pending attestation for the selected target.');
  // Removing other branches never creates a commitment or submits one. All previous Bitcoin proofs are removed.
  return codec.serializeProof({ digest: proof.digest, root });
}

export function assessBrowser({ target, fileSha256, original, isolated, downloaded, report, exitCode }, codec) {
  const reasons = [];
  const reject = (reason) => { if (!reasons.includes(reason)) reasons.push(reason); };
  let input;
  let output;
  try {
    if (sha256(isolateTarget(original, target, codec)) !== sha256(isolated)) reject('TARGET_ISOLATION_MISMATCH');
    input = codec.parseProof(isolated);
    if (Buffer.from(input.digest).toString('hex') !== fileSha256) reject('INPUT_FILE_DIGEST_MISMATCH');
  } catch { reject('TARGET_INPUT_INVALID'); }
  if (!downloaded) reject('DOWNLOADED_RECEIPT_MISSING');
  else {
    try { output = codec.parseProof(downloaded); }
    catch { reject('DOWNLOADED_RECEIPT_INVALID'); }
  }
  if (output && Buffer.from(output.digest).toString('hex') !== fileSha256) reject('OUTPUT_FILE_DIGEST_MISMATCH');
  const block = typeof report?.verify?.block === 'string' && /^\d+$/.test(report.verify.block)
    ? Number(report.verify.block) : Number.NaN;
  if (!Number.isSafeInteger(block) || block < 0) reject('VERIFIED_BLOCK_MISSING');
  const bitcoin = output ? codec.collectAttestations(output.root).filter(({ attestation }) => attestation.kind === 'bitcoin') : [];
  if (!bitcoin.some(({ attestation }) => attestation.height === block)) reject('TARGET_BITCOIN_PROOF_MISSING');
  if (exitCode !== 0 || report?.classification !== 'PASS' || report?.verify?.state !== 'VERIFIED') reject('BROWSER_NOT_VERIFIED');
  if (report?.upgrade?.confirmed !== true || report?.upgrade?.downloaded !== true || !report?.verify?.upgradedReceiptPath) reject('BROWSER_DOWNLOAD_NOT_CONFIRMED');
  if (report?.upgrade?.stillPending !== false || report?.upgrade?.receiptError || report?.upgrade?.unknownCalendars
    || !Array.isArray(report?.upgrade?.failedCalendars) || report.upgrade.failedCalendars.length) reject('UPGRADE_NOT_CLEAN');
  if (!Array.isArray(report?.csp) || report.csp.length) reject('CSP_EVIDENCE_NOT_CLEAN');
  const requests = Array.isArray(report?.requests) ? report.requests : [];
  const upgrades = requests.filter((r) => r.kind === 'upgrade');
  if (!upgrades.length) reject('TARGET_NOT_REQUESTED');
  if (upgrades.some((r) => r.host !== TARGETS[target])) reject('OTHER_CALENDAR_REQUESTED');
  if (upgrades.some((r) => r.method !== 'GET' || r.status !== 200 || typeof r.acao !== 'string' || !r.acao || r.failure)) reject('TARGET_READ_NOT_CLEAN');
  const explorers = codec.ENDPOINTS.filter((e) => e.role === 'explorer').map((e) => e.host);
  if (requests.some((r) => r.method !== 'GET' || (r.kind !== 'upgrade' && (r.kind !== 'explorer' || !explorers.includes(r.host))))) reject('UNEXPECTED_NETWORK_REQUEST');
  return {
    target, browserAccepted: reasons.length === 0, reasons,
    fileSha256, receiptSha256: downloaded ? sha256(downloaded) : null,
    block: Number.isSafeInteger(block) ? block : null,
  };
}

export function assessReference(browser, reference) {
  const reasons = [...browser.reasons];
  if (!browser.browserAccepted && !reasons.length) reasons.push('BROWSER_NOT_ACCEPTED');
  if (!reference) reasons.push('INDEPENDENT_REFERENCE_REQUIRED');
  else {
    if (reference.version !== REFERENCE_VERSION) reasons.push('REFERENCE_VERSION_MISMATCH');
    if (reference.fileSha256 !== browser.fileSha256 || reference.receiptSha256 !== browser.receiptSha256) reasons.push('REFERENCE_INPUT_BINDING_MISMATCH');
    const result = reference.report;
    if (reference.exitCode !== 0 || result?.ok !== true || result?.digestMatches !== true) reasons.push('REFERENCE_NOT_VERIFIED');
    if (!/^[a-f0-9]{64}$/.test(reference.headerHash ?? '') || result?.headerHash !== reference.headerHash) reasons.push('REFERENCE_HEADER_MISMATCH');
    if (!Array.isArray(result?.bitcoin) || !result.bitcoin.some((b) => b.height === browser.block && Number.isSafeInteger(b.verifiedTime) && !b.error)) reasons.push('REFERENCE_BLOCK_NOT_VERIFIED');
    if (typeof reference.headerSource !== 'string' || !reference.headerSource.trim()) reasons.push('INDEPENDENT_HEADER_SOURCE_REQUIRED');
  }
  return { ...DIAGNOSTIC_SCOPE, target: browser.target, status: reasons.length ? 'BLOCKED' : 'PASS', reasons };
}

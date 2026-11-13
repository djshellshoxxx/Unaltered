import { sha256 } from '@noble/hashes/sha2.js';
// Verify view (FR-7, FR-8, FR-11) and receipt upgrade (FR-6).
import { archivalCertificateControls, type ArchivalCertificateView } from '../archival-certificate';
import { fromHex, groupHex, toHex } from '../../core/bytes';
import { createVerificationReportJson } from '../../core/reports/verification';
import { createEvidenceZip } from '../../core/reports/evidence-zip';
import { pairEvidenceFiles } from '../../core/reports/batch-pair';
import { verifyBatch } from '../../core/reports/batch-verify';
import { isAbort, safeMessage, UnalteredError } from '../../core/errors';
import { hashBlob } from '../../core/hash/hasher';
import { upgrade, type UpgradeResult } from '../../core/ots/calendar';
import { parseProof } from '../../core/ots/codec';
import { LIMITS } from '../../core/ots/types';
import { verify, type VerifyReport, type VerifyState } from '../../core/ots/verify';
import { announce, dropZone, el, formatBytes, setChildren } from '../dom';
import { downloadLink, revokeAll, revokeOwner, upgradedName } from '../download';
import { stampConfigFromSettings, verifyConfigFromSettings } from '../state';
import { t, type StringKey } from '../strings';
import { localNodeInstructions, referenceUpgradeInstructions } from './about';

const ICON: Record<VerifyState, string> = { VERIFIED: '✔', PENDING: '⏳', NO_MATCH_FILE: '✖', INVALID_PROOF: '✖', SOURCES_DISAGREE: '⚠', UNREACHABLE: '⚠' };
const TITLE: Record<VerifyState, StringKey> = {
  VERIFIED: 'verify.state.VERIFIED',
  PENDING: 'verify.state.PENDING',
  NO_MATCH_FILE: 'verify.state.NO_MATCH_FILE',
  INVALID_PROOF: 'verify.state.INVALID_PROOF',
  SOURCES_DISAGREE: 'verify.state.SOURCES_DISAGREE',
  UNREACHABLE: 'verify.state.UNREACHABLE',
};
const BODY: Record<VerifyState, StringKey> = {
  VERIFIED: 'verify.body.VERIFIED',
  PENDING: 'verify.body.PENDING',
  NO_MATCH_FILE: 'verify.body.NO_MATCH_FILE',
  INVALID_PROOF: 'verify.body.INVALID_PROOF',
  SOURCES_DISAGREE: 'verify.body.SOURCES_DISAGREE',
  UNREACHABLE: 'verify.body.UNREACHABLE',
};

// A share-link check hashes no file, so wording that speaks about "this file" would overstate the result.
const LINK_TITLE: Partial<Record<VerifyState, StringKey>> = { NO_MATCH_FILE: 'verify.state.link.NO_MATCH_FILE' };
const LINK_BODY: Partial<Record<VerifyState, StringKey>> = {
  VERIFIED: 'verify.link.VERIFIED',
  PENDING: 'verify.link.PENDING',
  NO_MATCH_FILE: 'verify.link.NO_MATCH_FILE',
};

const HEX64 = /^[0-9a-f]{64}$/;

function checkReceiptSize(file: File): void {
  if (file.size > LIMITS.maxInputBytes) throw new UnalteredError('PROOF_TOO_LARGE', 'The receipt file is too large.');
}

export interface VerifyView {
  setPrefill(hex: string | null): void;
  /** Re-renders every visible string in the current language from the retained state; never restarts work. */
  relabel(): void;
}

// What an output area shows, kept as data so a language switch can render it again without repeating the work.
type Shown =
  | { kind: 'working' }
  | { kind: 'report'; report: VerifyReport; hex: string; fromLink: boolean; certificate: ArchivalCertificateView }
  | { kind: 'upgraded'; result: UpgradeResult; fileName: string }
  | { kind: 'error'; message: string }
  | null;

export function mountVerify(root: HTMLElement): VerifyView {
  revokeAll();
  let file: File | null = null;
  let receipt: File | null = null;
  let prefill: string | null = null;
  let busy = false;
  let abort: AbortController | null = null;
  let generation = 0;

  const inputs = el('div', { class: 'inputs' });
  const actions = el('div', { class: 'actions' });
  const out = el('div', { class: 'verify-result', 'aria-live': 'polite' });
  const upOut = el('div', { class: 'upgrade-result', 'aria-live': 'polite' });
  let upFile: File | null = null;
  let upGeneration = 0;
  let upAbort: AbortController | null = null;
  let shown: Shown = null;
  let upShown: Shown = null;

  function show(next: Shown): void {
    if (next !== shown) {
      if (shown?.kind === 'report') shown.certificate.dispose();
      revokeOwner(out);
    }
    shown = next;
    setChildren(out, render(next));
  }

  function showUpgrade(next: Shown): void {
    if (next !== upShown) revokeOwner(upOut);
    upShown = next;
    setChildren(upOut, ...renderUpgradeOutput(next));
  }
  const upInputs = el('div', { class: 'inputs' });
  const upActions = el('div', { class: 'actions' });

  // Supersedes any running verification: its result is discarded, so its hash worker and requests are stopped too.
  function resetVerification(): void {
    generation++;
    busy = false;
    abort?.abort();
    abort = null;
    show(null);
  }

  function renderInputs(): void {
    setChildren(
      inputs,
      el('h3', {}, t('verify.step1')),
      prefill
        ? el(
            'div',
            { class: 'notice' },
            el('p', {}, t('verify.prefilled')),
            el('code', { class: 'digest' }, groupHex(prefill)),
            el('button', { type: 'button', class: 'button small', onclick: () => ((prefill = null), resetVerification(), renderInputs(), renderActions()) }, t('common.remove')),
          )
        : null,
      el('p', { class: 'muted help-text', title: t('help.verifyFile') }, t('help.verifyFile')),
      dropZone({ id: 'verify-file', label: t('verify.dropFile'), hint: t('verify.dropFileHint'), onFiles: (f) => ((file = f[0] ?? null), (prefill = file ? null : prefill), resetVerification(), renderInputs(), renderActions()) }),
      file ? el('p', { class: 'picked' }, `${file.name} · ${formatBytes(file.size)}`) : null,
      el('h3', {}, t('verify.step2')),
      el('p', { class: 'muted help-text', title: t('help.verifyReceipt') }, t('help.verifyReceipt')),
      dropZone({ id: 'verify-receipt', label: t('verify.dropReceipt'), hint: t('verify.dropReceiptHint'), accept: '.ots', onFiles: (f) => ((receipt = f[0] ?? null), resetVerification(), renderInputs(), renderActions()) }),
      receipt ? el('p', { class: 'picked' }, `${receipt.name} · ${formatBytes(receipt.size)}`) : null,
    );
  }

  function renderActions(): void {
    setChildren(
      actions,
      el('button', { type: 'button', class: 'button primary big', disabled: busy || !receipt || (!file && !prefill), onclick: () => void run() }, busy ? t('verify.checking') : t('verify.check')),
      busy ? el('button', { type: 'button', class: 'button', onclick: () => { resetVerification(); renderActions(); } }, t('common.cancel')) : null,
      file && receipt && !busy ? el('button', { type: 'button', class: 'button', onclick: () => void downloadEvidenceBundle() }, t('evidence.downloadZip')) : null,
    );
  }

  async function downloadEvidenceBundle(): Promise<void> {
    if (!file || !receipt || busy) return;
    try {
      if (file.size + receipt.size > 16 * 1024 * 1024) throw new Error(t('evidence.limit'));
      const [original, proof] = await Promise.all([file.arrayBuffer(), receipt.arrayBuffer()]);
      const archive = await createEvidenceZip(new Uint8Array(original), new Uint8Array(proof));
      const blob = new Blob([archive as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = el('a', { href: url, download: 'unaltered-evidence.zip' });
      link.click();
      // Defer revocation until after the browser has consumed the click.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      show({ kind: 'error', message: safeMessage(error) });
    }
  }

  async function run(): Promise<void> {
    if (!receipt) return;
    const selectedReceipt = receipt;
    const selectedFile = file;
    const selectedPrefill = prefill;
    const operation = ++generation;
    const controller = new AbortController();
    const current = (): boolean => operation === generation && !controller.signal.aborted && out.isConnected;
    busy = true;
    abort = controller;
    renderActions();
    show({ kind: 'working' });
    try {
      checkReceiptSize(selectedReceipt);
      let digest: Uint8Array;
      let hex: string;
      if (selectedFile) {
        const h = await hashBlob(selectedFile, { signal: controller.signal });
        if (!current()) return;
        digest = h.digest;
        hex = h.hex;
      } else {
        hex = selectedPrefill!;
        digest = fromHex(hex);
      }
      const bytes = new Uint8Array(await selectedReceipt.arrayBuffer());
      if (!current()) return;
      const report = await verify(digest, bytes, verifyConfigFromSettings(controller.signal));
      if (!current()) return;
      const receiptSha256 = toHex(sha256(bytes));
      if (!current()) return;
      const certificate = archivalCertificateControls(async () => bytes, selectedFile !== null && report.state === 'VERIFIED' && report.bitcoin ? {
        receiptSha256, fileSha256: hex, bitcoin: {
          height: report.bitcoin.height,
          blockHash: report.bitcoin.blockHash,
          blockTimeUtc: report.bitcoin.blockTimeUtc,
          sourcesAgreeing: report.bitcoin.sourcesAgreeing,
        },
      } : undefined);
      show({ kind: 'report', report, hex, fromLink: selectedFile === null, certificate });
      announce(t(reportTitleKey(report.state, selectedFile === null)), root);
    } catch (e) {
      if (current()) show(isAbort(e) ? null : { kind: 'error', message: safeMessage(e) });
    } finally {
      if (current()) {
        busy = false;
        abort = null;
        renderActions();
      }
    }
  }

  function resetUpgrade(): void {
    upGeneration++;
    upAbort?.abort();
    upAbort = null;
    showUpgrade(null);
  }

  function renderUpgrade(): void {
    const hadActionFocus = upActions.contains(document.activeElement);
    setChildren(
      upInputs,
      el('p', { class: 'muted help-text', title: t('help.upgradeReceipt') }, t('help.upgradeReceipt')),
      dropZone({ id: 'upgrade-receipt', label: t('upgrade.drop'), hint: t('verify.dropReceiptHint'), accept: '.ots', onFiles: (f) => { resetUpgrade(); upFile = f[0] ?? null; renderUpgrade(); } }),
      upFile ? el('p', { class: 'picked' }, `${upFile.name} · ${formatBytes(upFile.size)}`) : null,
    );
    setChildren(upActions,
      el('button', { id: 'upgrade-run', type: 'button', class: 'button primary', disabled: !upFile || upAbort !== null, onclick: () => void runUpgrade() }, t('upgrade.run')),
      upAbort ? el('button', { id: 'upgrade-cancel', type: 'button', class: 'button', onclick: () => { resetUpgrade(); renderUpgrade(); } }, t('common.cancel')) : null,
    );
    if (hadActionFocus) upActions.querySelector<HTMLElement>(upAbort ? '#upgrade-cancel' : '#upgrade-run')?.focus();
  }

  async function runUpgrade(): Promise<void> {
    if (!upFile || upAbort) return;
    const f = upFile;
    const controller = new AbortController();
    upAbort = controller;
    const operation = ++upGeneration;
    const current = (): boolean => operation === upGeneration && !controller.signal.aborted && upOut.isConnected;
    showUpgrade({ kind: 'working' });
    renderUpgrade();
    try {
      checkReceiptSize(f);
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!current()) return;
      parseProof(bytes);
      const result = await upgrade(bytes, { ...stampConfigFromSettings(), signal: controller.signal });
      if (!current()) return;
      showUpgrade({ kind: 'upgraded', result, fileName: f.name });
    } catch (e) {
      if (current()) showUpgrade(isAbort(e) ? null : { kind: 'error', message: safeMessage(e) });
    } finally {
      if (current()) {
        upAbort = null;
        renderUpgrade();
      }
    }
  }

  function render(next: Shown): Node | null {
    if (!next) return null;
    if (next.kind === 'working') return el('p', { role: 'status' }, t('verify.working'));
    if (next.kind === 'error') return el('p', { class: 'error', role: 'alert' }, next.message);
    if (next.kind === 'report') {
      const reportCard = renderReport(next.report, next.hex, next.fromLink, out);
      reportCard.appendChild(next.certificate.root);
      return reportCard;
    }
    return null;
  }

  function renderUpgradeOutput(next: Shown): (Node | null)[] {
    if (!next || next.kind !== 'upgraded') return [render(next)];
    const r = next.result;
    const kids: (Node | null)[] = [];
    const name = upgradedName(next.fileName);
    const download = (): Node[] => [downloadLink(t('upgrade.download', { name }), name, r.ots, 'application/octet-stream', undefined, { owner: upOut, key: 'receipt' }), el('p', { class: 'muted' }, t('upgrade.newFile'))];
    if (r.status === 'bitcoin-confirmed') {
      kids.push(el('p', { class: 'notice warn', role: 'status' }, r.changed ? t('upgrade.confirmed') : t('upgrade.alreadyConfirmed')));
    } else {
      kids.push(el('p', { class: 'notice pending', role: 'status' }, t('upgrade.stillPending')));
    }
    if (r.status !== 'bitcoin-confirmed' && r.calendars.some((c) => c.unreadable)) {
      kids.push(el('p', { class: 'notice pending' }, t('upgrade.unreadable')), referenceUpgradeInstructions());
    }
    if (r.changed) kids.push(...download());
    if (r.unknownCalendars.length > 0) kids.push(el('p', { class: 'warn' }, t('upgrade.unknownCalendar', { hosts: r.unknownCalendars.join(', ') })));
    const failed = r.calendars.filter((c) => !c.ok);
    if (failed.length > 0) kids.push(el('ul', { class: 'calendars' }, ...failed.map((c) => el('li', {}, `✖ ${new URL(c.url).host} – ${c.error ?? ''}`))));
    return kids;
  }

  // Batch inputs are separate from the single-file Verify workflow. Never match by upload order.
  const batchRoot = el('section', { class: 'batch-verify' });
  let batchFiles: File[] = [];
  let batchReceipts: File[] = [];
  let batchBusy = false;
  let batchController: AbortController | null = null;
  let batchGeneration = 0;
  const batchResults = el('div', { class: 'batch-results', 'aria-live': 'polite' });
  const batchActions = el('div', { class: 'actions' });
  function renderBatchActions(): void {
    setChildren(batchActions,
      el('p', {}, t('batch.selected', { files: batchFiles.length, receipts: batchReceipts.length })),
      el('button', { type: 'button', class: 'button primary', disabled: batchBusy || !batchFiles.length || !batchReceipts.length,
        onclick: () => void runBatch() }, t('batch.run')),
      batchBusy ? el('button', { type: 'button', class: 'button', onclick: () => {
        batchGeneration++;
        batchController?.abort();
        batchBusy = false;
        renderBatchActions();
      } }, t('common.cancel')) : null,
    );
  }
  async function runBatch(): Promise<void> {
    if (batchBusy) return;
    const files = [...batchFiles];
    const receipts = [...batchReceipts];
    let pairs: ReturnType<typeof pairEvidenceFiles>;
    try {
      pairs = pairEvidenceFiles(files.map(f => f.name), receipts.map(f => f.name));
    } catch {
      setChildren(batchResults, el('p', { role: 'alert', class: 'error' }, t('batch.pairError')));
      return;
    }
    const controller = new AbortController();
    const generation = ++batchGeneration;
    batchController = controller;
    batchBusy = true;
    renderBatchActions();
    setChildren(batchResults, el('p', { role: 'status' }, t('batch.working')));
    try {
      const result = await verifyBatch(pairs, async pair => {
        if (controller.signal.aborted) throw new UnalteredError('ABORTED', 'Cancelled');
        const f = files.find(f => f.name === pair.fileName)!;
        const receipt = receipts.find(f => f.name === pair.receiptName)!;
        checkReceiptSize(receipt);
        const hashed = await hashBlob(f, { signal: controller.signal });
        if (controller.signal.aborted) throw new UnalteredError('ABORTED', 'Cancelled');
        const proof = new Uint8Array(await receipt.arrayBuffer());
        if (controller.signal.aborted) throw new UnalteredError('ABORTED', 'Cancelled');
        return verify(hashed.digest, proof, verifyConfigFromSettings(controller.signal));
      }, controller.signal);
      if (generation !== batchGeneration || controller.signal.aborted) return;
      setChildren(batchResults, el('ul', {}, ...result.map(item =>
        el('li', {},
          el('strong', {}, item.input.fileName + ': '),
          el('span', {}, item.status === 'ERROR' ? t('batch.error') : item.status),
          item.status !== 'ERROR' ? el('p', { class: 'muted' }, item.report.detail) : null,
          item.status === 'VERIFIED' && item.report.bitcoin
            ? el('p', {}, t('batch.block', { height: item.report.bitcoin.height })) : null,
        ),
      )));
    } catch (error) {
      if (generation === batchGeneration && !controller.signal.aborted)
        setChildren(batchResults, el('p', { class: 'error', role: 'alert' }, safeMessage(error)));
    } finally {
      if (generation === batchGeneration) {
        batchBusy = false;
        batchController = null;
        renderBatchActions();
      }
    }
  }
  function renderBatch(): void {
    setChildren(batchRoot,
      el('h3', {}, t('batch.title')),
      el('p', { class: 'muted' }, t('batch.instructions')),
      el('p', { class: 'muted help-text', title: t('help.batchFiles') }, t('help.batchFiles')),
      dropZone({ id: 'batch-files', label: t('batch.files'), hint: t('batch.fileHint'), multiple: true,
        onFiles: files => { batchGeneration++; batchController?.abort(); batchBusy = false; batchFiles = files; setChildren(batchResults); renderBatchActions(); } }),
      el('p', { class: 'muted help-text', title: t('help.batchReceipts') }, t('help.batchReceipts')),
      dropZone({ id: 'batch-receipts', label: t('batch.receipts'), hint: t('batch.receiptHint'), multiple: true, accept: '.ots',
        onFiles: files => { batchGeneration++; batchController?.abort(); batchBusy = false; batchReceipts = files; setChildren(batchResults); renderBatchActions(); } }),
      batchActions,
      batchResults,
    );
    renderBatchActions();
  }

  function renderFrame(): void {
    setChildren(
      root,
      el('h2', { id: 'verify-h', tabindex: -1 }, t('verify.title')),
      el('p', { class: 'lead' }, t('copy.stays')),
      inputs,
      actions,
      out,
      el('hr'),
      batchRoot,
      el('hr'),
      el('h3', {}, t('upgrade.title')),
      el('p', {}, t('upgrade.intro')),
      upInputs,
      upActions,
      upOut,
    );
  }

  renderFrame();
  renderInputs();
  renderActions();
  renderUpgrade();
  renderBatch();

  return {
    setPrefill(hex) {
      const next = hex && HEX64.test(hex) ? hex : null;
      if (next !== prefill) resetVerification();
      prefill = next;
      // A link and a chosen file are alternatives: Check uses the file when there is one, so showing both would mislead.
      if (next) file = null;
      renderInputs();
      renderActions();
    },
    relabel() {
      renderFrame();
      renderInputs();
      renderActions();
      renderUpgrade();
      renderBatch();
      if (shown?.kind === 'report') shown.certificate.relabel();
      setChildren(out, render(shown));
      showUpgrade(upShown);
    },
  };
}

function reportTitleKey(state: VerifyState, fromLink: boolean): StringKey {
  return (fromLink ? LINK_TITLE[state] : undefined) ?? TITLE[state];
}

export function renderReport(r: VerifyReport, hex: string, fromLink: boolean, owner?: object): HTMLElement {
  const title = reportTitleKey(r.state, fromLink);
  const linkBody = fromLink ? LINK_BODY[r.state] : undefined;
  const detailRows: Node[] = [
    el('dt', {}, t('verify.d.fingerprint')),
    el('dd', {}, el('code', { class: 'digest' }, groupHex(hex)), fromLink ? el('span', { class: 'muted' }, ` ${t('verify.d.fromLink')}`) : null),
  ];
  if (r.bitcoin) {
    detailRows.push(
      el('dt', {}, t('verify.d.block')),
      el('dd', {}, String(r.bitcoin.height)),
      el('dt', {}, 'Bitcoin block hash'),
      el('dd', {}, el('code', { class: 'digest' }, r.bitcoin.blockHash)),
      el('dt', {}, t('verify.d.time')),
      el('dd', {}, t(fromLink ? 'verify.d.noLater.link' : 'verify.d.noLater', { time: r.bitcoin.blockTimeUtc })),
      el('dt', {}, t('verify.d.sources')),
      el('dd', {}, r.bitcoin.sourcesAgreeing.join(', ')),
    );
  }
  if (r.pendingCalendars && r.pendingCalendars.length > 0) {
    detailRows.push(el('dt', {}, t('verify.d.calendars')), el('dd', {}, r.pendingCalendars.join(', ')));
  }
  const card = el(
    'div',
    { class: `result result-${r.state}`, role: 'status' },
    el('div', { class: 'result-head' }, el('span', { class: 'icon', 'aria-hidden': 'true' }, ICON[r.state]), el('h3', {}, t(title))),
    el('p', {}, t(linkBody ?? BODY[r.state])),
    // The core detail describes a file; the link-specific body replaces it.
    r.state !== 'VERIFIED' && !linkBody && r.detail ? el('p', { class: 'muted' }, r.detail) : null,
    el('dl', { class: 'details' }, ...detailRows),
  );
  if (r.state === 'VERIFIED') {
    card.appendChild(
      el(
        'div',
        { class: 'notice trust' },
        el('p', {}, el('strong', {}, t('verify.trust.title')), ' ', t('verify.trust.l1')),
        el('p', {}, t('verify.trust.l2')),
        el('p', { class: 'muted' }, t('verify.trust.timeCaveat')),
        localNodeInstructions(),
      ),
    );
  }
  if (r.state === 'PENDING') card.appendChild(el('p', { class: 'notice pending' }, t('copy.pendingNotProof')));
  card.appendChild(downloadLink('Download verification report (JSON)', 'unaltered-verification-report.json',
    new Blob([createVerificationReportJson(hex, r)], { type: 'application/json' }),
    'application/json', undefined, owner ? { owner, key: 'verification-report' } : undefined));
  return card;
}

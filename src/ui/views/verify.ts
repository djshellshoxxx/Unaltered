// Verify view (FR-7, FR-8, FR-11) and receipt upgrade (FR-6).
import { fromHex, groupHex } from '../../core/bytes';
import { isAbort, safeMessage, UnalteredError } from '../../core/errors';
import { hashBlob } from '../../core/hash/hasher';
import { upgrade, type UpgradeResult } from '../../core/ots/calendar';
import { parseProof } from '../../core/ots/codec';
import { LIMITS } from '../../core/ots/types';
import { verify, type VerifyReport, type VerifyState } from '../../core/ots/verify';
import { announce, dropZone, el, formatBytes, setChildren } from '../dom';
import { downloadLink, revokeAll } from '../download';
import { stampConfigFromSettings, verifyConfigFromSettings } from '../state';
import { t, type StringKey } from '../strings';
import { localNodeInstructions } from './about';

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
  | { kind: 'report'; report: VerifyReport; hex: string; fromLink: boolean }
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
  let shown: Shown = null;
  let upShown: Shown = null;

  function show(next: Shown): void {
    shown = next;
    setChildren(out, render(next));
  }

  function showUpgrade(next: Shown): void {
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
      dropZone({ id: 'verify-file', label: t('verify.dropFile'), hint: t('verify.dropFileHint'), onFiles: (f) => ((file = f[0] ?? null), resetVerification(), renderInputs(), renderActions()) }),
      file ? el('p', { class: 'picked' }, `${file.name} · ${formatBytes(file.size)}`) : null,
      el('h3', {}, t('verify.step2')),
      dropZone({ id: 'verify-receipt', label: t('verify.dropReceipt'), hint: t('verify.dropReceiptHint'), accept: '.ots', onFiles: (f) => ((receipt = f[0] ?? null), resetVerification(), renderInputs(), renderActions()) }),
      receipt ? el('p', { class: 'picked' }, `${receipt.name} · ${formatBytes(receipt.size)}`) : null,
    );
  }

  function renderActions(): void {
    setChildren(
      actions,
      el('button', { type: 'button', class: 'button primary big', disabled: busy || !receipt || (!file && !prefill), onclick: () => void run() }, busy ? t('verify.checking') : t('verify.check')),
      busy ? el('button', { type: 'button', class: 'button', onclick: () => { resetVerification(); renderActions(); } }, t('common.cancel')) : null,
    );
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
      show({ kind: 'report', report, hex, fromLink: selectedFile === null });
      announce(t(TITLE[report.state]));
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

  function renderUpgrade(): void {
    setChildren(
      upInputs,
      dropZone({ id: 'upgrade-receipt', label: t('upgrade.drop'), hint: t('verify.dropReceiptHint'), accept: '.ots', onFiles: (f) => { upFile = f[0] ?? null; upGeneration++; showUpgrade(null); renderUpgrade(); } }),
      upFile ? el('p', { class: 'picked' }, `${upFile.name} · ${formatBytes(upFile.size)}`) : null,
    );
    setChildren(upActions, el('button', { type: 'button', class: 'button primary', disabled: !upFile, onclick: () => void runUpgrade() }, t('upgrade.run')));
  }

  async function runUpgrade(): Promise<void> {
    if (!upFile) return;
    const f = upFile;
    const operation = ++upGeneration;
    const current = (): boolean => operation === upGeneration && upOut.isConnected;
    showUpgrade({ kind: 'working' });
    try {
      checkReceiptSize(f);
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!current()) return;
      parseProof(bytes);
      const result = await upgrade(bytes, stampConfigFromSettings());
      if (!current()) return;
      showUpgrade({ kind: 'upgraded', result, fileName: f.name });
    } catch (e) {
      if (current()) showUpgrade({ kind: 'error', message: safeMessage(e) });
    }
  }

  function render(next: Shown): Node | null {
    if (!next) return null;
    if (next.kind === 'working') return el('p', { role: 'status' }, t('verify.working'));
    if (next.kind === 'error') return el('p', { class: 'error', role: 'alert' }, next.message);
    if (next.kind === 'report') return renderReport(next.report, next.hex, next.fromLink);
    return null;
  }

  function renderUpgradeOutput(next: Shown): (Node | null)[] {
    if (!next || next.kind !== 'upgraded') return [render(next)];
    const r = next.result;
    const kids: (Node | null)[] = [];
    const name = next.fileName.replace(/\.ots$/i, '') + '.upgraded.ots';
    const download = (): Node[] => [downloadLink(t('upgrade.download', { name }), name, r.ots, 'application/octet-stream'), el('p', { class: 'muted' }, t('upgrade.newFile'))];
    if (r.status === 'bitcoin-confirmed') {
      kids.push(el('p', { class: 'notice ok', role: 'status' }, r.changed ? t('upgrade.confirmed') : t('upgrade.alreadyConfirmed')));
    } else {
      kids.push(el('p', { class: 'notice pending', role: 'status' }, t('upgrade.stillPending')));
    }
    if (r.status !== 'bitcoin-confirmed' && r.calendars.some((c) => c.unreadable)) kids.push(el('p', { class: 'notice pending' }, t('upgrade.unreadable')));
    if (r.changed) kids.push(...download());
    if (r.unknownCalendars.length > 0) kids.push(el('p', { class: 'warn' }, t('upgrade.unknownCalendar', { hosts: r.unknownCalendars.join(', ') })));
    const failed = r.calendars.filter((c) => !c.ok);
    if (failed.length > 0) kids.push(el('ul', { class: 'calendars' }, ...failed.map((c) => el('li', {}, `✖ ${new URL(c.url).host} – ${c.error ?? ''}`))));
    return kids;
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

  return {
    setPrefill(hex) {
      const next = hex && HEX64.test(hex) ? hex : null;
      if (next !== prefill) resetVerification();
      prefill = next;
      renderInputs();
      renderActions();
    },
    relabel() {
      renderFrame();
      renderInputs();
      renderActions();
      renderUpgrade();
      show(shown);
      showUpgrade(upShown);
    },
  };
}

function renderReport(r: VerifyReport, hex: string, fromLink: boolean): HTMLElement {
  const detailRows: Node[] = [
    el('dt', {}, t('verify.d.fingerprint')),
    el('dd', {}, el('code', { class: 'digest' }, groupHex(hex)), fromLink ? el('span', { class: 'muted' }, ` ${t('verify.d.fromLink')}`) : null),
  ];
  if (r.bitcoin) {
    detailRows.push(
      el('dt', {}, t('verify.d.block')),
      el('dd', {}, String(r.bitcoin.height)),
      el('dt', {}, t('verify.d.time')),
      el('dd', {}, t('verify.d.noLater', { time: r.bitcoin.blockTimeUtc })),
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
    el('div', { class: 'result-head' }, el('span', { class: 'icon', 'aria-hidden': 'true' }, ICON[r.state]), el('h3', {}, t(TITLE[r.state]))),
    el('p', {}, t(BODY[r.state])),
    r.state !== 'VERIFIED' && r.detail ? el('p', { class: 'muted' }, r.detail) : null,
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
  return card;
}

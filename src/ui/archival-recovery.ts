import { recoverReceiptFrames } from '../core/archive/frames';
import { scanQrImage } from '../core/archive/qr-scan';
import { MAX_QR_IMAGE_BYTES } from '../core/archive/qr-image';
import { parseProof } from '../core/ots/codec';
import { isAbort } from '../core/errors';
import { el, setChildren } from './dom';
import { downloadLink, revokeOwner } from './download';
import { archiveText as t } from './archive-strings';

/** Scans stay local. Selection changes/cancellation terminate the active decoder worker. */
export function archivalRecoveryPanel(): { root: HTMLElement; relabel(): void; dispose(): void } {
  let files: File[] = [];
  let generation = 0;
  let controller: AbortController | null = null;
  const root = el('section', { class: 'archival-recovery' });
  const input = el('input', { type: 'file', multiple: true, accept: '.png,.jpg,.jpeg,.bin', 'aria-label': t('archive.scanInput') });
  const status = el('p', { role: 'status' }, t('archive.scanHint'));
  const result = el('div');
  const heading = el('h3', {}, t('archive.recoveryTitle'));
  const intro = el('p', { class: 'muted' }, t('archive.recoveryIntro'));
  let shown: Parameters<typeof t> = ['archive.scanHint'];
  let recoveredLink: HTMLAnchorElement | null = null;
  const show = (...message: Parameters<typeof t>): void => { shown = message; status.textContent = t(...shown); };
  const clear = (): void => { revokeOwner(root); setChildren(result); recoveredLink = null; };
  const cancel = (): void => {
    generation++; controller?.abort(); controller = null;
    run.disabled = files.length === 0; stop.disabled = true;
    show('archive.cancelled'); clear();
  };
  const run = el('button', { type: 'button', class: 'button', disabled: true, onclick: () => { void recover(); } }, t('archive.recover'));
  const stop = el('button', { type: 'button', class: 'button', disabled: true, onclick: cancel }, t('archive.cancelScan'));
  input.addEventListener('change', () => {
    cancel(); files = Array.from(input.files ?? []); input.value = '';
    run.disabled = !files.length;
    show('archive.selected', { count: files.length });
  });
  async function recover(): Promise<void> {
    if (controller) return;
    const selected = [...files];
    if (!selected.length || selected.length > 64 || selected.reduce((sum, file) => sum + file.size, 0) > 64 * 1024 * 1024 ||
        selected.some(file => !file.size || file.size > MAX_QR_IMAGE_BYTES)) { show('archive.scanLimit'); return; }
    const owned = new AbortController(); controller = owned;
    const operation = ++generation;
    const current = (): boolean => operation === generation && !owned.signal.aborted && root.isConnected;
    run.disabled = true; stop.disabled = false; clear();
    try {
      const frames: Uint8Array[] = [];
      for (const [index, file] of selected.entries()) {
        show('archive.scanning', { index: index + 1, total: selected.length });
        if (/\.bin$/i.test(file.name)) {
          if (file.size < 81 || file.size > 2953) throw new Error('Invalid frame');
          frames.push(new Uint8Array(await file.arrayBuffer()));
        } else {
          const decoded = await scanQrImage(file, owned.signal);
          // A certificate appendix contains no QR data; it is safe to include that scanned page.
          frames.push(...decoded);
        }
        if (!current()) return;
        if (frames.length > 4096) throw new Error('Too many frames');
      }
      const receipt = await recoverReceiptFrames(frames);
      // A complete transport is not necessarily a standard OTS receipt. Validate it before export.
      parseProof(receipt);
      if (!current()) return;
      recoveredLink = downloadLink(t('archive.downloadRecovered'), 'recovered.ots', receipt,
        'application/octet-stream', undefined, { owner: root, key: 'receipt' });
      result.appendChild(recoveredLink);
      show('archive.recovered', { bytes: receipt.length });
    } catch (error) {
      if (current()) show(isAbort(error) ? 'archive.cancelled' : 'archive.scanFailed');
    } finally {
      if (operation === generation) { controller = null; run.disabled = !files.length; stop.disabled = true; }
    }
  }
  root.appendChild(heading);
  root.appendChild(intro);
  root.appendChild(input); root.appendChild(run); root.appendChild(stop); root.appendChild(status); root.appendChild(result);
  const relabel = (): void => {
    heading.textContent = t('archive.recoveryTitle');
    intro.textContent = t('archive.recoveryIntro');
    input.setAttribute('aria-label', t('archive.scanInput'));
    run.textContent = t('archive.recover');
    stop.textContent = t('archive.cancelScan');
    status.textContent = t(...shown);
    if (recoveredLink) recoveredLink.textContent = t('archive.downloadRecovered');
  };
  // Actual teardown owns cancellation and URL cleanup; relabeling never changes the work or its result.
  const dispose = (): void => { generation++; controller?.abort(); controller = null; files = []; clear(); root.remove(); };
  return { root, relabel, dispose };
}

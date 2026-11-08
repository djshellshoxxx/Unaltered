import { recoverReceiptFrames } from '../core/archive/frames';
import { scanQrImage } from '../core/archive/qr-scan';
import { MAX_QR_IMAGE_BYTES } from '../core/archive/qr-image';
import { parseProof } from '../core/ots/codec';
import { isAbort } from '../core/errors';
import { el, setChildren } from './dom';
import { downloadLink, revokeOwner } from './download';
import { archiveText as t } from './archive-strings';

/** Scans stay local. Selection changes/cancellation terminate the active decoder worker. */
export function archivalRecoveryPanel(): HTMLElement {
  let files: File[] = [];
  let generation = 0;
  let controller: AbortController | null = null;
  const root = el('section', { class: 'archival-recovery' });
  const input = el('input', { type: 'file', multiple: true, accept: '.png,.jpg,.jpeg,.bin', 'aria-label': t('archive.scanInput') });
  const status = el('p', { role: 'status' }, t('archive.scanHint'));
  const result = el('div');
  const clear = (): void => { revokeOwner(root); setChildren(result); };
  const cancel = (): void => {
    generation++; controller?.abort(); controller = null;
    run.disabled = files.length === 0; stop.disabled = true;
    status.textContent = t('archive.cancelled'); clear();
  };
  const run = el('button', { type: 'button', class: 'button', disabled: true, onclick: () => { void recover(); } }, t('archive.recover'));
  const stop = el('button', { type: 'button', class: 'button', disabled: true, onclick: cancel }, t('common.cancel'));
  input.addEventListener('change', () => {
    cancel(); files = Array.from(input.files ?? []); input.value = '';
    run.disabled = !files.length;
    status.textContent = t('archive.selected', { count: files.length });
  });
  async function recover(): Promise<void> {
    if (controller) return;
    const selected = [...files];
    if (!selected.length || selected.length > 64 || selected.reduce((sum, file) => sum + file.size, 0) > 64 * 1024 * 1024 ||
        selected.some(file => !file.size || file.size > MAX_QR_IMAGE_BYTES)) { status.textContent = t('archive.scanLimit'); return; }
    const owned = new AbortController(); controller = owned;
    const operation = ++generation;
    const current = (): boolean => operation === generation && !owned.signal.aborted && root.isConnected;
    run.disabled = true; stop.disabled = false; clear();
    try {
      const frames: Uint8Array[] = [];
      for (const [index, file] of selected.entries()) {
        status.textContent = t('archive.scanning', { index: index + 1, total: selected.length });
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
      result.appendChild(downloadLink(t('archive.downloadRecovered'), 'recovered.ots', receipt,
        'application/octet-stream', undefined, { owner: root, key: 'receipt' }));
      status.textContent = t('archive.recovered', { bytes: receipt.length });
    } catch (error) {
      if (current()) status.textContent = t(isAbort(error) ? 'archive.cancelled' : 'archive.scanFailed');
    } finally {
      if (operation === generation) { controller = null; run.disabled = !files.length; stop.disabled = true; }
    }
  }
  root.appendChild(el('h3', {}, t('archive.recoveryTitle')));
  root.appendChild(el('p', { class: 'muted' }, t('archive.recoveryIntro')));
  root.appendChild(input); root.appendChild(run); root.appendChild(stop); root.appendChild(status); root.appendChild(result);
  return root;
}

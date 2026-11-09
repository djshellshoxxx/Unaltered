import { encodeArchivalQr } from '../core/archive/qr-encode';
import { createArchivalPrintSheet } from '../core/archive/qr-print';
import type { QrPaper, QrPreference } from '../core/archive/qr-plan';
import { parseProof } from '../core/ots/codec';
import { toHex } from '../core/bytes';
import { LIMITS } from '../core/ots/types';
import { el } from './dom';
import { downloadLink, revokeOwner } from './download';
import { archiveText as t } from './archive-strings';

interface CertificatePreview {
  close(restoreFocus?: boolean): void;
  relabel(): void;
}
let activePreview: CertificatePreview | null = null;

export interface ArchivalCertificateView {
  root: HTMLElement;
  relabel(): void;
  dispose(): void;
}

/** Reused by Stamp and Verify; encoding is never submitted to a remote service. */
export function archivalCertificateControls(readReceipt: () => Promise<Uint8Array>): ArchivalCertificateView {
  let preference: QrPreference = 'auto';
  let paper: QrPaper = 'a4';
  let operation = 0;
  let busy = false;
  let disposed = false;
  let ownPreview: CertificatePreview | null = null;
  let statusKey: Parameters<typeof t>[0] | null = null;
  const status = el('p', { role: 'status' });
  const root = el('div', { class: 'archival-controls' });
  const summary = el('summary', {}, t('archive.options'));
  const advanced = el('details', {}, summary);
  const correctionLegend = el('legend', {}, t('archive.correction'));
  const paperLegend = el('legend', {}, t('archive.paper'));
  const ecc = el('fieldset', {}, correctionLegend);
  const paperChoices = el('fieldset', {}, paperLegend);
  const automatic = el('span', {}, t('archive.auto'));
  const maximum = el('span', {}, t('archive.maximum'));
  const help = el('p', { class: 'muted' }, t('archive.correctionHelp'));
  const show = (key: Parameters<typeof t>[0]): void => { statusKey = key; status.textContent = t(key); };
  // Per-panel radio names cannot interfere with another receipt's settings.
  const panelId = nextPanelId++;
  for (const level of ['auto', 'L', 'M', 'Q', 'H'] as const) {
    ecc.appendChild(el('label', { class: 'check' }, el('input', { type: 'radio', name: `archive-ecc-${panelId}`,
      value: level, checked: level === 'auto', onchange: () => { preference = level; } }),
      level === 'auto' ? automatic : level === 'H' ? maximum : level));
  }
  for (const size of ['a4', 'letter'] as const) {
    paperChoices.appendChild(el('label', { class: 'check' }, el('input', { type: 'radio', name: `archive-paper-${panelId}`,
      value: size, checked: size === 'a4', onchange: () => { paper = size; } }), size === 'a4' ? 'A4' : 'US Letter'));
  }
  advanced.appendChild(ecc); advanced.appendChild(paperChoices);
  advanced.appendChild(help);
  const button = el('button', { type: 'button', class: 'button small', title: t('archive.previewHelp'), onclick: () => { void preview(); } }, t('archive.preview'));
  async function preview(): Promise<void> {
    if (busy || disposed) return;
    const generation = ++operation;
    const selected = { preference, paper };
    busy = true; button.disabled = true; show('archive.preparing');
    try {
      const bytes = (await readReceipt()).slice();
      if (bytes.length > LIMITS.maxInputBytes) throw new Error('Receipt too large');
      const proof = parseProof(bytes);
      // Yield before CPU-bound matrix generation so status and cancellation/navigation can paint.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (generation !== operation || !root.isConnected) return;
      const { symbols, plan } = await encodeArchivalQr(bytes, selected);
      const sha = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      if (generation !== operation || !root.isConnected) return;
      const sheet = createArchivalPrintSheet(symbols, sha, bytes.length, plan.paper, toHex(proof.digest));
      activePreview?.close(false);
      const heading = el('h2', { tabindex: -1 }, t('archive.previewTitle'));
      const previewRoot = el('section', { class: 'archival-preview', 'aria-label': t('archive.previewTitle') });
      const toolbar = el('div', { class: 'archival-toolbar' });
      const close = (restoreFocus = true): void => {
        revokeOwner(previewRoot);
        previewRoot.remove();
        if (activePreview === presentation) activePreview = null;
        if (ownPreview === presentation) ownPreview = null;
        if (restoreFocus && button.isConnected) button.focus();
      };
      const printButton = el('button', { type: 'button', class: 'button', onclick: () => window.print() }, t('archive.print'));
      const closeButton = el('button', { type: 'button', class: 'button', onclick: () => close() }, t('archive.close'));
      const digitalReceipt = downloadLink(t('archive.saveDigital'), 'unaltered-receipt.ots', bytes,
        'application/octet-stream', undefined, { owner: previewRoot, key: 'original-receipt' });
      const digitalAdvice = el('strong', {}, t('archive.digitalFirst'));
      const digitalExplanation = el('span', {}, ' ' + t('archive.digitalHelp'));
      const digitalGuidance = el('p', { class: 'archival-digital-guidance' }, digitalAdvice, digitalExplanation);
      const pngButtons: { button: HTMLButtonElement; index: number }[] = [];
      const description = el('p', {}, t('archive.summary', { symbols: symbols.length, pages: plan.pages, level: plan.level }));
      toolbar.appendChild(digitalReceipt);
      toolbar.appendChild(printButton);
      toolbar.appendChild(closeButton);
      for (const canvas of Array.from(sheet.querySelectorAll<HTMLCanvasElement>('canvas[data-archival-frame]'))) {
        const index = Number(canvas.dataset.archivalFrame);
        const pngButton = el('button', { type: 'button', class: 'button small', onclick: () => {
          canvas.toBlob(blob => {
            if (!blob || !previewRoot.isConnected) return;
            const url = URL.createObjectURL(blob);
            const link = el('a', { href: url, download: `unaltered-qr-${String(index + 1).padStart(4, '0')}-of-${String(symbols.length).padStart(4, '0')}.png` });
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }, 'image/png');
        } }, t('archive.png', { index: index + 1, total: symbols.length }));
        pngButtons.push({ button: pngButton, index });
        toolbar.appendChild(pngButton);
      }
      const presentation: CertificatePreview = {
        close,
        relabel() {
          heading.textContent = t('archive.previewTitle');
          previewRoot.setAttribute('aria-label', t('archive.previewTitle'));
          printButton.textContent = t('archive.print');
          closeButton.textContent = t('archive.close');
          digitalReceipt.textContent = t('archive.saveDigital');
          digitalAdvice.textContent = t('archive.digitalFirst');
          digitalExplanation.textContent = ' ' + t('archive.digitalHelp');
          description.textContent = t('archive.summary', { symbols: symbols.length, pages: plan.pages, level: plan.level });
          for (const { button, index } of pngButtons) button.textContent = t('archive.png', { index: index + 1, total: symbols.length });
        },
      };
      previewRoot.appendChild(heading);
      previewRoot.appendChild(digitalGuidance);
      previewRoot.appendChild(description);
      previewRoot.appendChild(toolbar); previewRoot.appendChild(sheet);
      document.body.appendChild(previewRoot); activePreview = ownPreview = presentation;
      heading.focus(); heading.scrollIntoView({ block: 'start' }); show('archive.ready');
    } catch {
      if (generation === operation && root.isConnected) show('archive.failed');
    } finally {
      if (generation === operation) { busy = false; button.disabled = false; }
    }
  }
  root.appendChild(advanced); root.appendChild(button); root.appendChild(status);
  return {
    root,
    relabel() {
      summary.textContent = t('archive.options');
      correctionLegend.textContent = t('archive.correction');
      paperLegend.textContent = t('archive.paper');
      automatic.textContent = t('archive.auto');
      maximum.textContent = t('archive.maximum');
      help.textContent = t('archive.correctionHelp');
      button.textContent = t('archive.preview');
      button.title = t('archive.previewHelp');
      if (statusKey) status.textContent = t(statusKey);
      ownPreview?.relabel();
    },
    dispose() {
      disposed = true; operation++;
      ownPreview?.close(false);
      root.remove();
    },
  };
}
let nextPanelId = 1;

export function archivalCertificateImport(): ArchivalCertificateView {
  const input = el('input', { type: 'file', accept: '.ots', 'aria-label': t('archive.receiptInput') });
  const heading = el('h3', {}, t('archive.title'));
  const intro = el('p', { class: 'muted' }, t('archive.intro'));
  const root = el('section', { class: 'archival-import' }, heading, intro, input);
  let controls: ArchivalCertificateView | null = null;
  input.addEventListener('change', () => {
    const selected = input.files?.[0] ?? null;
    input.value = '';
    controls?.dispose(); controls = null;
    if (!selected) return;
    controls = archivalCertificateControls(async () => {
      if (selected.size > LIMITS.maxInputBytes) throw new Error('Receipt too large');
      return new Uint8Array(await selected.arrayBuffer());
    });
    root.appendChild(controls.root);
  });
  return {
    root,
    relabel() {
      heading.textContent = t('archive.title');
      intro.textContent = t('archive.intro');
      input.setAttribute('aria-label', t('archive.receiptInput'));
      controls?.relabel();
    },
    dispose() { controls?.dispose(); controls = null; root.remove(); },
  };
}

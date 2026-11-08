import { encodeArchivalQr } from '../core/archive/qr-encode';
import { createArchivalPrintSheet } from '../core/archive/qr-print';
import type { QrPaper, QrPreference } from '../core/archive/qr-plan';
import { parseProof } from '../core/ots/codec';
import { toHex } from '../core/bytes';
import { LIMITS } from '../core/ots/types';
import { el } from './dom';
import { archiveText as t } from './archive-strings';

let activePreview: HTMLElement | null = null;

/** Reused by Stamp and Verify; encoding is never submitted to a remote service. */
export function archivalCertificateControls(readReceipt: () => Promise<Uint8Array>): HTMLElement {
  let preference: QrPreference = 'auto';
  let paper: QrPaper = 'a4';
  let operation = 0;
  let busy = false;
  const status = el('p', { role: 'status' });
  const root = el('div', { class: 'archival-controls' });
  const advanced = el('details', {}, el('summary', {}, t('archive.options')));
  const ecc = el('fieldset', {}, el('legend', {}, t('archive.correction')));
  const paperChoices = el('fieldset', {}, el('legend', {}, t('archive.paper')));
  // Per-panel radio names cannot interfere with another receipt's settings.
  const panelId = nextPanelId++;
  for (const level of ['auto', 'L', 'M', 'Q', 'H'] as const) {
    ecc.appendChild(el('label', { class: 'check' }, el('input', { type: 'radio', name: `archive-ecc-${panelId}`,
      value: level, checked: level === 'auto', onchange: () => { preference = level; } }),
      level === 'auto' ? t('archive.auto') : level === 'H' ? t('archive.maximum') : level));
  }
  for (const size of ['a4', 'letter'] as const) {
    paperChoices.appendChild(el('label', { class: 'check' }, el('input', { type: 'radio', name: `archive-paper-${panelId}`,
      value: size, checked: size === 'a4', onchange: () => { paper = size; } }), size === 'a4' ? 'A4' : 'US Letter'));
  }
  advanced.appendChild(ecc); advanced.appendChild(paperChoices);
  advanced.appendChild(el('p', { class: 'muted' }, t('archive.correctionHelp')));
  const button = el('button', { type: 'button', class: 'button small', title: t('archive.previewHelp'), onclick: () => { void preview(); } }, t('archive.preview'));
  async function preview(): Promise<void> {
    if (busy) return;
    const generation = ++operation;
    const selected = { preference, paper };
    busy = true; button.disabled = true; status.textContent = t('archive.preparing');
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
      activePreview?.remove();
      const heading = el('h2', { tabindex: -1 }, t('archive.previewTitle'));
      const previewRoot = el('section', { class: 'archival-preview', 'aria-label': t('archive.previewTitle') });
      const toolbar = el('div', { class: 'archival-toolbar' });
      const close = (): void => {
        previewRoot.remove();
        if (activePreview === previewRoot) activePreview = null;
        if (button.isConnected) button.focus();
      };
      toolbar.appendChild(el('button', { type: 'button', class: 'button', onclick: () => window.print() }, t('archive.print')));
      toolbar.appendChild(el('button', { type: 'button', class: 'button', onclick: close }, t('archive.close')));
      for (const canvas of Array.from(sheet.querySelectorAll<HTMLCanvasElement>('canvas[data-archival-frame]'))) {
        const index = Number(canvas.dataset.archivalFrame);
        toolbar.appendChild(el('button', { type: 'button', class: 'button small', onclick: () => {
          canvas.toBlob(blob => {
            if (!blob || !previewRoot.isConnected) return;
            const url = URL.createObjectURL(blob);
            const link = el('a', { href: url, download: `unaltered-qr-${String(index + 1).padStart(4, '0')}-of-${String(symbols.length).padStart(4, '0')}.png` });
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }, 'image/png');
        } }, t('archive.png', { index: index + 1, total: symbols.length })));
      }
      previewRoot.appendChild(heading);
      previewRoot.appendChild(el('p', {}, t('archive.summary', { symbols: symbols.length, pages: plan.pages, level: plan.level })));
      previewRoot.appendChild(toolbar); previewRoot.appendChild(sheet);
      document.body.appendChild(previewRoot); activePreview = previewRoot;
      heading.focus(); heading.scrollIntoView({ block: 'start' }); status.textContent = t('archive.ready');
    } catch {
      if (generation === operation && root.isConnected) status.textContent = t('archive.failed');
    } finally {
      if (generation === operation) { busy = false; button.disabled = false; }
    }
  }
  root.appendChild(advanced); root.appendChild(button); root.appendChild(status);
  return root;
}
let nextPanelId = 1;

export function archivalCertificateImport(): HTMLElement {
  let receipt: File | null = null;
  const input = el('input', { type: 'file', accept: '.ots', 'aria-label': t('archive.receiptInput') });
  const root = el('section', { class: 'archival-import' }, el('h3', {}, t('archive.title')),
    el('p', { class: 'muted' }, t('archive.intro')), input);
  let controls: HTMLElement | null = null;
  input.addEventListener('change', () => {
    receipt = input.files?.[0] ?? null;
    input.value = '';
    controls?.remove(); controls = null;
    const selected = receipt;
    if (!selected) return;
    controls = archivalCertificateControls(async () => {
      if (selected.size > LIMITS.maxInputBytes) throw new Error('Receipt too large');
      return new Uint8Array(await selected.arrayBuffer());
    });
    root.appendChild(controls);
  });
  return root;
}

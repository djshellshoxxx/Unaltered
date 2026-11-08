import { recoverReceiptFrames } from '../core/archive/frames';
import { el } from './dom';

/**
 * Offline recovery of raw binary QR payloads. A QR image scanner will be
 * added separately; browsers' BarcodeDetector.rawValue is text and cannot
 * safely recover arbitrary binary .ots payloads.
 */
export function archivalRecoveryPanel(): HTMLElement {
  const section = el('section', { class: 'archival-recovery' });
  const heading = el('h3', {}, 'Recover archival QR receipt');
  const help = el('p', {}, 'Experimental: import raw binary payload files extracted from UNALTERED-OTS-QR/1 QR symbols. QR photographs are not supported yet. Files never leave this browser.');
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.bin,application/octet-stream';
  input.setAttribute('aria-label', 'Decoded QR binary payload files');
  const status = el('p', { role: 'status' }, 'Select one or more binary QR frame files.');
  const button = el('button', { type: 'button', class: 'button small' }, 'Recover .ots receipt') as HTMLButtonElement;
  const download = el('div', {});
  let activeUrl: string | null = null;
  let generation = 0;
  const clearDownload = (): void => {
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = null;
    download.replaceChildren();
  };
  button.disabled = true;
  input.addEventListener('change', () => {
    generation++;
    button.disabled = !input.files?.length;
    status.textContent = input.files?.length ? `${input.files.length} QR payload files selected.` : 'Select QR payload files.';
    clearDownload();
  });
  button.addEventListener('click', () => {
    void (async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length || files.length > 4096) { status.textContent = 'Invalid frame count.'; return; }
      button.disabled = true;
      const currentGeneration = ++generation;
      clearDownload();
      status.textContent = 'Checking frames and reconstructing receipt…';
      try {
        const frames: Uint8Array[] = [];
        for (const file of files) {
          if (file.size < 81 || file.size > 2953) throw new Error('Frame file size is invalid');
          frames.push(new Uint8Array(await file.arrayBuffer()));
        }
        const receipt = await recoverReceiptFrames(frames);
        if (generation !== currentGeneration) return;
        const blob = new Blob([Uint8Array.from(receipt)], { type:'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        activeUrl = url;
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'recovered.ots';
        anchor.textContent = 'Download reconstructed .ots receipt';
        anchor.addEventListener('click', () => { setTimeout(() => { if (activeUrl === url) clearDownload(); }, 60000); }, { once:true });
        download.appendChild(anchor);
        status.textContent = `Recovered ${receipt.length} bytes. SHA-256 and frame identifiers match. This does not verify the Bitcoin timestamp.`;
      } catch (error) {
        if (generation !== currentGeneration) return;
        status.textContent = 'Recovery failed: ' + (error instanceof Error ? error.message : 'Invalid input');
      } finally {
        if (generation === currentGeneration) button.disabled = !input.files?.length;
      }
    })();
  });
  section.appendChild(heading);
  section.appendChild(help);
  section.appendChild(input);
  section.appendChild(button);
  section.appendChild(status);
  section.appendChild(download);
  return section;
}

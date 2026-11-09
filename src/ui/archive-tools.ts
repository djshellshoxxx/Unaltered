import { archivalCertificateImport } from './archival-certificate';
import { archivalRecoveryPanel } from './archival-recovery';
import { el } from './dom';

let disposeActive: (() => void) | null = null;

/** Mounted after Verify renders; a re-mount (language switch) disposes the previous recovery panel first. */
export function mountArchiveTools(root: HTMLElement): void {
  disposeActive?.();
  const recovery = archivalRecoveryPanel();
  disposeActive = recovery.dispose;
  root.appendChild(el('hr'));
  root.appendChild(archivalCertificateImport());
  root.appendChild(el('hr'));
  root.appendChild(recovery.root);
}

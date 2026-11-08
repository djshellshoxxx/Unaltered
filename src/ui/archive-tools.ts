import { archivalCertificateImport } from './archival-certificate';
import { archivalRecoveryPanel } from './archival-recovery';
import { el } from './dom';

export function mountArchiveTools(root: HTMLElement): void {
  root.appendChild(el('hr'));
  root.appendChild(archivalCertificateImport());
  root.appendChild(el('hr'));
  root.appendChild(archivalRecoveryPanel());
}

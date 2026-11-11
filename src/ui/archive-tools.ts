import { archivalCertificateImport } from './archival-certificate';
import { archivalRecoveryPanel } from './archival-recovery';
import { el } from './dom';

export interface ArchiveToolsView {
  relabel(): void;
  dispose(): void;
}

/** Keep user work in the same panels when Verify rebuilds its presentation. */
export function mountArchiveTools(root: HTMLElement): ArchiveToolsView {
  const certificate = archivalCertificateImport();
  const recovery = archivalRecoveryPanel();
  const beforeCertificate = el('hr');
  const beforeRecovery = el('hr');
  const attach = (): void => { root.append(beforeCertificate, certificate.root, beforeRecovery, recovery.root); };
  attach();
  return {
    relabel() {
      certificate.relabel();
      recovery.relabel();
      attach();
    },
    dispose() {
      certificate.dispose();
      recovery.dispose();
      beforeCertificate.remove();
      beforeRecovery.remove();
    },
  };
}

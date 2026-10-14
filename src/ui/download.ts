// Downloads happen only on explicit user action (FR-5). Object URLs are tracked and revoked.
import { el } from './dom';

const urls = new Set<string>();

export function revokeAll(): void {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
}

/** Replace characters that are not safe in a download file name. */
export function safeFileName(name: string): string {
  const noControl = Array.from(name, (ch) => (ch.charCodeAt(0) < 32 ? '_' : ch)).join('');
  const cleaned = noControl.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'file';
}

export function downloadLink(label: string, fileName: string, data: Blob | Uint8Array, mime: string, onClick?: () => void): HTMLAnchorElement {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return el('a', { class: 'button primary', href: url, download: safeFileName(fileName), onclick: () => onClick?.() }, label);
}

export function receiptName(fileName: string): string {
  return `${safeFileName(fileName)}.ots`;
}

export function cleanedName(fileName: string, format: 'jpeg' | 'png'): string {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const stem = safeFileName(fileName).replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return `${stem}-cleaned.${ext}`;
}

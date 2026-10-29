// Downloads happen only on explicit user action (FR-5). Object URLs are tracked and revoked.
import { el } from './dom';

const scopes = new Map<object, Map<string, { data: Blob | Uint8Array; url: string }>>();

export function revokeOwner(owner: object): void {
  for (const entry of scopes.get(owner)?.values() ?? []) URL.revokeObjectURL(entry.url);
  scopes.delete(owner);
}

export function revokeAll(): void {
  for (const owner of scopes.keys()) revokeOwner(owner);
}

// C0/C1 controls, and bidirectional controls that can make a name display with its characters reordered
// (for example a fake extension), are never kept.
const isUnsafeCodePoint = (cp: number): boolean =>
  cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0x061c || cp === 0x200e || cp === 0x200f || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);

/** Replace characters that are not safe in a download file name. */
export function safeFileName(name: string): string {
  const noControl = Array.from(name, (ch) => (isUnsafeCodePoint(ch.codePointAt(0)!) ? '_' : ch)).join('');
  const cleaned = noControl.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '_');
  // Cut by code point so a surrogate pair is never split.
  return cleaned.length > 0 ? Array.from(cleaned).slice(0, 200).join('') : 'file';
}

export function downloadLink(label: string, fileName: string, data: Blob | Uint8Array, mime: string, onClick?: () => void, scope?: { owner: object; key: string }): HTMLAnchorElement {
  const owner = scope?.owner ?? {};
  const key = scope?.key ?? 'download';
  const entries = scopes.get(owner) ?? new Map();
  let entry = entries.get(key);
  // Callers retain immutable data identities; presentation-only renders reuse the active handle.
  if (!entry || entry.data !== data) {
    if (entry) URL.revokeObjectURL(entry.url);
    const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
    entry = { data, url: URL.createObjectURL(blob) };
    entries.set(key, entry);
    scopes.set(owner, entries);
  }
  return el('a', { class: 'button primary', href: entry.url, download: safeFileName(fileName), onclick: () => onClick?.() }, label);
}

export function receiptName(fileName: string): string {
  return `${safeFileName(fileName)}.ots`;
}

export function cleanedName(fileName: string, format: 'jpeg' | 'png' | 'wav' | 'mp3'): string {
  const ext = format === 'jpeg' ? 'jpg' : format;
  const stem = safeFileName(fileName).replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return `${stem}-cleaned.${ext}`;
}

/** The hosted build uses a builder-owned local PNG link. The offline page needs no neighbouring files. */
declare const __FAVICON_BASE64__: string;
export function installOfflineFavicon(): void {
  if (typeof __FAVICON_BASE64__ !== 'string' || !document.head) return;
  if (document.head.querySelector('link[rel~="icon"]')) return;
  const bytes = Uint8Array.from(atob(__FAVICON_BASE64__), char => char.charCodeAt(0));
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/png';
  icon.setAttribute('sizes', '64x64');
  icon.href = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  // One URL per document; it remains valid across bfcache restores and is released with the document.
  document.head.appendChild(icon);
}

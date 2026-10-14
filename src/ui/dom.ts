// Tiny DOM helpers. All dynamic text goes through textContent / text nodes (SR-4): no innerHTML anywhere.
export type Child = Node | string | null | undefined | false;
export type AttrValue = string | number | boolean | undefined | null | ((ev: Event) => void);

const PROPS = new Set(['checked', 'disabled', 'hidden', 'value', 'indeterminate']);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, AttrValue> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'style') continue; // inline styles are blocked by CSP; use classes
    if (k === 'class') node.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v as EventListener);
    else if (PROPS.has(k)) (node as unknown as Record<string, unknown>)[k] = v === true ? true : v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  append(node, kids);
  return node;
}

export function append(parent: Node, kids: Child[]): void {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    parent.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setChildren(node: Node, ...kids: Child[]): void {
  clear(node);
  append(node, kids);
}

let liveRegion: HTMLElement | null = null;
export function setLiveRegion(node: HTMLElement): void {
  liveRegion = node;
}
/** Polite screen-reader announcement. */
export function announce(message: string): void {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  setTimeout(() => {
    if (liveRegion) liveRegion.textContent = message;
  }, 30);
}

export interface DropZoneOptions {
  id: string;
  label: string;
  hint: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}

/** Keyboard-accessible file picker with drag and drop. The native input stays focusable and labelled. */
export function dropZone(o: DropZoneOptions): HTMLElement {
  const input = el('input', { type: 'file', id: o.id, class: 'file-input', multiple: o.multiple === true, accept: o.accept });
  const zone = el('label', { class: 'drop', for: o.id }, el('span', { class: 'drop-title' }, o.label), el('span', { class: 'drop-hint' }, o.hint));
  const wrap = el('div', { class: 'drop-wrap' }, input, zone);
  input.addEventListener('change', () => {
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) o.onFiles(files);
    input.value = '';
  });
  wrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    wrap.classList.add('over');
  });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('over'));
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    wrap.classList.remove('over');
    const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) o.onFiles(o.multiple ? files : files.slice(0, 1));
  });
  return wrap;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KiB', 'MiB', 'GiB', 'TiB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${u[i]}`;
}

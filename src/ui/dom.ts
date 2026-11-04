// Tiny DOM helpers. All dynamic text goes through textContent / text nodes (SR-4): no innerHTML anywhere.
export type Child = Node | string | null | undefined | false;
export type AttrValue = string | number | boolean | undefined | null | ((ev: Event) => void);

const PROPS = new Set(['checked', 'disabled', 'hidden', 'value', 'indeterminate']);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, AttrValue> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'style') continue; // inline styles are blocked by CSP; use classes
    // Never create inline handlers, srcdoc or script URLs from strings (SR-4); only function listeners are wired.
    if (/^on/i.test(k) || k.toLowerCase() === 'srcdoc') {
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v as EventListener);
      continue;
    }
    if (typeof v === 'string' && /^\s*(javascript|data|vbscript):/i.test(v) && (k === 'href' || k === 'src' || k === 'action' || k === 'formaction')) continue;
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
  const path = focusPath(node);
  clear(node);
  append(node, kids);
  if (path) restoreFocus(node, path);
}

// Re-rendering rebuilds controls; without this a keyboard user's focus falls back to the page (WCAG 2.4.3).
function focusPath(root: Node): { tag: string; id: string | null; at: number[] }[] | null {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (!active || active === root || !root.contains(active)) return null;
  const steps: { tag: string; id: string | null; at: number[] }[] = [];
  const at: number[] = [];
  for (let n: Node | null = active; n && n !== root; n = n.parentNode) {
    const parent: Node | null = n.parentNode;
    if (!parent) return null;
    at.unshift(Array.prototype.indexOf.call(parent.childNodes, n));
    const e = n as Element;
    steps.unshift({ tag: e.tagName, id: e.getAttribute ? e.getAttribute('id') : null, at: [...at] });
  }
  return steps.length > 0 ? steps : null;
}

function restoreFocus(root: Node, steps: { tag: string; id: string | null; at: number[] }[]): void {
  let cur: Node = root;
  for (const step of steps) {
    const idx = step.at[step.at.length - 1]!;
    const next: Node | undefined = cur.childNodes[idx];
    const e = next as Element | undefined;
    if (!e || e.tagName !== step.tag || (e.getAttribute ? e.getAttribute('id') : null) !== step.id) return;
    cur = e;
  }
  const target = cur as HTMLElement;
  if (typeof target.focus === 'function' && !(target as { disabled?: boolean }).disabled) target.focus();
}

let liveRegion: HTMLElement | null = null;
let announcementGeneration = 0;
export function setLiveRegion(node: HTMLElement): void {
  liveRegion = node;
  announcementGeneration++;
}
/** Polite screen-reader announcement. Only the newest queued status may be spoken. */
export function announce(message: string): void {
  if (!liveRegion) return;
  const target = liveRegion;
  const generation = ++announcementGeneration;
  target.textContent = '';
  setTimeout(() => {
    if (generation === announcementGeneration && liveRegion === target) target.textContent = message;
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

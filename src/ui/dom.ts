// Tiny DOM helpers. All dynamic text goes through textContent / text nodes (SR-4): no innerHTML anywhere.
export type Child = Node | string | null | undefined | false;
export type AttrValue = string | number | boolean | undefined | null | ((ev: Event) => void);

const PROPS = new Set(['checked', 'disabled', 'hidden', 'value', 'indeterminate']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction']);

function isScriptUrl(value: string): boolean {
  // Match browser URL preprocessing: remove TAB/LF/CR anywhere, then trim leading C0 controls and spaces.
  // Other embedded controls are not removed by the URL parser and must not be treated as scheme characters.
  const normalized = value.replace(/[\t\n\r]/g, '');
  let start = 0;
  while (start < normalized.length && normalized.charCodeAt(start) <= 0x20) start++;
  return /^(javascript|data|vbscript):/i.test(normalized.slice(start));
}

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
    if (typeof v === 'string' && URL_ATTRS.has(k.toLowerCase()) && isScriptUrl(v)) continue;
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
// Each step is one ancestor at its own position. A row that can be removed or reordered carries `data-key`, so focus
// never lands on a different row's control that happens to sit at the same position (Enter would then act on it).
interface FocusStep { tag: string; id: string | null; key: string | null; at: number }

function attr(n: Node | undefined, name: string): string | null {
  const e = n as Element | undefined;
  return e && typeof e.getAttribute === 'function' ? e.getAttribute(name) : null;
}

function focusPath(root: Node): FocusStep[] | null {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (!active || active === root || !root.contains(active)) return null;
  const steps: FocusStep[] = [];
  for (let n: Node | null = active; n && n !== root; n = n.parentNode) {
    const parent: Node | null = n.parentNode;
    if (!parent) return null;
    steps.unshift({ tag: (n as Element).tagName, id: attr(n, 'id'), key: attr(n, 'data-key'), at: Array.prototype.indexOf.call(parent.childNodes, n) });
  }
  return steps.length > 0 ? steps : null;
}

function restoreFocus(root: Node, steps: FocusStep[]): void {
  const own = steps[steps.length - 1]!;
  let target: Node | null = null;
  if (own.id) {
    // An id names one control; find it even if siblings before it were added or removed.
    const byId = document.getElementById(own.id);
    if (byId && byId !== root && root.contains(byId) && byId.tagName === own.tag) target = byId;
  } else {
    let cur: Node = root;
    for (const step of steps) {
      const next: Node | undefined = cur.childNodes[step.at];
      if (!next || (next as Element).tagName !== step.tag || attr(next, 'id') !== step.id || attr(next, 'data-key') !== step.key) return;
      cur = next;
    }
    target = cur;
  }
  const control = target as HTMLElement | null;
  if (control && typeof control.focus === 'function' && !(control as { disabled?: boolean }).disabled) control.focus();
}

let liveRegion: HTMLElement | null = null;
let announcementGeneration = 0;
export function setLiveRegion(node: HTMLElement): void {
  liveRegion = node;
  announcementGeneration++;
}
/** Polite status: only the newest message from a still-visible owning view may be spoken. */
export function announce(message: string, owner?: HTMLElement): void {
  const active = (): boolean => !owner || (owner.isConnected && !owner.hidden);
  if (!liveRegion || !active()) return;
  const target = liveRegion;
  const generation = ++announcementGeneration;
  target.textContent = '';
  setTimeout(() => {
    if (generation === announcementGeneration && liveRegion === target && active()) target.textContent = message;
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
    // Clear before invoking consumers: they may re-render/detach the input.
    // This also ensures choosing the exact same file fires change next time.
    input.value = '';
    if (files.length > 0) o.onFiles(o.multiple ? files : files.slice(0, 1));
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

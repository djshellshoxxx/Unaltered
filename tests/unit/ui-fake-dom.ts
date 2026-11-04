// Minimal DOM stand-in for node-environment unit tests (no DOM library is a dependency). Supports only what src/ui uses.
type Listener = (ev: unknown) => void;

export class FNode {
  parentNode: FElement | null = null;
  get isConnected(): boolean {
    let n: FNode | null = this;
    while (n.parentNode) n = n.parentNode;
    return n === doc.body;
  }
}
export class FText extends FNode {
  constructor(public data: string) { super(); }
  get textContent(): string { return this.data; }
}
export class FElement extends FNode {
  childNodes: FNode[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Listener[]>();
  className = '';
  disabled = false;
  checked = false;
  value = '';
  files: unknown[] | null = null;
  constructor(public tagName: string) { super(); }
  get firstChild(): FNode | null { return this.childNodes[0] ?? null; }
  appendChild<T extends FNode>(c: T): T {
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.childNodes.push(c);
    return c;
  }
  removeChild<T extends FNode>(c: T): T {
    this.childNodes = this.childNodes.filter((x) => x !== c);
    c.parentNode = null;
    return c;
  }
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null; }
  removeAttribute(k: string): void { this.attrs.delete(k); }
  addEventListener(t: string, l: Listener): void { this.listeners.set(t, [...(this.listeners.get(t) ?? []), l]); }
  dispatch(t: string): void { for (const l of this.listeners.get(t) ?? []) l({ target: this, preventDefault() {} }); }
  contains(n: FNode | null): boolean { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  focus(): void { if (!this.disabled && this.isConnected) doc.activeElement = this; }
  get classList(): { contains(c: string): boolean; add(c: string): void; remove(c: string): void } {
    return {
      contains: (c) => this.className.split(/\s+/).includes(c),
      add: (c) => { this.className = `${this.className} ${c}`.trim(); },
      remove: (c) => { this.className = this.className.split(/\s+/).filter((x) => x !== c).join(' '); },
    };
  }
  get textContent(): string { return this.childNodes.map((c) => (c as FText).textContent).join(''); }
  set textContent(v: string) { this.childNodes = []; if (v) this.appendChild(new FText(v)); }
  querySelector(sel: string): FElement | null { return this.all().find((e) => matches(e, sel)) ?? null; }
  all(): FElement[] {
    const out: FElement[] = [];
    for (const c of this.childNodes) if (c instanceof FElement) out.push(c, ...c.all());
    return out;
  }
}

function matches(e: FElement, sel: string): boolean {
  if (sel.startsWith('.')) return e.classList.contains(sel.slice(1));
  if (sel.startsWith('#')) return e.getAttribute('id') === sel.slice(1);
  return e.tagName === sel.toUpperCase();
}

export const doc = {
  body: new FElement('BODY'),
  activeElement: null as FElement | null,
  createElement: (t: string): FElement => new FElement(t.toUpperCase()),
  createTextNode: (s: string): FText => new FText(s),
  getElementById: (id: string): FElement | null => doc.body.querySelector(`#${id}`),
};

export function installFakeDom(): () => void {
  const g = globalThis as Record<string, unknown>;
  const prev = { document: g.document, Node: g.Node, location: g.location };
  doc.body = new FElement('BODY');
  doc.activeElement = null;
  g.document = doc;
  g.Node = FNode;
  g.location = { protocol: 'https:', origin: 'https://x.test', pathname: '/', hash: '' };
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Reflect.deleteProperty(g, k);
      else g[k] = v;
    }
  };
}

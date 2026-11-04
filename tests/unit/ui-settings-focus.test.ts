import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addReceipt, loadReceipts, setEnabled } from '../../src/ui/store';
import { mountSettings } from '../../src/ui/views/settings';
import { doc, FElement, installFakeDom } from './ui-fake-dom';

class Mem {
  data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
}

const hex = (n: number): string => n.toString(16).padStart(64, '0');

let restore: () => void;
beforeEach(() => {
  restore = installFakeDom();
  Object.defineProperty(globalThis, 'localStorage', { value: new Mem(), configurable: true });
});
afterEach(() => {
  restore();
  Reflect.deleteProperty(globalThis, 'localStorage');
});

function mount(): FElement {
  const root = doc.createElement('section');
  doc.body.appendChild(root);
  mountSettings(root as never, () => {});
  return root;
}

const toggleOf = (root: FElement): FElement => root.querySelector('.receipts')!.querySelector('input')!;

describe('settings keeps keyboard focus across its own re-renders (WCAG 2.4.3)', () => {
  it('Space on "Remember my receipts" leaves focus on the new checkbox', () => {
    const root = mount();
    const box = toggleOf(root);
    box.focus();
    box.checked = true;
    box.dispatch('change');
    const fresh = toggleOf(root);
    expect(fresh).not.toBe(box);
    expect(fresh.checked).toBe(true);
    expect(doc.activeElement).toBe(fresh);
  });

  it('removing a stored receipt never moves focus to another receipt\'s Remove button', () => {
    setEnabled(true);
    for (const n of [1, 2, 3]) addReceipt({ digestHex: hex(n), createdAtUtc: `2026-01-0${n}T00:00:00Z`, label: '' });
    const root = mount();
    const list = (): FElement[] => root.querySelector('.receipt-list')!.all().filter((e) => e.tagName === 'BUTTON');
    const first = list()[0]!;
    first.focus();
    first.dispatch('click');
    expect(loadReceipts()).toHaveLength(2);
    for (const b of list()) expect(doc.activeElement).not.toBe(b);
    // Focus moves to a stable place in the same section instead of being dropped.
    expect(doc.activeElement).toBe(root.querySelector('.receipts')!.querySelector('h3'));
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isEnabled, loadReceipts, setEnabled } from '../../src/ui/store';

const KEY = 'unaltered.receipts.v1';
const hex = (n: number): string => n.toString(16).padStart(64, '0');

class Mem {
  data = new Map<string, string>();
  failRemove = new Set<string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void {
    if (this.failRemove.has(k)) throw new Error('blocked');
    this.data.delete(k);
  }
}

describe('local receipt list robustness (FR-12, NFR-6)', () => {
  let s: Mem;
  beforeEach(() => {
    s = new Mem();
    Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('turning the list off never leaves the stored list behind while reporting it off', () => {
    setEnabled(true);
    s.setItem(KEY, JSON.stringify([{ digestHex: hex(1), createdAtUtc: 'A', label: '' }]));
    s.failRemove.add(KEY);
    const ok = setEnabled(false);
    // Either the switch-off failed (and stays on, so the user sees the list is still stored) or the data is gone.
    expect(ok || isEnabled()).toBe(true);
    expect(!ok || !s.data.has(KEY)).toBe(true);
  });

  it('treats corrupted JSON, wrong shapes and non-string entries as an empty list', () => {
    setEnabled(true);
    for (const raw of ['{', 'null', '"x"', '{"a":1}', '[1,null,"x",{"digestHex":5}]', '[[]]']) {
      s.setItem(KEY, raw);
      expect(loadReceipts(), raw).toEqual([]);
    }
  });

  it('survives a storage whose getItem throws (private mode)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } },
      configurable: true,
    });
    expect(isEnabled()).toBe(false);
    expect(loadReceipts()).toEqual([]);
    expect(setEnabled(true)).toBe(false);
  });
});

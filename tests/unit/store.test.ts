import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addReceipt, loadReceipts, removeReceipt, setEnabled } from '../../src/ui/store';

const KEY = 'unaltered.receipts.v1';
const hex = (n: number): string => n.toString(16).padStart(64, '0');

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('local receipt list (FR-12)', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    setEnabled(true);
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('removes the record the user chose even if another tab changed the list since it was rendered', () => {
    addReceipt({ digestHex: hex(1), createdAtUtc: 'A', label: '' });
    const rendered = loadReceipts();
    addReceipt({ digestHex: hex(2), createdAtUtc: 'C', label: '' }); // another tab, inserted at the front
    expect(removeReceipt(rendered[0]!)).toBe(true);
    expect(loadReceipts().map((r) => r.createdAtUtc)).toEqual(['C']);
    expect(removeReceipt(rendered[0]!)).toBe(true); // already gone: nothing else is removed
    expect(loadReceipts().map((r) => r.createdAtUtc)).toEqual(['C']);
  });

  it('bounds a hostile stored list to the same 500 records addReceipt keeps', () => {
    const many = Array.from({ length: 40_001 }, (_, i) => ({ digestHex: hex(i), createdAtUtc: String(i), label: '' }));
    storage.setItem(KEY, JSON.stringify(many));
    const list = loadReceipts();
    expect(list).toHaveLength(500);
    expect(list[0]!.createdAtUtc).toBe('0');
  });
});

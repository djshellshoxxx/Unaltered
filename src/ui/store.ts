// FR-12: opt-in local receipt list. Stores only {digestHex, createdAtUtc, label}; every access is guarded (NFR-6).
export interface ReceiptRec {
  digestHex: string;
  createdAtUtc: string;
  label: string;
}

const KEY = 'unaltered.receipts.v1';
const FLAG = 'unaltered.receipts.enabled';
const HEX64 = /^[0-9a-f]{64}$/;
const MAX_RECEIPTS = 500;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.getItem(FLAG);
    return true;
  } catch {
    return false;
  }
}

export function isEnabled(): boolean {
  try {
    return storage()?.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function setEnabled(on: boolean): boolean {
  const s = storage();
  if (!s) return false;
  try {
    if (on) s.setItem(FLAG, '1');
    else {
      s.removeItem(FLAG);
      s.removeItem(KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function loadReceipts(): ReceiptRec[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Stored data is untrusted (another tab, an older build or a hand edit); keep the same bound addReceipt keeps.
    return parsed
      .slice(0, MAX_RECEIPTS)
      .filter((r): r is ReceiptRec => typeof r === 'object' && r !== null && typeof r.digestHex === 'string' && HEX64.test(r.digestHex) && typeof r.createdAtUtc === 'string' && typeof r.label === 'string')
      .map((r) => ({ digestHex: r.digestHex, createdAtUtc: r.createdAtUtc.slice(0, 40), label: r.label.slice(0, 200) }));
  } catch {
    return [];
  }
}

function save(list: ReceiptRec[]): boolean {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addReceipt(rec: ReceiptRec): boolean {
  if (!isEnabled() || !HEX64.test(rec.digestHex)) return false;
  const list = loadReceipts().filter((r) => !(r.digestHex === rec.digestHex && r.createdAtUtc === rec.createdAtUtc));
  list.unshift({ digestHex: rec.digestHex, createdAtUtc: rec.createdAtUtc, label: rec.label.slice(0, 200) });
  return save(list.slice(0, MAX_RECEIPTS));
}

/** Removes by identity, not position: another tab may have changed the stored list since it was rendered. */
export function removeReceipt(rec: Pick<ReceiptRec, 'digestHex' | 'createdAtUtc'>): boolean {
  const list = loadReceipts();
  const at = list.findIndex((r) => r.digestHex === rec.digestHex && r.createdAtUtc === rec.createdAtUtc);
  if (at === -1) return true;
  list.splice(at, 1);
  return save(list);
}

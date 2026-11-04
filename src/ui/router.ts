// Hash routing. Share links (FR-11) carry only the fingerprint in the fragment, which browsers never send to a server.
export const VIEWS = ['stamp', 'verify', 'about', 'settings'] as const;
export type View = (typeof VIEWS)[number];

const HEX64 = /^[0-9a-f]{64}$/i;

export function parseHash(hash: string): { view: View; h: string | null } {
  const parts = hash.replace(/^#/, '').split(/[&?]/).filter(Boolean);
  let h: string | null = null;
  let conflict = false;
  let view: View | null = null;
  for (const p of parts) {
    if ((VIEWS as readonly string[]).includes(p)) view = p as View;
    else if (p.startsWith('h=') && HEX64.test(p.slice(2))) {
      const next = p.slice(2).toLowerCase();
      // Two different fingerprints in one link is ambiguous: use neither rather than silently picking one.
      if (h !== null && h !== next) conflict = true;
      h = next;
    }
  }
  if (conflict) h = null;
  return { view: view ?? (h ? 'verify' : 'stamp'), h };
}


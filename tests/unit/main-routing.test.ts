import { afterEach, describe, expect, it, vi } from 'vitest';

const views = vi.hoisted(() => ({ setPrefill: vi.fn(), relabel: vi.fn() }));
vi.mock('../../src/ui/archive-tools', () => ({ mountArchiveTools() {} }));
vi.mock('../../src/ui/views/verify', () => ({ mountVerify: () => views }));
vi.mock('../../src/ui/views/stamp', () => ({ mountStamp: () => ({ relabel() {} }) }));
vi.mock('../../src/ui/views/about', () => ({ mountAbout() {} }));
vi.mock('../../src/ui/views/settings', () => ({ mountSettings() {} }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function start(hash: string): Promise<(hash: string) => void> {
  vi.resetModules();
  let onHashChange = (): void => {};
  const node = { hidden: false, textContent: '', addEventListener() {}, toggleAttribute() {}, setAttribute() {}, removeAttribute() {}, remove() {}, querySelector: () => null };
  const document = { readyState: 'complete', documentElement: { lang: '' }, title: '', getElementById: () => node };
  const window = { top: null as unknown, self: null as unknown, addEventListener: (_: string, cb: () => void) => { onHashChange = cb; } };
  window.top = window.self = window;
  const location = { hash };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', { languages: ['en'] });
  vi.stubGlobal('location', location);
  await import('../../src/main');
  return (next) => { location.hash = next; onHashChange(); };
}

describe('share-link navigation', () => {
  const first = 'ab'.repeat(32);
  const other = 'cd'.repeat(32);
  for (const invalid of [`#verify&h=${first}&h=${other}`, '#verify&h=broken']) {
    it(`clears a prior fingerprint when navigating to ${invalid.includes('broken') ? 'an invalid' : 'a conflicting'} link`, async () => {
      const navigate = await start(`#h=${first}`);
      expect(views.setPrefill).toHaveBeenLastCalledWith(first);
      navigate(invalid);
      expect(views.setPrefill).toHaveBeenLastCalledWith(null);
    });
  }
  it('keeps the same share-link state across ordinary navigation and history', async () => {
    const navigate = await start(`#h=${first}`);
    navigate('#about');
    navigate(`#h=${first}`);
    expect(views.setPrefill).toHaveBeenCalledExactlyOnceWith(first);
    navigate(`#h=${other}`);
    expect(views.setPrefill).toHaveBeenLastCalledWith(other);
  });
});

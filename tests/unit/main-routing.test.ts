import { afterEach, describe, expect, it, vi } from 'vitest';

const views = vi.hoisted(() => ({ setPrefill: vi.fn(), relabel: vi.fn() }));
vi.mock('../../src/ui/archive-tools', () => ({ mountArchiveTools() {} }));
vi.mock('../../src/ui/views/verify', () => ({ mountVerify: () => views }));
vi.mock('../../src/ui/views/stamp', () => ({ mountStamp: () => ({ relabel() {} }) }));
vi.mock('../../src/ui/views/about', () => ({ mountAbout() {} }));
vi.mock('../../src/ui/views/settings', () => ({ mountSettings() {} }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function start(hash: string) {
  vi.resetModules();
  let onHashChange = (): void => {};
  const node = { hidden: false, textContent: '', addEventListener() {}, toggleAttribute() {}, setAttribute() {}, removeAttribute() {}, remove() {}, querySelector: () => null };
  const introduction = { hidden: false };
  const brand = { focus: vi.fn() };
  const document = {
    readyState: 'complete', documentElement: { lang: '' }, title: '', getElementById: () => node,
    querySelector: (selector: string) => selector === '.site-intro' ? introduction : selector === 'header .brand' ? brand : null,
  };
  const window = { top: null as unknown, self: null as unknown, addEventListener: (event: string, cb: () => void) => { if (event === 'hashchange') onHashChange = cb; } };
  window.top = window.self = window;
  const location = { hash };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', { languages: ['en'] });
  vi.stubGlobal('location', location);
  await import('../../src/main');
  const navigate = (next: string) => { location.hash = next; onHashChange(); };
  return { navigate, document, introduction, brand };
}

describe('share-link navigation', () => {
  const first = 'ab'.repeat(32);
  const other = 'cd'.repeat(32);
  it('restores the home introduction, title and keyboard focus when returning from a shared receipt', async () => {
    const { navigate, document, introduction, brand } = await start('');
    const homeTitle = 'Free File Timestamp & Bitcoin Proof Verification | Unaltered';
    expect(introduction.hidden).toBe(false);
    expect(document.title).toBe(homeTitle);
    expect(brand.focus).not.toHaveBeenCalled();
    navigate(`#h=${first}`);
    expect(introduction.hidden).toBe(true);
    expect(document.title).toBe('Verify · Unaltered');
    navigate('');
    expect(introduction.hidden).toBe(false);
    expect(document.title).toBe(homeTitle);
    expect(brand.focus).toHaveBeenCalledTimes(1);
  });
  for (const invalid of [`#verify&h=${first}&h=${other}`, '#verify&h=broken']) {
    it(`clears a prior fingerprint when navigating to ${invalid.includes('broken') ? 'an invalid' : 'a conflicting'} link`, async () => {
      const { navigate } = await start(`#h=${first}`);
      expect(views.setPrefill).toHaveBeenLastCalledWith(first);
      navigate(invalid);
      expect(views.setPrefill).toHaveBeenLastCalledWith(null);
    });
  }
  it('keeps the same share-link state across ordinary navigation and history', async () => {
    const { navigate } = await start(`#h=${first}`);
    navigate('#about');
    navigate(`#h=${first}`);
    expect(views.setPrefill).toHaveBeenCalledExactlyOnceWith(first);
    navigate(`#h=${other}`);
    expect(views.setPrefill).toHaveBeenLastCalledWith(other);
  });
});

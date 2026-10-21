// Wires the UI to core. No business logic here (SPEC 5.1).
import { clear, el, setLiveRegion } from './ui/dom';
import { VIEWS, parseHash } from './ui/router';
import { detectLang, setLang, t } from './ui/strings';
import { mountAbout } from './ui/views/about';
import { mountSettings } from './ui/views/settings';
import { mountStamp } from './ui/views/stamp';
import { mountVerify, type VerifyView } from './ui/views/verify';

function frameBust(): boolean {
  // A meta CSP cannot set frame-ancestors (SR-1), so refuse to run inside someone else's page.
  if (window.top !== window.self) {
    const main = document.getElementById('app');
    if (main) {
      clear(main);
      main.appendChild(el('p', { class: 'error', role: 'alert' }, 'This page is running inside another page, which is not safe. Open it directly in its own tab.'));
    }
    return true;
  }
  return false;
}

function start(): void {
  if (frameBust()) return;
  setLang(detectLang(navigator.languages ?? [navigator.language]));
  const live = document.getElementById('live');
  if (live) setLiveRegion(live);

  const sections = {
    stamp: document.getElementById('stamp')!,
    verify: document.getElementById('verify')!,
    about: document.getElementById('about')!,
    settings: document.getElementById('settings')!,
  };
  let verifyView: VerifyView | null = null;
  let pendingPrefill: string | null = null;

  function renderChrome(): void {
    document.documentElement.lang = t('lang.code');
    const set = (id: string, key: Parameters<typeof t>[0]): void => {
      const n = document.getElementById(id);
      if (n) n.textContent = t(key);
    };
    set('nav-stamp', 'nav.stamp');
    set('nav-verify', 'nav.verify');
    set('nav-about', 'nav.about');
    set('nav-settings', 'nav.settings');
    set('skip', 'nav.skip');
    set('footer-version-label', 'footer.version');
    set('footer-build-label', 'footer.build');
    set('footer-note', 'footer.note');
    document.getElementById('nojs')?.remove();
  }

  function mountAll(): void {
    renderChrome();
    mountStamp(sections.stamp);
    verifyView = mountVerify(sections.verify);
    if (pendingPrefill) verifyView.setPrefill(pendingPrefill);
    mountAbout(sections.about);
    mountSettings(sections.settings, onLang);
  }

  function onLang(): void {
    mountAll();
    route(false);
    sections.settings.querySelector<HTMLElement>('#lang')?.focus();
  }

  function route(focus = true): void {
    const { view, h } = parseHash(location.hash);
    if (h) {
      pendingPrefill = h;
      verifyView?.setPrefill(h);
    }
    for (const v of VIEWS) {
      sections[v].hidden = v !== view;
      document.getElementById(`nav-${v}`)?.toggleAttribute('aria-current', v === view);
      if (v === view) document.getElementById(`nav-${v}`)?.setAttribute('aria-current', 'page');
      else document.getElementById(`nav-${v}`)?.removeAttribute('aria-current');
    }
    if (view === 'settings' && focus) mountSettings(sections.settings, onLang);
    document.title = `${t(`nav.${view}` as 'nav.stamp')} · Unaltered`;
    if (focus) sections[view].querySelector<HTMLElement>('h2')?.focus();
  }

  mountAll();
  route(false);
  window.addEventListener('hashchange', () => route(true));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

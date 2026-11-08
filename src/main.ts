// Wires the UI to core. No business logic here (SPEC 5.1).
import { clear, el, setLiveRegion } from './ui/dom';
import { VIEWS, parseHash } from './ui/router';
import { detectLang, setLang, t } from './ui/strings';
import { mountAbout } from './ui/views/about';
import { mountSettings } from './ui/views/settings';
import { mountStamp, type StampView } from './ui/views/stamp';
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
  document.getElementById('skip')?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('app')?.focus();
  });
  let stampView: StampView | null = null;
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

  // Progressive, dependency-free hints. Controls are recreated during file processing,
  // so observe added nodes; never overwrite an explicitly authored tooltip.
  const hints: Record<string, string> = {
    stamp: 'Fingerprint a local file and request a standard OpenTimestamps receipt.',
    verify: 'Check an existing receipt against the original file and Bitcoin evidence.',
    upgrade: 'Ask calendar servers for the Bitcoin proof completing a pending receipt.',
    clean: 'Optionally remove supported metadata before hashing; this changes the file bytes.',
    remove: 'Remove this item from the current browser session.',
    cancel: 'Stop the current operation without creating a completed receipt.',
    download: 'Save this file locally. Unaltered cannot recover receipts you lose.',
    copy: 'Copy the displayed fingerprint or verification link.',
    language: 'Choose the interface language without restarting a running operation.',
    settings: 'Change local application preferences.',
  };
  function annotateControls(): void {
    for (const control of document.querySelectorAll<HTMLElement>('button, input, select, summary, a')) {
      if (control.hasAttribute('title')) continue;
      const label = (control.getAttribute('aria-label') || control.textContent || control.getAttribute('type') || '').trim();
      const lower = label.toLowerCase();
      const key = Object.keys(hints).find((word) => lower.includes(word));
      if (key) control.setAttribute('title', hints[key]!);
      else if (label && (control.matches('button, summary') || control.matches('input[type="file"]'))) {
        control.setAttribute('title', label);
      }
    }
  }
  const hintsObserver = new MutationObserver(() => annotateControls());
  hintsObserver.observe(document.getElementById('app')!, { childList: true, subtree: true });

  function mountAll(): void {
    renderChrome();
    stampView = mountStamp(sections.stamp);
    verifyView = mountVerify(sections.verify);
    if (pendingPrefill) verifyView.setPrefill(pendingPrefill);
    mountAbout(sections.about);
    mountSettings(sections.settings, onLang);
    annotateControls();
  }

  // Language is presentation state: views that hold the user's files and results re-render in place,
  // keeping their inputs, results and any running work (docs/proposals/LANGUAGE_SWITCH.md).
  function onLang(): void {
    renderChrome();
    stampView?.relabel();
    verifyView?.relabel();
    mountAbout(sections.about);
    mountSettings(sections.settings, onLang);
    route(false);
    sections.settings.querySelector<HTMLElement>('#lang input:checked')?.focus();
  }

  function route(focus = true): void {
    const { view, h } = parseHash(location.hash);
    // Every hashchange routes here. Back/Forward (or a language switch) to the same #h= is not a new link: applying
    // it again would replace a file the user chose since, clear its result and abort a running check.
    if (h && h !== pendingPrefill) {
      pendingPrefill = h;
      verifyView?.setPrefill(h);
    } else if (!h && pendingPrefill !== null && /(?:^#?|[&?])h=/.test(location.hash)) {
      // An invalid or conflicting share link must not leave a previous link's fingerprint available for Check.
      // Ordinary tab navigation has no h= parameter and keeps the user's current verification state.
      pendingPrefill = null;
      verifyView?.setPrefill(null);
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

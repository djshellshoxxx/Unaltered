// About / "How to check independently" (UI-3, UI-4, FR-8, section 3.1).
import { copyText, el, setChildren } from '../dom';
import { t } from '../strings';

export function localNodeInstructions(): HTMLElement {
  const cmds = [
    'pip install opentimestamps-client',
    'ots verify --file YOUR_FILE YOUR_FILE.ots',
    'ots upgrade YOUR_FILE.ots',
  ].join('\n');
  return el(
    'details',
    { class: 'l2' },
    el('summary', {}, t('about.l2.summary')),
    el('p', {}, t('about.l2.intro')),
    el('pre', { class: 'cmd', tabindex: 0, 'aria-label': t('about.l2.cmdAria') }, cmds),
    el('button', { type: 'button', class: 'button small', onclick: async (e: Event) => ((e.target as HTMLElement).textContent = (await copyText(cmds)) ? t('common.copied') : t('common.copyFailed')) }, t('common.copy')),
    el('ol', {}, el('li', {}, t('about.l2.step1')), el('li', {}, t('about.l2.step2')), el('li', {}, t('about.l2.step3'))),
    el('p', { class: 'muted' }, t('about.l2.note')),
    el('p', {}, el('a', { href: 'https://opentimestamps.org', rel: 'noreferrer noopener', target: '_blank' }, 'opentimestamps.org')),
  );
}

export function mountAbout(root: HTMLElement): void {
  setChildren(
    root,
    el('h2', { id: 'about-h', tabindex: -1 }, t('about.title')),
    el('p', { class: 'lead' }, t('copy.notTrue')),
    el(
      'table',
      { class: 'proves' },
      el('caption', {}, t('about.table.caption')),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, t('about.proves')), el('th', { scope: 'col' }, t('about.doesNot')))),
      el(
        'tbody',
        {},
        el('tr', {}, el('td', {}, t('about.p1')), el('td', {}, t('about.n1'))),
        el('tr', {}, el('td', {}, t('about.p2')), el('td', {}, t('about.n2'))),
        el('tr', {}, el('td', {}), el('td', {}, t('about.n3'))),
        el('tr', {}, el('td', {}), el('td', {}, t('about.n4'))),
      ),
    ),
    el('h3', {}, t('about.how.title')),
    el('ol', {}, el('li', {}, t('about.how.1')), el('li', {}, t('about.how.2')), el('li', {}, t('about.how.3')), el('li', {}, t('about.how.4'))),
    el('h3', {}, t('about.time.title')),
    el('p', {}, t('about.time.body')),
    el('h3', {}, t('about.privacy.title')),
    el('p', {}, t('copy.visibleToServers')),
    el('p', {}, t('about.privacy.body')),
    el('h3', {}, t('about.strip.title')),
    el('p', {}, t('about.strip.body')),
    el('ul', {}, el('li', {}, t('about.strip.1')), el('li', {}, t('about.strip.2')), el('li', {}, t('about.strip.3')), el('li', {}, t('about.strip.4'))),
    el('h3', {}, t('about.indep.title')),
    el('p', {}, t('about.indep.body')),
    localNodeInstructions(),
    el('h3', {}, t('about.keep.title')),
    el('p', {}, t('copy.keep')),
    el('h3', {}, t('about.phish.title')),
    el('p', {}, t('about.phish.body')),
  );
}

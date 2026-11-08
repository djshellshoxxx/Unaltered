// Settings (FR-13), language (FR-14) and the opt-in local receipt list (FR-12).
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS } from '../../core/net/allowlist';
import { summarizeLocalReceipts } from '../../core/reports/receipt-dashboard';
import { clear, el, setChildren } from '../dom';
import { isDefault, restoreDefaults, settings } from '../state';
import { isEnabled, loadReceipts, removeReceipt, setEnabled, storageAvailable } from '../store';
import { LANGS, getLang, setLang, t } from '../strings';
import { groupHex } from '../../core/bytes';

export function mountSettings(root: HTMLElement, onLangChange: () => void): void {
  const advanced = el('div', { class: 'advanced' });
  const receipts = el('div', { class: 'receipts' });

  function checkboxes(urls: readonly string[], set: Set<string>, legend: string, help: 'help.calendars' | 'help.explorers', choice: 'help.calendarChoice' | 'help.explorerChoice'): HTMLElement {
    return el(
      'fieldset',
      {},
      el('legend', { title: t(help) }, legend),
      el('p', { class: 'muted help-text' }, t(help)),
      ...urls.map((u) => {
        const host = new URL(u).host;
        return el(
          'label',
          { class: 'check', title: t(choice, { host }) },
          el('input', {
            type: 'checkbox',
            checked: set.has(u),
            title: t(choice, { host }),
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) set.add(u);
              else set.delete(u);
              renderAdvanced();
            },
          }),
          el('span', { title: t(choice, { host }) }, host),
        );
      }),
    );
  }

  function renderAdvanced(): void {
    const calCount = settings.calendars.size;
    const problems: string[] = [];
    if (calCount === 0) problems.push(t('settings.errNoCalendars'));
    if (settings.explorers.size < 2) problems.push(t('settings.errExplorers'));
    setChildren(
      advanced,
      el('h3', {}, t('settings.advanced')),
      el('p', { class: 'notice warn' }, t('settings.banner')),
      checkboxes(DEFAULT_CALENDARS, settings.calendars, t('settings.calendars'), 'help.calendars', 'help.calendarChoice'),
      el(
        'div',
        { class: 'field' },
        el('label', { for: 'min-cal', title: t('help.minCalendars') }, t('settings.minCalendars')),
        el('p', { class: 'muted help-text' }, t('help.minCalendars')),
        el('input', {
          type: 'number',
          id: 'min-cal',
          title: t('help.minCalendars'),
          min: 1,
          max: Math.max(1, calCount),
          value: String(Math.min(settings.minCalendars, Math.max(1, calCount))),
          onchange: (e: Event) => {
            const n = Math.floor(Number((e.target as HTMLInputElement).value));
            settings.minCalendars = Number.isFinite(n) ? Math.max(1, n) : 1;
            renderAdvanced();
          },
        }),
      ),
      checkboxes(DEFAULT_EXPLORERS, settings.explorers, t('settings.explorers'), 'help.explorers', 'help.explorerChoice'),
      el('p', { class: 'muted' }, t('settings.explorerNote')),
      ...problems.map((p) => el('p', { class: 'error', role: 'alert' }, p)),
      el('button', { type: 'button', class: 'button', disabled: isDefault(), onclick: () => (restoreDefaults(), renderAdvanced()) }, t('settings.restore')),
    );
  }

  function renderReceipts(): void {
    const on = isEnabled();
    const kids: (Node | null)[] = [
      el('h3', { tabindex: -1 }, t('settings.receipts')),
      el('p', {}, t('settings.receiptsBody')),
      storageAvailable()
        ? el(
            'label',
            { class: 'check' },
            el('input', {
              type: 'checkbox',
              checked: on,
              onchange: (e: Event) => {
                const want = (e.target as HTMLInputElement).checked;
                setEnabled(want);
                renderReceipts();
              },
            }),
            el('span', {}, t('settings.receiptsToggle')),
          )
        : el('p', { class: 'muted' }, t('settings.noStorage')),
    ];
    if (on) {
      const list = loadReceipts();
      const summary = summarizeLocalReceipts(list);
      kids.push(
        el('section', { class: 'receipt-health-summary', 'aria-label': t('dashboard.aria') },
          el('h4', {}, t('dashboard.title')),
          el('p', {}, t('dashboard.saved', { count: summary.saved })),
          el('p', {}, summary.latestAddedUtc ? t('dashboard.latest', { date: summary.latestAddedUtc }) : t('dashboard.none')),
          el('p', { class: 'muted' }, t('dashboard.unknown')),
          el('a', { href: '#verify', class: 'button small' }, t('dashboard.openVerify')),
        ),
        list.length === 0
          ? el('p', { class: 'muted' }, t('settings.receiptsEmpty'))
          : el(
              'ul',
              { class: 'receipt-list' },
              ...list.map((r) =>
                el(
                  'li',
                  // Rows are matched by identity when focus is restored, never by position.
                  { 'data-key': `${r.digestHex} ${r.createdAtUtc}` },
                  el('span', {}, r.label ? el('strong', {}, `${r.label} · `) : null, r.createdAtUtc),
                  el('code', { class: 'digest' }, groupHex(r.digestHex)),
                  el('button', { type: 'button', class: 'button small', onclick: () => {
                    removeReceipt(r);
                    renderReceipts();
                    // The row is gone; put focus on the section heading, not on the next row's Remove (a held Enter would delete it too).
                    receipts.querySelector<HTMLElement>('h3')?.focus();
                  } }, t('common.remove')),
                ),
              ),
            ),
        el('p', { class: 'muted' }, t('settings.receiptsNote')),
      );
    }
    setChildren(receipts, ...kids);
  }

  // Native selection preserves keyboard navigation and avoids custom popup script.
  // Only languages with complete translated string tables are selectable.
  const languageChoices = el('div', { class: 'field', id: 'lang' },
    el('label', { for: 'language-choice', title: t('help.language') }, t('settings.language')),
    el('p', { class: 'muted help-text' }, t('help.language')),
    el('select', { id: 'language-choice', name: 'language', title: t('help.language'),
      onchange: (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        const selected = LANGS.find(l => l.code === value);
        if (selected) { setLang(selected.code); onLangChange(); }
      },
    }, ...LANGS.map(l => el('option', { value: l.code, selected: l.code === getLang() }, l.name))),
  );
  clear(root);
  setChildren(
    root,
    el('h2', { id: 'settings-h', tabindex: -1 }, t('settings.title')),
    languageChoices,
    receipts,
    advanced,
  );
  renderReceipts();
  renderAdvanced();
}

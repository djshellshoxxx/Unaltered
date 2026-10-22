// Settings (FR-13), language (FR-14) and the opt-in local receipt list (FR-12).
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS } from '../../core/net/allowlist';
import { clear, el, setChildren } from '../dom';
import { isDefault, restoreDefaults, settings } from '../state';
import { isEnabled, loadReceipts, removeReceipt, setEnabled, storageAvailable } from '../store';
import { LANGS, getLang, setLang, t } from '../strings';
import { groupHex } from '../../core/bytes';

export function mountSettings(root: HTMLElement, onLangChange: () => void): void {
  const advanced = el('div', { class: 'advanced' });
  const receipts = el('div', { class: 'receipts' });

  function checkboxes(urls: readonly string[], set: Set<string>, legend: string): HTMLElement {
    return el(
      'fieldset',
      {},
      el('legend', {}, legend),
      ...urls.map((u) => {
        const host = new URL(u).host;
        return el(
          'label',
          { class: 'check' },
          el('input', {
            type: 'checkbox',
            checked: set.has(u),
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) set.add(u);
              else set.delete(u);
              renderAdvanced();
            },
          }),
          el('span', {}, host),
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
      checkboxes(DEFAULT_CALENDARS, settings.calendars, t('settings.calendars')),
      el(
        'div',
        { class: 'field' },
        el('label', { for: 'min-cal' }, t('settings.minCalendars')),
        el('input', {
          type: 'number',
          id: 'min-cal',
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
      checkboxes(DEFAULT_EXPLORERS, settings.explorers, t('settings.explorers')),
      el('p', { class: 'muted' }, t('settings.explorerNote')),
      ...problems.map((p) => el('p', { class: 'error', role: 'alert' }, p)),
      el('button', { type: 'button', class: 'button', disabled: isDefault(), onclick: () => (restoreDefaults(), renderAdvanced()) }, t('settings.restore')),
    );
  }

  function renderReceipts(): void {
    const on = isEnabled();
    const kids: (Node | null)[] = [
      el('h3', {}, t('settings.receipts')),
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
      kids.push(
        list.length === 0
          ? el('p', { class: 'muted' }, t('settings.receiptsEmpty'))
          : el(
              'ul',
              { class: 'receipt-list' },
              ...list.map((r, i) =>
                el(
                  'li',
                  {},
                  el('span', {}, r.label ? el('strong', {}, `${r.label} · `) : null, r.createdAtUtc),
                  el('code', { class: 'digest' }, groupHex(r.digestHex)),
                  el('button', { type: 'button', class: 'button small', onclick: () => (removeReceipt(i), renderReceipts()) }, t('common.remove')),
                ),
              ),
            ),
        el('p', { class: 'muted' }, t('settings.receiptsNote')),
      );
    }
    setChildren(receipts, ...kids);
  }

  // WebKit 27.2 emits a style-src-attr CSP violation merely constructing a native select.
  // Two language choices fit native radios; keep the strict policy and keyboard semantics.
  const languageChoices = el(
    'fieldset',
    { id: 'lang' },
    el('legend', {}, t('settings.language')),
    ...LANGS.map((l) => el('label', { class: 'check' }, el('input', {
      type: 'radio',
      name: 'language',
      value: l.code,
      checked: l.code === getLang(),
      onchange: (e: Event) => {
        if ((e.target as HTMLInputElement).checked) {
          setLang(l.code);
          onLangChange();
        }
      },
    }), el('span', {}, l.name))),
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

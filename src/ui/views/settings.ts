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
              const updated = [...advanced.querySelectorAll<HTMLLabelElement>('label.check')].find(
                (label) => label.textContent?.trim() === host,
              );
              updated?.querySelector<HTMLInputElement>('input')?.focus();
            },
          }),
          el('span', {}, host),
        );
      }),
    );
  }

  // Explanations are visible text, not hover-only tooltips, so keyboard and touch users receive them too.
  const help = (en: string, es: string): HTMLElement =>
    el('p', { class: 'muted settings-help' }, getLang() === 'es' ? es : en);

  function renderAdvanced(): void {
    const calCount = settings.calendars.size;
    const problems: string[] = [];
    if (calCount === 0) problems.push(t('settings.errNoCalendars'));
    if (settings.explorers.size < 2) problems.push(t('settings.errExplorers'));
    setChildren(
      advanced,
      el('h3', {}, t('settings.advanced')),
      el('p', { class: 'notice warn' }, t('settings.banner')),
      help('Calendar servers accept timestamp commitments, not original file contents. Using independent operators improves availability but each selected operator can observe your network request.',
        'Los calendarios reciben compromisos de tiempo, no el archivo original. Elegir operadores independientes mejora la disponibilidad, pero cada operador puede observar tu solicitud de red.'),
      checkboxes(DEFAULT_CALENDARS, settings.calendars, t('settings.calendars')),
      el(
        'div',
        { class: 'field' },
        el('label', { for: 'min-cal' }, t('settings.minCalendars')),
        help('Minimum successful calendar submissions required to accept a stamping attempt. A larger number can reduce availability; it does not by itself prove Bitcoin confirmation.',
          'Número mínimo de calendarios que deben aceptar el envío. Un número mayor puede reducir la disponibilidad; no demuestra por sí solo la confirmación en Bitcoin.'),
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
            advanced.querySelector<HTMLInputElement>('#min-cal')?.focus();
          },
        }),
      ),
      help('Independent Bitcoin explorers are compared during online verification. Disagreement or insufficient responses cannot establish a verified result.',
        'Se comparan exploradores de Bitcoin independientes durante la verificación. Si discrepan o no responden suficientes, no se puede establecer un resultado verificado.'),
      checkboxes(DEFAULT_EXPLORERS, settings.explorers, t('settings.explorers')),
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

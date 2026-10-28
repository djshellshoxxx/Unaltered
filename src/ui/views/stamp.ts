// Stamp view (FR-1..FR-5, FR-10, FR-11, FR-12): pick file(s), optionally clean, fingerprint, create receipt.
import { groupHex } from '../../core/bytes';
import { isAbort, safeMessage, UnalteredError } from '../../core/errors';
import { hashBlob, type HashResult } from '../../core/hash/hasher';
import { calendarsOf, stampBatch, type CalendarResult } from '../../core/ots/calendar';
import { MIME, detectBlob, stripMetadata, type FileKind, type StripOutcome } from '../../core/strip';
import { announce, copyText, dropZone, el, formatBytes, setChildren } from '../dom';
import { cleanedName, downloadLink, receiptName, revokeAll } from '../download';
import { stampConfigFromSettings } from '../state';
import { addReceipt, isEnabled } from '../store';
import { t } from '../strings';

interface Item {
  id: number;
  file: File;
  kind: FileKind;
  strip: boolean;
  outcome: StripOutcome | null;
  hash: HashResult | null;
  progress: number;
  busy: boolean;
  error: string | null;
  downloadedCleaned: boolean;
  ackHidden: boolean;
  ackOrientation: boolean;
  proof: Uint8Array | null;
  abort: AbortController;
  card: HTMLElement;
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
}

// Kinds the cleaner can rewrite (images and audio).
const isImage = (k: FileKind): boolean => k === 'jpeg' || k === 'png' || k === 'wav' || k === 'mp3';

export interface StampView {
  /** Re-renders every visible string in the current language from the retained state; never restarts work. */
  relabel(): void;
}

export function mountStamp(root: HTMLElement): StampView {
  revokeAll();
  let nextId = 1;
  const items: Item[] = [];
  let stamping = false;
  let stampAbort: AbortController | null = null;
  let lastCalendars: CalendarResult[] | null = null;
  let stampError: string | null = null;

  const list = el('div', { class: 'items', role: 'list' });
  const actions = el('div', { class: 'actions' });
  const result = el('div', { class: 'stamp-result', 'aria-live': 'polite' });

  function cleanedOf(it: Item): Extract<StripOutcome, { kind: 'cleaned' }> | null {
    return it.outcome && it.outcome.kind === 'cleaned' ? it.outcome : null;
  }

  function ready(it: Item): boolean {
    if (it.busy || it.error || !it.hash) return false;
    const c = cleanedOf(it);
    if (c) {
      if (!it.downloadedCleaned) return false;
      if (c.orientation !== undefined && c.orientation !== 1 && !it.ackOrientation) return false;
      return true;
    }
    return it.ackHidden;
  }

  async function process(it: Item): Promise<void> {
    it.abort.abort();
    it.abort = new AbortController();
    const signal = it.abort.signal;
    it.busy = true;
    it.error = null;
    it.hash = null;
    it.outcome = null;
    // A receipt belongs to the previous byte target; changing cleaning requires a new stamp.
    it.proof = null;
    lastCalendars = null;
    stampError = null;
    it.progress = 0;
    it.downloadedCleaned = false;
    it.ackHidden = false;
    it.ackOrientation = false;
    refreshItem(it);
    refreshActions();
    try {
      it.kind = await detectBlob(it.file);
      throwIfCancelled(signal);
      let target: Blob = it.file;
      if (isImage(it.kind) && it.strip) {
        const out = await stripMetadata(it.file);
        throwIfCancelled(signal);
        it.outcome = out;
        if (out.kind === 'rejected') {
          it.error = t('stamp.rejected', { reason: out.reason });
          it.busy = false;
          refreshItem(it);
          refreshActions();
          return;
        }
        if (out.kind === 'cleaned') target = out.output;
      }
      it.hash = await hashBlob(target, {
        signal,
        onProgress: (done) => {
          it.progress = target.size === 0 ? 1 : done / target.size;
          refreshProgress(it);
        },
      });
    } catch (e) {
      if (isAbort(e) || signal.aborted) {
        // A newer run or Remove owns the item now; only the item's own Cancel leaves it here to settle.
        if (it.abort.signal !== signal || !items.includes(it)) return;
        it.error = t('stamp.cancelled');
      } else {
        it.error = safeMessage(e);
      }
    }
    it.busy = false;
    refreshItem(it);
    refreshActions();
  }

  function refreshProgress(it: Item): void {
    const p = it.card.querySelector('progress');
    if (p) p.value = it.progress;
  }

  function refreshItem(it: Item): void {
    const c = cleanedOf(it);
    const kids: (Node | string | false | null)[] = [];
    kids.push(
      el(
        'div',
        { class: 'item-head' },
        el('strong', { class: 'item-name' }, it.file.name),
        el('span', { class: 'muted' }, ` · ${formatBytes(it.file.size)}`),
        el('button', { type: 'button', class: 'button small', onclick: () => remove(it), disabled: stamping }, t('common.remove')),
      ),
    );
    if (it.busy) {
      kids.push(el('label', { class: 'progress-label' }, t('stamp.working'), el('progress', { max: 1, value: it.progress })));
      kids.push(el('button', { type: 'button', class: 'button small', onclick: () => it.abort.abort() }, t('common.cancel')));
    }
    if (it.error) kids.push(el('p', { class: 'error', role: 'alert' }, it.error));

    if (!it.busy && !it.error && isImage(it.kind)) {
      kids.push(
        el(
          'label',
          { class: 'check' },
          el('input', { type: 'checkbox', checked: it.strip, disabled: stamping, onchange: (e: Event) => ((it.strip = (e.target as HTMLInputElement).checked), void process(it)) }),
          el('span', {}, t('stamp.stripLabel')),
        ),
      );
    }

    if (!it.busy && c) {
      kids.push(
        el(
          'div',
          { class: 'notice ok' },
          el('p', {}, t('stamp.cleanedNotice')),
          c.removed.length > 0 ? el('p', {}, t('stamp.removed'), ' ', c.removed.join('; ')) : el('p', {}, t('stamp.nothingRemoved')),
          el('p', { class: 'muted' }, t(c.format === 'wav' || c.format === 'mp3' ? 'stamp.limitsAudio' : 'stamp.limits')),
          downloadLink(t('stamp.downloadCleaned', { name: cleanedName(it.file.name, c.format) }), cleanedName(it.file.name, c.format), c.output, MIME[c.format], () => {
            it.downloadedCleaned = true;
            refreshItem(it);
            refreshActions();
          }),
          it.downloadedCleaned ? el('p', { class: 'muted' }, t('stamp.cleanedDownloaded')) : el('p', { class: 'warn' }, t('stamp.mustDownload')),
          el('p', { class: 'muted' }, t('stamp.fileNameWarning')),
          c.orientation !== undefined && c.orientation !== 1
            ? el(
                'label',
                { class: 'check warn' },
                el('input', { type: 'checkbox', checked: it.ackOrientation, onchange: (e: Event) => ((it.ackOrientation = (e.target as HTMLInputElement).checked), refreshActions()) }),
                el('span', {}, t('stamp.orientationWarn')),
              )
            : null,
        ),
      );
    } else if (!it.busy && !it.error && it.hash) {
      const pdf = it.kind === 'pdf';
      kids.push(
        el(
          'div',
          { class: 'notice warn' },
          el('p', {}, pdf ? t('stamp.pdfWarn') : isImage(it.kind) ? t('stamp.stripOffWarn') : t('stamp.unsupportedWarn')),
          el(
            'label',
            { class: 'check' },
            el('input', { type: 'checkbox', checked: it.ackHidden, disabled: stamping, onchange: (e: Event) => ((it.ackHidden = (e.target as HTMLInputElement).checked), refreshActions()) }),
            el('span', {}, t('stamp.ack')),
          ),
        ),
      );
    }

    if (it.hash) {
      const hex = it.hash.hex;
      kids.push(
        el(
          'div',
          { class: 'fingerprint' },
          el('span', { class: 'label' }, t('stamp.fingerprint')),
          el('code', { class: 'digest', 'aria-label': t('stamp.fingerprintAria') }, groupHex(hex)),
          el('button', { type: 'button', class: 'button small', onclick: async (e: Event) => flash(e.target as HTMLElement, (await copyText(hex)) ? t('common.copied') : t('common.copyFailed')) }, t('common.copy')),
        ),
      );
    }

    if (it.proof) {
      const name = receiptName(c ? cleanedName(it.file.name, c.format) : it.file.name);
      kids.push(
        el(
          'div',
          { class: 'notice ok' },
          downloadLink(t('stamp.downloadReceipt', { name }), name, it.proof, 'application/octet-stream'),
          el('p', { class: 'muted' }, t('stamp.receiptName')),
          shareRow(it),
          labelRow(it),
        ),
      );
    }
    setChildren(it.card, ...kids);
  }

  function shareRow(it: Item): Node | null {
    if (!it.hash) return null;
    const hex = it.hash.hex;
    const base = location.protocol === 'file:' ? '' : `${location.origin}${location.pathname}`;
    const link = `${base}#h=${hex}`;
    return el(
      'div',
      { class: 'share' },
      el('button', { type: 'button', class: 'button small', onclick: async (e: Event) => flash(e.target as HTMLElement, (await copyText(link)) ? t('common.copied') : t('common.copyFailed')) }, t('stamp.copyLink')),
      el('span', { class: 'muted' }, ' ', t('stamp.linkNote')),
    );
  }

  function labelRow(it: Item): Node | null {
    if (!isEnabled() || !it.hash) return null;
    const hex = it.hash.hex;
    const input = el('input', { type: 'text', id: `label-${it.id}`, maxlength: 100, autocomplete: 'off' });
    const saved = el('span', { class: 'muted', role: 'status' });
    return el(
      'div',
      { class: 'label-row' },
      el('label', { for: `label-${it.id}` }, t('stamp.labelField')),
      input,
      el(
        'button',
        {
          type: 'button',
          class: 'button small',
          onclick: () => {
            const ok = addReceipt({ digestHex: hex, createdAtUtc: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), label: input.value });
            saved.textContent = ok ? t('stamp.savedToList') : t('stamp.saveFailed');
          },
        },
        t('stamp.saveToList'),
      ),
      saved,
    );
  }

  function flash(target: HTMLElement, msg: string): void {
    announce(msg);
    const old = target.textContent;
    target.textContent = msg;
    setTimeout(() => (target.textContent = old), 1500);
  }

  function remove(it: Item): void {
    it.abort.abort();
    items.splice(items.indexOf(it), 1);
    it.card.remove();
    if (items.length === 0) {
      lastCalendars = null;
      stampError = null;
    }
    refreshActions();
  }

  function add(files: File[]): void {
    for (const file of files) {
      const it: Item = {
        id: nextId++,
        file,
        kind: 'other',
        strip: true,
        outcome: null,
        hash: null,
        progress: 0,
        busy: true,
        error: null,
        downloadedCleaned: false,
        ackHidden: false,
        ackOrientation: false,
        proof: null,
        abort: new AbortController(),
        card: el('div', { class: 'card item', role: 'listitem' }),
      };
      items.push(it);
      list.appendChild(it.card);
      void process(it);
    }
    refreshActions();
  }

  async function createReceipt(): Promise<void> {
    stamping = true;
    stampError = null;
    lastCalendars = null;
    stampAbort = new AbortController();
    refreshActions();
    items.forEach(refreshItem);
    try {
      const digests = items.map((i) => i.hash!.digest);
      const cfg = stampConfigFromSettings(stampAbort.signal);
      const r = await stampBatch(digests, cfg);
      lastCalendars = r.calendars;
      items.forEach((it, i) => (it.proof = r.proofs[i]!));
      announce(t('stamp.done'));
    } catch (e) {
      if (!isAbort(e)) {
        stampError = safeMessage(e);
        lastCalendars = calendarsOf(e) ?? null;
      }
    }
    stamping = false;
    stampAbort = null;
    items.forEach(refreshItem);
    refreshActions();
  }

  function refreshActions(): void {
    const stamped = items.length > 0 && items.every((i) => i.proof);
    const allReady = items.length > 0 && items.every(ready);
    const kids: (Node | null)[] = [];
    if (items.length > 0 && !stamped) {
      kids.push(
        el(
          'button',
          { type: 'button', class: 'button primary big', disabled: !allReady || stamping, onclick: () => void createReceipt() },
          stamping ? t('stamp.creating') : items.length > 1 ? t('stamp.createMany', { n: items.length }) : t('stamp.create'),
        ),
      );
      if (stamping) kids.push(el('button', { type: 'button', class: 'button', onclick: () => stampAbort?.abort() }, t('common.cancel')));
      if (!allReady && !stamping) kids.push(el('p', { class: 'muted' }, items.some((i) => i.error) ? t('stamp.fixErrors') : t('stamp.completeSteps')));
    }
    setChildren(actions, ...kids);

    const res: (Node | null)[] = [];
    if (stampError) res.push(el('p', { class: 'error', role: 'alert' }, stampError));
    if (lastCalendars) {
      res.push(
        el(
          'ul',
          { class: 'calendars' },
          ...lastCalendars.map((c) => el('li', {}, `${c.ok ? '✔' : '✖'} ${new URL(c.url).host}${c.error ? ` – ${c.error}` : ''}`)),
        ),
      );
    }
    if (stamped) {
      res.push(
        el(
          'div',
          { class: 'notice pending', role: 'status' },
          el('p', {}, el('strong', {}, t('stamp.pendingTitle')), ' ', t('stamp.pendingBody')),
          el('p', {}, el('strong', {}, t('stamp.keepTitle')), ' ', t('stamp.keepBody')),
          el('p', { class: 'muted' }, t('copy.visibleToServers')),
        ),
      );
    }
    setChildren(result, ...res);
  }

  function renderFrame(): void {
    setChildren(
      root,
      el('h2', { id: 'stamp-h', tabindex: -1 }, t('stamp.title')),
      el('p', { class: 'lead' }, t('copy.stays')),
      el('p', {}, t('copy.notTrue')),
      dropZone({ id: 'stamp-file', label: t('stamp.drop'), hint: t('stamp.dropHint'), multiple: true, onFiles: add }),
      list,
      actions,
      result,
      el('p', { class: 'muted' }, t('copy.visibleToServers')),
    );
  }

  renderFrame();
  refreshActions();
  return {
    relabel() {
      renderFrame();
      items.forEach(refreshItem);
      refreshActions();
    },
  };
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { el, setChildren, dropZone } from '../../src/ui/dom';
import { doc, FElement, installFakeDom } from './ui-fake-dom';

let restore: () => void;
beforeEach(() => { restore = installFakeDom(); });
afterEach(() => restore());

describe('el() sinks', () => {
  it('never turns a string into an inline event handler or script-bearing attribute', () => {
    const a = el('a', { onclick: 'alert(1)', onmouseover: 'x()', srcdoc: '<b>', href: 'javascript:alert(1)' }) as unknown as FElement;
    expect(a.getAttribute('onclick')).toBeNull();
    expect(a.getAttribute('onmouseover')).toBeNull();
    expect(a.getAttribute('srcdoc')).toBeNull();
    expect(a.getAttribute('href')).toBeNull();
  });
  it('still wires function handlers', () => {
    let n = 0;
    const b = el('button', { onclick: () => n++ }) as unknown as FElement;
    b.dispatch('click');
    expect(n).toBe(1);
  });
  it('blocks script URLs after browser whitespace normalization and attribute case folding', () => {
    for (const attr of ['href', 'HREF', 'src', 'SRC', 'action', 'Action', 'formaction', 'formAction']) {
      for (const value of ['java\nscript:alert(1)', 'java\tscript:alert(1)', '\u0001javascript:alert(1)', 'da\rta:text/html,hi', 'VBScript:msgbox(1)']) {
        const node = el('a', { [attr]: value }) as unknown as FElement;
        expect(node.getAttribute(attr), `${attr}: ${JSON.stringify(value)}`).toBeNull();
      }
    }
  });
  it('keeps ordinary relative, HTTPS, fragment and blob URLs', () => {
    for (const value of ['./main.js', '/Unaltered/', '#verify', 'https://example.org/', 'blob:https://example.org/id']) {
      const node = el('a', { href: value }) as unknown as FElement;
      expect(node.getAttribute('href')).toBe(value);
    }
  });
});

describe('focus survives a re-render of its container (WCAG 2.4.3)', () => {
  const build = (): unknown[] => [el('label', {}, el('input', { type: 'checkbox', id: 'c' })), el('button', { type: 'button', id: 'b' }, 'Go')];

  it('keeps focus on the equivalent control after setChildren', () => {
    const root = el('div') as unknown as FElement;
    doc.body.appendChild(root);
    setChildren(root as unknown as Node, ...(build() as never[]));
    const box = root.querySelector('#c')!;
    box.focus();
    expect(doc.activeElement).toBe(box);
    setChildren(root as unknown as Node, ...(build() as never[]));
    const fresh = root.querySelector('#c')!;
    expect(fresh).not.toBe(box);
    expect(doc.activeElement).toBe(fresh);
  });

  it('does not steal focus when the focused element is outside the container', () => {
    const root = el('div') as unknown as FElement;
    const other = el('button', { id: 'o' }) as unknown as FElement;
    doc.body.appendChild(root);
    doc.body.appendChild(other);
    setChildren(root as unknown as Node, ...(build() as never[]));
    other.focus();
    setChildren(root as unknown as Node, ...(build() as never[]));
    expect(doc.activeElement).toBe(other);
  });
});

describe('focus restoration follows each ancestor at its own position', () => {
  const mount = (): FElement => {
    const root = el('div') as unknown as FElement;
    doc.body.appendChild(root);
    return root;
  };
  const render = (root: FElement, kids: unknown[]): void => setChildren(root as unknown as Node, ...(kids as never[]));

  it('restores a control nested below a container that is not the first child (settings receipt toggle)', () => {
    const build = (): unknown[] => [el('h3', {}, 'Receipts'), el('p', {}, 'Body'), el('label', { class: 'check' }, el('input', { type: 'checkbox' }), el('span', {}, 'Remember'))];
    const root = mount();
    render(root, build());
    const box = root.querySelector('input')!;
    box.focus();
    render(root, build());
    const fresh = root.querySelector('input')!;
    expect(fresh).not.toBe(box);
    expect(doc.activeElement).toBe(fresh);
  });

  it('restores a file input at [1,0] (verify step 1)', () => {
    const build = (): unknown[] => [el('h3', {}, 'Step 1'), el('div', { class: 'drop-wrap' }, el('input', { type: 'file', class: 'file-input' }), el('label', { class: 'drop' }, 'Choose'))];
    const root = mount();
    render(root, build());
    root.querySelector('input')!.focus();
    render(root, build());
    expect(doc.activeElement).toBe(root.querySelector('input'));
  });

  it('never moves focus to a different control that shares the innermost index (stamp Remove -> Copy)', () => {
    const head = (): unknown => el('div', { class: 'item-head' }, el('strong', {}, 'big.bin'), el('span', {}, ' · 1 GiB'), el('button', { type: 'button' }, 'Remove'));
    const card = mount();
    render(card, [head(), el('label', { class: 'progress-label' }, 'Working', el('progress')), el('button', { type: 'button' }, 'Cancel')]);
    card.querySelector('button')!.focus();
    expect(doc.activeElement!.textContent).toBe('Remove');
    render(card, [
      head(),
      el('div', { class: 'notice warn' }, el('p', {}, 'Hidden data'), el('label', { class: 'check' }, el('input', { type: 'checkbox' }), el('span', {}, 'I understand'))),
      el('div', { class: 'fingerprint' }, el('span', {}, 'Fingerprint'), el('code', {}, 'ab'), el('button', { type: 'button' }, 'Copy')),
    ]);
    expect(doc.activeElement!.textContent).toBe('Remove');
    expect(doc.activeElement).toBe(card.querySelector('.item-head')!.querySelector('button'));
  });

  it('finds a control by its id when the siblings before it changed (share-link notice removed)', () => {
    const build = (notice: boolean): unknown[] => [
      el('h3', {}, 'Step 1'),
      notice ? el('div', { class: 'notice' }, el('p', {}, 'From a link')) : null,
      el('div', { class: 'drop-wrap' }, el('input', { type: 'file', id: 'verify-file' }), el('label', { for: 'verify-file' }, 'Choose')),
    ];
    const root = mount();
    render(root, build(true));
    root.querySelector('#verify-file')!.focus();
    render(root, build(false));
    expect(doc.activeElement).toBe(root.querySelector('#verify-file'));
  });

  it('does not move focus onto another list row after the focused row is removed', () => {
    const rows = (keys: string[]): unknown => el('ul', {}, ...keys.map((k) => el('li', { 'data-key': k }, el('span', {}, k), el('button', { type: 'button' }, 'Remove'))));
    const root = mount();
    render(root, [rows(['a', 'b', 'c'])]);
    const first = root.querySelector('button')!;
    first.focus();
    render(root, [rows(['b', 'c'])]);
    for (const b of root.all().filter((e) => e.tagName === 'BUTTON')) expect(doc.activeElement).not.toBe(b);
  });

  it('keeps focus on the same list row when that row is still there', () => {
    const rows = (keys: string[]): unknown => el('ul', {}, ...keys.map((k) => el('li', { 'data-key': k }, el('span', {}, k), el('button', { type: 'button' }, `Remove ${k}`))));
    const root = mount();
    render(root, [rows(['a', 'b', 'c'])]);
    root.all().find((e) => e.textContent === 'Remove b')!.focus();
    render(root, [rows(['a', 'b', 'c'])]);
    expect(doc.activeElement!.textContent).toBe('Remove b');
    expect(root.all()).toContain(doc.activeElement);
  });
});


it('clears file selection before consumers can throw or replace the input', () => {
  const root = dropZone({ id: 'repeat', label: 'Choose', hint: '', onFiles: () => { throw new Error('consumer failed'); } }) as unknown as FElement;
  const input = root.querySelector('input')!;
  input.value = 'selected-file';
  input.files = [{ name: 'same.txt' }];
  expect(() => input.dispatch('change')).toThrow('consumer failed');
  expect(input.value).toBe('');
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { el, setChildren } from '../../src/ui/dom';
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
});

describe('focus survives a re-render of its container (WCAG 2.4.3)', () => {
  const build = (): unknown[] => [el('label', {}, el('input', { type: 'checkbox', id: 'c' })), el('button', { type: 'button', id: 'b' }, 'Go')];

  it('keeps focus on the equivalent control after setChildren', () => {
    const root = el('div') as unknown as FElement;
    doc.body.appendChild(root);
    setChildren(root, ...(build() as never[]));
    const box = root.querySelector('#c')!;
    box.focus();
    expect(doc.activeElement).toBe(box);
    setChildren(root, ...(build() as never[]));
    const fresh = root.querySelector('#c')!;
    expect(fresh).not.toBe(box);
    expect(doc.activeElement).toBe(fresh);
  });

  it('does not steal focus when the focused element is outside the container', () => {
    const root = el('div') as unknown as FElement;
    const other = el('button', { id: 'o' }) as unknown as FElement;
    doc.body.appendChild(root);
    doc.body.appendChild(other);
    setChildren(root, ...(build() as never[]));
    other.focus();
    setChildren(root, ...(build() as never[]));
    expect(doc.activeElement).toBe(other);
  });
});

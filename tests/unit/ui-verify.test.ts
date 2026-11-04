import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../../src/ui/strings';
import { mountVerify, renderReport } from '../../src/ui/views/verify';
import { doc, FElement, installFakeDom } from './ui-fake-dom';
import type { VerifyReport } from '../../src/core/ots/verify';

let restore: () => void;
beforeEach(() => { restore = installFakeDom(); });
afterEach(() => { restore(); setLang('en'); });

const HEX = 'ab'.repeat(32);
const verified = { state: 'VERIFIED', bitcoin: { height: 1, blockTimeUtc: '2020-01-01T00:00:00Z', sourcesAgreeing: ['a', 'b'] } } as unknown as VerifyReport;

describe('share-link result wording never claims a file was checked', () => {
  for (const lang of ['en', 'es'] as const) {
    it(`${lang}: VERIFIED from a link speaks about the fingerprint, not "this file"`, () => {
      setLang(lang);
      const text = (renderReport(verified, HEX, true) as unknown as FElement).textContent;
      expect(text).not.toMatch(/This file existed|Este archivo existía/);
      const file = (renderReport(verified, HEX, false) as unknown as FElement).textContent;
      expect(file).toMatch(/This file existed|Este archivo existía/);
    });
  }
});

describe('link fingerprint and chosen file are mutually exclusive', () => {
  it('choosing a file drops the link fingerprint, and a new link drops the file', () => {
    const root = doc.createElement('section');
    doc.body.appendChild(root);
    const view = mountVerify(root as never);
    view.setPrefill(HEX);
    expect(root.querySelector('.notice')).not.toBeNull();
    const input = root.querySelector('#verify-file')!;
    input.files = [{ name: 'f.txt', size: 1 }];
    input.dispatch('change');
    expect(root.querySelector('.notice')).toBeNull();
    expect(root.textContent).toContain('f.txt');
    view.setPrefill(HEX);
    expect(root.querySelector('.notice')).not.toBeNull();
    expect(root.textContent).not.toContain('f.txt');
  });
});

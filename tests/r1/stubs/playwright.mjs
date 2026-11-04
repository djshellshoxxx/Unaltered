// Test double for '@playwright/test', loaded only by tests/r1/r1-acceptance.test.mjs through ./register.mjs.
// No browser, page or network: it walks scripts/r1-acceptance.mjs through a VERIFIED run whose Upgrade step offers
// one download. R1_STUB_DOWNLOAD names the synthetic bytes that download holds (not a real receipt); every file given
// to the Verify receipt input is appended to R1_STUB_LOG with the bytes it held at that moment.
import { appendFileSync, readFileSync } from 'node:fs';

const required = (name) => {
  if (!process.env[name]) throw new Error(`${name} is required by the Playwright test double`);
  return process.env[name];
};

class Locator {
  constructor(selector) { this.selector = selector; }
  locator(child) { return new Locator(`${this.selector} ${child}`); }
  first() { return this; }
  async waitFor() {}
  async count() { return this.selector.endsWith('a[download]') ? 1 : 0; }
  async allTextContents() { return []; }
  async click() {}
  async getAttribute() { return 'result result-VERIFIED'; }
  async innerText() { return 'Bitcoin block\n428648\nTime'; }
}

const page = {
  async addInitScript() {},
  on() {},
  async goto() {},
  async setInputFiles(selector, path) {
    if (selector !== '#verify-receipt') return;
    appendFileSync(required('R1_STUB_LOG'), `${JSON.stringify({ path, hex: readFileSync(path).toString('hex') })}\n`);
  },
  getByRole() { return { async click() {} }; },
  locator(selector) { return new Locator(selector); },
  async waitForEvent() {
    return { suggestedFilename: () => process.env.R1_STUB_NAME || 'incomplete.txt.ots', path: async () => required('R1_STUB_DOWNLOAD') };
  },
  async evaluate() { return []; },
};

export const chromium = {
  async launch() {
    return { async newContext() { return { async newPage() { return page; } }; }, version: () => 'test-double', async close() {} };
  },
};

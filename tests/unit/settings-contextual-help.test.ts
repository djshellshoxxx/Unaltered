import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const settings = readFileSync(new URL('../../src/ui/views/settings.ts', import.meta.url), 'utf8');
describe('Settings accessibility and contextual help', () => {
  it('provides bilingual visible explanations for the network controls', () => {
    for (const phrase of ['Calendar servers accept', 'Minimum successful calendar', 'Independent Bitcoin explorers', 'Los calendarios reciben', 'Se comparan exploradores']) expect(settings).toContain(phrase);
    expect(settings).toContain("class: 'muted settings-help'");
  });
  it('restores keyboard focus after rerendering network options', () => {
    expect(settings).toContain("updated?.querySelector<HTMLInputElement>('input')?.focus()");
    expect(settings).toContain("advanced.querySelector<HTMLInputElement>('#min-cal')?.focus()");
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../src/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('CDL SEO and visual integration', () => {
  it('provides a canonical URL, description and social metadata without inline scripts', () => {
    expect(html).toContain('rel="canonical" href="https://djshellshoxxx.github.io/Unaltered/"');
    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('circuitdriftlabs/development/crypto-libertarian/');
    expect(html).not.toContain('application/ld+json');
  });
  it('uses CDL wing colors and local fallback fonts', () => {
    expect(css).toContain('--bg: #0e1116');
    expect(css).toContain('--primary: #4fb6c4');
    expect(css).toContain('#e8532a');
    expect(css).toContain("font-family: Arial, 'Segoe UI', sans-serif");
  });
});

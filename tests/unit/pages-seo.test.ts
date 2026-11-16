import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const build = readFileSync(new URL('../../scripts/build.mjs', import.meta.url), 'utf8');
describe('Pages SEO publishing boundaries', () => {
  it('adds canonical and sitemap only to hosted Pages output', () => {
    expect(build).toContain("const siteUrl = 'https://djshellshoxxx.github.io/Unaltered/'");
    expect(build).toContain("seoHead");
    expect(build).toContain("'robots.txt'");
    expect(build).toContain("'sitemap.xml'");
    expect(build).toContain("multiHtml.replace('</head>'");
    expect(build).toContain("const singleHtml = fill(template");
  });
});
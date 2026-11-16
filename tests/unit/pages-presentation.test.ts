import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../src/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('Pages presentation preserves existing application', () => {
  it('retains all application mounts, navigation, QR tools and CSP placeholders', () => {
    for (const marker of ['id="app"', 'id="stamp"', 'id="verify"', 'id="about"', 'id="settings"', 'id="live"', 'id="network-capability"', '{{CSP}}', '{{FAVICON}}', '{{STYLES}}', '{{SCRIPT}}']) {
      expect(html).toContain(marker);
    }
    expect(html).not.toContain('<script src="https:');
  });
  it('provides bilingual presentation and QR documentation', () => {
    for (const marker of ['class="site-intro"', 'class="site-guide"', 'class="intro-en"', 'class="intro-es"', 'class="site-steps"', 'Archival QR certificates', 'Certificados QR de archivo', 'opentimestamps-client']) expect(html).toContain(marker);
    expect(css).toContain('html[lang="es"] .intro-en');
    expect(css).toContain('html[lang="es"] .intro-es');
  });
});

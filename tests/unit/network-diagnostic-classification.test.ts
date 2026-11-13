import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const diagnostic = readFileSync(new URL('../../scripts/network-check.mjs', import.meta.url), 'utf8');

describe('live network diagnostic classification', () => {
  it('reports upstream 404 CORS omissions without claiming browser compatibility', () => {
    expect(diagnostic).toContain("g.res.status === 404 && !gcors && !g.oversized");
    expect(diagnostic).toContain("'UPSTREAM_CORS_WARNING'");
    expect(diagnostic).toContain('externalCorsWarnings++');
    expect(diagnostic).toContain("else if (lookupResult === 'FAIL') failed++");
    expect(diagnostic).toContain('process.exit(failed === 0 ? 0 : 1)');
  });
});

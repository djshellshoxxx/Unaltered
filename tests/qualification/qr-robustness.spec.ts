import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { archivalReceiptFixture } from '../helpers/archival-receipt';
import { ABSENT_MESSAGE, type Level, printCertificate, qrPython, runJson } from './qr-cert';

/**
 * Opt-in distortion corpus measurement (UNALTERED_QR_ROBUSTNESS=1, plus the zxing-cpp/Pillow venv).
 * Each seeded variant of the printed pages goes through the real in-app path: the file input, the bounded
 * jsQR scan worker in Chromium, frame reassembly and .ots parsing, offline. zxing-cpp results for the same
 * image files come from tests/archival/qr_distort.py. This is a measurement, not a pass-rate gate: it asserts
 * only that clean pages recover and that every in-app recovery is byte-identical (never a wrong receipt).
 * Set UNALTERED_QR_ROBUSTNESS_OUT=<path> to also write the compact results JSON (images are never kept).
 */
interface Manifest {
  seed: number; expected_symbols: number; qr_pages: number[]; decoder: string; original_bytes: number;
  variants: { id: string; axis: string; param: string; recipe: Record<string, unknown>; dir: string; files: string[];
    first_page_px: number[]; zxing: { symbols: number; recovered: boolean } }[];
}
const python = qrPython();
const enabled = process.env.UNALTERED_QR_ROBUSTNESS === '1';
// The default (automatic ECC) certificate gets every axis; the H certificate repeats the damage-sensitive axes only,
// to keep the shared-CPU run modest (tens of variants per axis, deterministic seed).
const certificates: { name: string; size: number; level: Level; axes: string }[] = [
  { name: 'receipt-3145B-auto', size: 3000, level: 'auto', axes: '' },
  { name: 'receipt-3145B-H', size: 3000, level: 'H', axes: 'blur,occlusion,camera' },
];
const only = process.env.UNALTERED_QR_ROBUSTNESS_AXES ?? '';
// Optional: keep the corpus outside test-results (which Playwright empties) and reuse it, so two builds (for example
// before and after a scan-pipeline change) are measured on byte-identical images.
const corpusRoot = process.env.UNALTERED_QR_ROBUSTNESS_DIR ? resolve(process.env.UNALTERED_QR_ROBUSTNESS_DIR) : null;
// Optional: an earlier report from this runner; its in-app outcome per variant is embedded as inapp_baseline.
type Outcome = { recovered: boolean; ms: number };
const baseline = new Map<string, Outcome>();
if (process.env.UNALTERED_QR_ROBUSTNESS_BASELINE) {
  const earlier = JSON.parse(readFileSync(resolve(process.env.UNALTERED_QR_ROBUSTNESS_BASELINE), 'utf8')) as
    { certificates: { certificate: string; variants: { id: string; inapp: Outcome }[] }[] };
  for (const c of earlier.certificates) for (const v of c.variants) baseline.set(`${c.certificate}/${v.id}`, v.inapp);
}

test.describe('archival QR distortion corpus: in-app jsQR worker vs zxing-cpp', () => {
  test.skip(!enabled || !python, !enabled ? 'Opt-in: set UNALTERED_QR_ROBUSTNESS=1 to run the distortion corpus.' : ABSENT_MESSAGE);
  test('measure recovery per variant', async ({ page, context }) => {
    test.setTimeout(3 * 60 * 60_000);
    const root = resolve('test-results/qr-robustness'); mkdirSync(root, { recursive: true });
    const summary: Record<string, unknown>[] = [];
    for (const certificate of certificates) {
      const directory = resolve(corpusRoot ?? root, certificate.name); mkdirSync(directory, { recursive: true });
      const original = archivalReceiptFixture(certificate.size);
      const pdf = resolve(directory, 'certificate.pdf');
      let printed: Awaited<ReturnType<typeof printCertificate>>;
      if (corpusRoot && existsSync(resolve(directory, 'corpus/manifest.json')) && existsSync(resolve(directory, 'printed.json'))) {
        expect(readFileSync(resolve(directory, 'original.ots'))).toEqual(Buffer.from(original));
        printed = JSON.parse(readFileSync(resolve(directory, 'printed.json'), 'utf8')) as typeof printed;
      } else {
        writeFileSync(resolve(directory, 'original.ots'), original);
        await context.setOffline(false);
        printed = await printCertificate(page, original, certificate.level, 'a4', pdf);
        const generated = runJson<{ variants: number }>(python!, [resolve('tests/archival/qr_distort.py'), 'generate',
          '--pdf', pdf, '--original', resolve(directory, 'original.ots'), '--out', resolve(directory, 'corpus'),
          ...(only || certificate.axes ? ['--axes', only || certificate.axes] : [])], 30 * 60_000);
        expect(generated.status).toBe(0);
        writeFileSync(resolve(directory, 'printed.json'), JSON.stringify(printed));
      }
      const manifest = JSON.parse(readFileSync(resolve(directory, 'corpus/manifest.json'), 'utf8')) as Manifest;
      await page.goto('/Unaltered/#verify');
      await context.setOffline(true);
      const results: Record<string, unknown>[] = [];
      for (const variant of manifest.variants) {
        const files = variant.files.map(name => resolve(directory, 'corpus', variant.dir, name));
        await page.getByLabel('Choose QR images or binary frame files').setInputFiles(files);
        const status = page.locator('.archival-recovery [role="status"]');
        await expect(status).toContainText(String(files.length));
        const started = Date.now();
        await page.getByRole('button', { name: 'Recover receipt from QR images' }).click();
        await expect(status).toHaveText(/^(Recovered|Recovery failed)/, { timeout: files.length * 125_000 });
        const ms = Date.now() - started;
        const recovered = (await status.textContent())!.startsWith('Recovered');
        if (recovered) {
          const [download] = await Promise.all([page.waitForEvent('download'),
            page.getByRole('link', { name: 'Download recovered .ots receipt' }).click()]);
          // Never a wrong receipt: any in-app recovery must be the exact original bytes.
          expect(readFileSync((await download.path())!)).toEqual(Buffer.from(original));
        }
        if (variant.axis === 'clean') { expect(recovered).toBe(true); expect(variant.zxing.recovered).toBe(true); }
        const before = baseline.get(`${certificate.name}/${variant.id}`);
        results.push({ id: variant.id, axis: variant.axis, param: variant.param, recipe: variant.recipe,
          px: variant.first_page_px, zxing: variant.zxing, inapp: { recovered, ms }, ...(before ? { inapp_baseline: before } : {}) });
        test.info().annotations.push({ type: 'variant', description: `${certificate.name} ${variant.id}: in-app ${recovered ? 'OK' : '--'} (${ms} ms), zxing ${variant.zxing.recovered ? 'OK' : '--'} ${variant.zxing.symbols}/${manifest.expected_symbols}` });
      }
      const axes: Record<string, { variants: number; inapp: number; inapp_baseline?: number; zxing: number; both: number; zxing_only: number; inapp_only: number }> = {};
      for (const r of results as { axis: string; zxing: { recovered: boolean }; inapp: Outcome; inapp_baseline?: Outcome }[]) {
        const a = axes[r.axis] ??= { variants: 0, inapp: 0, zxing: 0, both: 0, zxing_only: 0, inapp_only: 0 };
        a.variants++; if (r.inapp.recovered) a.inapp++; if (r.zxing.recovered) a.zxing++;
        if (r.inapp_baseline) a.inapp_baseline = (a.inapp_baseline ?? 0) + (r.inapp_baseline.recovered ? 1 : 0);
        if (r.inapp.recovered && r.zxing.recovered) a.both++;
        if (!r.inapp.recovered && r.zxing.recovered) a.zxing_only++;
        if (r.inapp.recovered && !r.zxing.recovered) a.inapp_only++;
      }
      const labels = printed.labels;
      summary.push({ certificate: certificate.name, level: certificate.level, receipt_bytes: original.length,
        symbols: labels.length, qr_version: labels[0]!.version, ecc: labels[0]!.level, pages: printed.pages,
        qr_pages: manifest.qr_pages, seed: manifest.seed, axes, variants: results });
      writeFileSync(resolve(directory, 'results.json'), JSON.stringify(summary.at(-1), null, 1));
    }
    const report = {
      schema: 'unaltered-qr-robustness/1',
      purpose: 'Synthetic camera-like distortions of Chromium-printed archival QR certificates; recovery per variant.',
      generator: 'tests/archival/qr_distort.py', runner: 'tests/qualification/qr-robustness.spec.ts',
      inapp: 'Chromium file input -> qr-scan worker (jsQR 1.4.0) -> frame reassembly -> .ots parse, offline',
      independent: (runJson<{ decoder: string }>(python!, [resolve('tests/archival/zxing_qr.py'), 'probe']).value.decoder) +
        ' + scripts/recover-archival-qr.py',
      rasterizer: spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' }).stderr.trim().split('\n')[0] || 'pdftoppm',
      chromium: page.context().browser()?.version() ?? 'unknown',
      build: process.env.UNALTERED_QR_ROBUSTNESS_BUILD ?? 'working tree',
      ...(baseline.size ? { baseline: process.env.UNALTERED_QR_ROBUSTNESS_BASELINE_LABEL ?? 'earlier run' } : {}),
      recovered_means: 'every symbol of the certificate decoded and the exact original .ots bytes reassembled',
      not_covered: 'real printers, paper, inks and phone cameras (human evidence still required)',
      certificates: summary,
    };
    writeFileSync(resolve(root, 'results.json'), JSON.stringify(report, null, 1));
    if (process.env.UNALTERED_QR_ROBUSTNESS_OUT) writeFileSync(resolve(process.env.UNALTERED_QR_ROBUSTNESS_OUT), JSON.stringify(report) + '\n');
  });
});

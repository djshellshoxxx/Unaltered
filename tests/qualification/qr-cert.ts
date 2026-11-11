import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

/** Shared helpers for the opt-in independent-decoder and robustness qualification specs. */
export type Level = 'auto' | 'L' | 'M' | 'Q' | 'H';
export type Paper = 'a4' | 'letter';
export interface SymbolLabel { index: number; total: number; version: number; level: string; mask: number; frameBytes: number }

export const ZXING_TOOL = resolve('tests/archival/zxing_qr.py');
export const ABSENT_MESSAGE = 'Independent QR decoder absent. To run: python3 -m venv .venv-qr && ' +
  '.venv-qr/bin/pip install --require-hashes --no-deps -r tests/archival/requirements.txt && ' +
  'export UNALTERED_QR_PYTHON="$PWD/.venv-qr/bin/python" (needs zxing-cpp, Pillow and pdftoppm).';

/** The interpreter with zxing-cpp and Pillow, or null when the opt-in decoder is not installed. */
export function qrPython(): string | null {
  const python = process.env.UNALTERED_QR_PYTHON ?? 'python3';
  const probe = spawnSync(python, ['-I', ZXING_TOOL, 'probe'], { encoding: 'utf8' });
  const tool = spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' });
  return probe.status === 0 && tool.status === 0 ? python : null;
}

export function runJson<T>(python: string, args: string[], timeout = 600_000): { status: number; value: T } {
  const run = spawnSync(python, ['-I', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout });
  if (run.error) throw run.error;
  const line = run.stdout.trim().split('\n').pop() ?? '';
  try { return { status: run.status ?? -1, value: JSON.parse(line) as T }; } catch {
    throw new Error(`Python tool failed (${String(run.status)}): ${run.stderr.slice(-2000)}`);
  }
}

/** Builds a certificate through the real UI and prints it with Chromium's PDF backend (as Save as PDF does). */
export async function printCertificate(page: Page, receipt: Uint8Array, level: Level, paper: Paper, pdf: string):
  Promise<{ pages: number; labels: SymbolLabel[] }> {
  await page.goto('/Unaltered/#verify');
  await page.getByLabel('Choose a .ots receipt for a QR certificate').setInputFiles({
    name: 'qualification.ots', mimeType: 'application/octet-stream', buffer: Buffer.from(receipt) });
  await page.locator('.archival-import summary').click();
  await page.locator(`.archival-import input[value="${level}"]`).check();
  await page.locator(`.archival-import input[value="${paper}"]`).check();
  await page.getByRole('button', { name: 'Preview QR certificate', exact: true }).click();
  await expect(page.locator('.archival-preview')).toBeVisible();
  const pages = await page.locator('.archival-page').count();
  const labels = await page.locator('.unaltered-archival-symbol').evaluateAll(nodes => nodes.map(node => [
    node.querySelector('h2')?.textContent ?? '', node.querySelector('p')?.textContent ?? '']));
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  expect(Number(/^Pages:\s+(\d+)/m.exec(info)?.[1])).toBe(pages);
  return { pages, labels: labels.map(([heading, text]) => {
    const h = /^QR (\d+) \/ (\d+)$/.exec(heading ?? '');
    const p = /V(\d+); \d+ × \d+ modules; ECC ([LMQH]); mask (\d); byte mode; (\d+) frame bytes\./.exec(text ?? '');
    if (!h || !p) throw new Error('Unexpected symbol label: ' + heading + ' / ' + text);
    return { index: Number(h[1]) - 1, total: Number(h[2]), version: Number(p[1]), level: p[2]!, mask: Number(p[3]), frameBytes: Number(p[4]) };
  }) };
}

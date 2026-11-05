// Structural contract for preparation: successful validation may upload deployable files, but cannot publish them.
// This bounded reader handles this workflow's mapping/step layout, and assertions fail if required blocks disappear.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync(new URL('../../.github/workflows/pages-readiness.yml', import.meta.url), 'utf8');
const lines = source.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim() && !line.trimStart().startsWith('#'));
function block(key: string): string[] {
  const start = lines.findIndex((line) => line === `${key}:`);
  expect(start, `missing ${key} mapping`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((line, i) => i > start && /^\S/.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

type Step = { uses?: string; run?: string; with: Record<string, string> };
const steps: Step[] = [];
for (const line of block('jobs')) {
  const start = /^ {6}- ([\w-]+):\s*(.*)$/.exec(line);
  if (start) {
    const step: Step = { with: {} };
    if (start[1] === 'uses' || start[1] === 'run') step[start[1]] = start[2]!.split(/\s+#/)[0];
    steps.push(step);
  } else if (steps.length) {
    const scalar = /^ {8}(uses|run):\s*(.*)$/.exec(line);
    if (scalar) steps.at(-1)![scalar[1] as 'uses' | 'run'] = scalar[2]!.split(/\s+#/)[0];
    const input = /^ {10}([\w-]+):\s*(.*)$/.exec(line);
    if (input) steps.at(-1)!.with[input[1]!] = input[2]!.replace(/^['"](.*)['"]$/, '$1');
  }
}

it('Pages preparation can run only manually and grants no publication capability', () => {
  expect(block('on').map((line) => line.trim())).toEqual(['workflow_dispatch:']);
  expect(block('permissions').map((line) => line.trim())).toEqual(['contents: read']);
  expect(lines.filter((line) => /^\s*permissions:/.test(line))).toHaveLength(1);
  expect(lines.filter((line) => /^ {2}[\w-]+:$/.test(line) && block('jobs').includes(line))).toHaveLength(1);
  expect(source).not.toMatch(/^\s*(?:environment|continue-on-error):/m);
  const allowed = new Set(['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'actions/upload-pages-artifact']);
  for (const step of steps) {
    if (step.uses) {
      const action = /^([^@]+)@([0-9a-f]{40})$/.exec(step.uses);
      expect(action, `action must use a full commit pin: ${step.uses}`).not.toBeNull();
      expect(allowed.has(action![1]!)).toBe(true);
    }
  }
  expect(steps.length).toBeGreaterThan(0);
});

it('both review and official Pages artifacts require install, checks, build and strict subpath browser acceptance', () => {
  const index = (pattern: RegExp) => steps.findIndex((step) => pattern.test(step.run ?? ''));
  const gates = [
    index(/^npm ci\s+--ignore-scripts$/),
    index(/^npm run check$/),
    index(/^npm run build$/),
    index(/\bplaywright install\b.*\bchromium$/),
    index(/\bplaywright test\s+tests\/e2e\/pages-base-path\.spec\.ts\s+--retries=0$/),
  ];
  for (const gate of gates) expect(gate, 'missing required acceptance gate').toBeGreaterThanOrEqual(0);
  expect(gates).toEqual([...gates].sort((a, b) => a - b));
  const pages = steps.findIndex((step) => step.uses?.startsWith('actions/upload-pages-artifact@'));
  const review = steps.findIndex((step) => step.uses?.startsWith('actions/upload-artifact@'));
  expect(pages, 'missing official Pages upload').toBeGreaterThan(gates.at(-1)!);
  expect(review, 'missing downloadable review site').toBeGreaterThan(gates.at(-1)!);
  expect(steps[pages]!.with.name).toBe('github-pages');
  for (const index of [pages, review]) {
    expect(steps[index]!.with.path!.replace(/^\.\//, '').replace(/\/$/, '')).toBe('dist/web');
    expect(Number(steps[index]!.with['retention-days'])).toBeGreaterThan(0);
  }
  // Conditional or ignored failures could upload artifacts that never passed a gate.
  expect(source).not.toMatch(/^\s*(?:if|continue-on-error):/m);
  expect(steps.filter((step) => step.run).map((step) => step.run)).toHaveLength(gates.length);
});

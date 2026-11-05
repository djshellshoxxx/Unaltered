// Offline policy checks for the inactive deployment template. No workflow is dispatched by these tests.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Bounded YAML reader for mapping/step/quoted-scalar layouts used by these two files. Reject unsupported syntax
// instead of silently skipping it. A full YAML parse is also part of the documented local preparation review.
type Mapping = Record<string, any>;
function parse(source: string): Mapping {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => {
      if (/\t/.test(line)) throw new Error('unsupported YAML tab');
      return { indent: line.length - line.trimStart().length, text: line.trim().replace(/\s+#.*$/, '') };
    });
  let cursor = 0;
  const scalar = (text: string): unknown => {
    if (text === '{}') return {};
    if (text === 'true' || text === 'false') return text === 'true';
    if (/^\d+$/.test(text)) return Number(text);
    if (/^'.*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");
    if (/^".*"$/.test(text)) return JSON.parse(text);
    if (/^[|>&*![\]{}]/.test(text) || /:\s/.test(text)) throw new Error(`unsupported YAML scalar: ${text}`);
    return text;
  };
  const entry = (text: string, result: Mapping, indent: number): void => {
    const match = /^([\w-]+):(?: (.*))?$/.exec(text);
    if (!match) throw new Error(`unsupported YAML entry: ${text}`);
    const key = match[1]!;
    if (Object.hasOwn(result, key)) throw new Error(`duplicate YAML key: ${key}`);
    result[key] = match[2] !== undefined ? scalar(match[2])
      : lines[cursor] && lines[cursor]!.indent > indent ? block(lines[cursor]!.indent) : null;
  };
  const block = (indent: number): Mapping | Mapping[] => {
    const sequence = lines[cursor]!.text.startsWith('- ');
    const result: Mapping = {};
    const items: Mapping[] = [];
    while (cursor < lines.length && lines[cursor]!.indent === indent) {
      const line = lines[cursor++]!;
      if (sequence) {
        if (!line.text.startsWith('- ')) throw new Error('mixed YAML block');
        const item: Mapping = {};
        entry(line.text.slice(2), item, indent + 2);
        if (lines[cursor] && lines[cursor]!.indent > indent) {
          if (lines[cursor]!.indent !== indent + 2) throw new Error('unsupported step indentation');
          const rest = block(indent + 2);
          if (Array.isArray(rest)) throw new Error('unsupported nested sequence');
          for (const key of Object.keys(rest)) {
            if (Object.hasOwn(item, key)) throw new Error(`duplicate step key: ${key}`);
            item[key] = rest[key];
          }
        }
        items.push(item);
      } else {
        entry(line.text, result, indent);
      }
    }
    return sequence ? items : result;
  };
  const result = block(0);
  if (cursor !== lines.length || Array.isArray(result)) throw new Error('unsupported YAML root/indentation');
  return result;
}

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const template = parse(read('docs/templates/pages-deployment.yml'));
const readiness = parse(read('.github/workflows/pages-readiness.yml'));
const prepare = template.jobs.prepare;
const deploy = template.jobs.deploy;

function verifyInstalledWorkflows(workflowDirectory: string): void {
  const installed = join(workflowDirectory, 'pages-deployment.yml');
  if (existsSync(installed)) expect(parse(readFileSync(installed, 'utf8'))).toEqual(template);
  for (const file of readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name))) {
    if (file !== 'pages-deployment.yml') {
      expect(readFileSync(join(workflowDirectory, file), 'utf8'))
        .not.toMatch(/uses:\s*actions\/(?:deploy|configure)-pages@/);
    }
  }
}

it('is manual, disabled by default, and grants capabilities only to the job that needs them', () => {
  verifyInstalledWorkflows(fileURLToPath(new URL('.github/workflows/', root)));
  expect(Object.keys(template.on)).toEqual(['workflow_dispatch']);
  expect(template.on.workflow_dispatch.inputs.authorize_deployment).toMatchObject({ type: 'boolean', required: true, default: false });
  expect(template.on.workflow_dispatch.inputs.reviewed_commit).toMatchObject({ type: 'string', required: true, default: '' });
  expect(template.permissions).toEqual({});
  expect(Object.keys(template.jobs).sort()).toEqual(['deploy', 'prepare']);
  expect(prepare.permissions).toEqual({ contents: 'read' });
  expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  expect(deploy.environment).toEqual({ name: 'github-pages', url: '${{ steps.deployment.outputs.page_url }}' });
  expect(template.concurrency).toEqual({ group: 'pages-publication', 'cancel-in-progress': false });
  for (const job of [prepare, deploy]) {
    expect(job['continue-on-error']).toBeUndefined();
    expect(job.secrets).toBeUndefined();
    expect(job['runs-on']).toBe('ubuntu-latest');
  }
});

it('preserves the readiness gates and only consumes its successful same-run official artifact', () => {
  const base = readiness.jobs.prepare;
  // Semantic objects ignore comments/formatting while detecting skipped checks, artifact drift and changed flags.
  expect(prepare.steps.slice(1)).toEqual(base.steps);
  expect(prepare.env).toEqual(base.env);
  expect(prepare['timeout-minutes']).toBe(base['timeout-minutes']);
  expect(deploy.needs).toBe('prepare');
  expect(deploy.steps).toHaveLength(1);
  const step = deploy.steps[0];
  expect(step.id).toBe('deployment');
  expect(step.run).toBeUndefined();
  expect(step.if).toBeUndefined();
  expect(step['continue-on-error']).toBeUndefined();
  const uploads = prepare.steps.filter((s: Mapping) => s.uses?.startsWith('actions/upload-pages-artifact@'));
  expect(uploads).toHaveLength(1);
  expect(step.with).toEqual({ artifact_name: uploads[0].with.name, preview: false });
  expect(step.with.artifact_name).toBe('github-pages');
  expect(uploads[0].with.path.replace(/\/$/, '')).toBe('dist/web');
  for (const gate of prepare.steps) {
    expect(gate.if).toBeUndefined();
    expect(gate['continue-on-error']).toBeUndefined();
  }
});

// Deliberately limited interpreter for the documented AND-only authorization expressions. Unknown terms fail
// closed. This exercises the actual template expressions across rejected dispatch/ref/SHA/result combinations.
function eligible(expression: string, context: { event: string; authorized: boolean; ref: string; defaultBranch: string; reviewed: string; sha: string; result: string }): boolean {
  const terms: Record<string, () => boolean> = {
    "github.event_name == 'workflow_dispatch'": () => context.event.toLowerCase() === 'workflow_dispatch',
    'inputs.authorize_deployment': () => context.authorized,
    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)": () => context.ref.toLowerCase() === `refs/heads/${context.defaultBranch}`.toLowerCase(),
    'inputs.reviewed_commit == github.sha': () => context.reviewed.toLowerCase() === context.sha.toLowerCase(),
    "needs.prepare.result == 'success'": () => context.result.toLowerCase() === 'success',
  };
  return expression.split(/\s*&&\s*/).map((term) => {
    if (!terms[term]) throw new Error(`unreviewed authorization expression: ${term}`);
    return terms[term]!();
  }).every(Boolean);
}

it('models native case-insensitive guards for unapproved, non-default, stale and unsuccessful runs', () => {
  const accepted = { event: 'workflow_dispatch', authorized: true, ref: 'refs/heads/main', defaultBranch: 'main', reviewed: 'a'.repeat(40), sha: 'a'.repeat(40), result: 'success' };
  for (const job of [prepare, deploy]) {
    expect(eligible(job.if, accepted)).toBe(true);
    for (const rejected of [
      { event: 'push' }, { authorized: false }, { ref: 'refs/heads/candidate' }, { ref: 'refs/tags/main' },
      { reviewed: '' }, { reviewed: 'b'.repeat(40) }, { reviewed: 'a'.repeat(7) }, { defaultBranch: 'trunk' },
    ]) expect(eligible(job.if, { ...accepted, ...rejected }), JSON.stringify(rejected)).toBe(false);
    expect(eligible(job.if, { ...accepted, defaultBranch: 'trunk', ref: 'refs/heads/trunk' })).toBe(true);
  }
  for (const result of ['failure', 'cancelled', 'skipped', '']) expect(eligible(deploy.if, { ...accepted, result })).toBe(false);
});

it('executes a case-sensitive preflight before checkout and all readiness gates', () => {
  const preflight = prepare.steps[0];
  expect(preflight.shell).toBe('bash');
  expect(preflight.env).toEqual({
    PAGES_DEFAULT_BRANCH: '${{ github.event.repository.default_branch }}',
    PAGES_REVIEWED_COMMIT: '${{ inputs.reviewed_commit }}',
  });
  expect(preflight.run).not.toContain('${{');
  expect(preflight.uses).toBeUndefined();
  const accepted = { event: 'workflow_dispatch', authorized: true, ref: 'refs/heads/main', defaultBranch: 'main', reviewed: 'a'.repeat(40), sha: 'a'.repeat(40), result: 'success' };
  const execute = (context: typeof accepted) => spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', preflight.run], {
    env: { ...process.env, GITHUB_REF: context.ref, GITHUB_SHA: context.sha, PAGES_DEFAULT_BRANCH: context.defaultBranch, PAGES_REVIEWED_COMMIT: context.reviewed },
    encoding: 'utf8',
  });
  expect(execute(accepted).status).toBe(0);
  expect(execute({ ...accepted, defaultBranch: 'Main', ref: 'refs/heads/Main' }).status).toBe(0);
  for (const rejected of [
    { ref: 'refs/heads/Main' }, { defaultBranch: 'Main' }, { reviewed: 'A'.repeat(40) },
    { reviewed: 'b'.repeat(40) }, { reviewed: '' }, { reviewed: 'a'.repeat(7) },
    { defaultBranch: 'main*' }, { reviewed: '$(exit 0)' },
  ]) {
    const context = { ...accepted, ...rejected };
    const outcome = execute(context);
    expect(outcome.error).toBeUndefined();
    expect(outcome.status, JSON.stringify(rejected)).not.toBe(0);
    expect(eligible(deploy.if, { ...context, result: 'failure' })).toBe(false);
  }
  // Native Actions == alone accepts case-only differences. The shell preflight closes that preparation gap.
  expect(eligible(prepare.if, { ...accepted, ref: 'refs/heads/Main' })).toBe(true);
  expect(eligible(prepare.if, { ...accepted, reviewed: 'A'.repeat(40) })).toBe(true);
});

it('accepts a future exact template installation in an isolated fixture tree and rejects altered installation', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'unaltered-pages-activation-'));
  try {
    const workflows = join(fixture, '.github', 'workflows');
    mkdirSync(workflows, { recursive: true });
    const installed = join(workflows, 'pages-deployment.yml');
    writeFileSync(installed, read('docs/templates/pages-deployment.yml'));
    verifyInstalledWorkflows(workflows);
    writeFileSync(installed, read('docs/templates/pages-deployment.yml').replace('default: false', 'default: true'));
    expect(() => verifyInstalledWorkflows(workflows)).toThrow();
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

it('allows only reviewed official full-SHA action contracts and no credential override', () => {
  const reviewed: Record<string, string> = {
    'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
    'actions/upload-artifact': 'cf430e030ddbb5b0abf93d22962f4752f3646cd9',
    'actions/upload-pages-artifact': 'fc324d3547104276b827a68afc52ff2a11cc49c9',
    'actions/deploy-pages': '368f82528645a54fb793d4d04e342629a3f51346',
  };
  const actions = [...prepare.steps, ...deploy.steps].filter((step) => step.uses);
  expect(actions).toHaveLength(Object.keys(reviewed).length);
  for (const step of actions) {
    const match = /^([^@]+)@([a-f0-9]{40})$/.exec(step.uses);
    expect(match, 'official action must use reviewed full commit SHA').not.toBeNull();
    expect(reviewed[match![1]!]).toBe(match![2]);
    expect(step.with?.token).toBeUndefined();
    expect(step.with?.['ssh-key']).toBeUndefined();
  }
  expect(actions.find((step) => step.uses.startsWith('actions/checkout@')).with).toEqual({ 'persist-credentials': false });
  expect(actions.find((step) => step.uses.startsWith('actions/setup-node@')).with).toEqual({ 'node-version': 22 });
  expect(deploy.steps[0].uses.split('@')[0]).toBe('actions/deploy-pages');
});

it('fails closed when its bounded YAML reader cannot establish the workflow structure', () => {
  expect(() => parse('jobs:\n  prepare: {}\n  prepare: {}')).toThrow(/duplicate/);
  expect(() => parse('jobs:\n  prepare: &alias')).toThrow(/unsupported/);
});

import { sha256 } from '@noble/hashes/sha2.js';
import type { BrowserContext, Page } from '@playwright/test';
import { fromHex, toHex } from '../../src/core/bytes';
import { serializeTree } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';
import { concat } from '../../src/core/bytes';
import { makeHeader } from '../helpers/chain';

const CORS = { 'access-control-allow-origin': '*' };

export interface Chain {
  /** merkle root by height */
  roots: Map<number, Uint8Array>;
  digestPosts: string[];
  timestampGets: string[];
  confirmed: boolean;
  /** which explorer hosts disagree */
  skew: Set<string>;
}

export async function installNetwork(ctx: BrowserContext, opts: { confirm?: boolean } = {}): Promise<Chain> {
  const chain: Chain = { roots: new Map(), digestPosts: [], timestampGets: [], confirmed: opts.confirm ?? false, skew: new Set() };
  const HEIGHT = 840_000;
  const calHosts = ['alice.btc.calendar.opentimestamps.org', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com'];
  for (const host of calHosts) {
    await ctx.route(`https://${host}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*' } });
      if (url.pathname === '/digest') {
        const body = new Uint8Array(req.postDataBuffer() ?? Buffer.alloc(0));
        chain.digestPosts.push(toHex(body));
        const node: TsNode = { msg: body, attestations: [{ kind: 'pending', uri: `https://${host}` }], children: [] };
        return route.fulfill({ status: 200, headers: CORS, body: Buffer.from(serializeTree(node)) });
      }
      const m = /^\/timestamp\/([0-9a-f]+)$/.exec(url.pathname);
      if (m) {
        chain.timestampGets.push(m[1]!);
        if (!chain.confirmed) return route.fulfill({ status: 404, headers: CORS, body: 'Pending confirmation in Bitcoin blockchain' });
        const commitment = fromHex(m[1]!);
        const extra = Uint8Array.of(1, 2, 3, 4);
        const append = concat(commitment, extra);
        const root = sha256(append);
        chain.roots.set(HEIGHT, root);
        const end: TsNode = { msg: root, attestations: [{ kind: 'bitcoin', height: HEIGHT }], children: [] };
        const mid: TsNode = { msg: append, attestations: [], children: [{ op: { kind: 'sha256' }, node: end }] };
        const top: TsNode = { msg: commitment, attestations: [], children: [{ op: { kind: 'append', arg: extra }, node: mid }] };
        return route.fulfill({ status: 200, headers: CORS, body: Buffer.from(serializeTree(top)) });
      }
      return route.fulfill({ status: 404, headers: CORS, body: 'no' });
    });
  }
  for (const host of ['mempool.space', 'blockstream.info']) {
    await ctx.route(`https://${host}/**`, async (route) => {
      const url = new URL(route.request().url());
      const root = chain.roots.get(HEIGHT);
      const hdr = (): ReturnType<typeof makeHeader> | null => (root ? makeHeader(root, 1_760_000_000, chain.skew.has(host) ? 99 : 0) : null);
      let m = /^\/api\/block-height\/(\d+)$/.exec(url.pathname);
      if (m) {
        const h = hdr();
        return h && Number(m[1]) === HEIGHT ? route.fulfill({ status: 200, headers: CORS, body: h.hashHex }) : route.fulfill({ status: 404, headers: CORS, body: 'Block not found' });
      }
      m = /^\/api\/block\/([0-9a-f]{64})\/header$/.exec(url.pathname);
      if (m) {
        const h = hdr();
        return h && h.hashHex === m[1] ? route.fulfill({ status: 200, headers: CORS, body: toHex(h.raw) }) : route.fulfill({ status: 404, headers: CORS, body: 'Block not found' });
      }
      return route.fulfill({ status: 404, headers: CORS, body: 'no' });
    });
  }
  return chain;
}

/** Fail the test on any CSP violation or page error. Call before navigation. */
export async function watchViolations(page: Page): Promise<{ list: string[] }> {
  const state = { list: [] as string[] };
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  page.on('pageerror', (e) => state.list.push(`pageerror: ${e.message}`));
  return state;
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
}

export const bytesOf = (s: string): Buffer => Buffer.from(s, 'utf8');
export const sha256hex = (b: Uint8Array): string => toHex(sha256(b));

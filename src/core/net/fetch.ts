// The ONLY module that calls fetch() (SPEC section 9, enforced by tests/unit/no-fetch.test.ts and ESLint).
import { UnalteredError } from '../errors';
import { ALLOWED_HOSTS } from './allowlist';

export interface NetPolicy {
  allowedHosts: ReadonlySet<string>;
  timeoutMs: number;
  maxBytes: number;
  /** Test seam only. Production code never sets this. */
  fetchImpl?: typeof fetch;
  /** Test seam only: permit http://localhost style URLs. */
  allowInsecure?: boolean;
}

export const DEFAULT_POLICY: NetPolicy = {
  allowedHosts: ALLOWED_HOSTS,
  timeoutMs: 15_000,
  maxBytes: 256 * 1024,
};

export interface NetRequest {
  method?: 'GET' | 'POST';
  body?: Uint8Array;
  headers?: Record<string, string>;
  signal?: AbortSignal | undefined;
}

export interface NetResponse {
  status: number;
  bytes: Uint8Array;
}

export function checkUrl(raw: string, policy: NetPolicy): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnalteredError('NET_BLOCKED', 'Blocked an invalid address.');
  }
  const httpsOk = u.protocol === 'https:' || (policy.allowInsecure === true && u.protocol === 'http:');
  if (!httpsOk || u.username !== '' || u.password !== '' || (u.port !== '' && policy.allowInsecure !== true)) {
    throw new UnalteredError('NET_BLOCKED', 'Blocked a connection that is not plain HTTPS.');
  }
  if (!policy.allowedHosts.has(u.host)) {
    throw new UnalteredError('NET_BLOCKED', 'Blocked a connection to a server that is not on the allowed list.');
  }
  return u;
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = res.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) {
    throw new UnalteredError('NET_TOO_LARGE', 'A server reply was larger than allowed.');
  }
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      void reader.cancel();
      throw new UnalteredError('NET_TOO_LARGE', 'A server reply was larger than allowed.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export async function netFetch(rawUrl: string, req: NetRequest = {}, overrides: Partial<NetPolicy> = {}): Promise<NetResponse> {
  const policy: NetPolicy = { ...DEFAULT_POLICY, ...overrides };
  const url = checkUrl(rawUrl, policy);
  const timeout = AbortSignal.timeout(policy.timeoutMs);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  const f = policy.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    const init: RequestInit = {
      method: req.method ?? 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      redirect: 'error',
      mode: 'cors',
      signal,
    };
    if (req.headers) init.headers = req.headers;
    if (req.body) init.body = req.body as BodyInit;
    res = await f(url.href, init);
    const bytes = await readCapped(res, policy.maxBytes);
    return { status: res.status, bytes };
  } catch (e) {
    if (e instanceof UnalteredError) throw e;
    if (req.signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
    if (timeout.aborted) throw new UnalteredError('NET_TIMEOUT', 'A server took too long to answer.');
    throw new UnalteredError('NET_FAILED', 'Could not reach a server.');
  }
}

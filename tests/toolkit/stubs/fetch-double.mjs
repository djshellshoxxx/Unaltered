// Test double for globalThis.fetch, preloaded (node --import) by tests/toolkit/network-check.test.mjs into
// scripts/network-check.mjs. No network. Calendar POST /digest and explorer /header replies are streamed bodies of
// NETCHECK_BODY_BYTES bytes; every other request answers like a healthy service. On exit it prints, per streamed
// request, how many bytes the script pulled and whether it cancelled the rest.
import { ReadableStream } from 'node:stream/web';

const SIZE = Number(process.env.NETCHECK_BODY_BYTES);
const CHUNK = 64 * 1024;
const GENESIS_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const streams = {};

function streamed(key) {
  const stat = (streams[key] = { pulled: 0, cancelled: false });
  return new ReadableStream({
    pull(controller) {
      if (stat.pulled >= SIZE) return controller.close();
      const length = Math.min(CHUNK, SIZE - stat.pulled);
      stat.pulled += length;
      controller.enqueue(new Uint8Array(length).fill(0x41));
    },
    cancel() { stat.cancelled = true; },
  }, { highWaterMark: 0 });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  const headers = { 'access-control-allow-origin': '*' };
  if (url.pathname === '/digest' && method === 'POST') return new Response(streamed(`${url.host} POST /digest`), { status: 200, headers });
  if (url.pathname === '/digest') return new Response(null, { status: 204, headers });
  if (url.pathname.startsWith('/timestamp/')) return new Response('pending', { status: 404, headers });
  if (url.pathname === '/api/block-height/0') return new Response(GENESIS_HASH, { status: 200, headers });
  if (url.pathname.endsWith('/header')) return new Response(streamed(`${url.host} GET /header`), { status: 200, headers });
  return new Response('not found', { status: 404, headers });
};

process.on('exit', () => process.stderr.write(`NETCHECK_STREAMS ${JSON.stringify(streams)}\n`));

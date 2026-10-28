// Minimal static server for the built multi-file site, used by the opt-in live browser scripts.
// Serves only flat file names from dist/web on an ephemeral loopback port; no routing, mocks or relaxed headers.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export async function serveDist(root = resolve('dist/web')) {
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!/^\/[a-zA-Z0-9._-]+$/.test(path)) { res.writeHead(404).end(); return; }
      const body = await readFile(join(root, path));
      const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
      res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
  };
}

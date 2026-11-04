// Minimal static server for dist/web, at / and the GitHub Pages project prefix. Test tooling only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist', 'web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('invalid path');
    if (pathname === '/Unaltered') {
      res.writeHead(308, { location: '/Unaltered/' }).end();
      return;
    }
    if (pathname.startsWith('/Unaltered/')) pathname = pathname.slice('/Unaltered'.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) throw new Error('outside static root');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(4173, '127.0.0.1');

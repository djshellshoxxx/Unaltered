'use strict';
// Pure request/path policy for the desktop shell (no Electron imports, unit-testable).
const path = require('node:path');

const SCHEME = 'app';
const HOST = 'unaltered';
const ORIGIN = `${SCHEME}://${HOST}`;

function createPolicy(allowedHosts, webRoot) {
  const hosts = new Set(allowedHosts);
  const root = path.resolve(webRoot);

  function isAllowedRemote(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && u.port === '' && u.username === '' && u.password === '' &&
        hosts.has(u.hostname);
    } catch {
      return false;
    }
  }

  function isAllowedRequest(url) {
    if (url.startsWith(`${ORIGIN}/`) || url.startsWith('blob:') || url.startsWith('devtools:')) return true;
    return isAllowedRemote(url);
  }

  /** Map app://unaltered/<path> to a file under the web root, refusing traversal. */
  function resolveAppPath(requestUrl) {
    let u;
    try {
      u = new URL(requestUrl);
    } catch {
      return null;
    }
    if (u.protocol !== `${SCHEME}:` || u.host !== HOST) return null;
    let rel;
    try {
      rel = decodeURIComponent(u.pathname);
    } catch {
      return null;
    }
    if (rel.includes('\0')) return null;
    if (rel === '/' || rel === '') rel = '/index.html';
    const full = path.resolve(root, '.' + rel);
    if (!full.startsWith(root + path.sep)) return null;
    return full;
  }

  return { isAllowedRemote, isAllowedRequest, resolveAppPath };
}

module.exports = { SCHEME, HOST, ORIGIN, createPolicy };

'use strict';
// Unaltered desktop shell (ADR-008). Loads the unchanged web build from a private
// app:// origin inside a sandboxed renderer. The renderer gets no Node.js access and
// no preload; this file adds only containment around the web app:
//   - network requests limited to the same host allowlist as the web CSP (SPEC 9)
//   - no navigation away from the app, no new windows, no permissions
//   - external https links open in the user's default browser
const { app, BrowserWindow, Menu, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const allowlist = require('./allowlist.json');

const { ORIGIN, SCHEME, createPolicy } = require('./policy.cjs');

const WEB_ROOT = path.join(__dirname, 'web');
const { isAllowedRequest, resolveAppPath } = createPolicy(allowlist.hosts, WEB_ROOT);

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Sandbox every process. The only exception is an explicit --no-sandbox (needed when CI
// runs as root on Linux, where Chromium refuses its setuid sandbox); renderers keep
// webPreferences.sandbox either way.
if (!process.argv.includes('--no-sandbox')) app.enableSandbox();
// No crash reports, no component updates, no background networking from Chromium.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('no-pings');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), serial=(), hid=(), bluetooth=()',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveApp(request) {
  const file = resolveAppPath(request.url);
  const type = file && MIME[path.extname(file).toLowerCase()];
  if (!file || !type) return new Response('Not found', { status: 404 });
  try {
    const body = await fs.readFile(file);
    return new Response(body, { status: 200, headers: { 'Content-Type': type, ...SECURITY_HEADERS } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function hardenSession(ses) {
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  ses.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !isAllowedRequest(details.url) }));
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = { ...details.requestHeaders };
    delete headers.Referer;
    delete headers.Cookie;
    cb({ requestHeaders: headers });
  });
  ses.on('will-download', (_event, item) => {
    // Receipts and cleaned copies are created in-page as blob: URLs; anything else is refused.
    if (!item.getURL().startsWith('blob:')) item.cancel();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 360,
    minHeight: 480,
    title: 'Unaltered',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    }
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle(SCHEME, serveApp);
    hardenSession(session.defaultSession);
    createWindow();
  });

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  app.on('window-all-closed', () => app.quit());
}

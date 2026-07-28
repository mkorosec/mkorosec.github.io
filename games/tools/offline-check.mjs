/* Proves the offline claim.
 *
 * Loads the hub so the service worker installs and precaches, then switches
 * Chromium to offline and navigates to each game. Anything that still renders
 * came from the cache; anything that does not would be a blank page on a
 * plane. */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8232;
const CHROME = process.env.CHROME || 'chromium';

const PAGES = [
  ['index.html', `document.querySelectorAll('.card').length >= 10`],
  ['sudoku.html', `document.querySelectorAll('.sudoku-cell').length === 81`],
  ['wordle.html', `document.querySelectorAll('.wordle-tile').length === 30`],
  ['nonogram.html', `document.querySelectorAll('.nono-cell').length >= 100`],
  ['2048.html', `document.querySelectorAll('.t2048-cell').length === 16`],
  ['minesweeper.html', `document.querySelectorAll('.mine-cell').length === 81`],
];

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) || []).forEach((fn) => fn(msg.params, msg.sessionId));
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('connect failed')), { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }
}

const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--disable-dev-shm-usage', '--remote-debugging-port=9334',
  `--user-data-dir=${join(ROOT, '.offline-profile')}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const cleanup = () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); };
process.on('exit', cleanup);

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const res = await fetch('http://localhost:9334/json/version');
    if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
  } catch { /* not up */ }
  if (!wsUrl) await delay(250);
}

const browser = await CDP.connect(wsUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
const send = (m, p) => browser.send(m, p, sessionId);

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');

// Warm the cache.
console.log('  installing service worker…');
await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
await delay(2500);

const registered = await send('Runtime.evaluate', {
  expression: `navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false)`,
  awaitPromise: true, returnByValue: true,
});
if (registered.result.value !== true) {
  console.error('  FAIL  service worker did not activate');
  cleanup();
  process.exit(1);
}
console.log('  service worker active');

// Give precaching time to finish, then visit each page once online so any
// runtime-cached module is stored too.
await delay(2500);
for (const [page] of PAGES) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/${page}` });
  await delay(1800);
}

console.log('  going offline…');
await send('Network.emulateNetworkConditions', {
  offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
});

let failures = 0;
for (const [page, check] of PAGES) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/${page}` });
  await delay(2600);
  const result = await send('Runtime.evaluate', {
    expression: `(() => { try { return !!(${check}); } catch (e) { return false; } })()`,
    returnByValue: true,
  });
  const ok = result.result.value === true;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${page} (offline)`);
}

cleanup();
console.log(failures ? `\n${failures} page(s) unusable offline.` : '\nEvery page works with the network off.');
process.exit(failures ? 1 : 0);

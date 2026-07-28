/* Headless smoke test for the game pages.
 *
 * Loads every page in Chromium, fails on any console error or uncaught
 * exception, and runs a per-page assertion against the live DOM. Catches the
 * whole class of bugs that unit tests cannot: a bad import path, a null
 * element, a worker that never answers.
 *
 * Usage: node tools/smoke.mjs [--keep] [page...]
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8231;
const BASE = `http://localhost:${PORT}`;

const CHROME = process.env.CHROME || 'chromium';

/* Each page: how long to settle, and an expression that must evaluate true. */
const PAGES = [
  { url: 'index.html', settle: 1200,
    check: `document.querySelectorAll('.card').length >= 10` },
  { url: 'sudoku.html', settle: 6000,
    check: `document.querySelectorAll('.sudoku-cell').length === 81
            && [...document.querySelectorAll('.sudoku-cell')].filter(c => c.textContent.trim()).length > 15` },
  { url: 'wordle.html', settle: 2500,
    check: `document.querySelectorAll('.wordle-tile').length === 30
            && document.querySelectorAll('.key').length > 25` },
  { url: 'kakuro.html', settle: 6000,
    check: `document.querySelectorAll('.kakuro-cell').length > 30` },
  { url: 'nonogram.html', settle: 6000,
    check: `document.querySelectorAll('.nono-cell').length >= 100` },
  { url: 'minesweeper.html', settle: 4000,
    check: `document.querySelectorAll('.mine-cell').length === 81` },
  { url: 'killer.html', settle: 8000,
    check: `document.querySelectorAll('.killer-cell').length === 81` },
  // 28 cards dealt to the tableau plus the top of the stock; 21 of the
  // tableau cards start face down, as does the stock.
  { url: 'solitaire.html', settle: 2000,
    check: `document.querySelectorAll('.sol-card').length === 29
            && document.querySelectorAll('.sol-pile').length === 13
            && document.querySelectorAll('.sol-card.is-down').length === 22
            && document.querySelectorAll('.sol-slot').length === 5` },
  { url: '2048.html', settle: 1500,
    check: `document.querySelectorAll('.t2048-cell').length === 16
            && document.querySelectorAll('.t2048-tile').length >= 2` },
  { url: 'wordsearch.html', settle: 3000,
    check: `document.querySelectorAll('.ws-cell').length >= 100
            && document.querySelectorAll('.ws-word').length >= 4` },
  { url: 'hangman.html', settle: 2500,
    check: `document.querySelectorAll('.hm-slot').length >= 3
            && document.querySelectorAll('.key').length > 20` },
  { url: 'mastermind.html', settle: 1500,
    check: `document.querySelectorAll('.mm-setup-btn').length >= 2` },
];

/* --- tiny CDP client ------------------------------------------------------ */

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        // Flat sessions put sessionId at the top level of the message, not
        // inside params, so hand listeners the whole envelope.
        (this.listeners.get(msg.method) || []).forEach((fn) => fn(msg.params, msg.sessionId));
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP connect failed')), { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() { this.ws.close(); }
}

/* --- run ------------------------------------------------------------------ */

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const pages = only.length ? PAGES.filter((p) => only.some((o) => p.url.includes(o))) : PAGES;

const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs'), String(PORT)], {
  stdio: 'ignore', detached: false,
});

const profile = join(ROOT, '.smoke-profile');
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--disable-dev-shm-usage', '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let failures = 0;

function cleanup() {
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

async function browserWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://localhost:9333/json/version');
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await delay(250);
  }
  throw new Error('Chromium did not expose a debugging port');
}

const browser = await CDP.connect(await browserWsUrl());

for (const page of pages) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

  const send = (method, params = {}) => browser.send(method, params, sessionId);

  const problems = [];
  browser.on('Runtime.consoleAPICalled', (params, from) => {
    if (from !== sessionId) return;
    if (params.type !== 'error' && params.type !== 'warning') return;
    problems.push(`console.${params.type}: ${params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
  });
  browser.on('Runtime.exceptionThrown', (params, from) => {
    if (from !== sessionId) return;
    const d = params.exceptionDetails;
    problems.push(`uncaught: ${d.exception?.description || d.text}`);
  });
  browser.on('Log.entryAdded', (params, from) => {
    if (from !== sessionId) return;
    if (params.entry.level !== 'error') return;
    problems.push(`log: ${params.entry.text} ${params.entry.url || ''}`);
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');

  // Keep the run hermetic: never reach out to the analytics host. It would
  // make CI depend on a third party, and count.js logs a warning when it
  // decides not to count on localhost, which is not a page defect.
  await send('Network.setBlockedURLs', { urls: ['*gc.zgo.at*', '*goatcounter.com*'] });

  await send('Page.navigate', { url: `${BASE}/${page.url}` });
  await delay(page.settle);

  let ok = false;
  let detail = '';
  try {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { try { return !!(${page.check}); } catch (e) { return 'ERR ' + e.message; } })()`,
      returnByValue: true,
    });
    ok = result.result.value === true;
    if (!ok) detail = `assertion returned ${JSON.stringify(result.result.value)}`;
  } catch (err) {
    detail = err.message;
  }

  const hardProblems = problems.filter((p) =>
    !/favicon|manifest|Download error|net::ERR_FAILED.*sw\.js/i.test(p)
    // Analytics is blocked above; its load failure is expected, not a defect.
    && !/goatcounter|gc\.zgo\.at|ERR_BLOCKED_BY_CLIENT/i.test(p));
  if (hardProblems.length) ok = false;

  if (ok) {
    console.log(`  PASS  ${page.url}`);
  } else {
    failures++;
    console.log(`  FAIL  ${page.url}${detail ? ` — ${detail}` : ''}`);
    for (const p of hardProblems.slice(0, 6)) console.log(`          ${p}`);
  }

  await browser.send('Target.closeTarget', { targetId });
}

browser.close();
cleanup();

console.log(failures ? `\n${failures} page(s) failed.` : `\nAll ${pages.length} pages loaded cleanly.`);
process.exit(failures ? 1 : 0);

/* Generates every page shell, the web manifest and the service worker from
 * games.config.mjs.
 *
 * Why a generator: the seven original pages each carried their own copy of
 * the same 200 lines of CSS and <head> boilerplate, and sw.js kept a
 * hand-maintained precache list with a cache name that had to be bumped by
 * hand. Both drift silently. Here the head is written once, the precache list
 * is read off disk, and the cache name is a hash of the cached bytes — so a
 * changed file can never be served stale.
 *
 * Output is committed, so GitHub Pages still serves plain static files with
 * no build step in the deploy path. CI re-runs this and fails if anything
 * differs.
 *
 * Run: node tools/build.mjs [--check]
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { GAMES, SITE, EXTRA_PRECACHE } from '../games.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const written = [];
let drift = 0;

function emit(name, content) {
  const path = join(ROOT, name);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (existing === content) { written.push(`  = ${name}`); return; }
  if (CHECK) { drift++; written.push(`  ! ${name} is out of date`); return; }
  writeFileSync(path, content);
  written.push(`  ${existing === null ? '+' : '~'} ${name}`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* --- page template -------------------------------------------------------- */

/* GoatCounter: cookieless, no personal data, and its count.js skips
   localhost and private ranges, so local runs and CI never register a hit.
   Cross-origin, so the service worker leaves it alone (it only intercepts
   same-origin requests) and it is deliberately not precached — offline the
   request simply fails and the game carries on. */
const ANALYTICS = `<script data-goatcounter="https://mkorosec.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>`;

function head({ title, description, css = [], canonical }) {
  const sheets = ['css/theme.css', 'css/ui.css', ...css]
    .map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');

  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${SITE.themeDark}" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="${SITE.themeLight}" media="(prefers-color-scheme: light)">
<meta name="color-scheme" content="dark light">
<title>${esc(title)}</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${esc(SITE.shortName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}${sheets}
<script src="js/core/boot.js"></script>
${ANALYTICS}`;
}

function gamePage(game) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({
    title: `${game.title} · ${SITE.name}`,
    description: game.blurb,
    css: game.css ? [`css/${game.css}`] : [],
  })}
</head>
<body class="is-game">
<noscript><p class="placeholder">${esc(game.title)} needs JavaScript. Everything runs on your device; nothing is sent anywhere.</p></noscript>
<div class="app" id="app"></div>
<script type="module" src="js/games/${game.id}.js"></script>
</body>
</html>
`;
}

/* --- hub ------------------------------------------------------------------ */

function hubPage() {
  const sections = [];
  for (const game of GAMES) {
    let section = sections.find((s) => s.name === game.section);
    if (!section) sections.push((section = { name: game.section, games: [] }));
    section.games.push(game);
  }

  const cards = sections.map((section) => `
      <h2 class="section-title">${esc(section.name)}</h2>
      <div class="grid">
${section.games.map((game) => `        <a class="card" href="${game.id}.html">
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${game.icon}</svg></span>
          <span class="card-head">
            <span class="card-title">${esc(game.title)}</span>
            <span class="card-badge">${esc(game.badge)}</span>
          </span>
          <span class="card-blurb">${esc(game.blurb)}</span>
        </a>`).join('\n')}
      </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title: `${SITE.name} · offline puzzles`, description: SITE.description, css: ['css/hub.css'] })}
</head>
<body>
<div class="app app--wide">
  <header class="hub-header">
    <h1>${esc(SITE.name)}</h1>
    <p>${esc(SITE.description)}</p>
    <div class="hub-actions" id="hub-actions"></div>
  </header>

  <section id="continue-section" hidden>
    <h2 class="section-title">Continue</h2>
    <div class="grid" id="continue-grid"></div>
  </section>

  <main>
${cards}
  </main>

  <footer class="hub-footer">
    <p>Everything runs on your device. No accounts, no tracking, no network needed once loaded.</p>
  </footer>
</div>
<script type="module" src="js/hub.js"></script>
</body>
</html>
`;
}

/* --- manifest ------------------------------------------------------------- */

function manifest() {
  return `${JSON.stringify({
    name: `${SITE.name} — offline puzzles`,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: SITE.themeDark,
    theme_color: SITE.themeDark,
    categories: ['games', 'puzzle'],
    icons: [
      { src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'assets/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: 'assets/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: GAMES.filter((g) => g.daily).slice(0, 4).map((g) => ({
      name: g.title,
      url: `./${g.id}.html`,
      icons: [{ src: 'assets/icons/icon-192.png', sizes: '192x192' }],
    })),
  }, null, 2)}\n`;
}

/* --- service worker ------------------------------------------------------- */

function collectPrecache() {
  const files = new Set(['./', 'index.html', 'offline.html']);
  for (const game of GAMES) {
    files.add(`${game.id}.html`);
    if (game.css) files.add(`css/${game.css}`);
    if (!game.legacy) files.add(`js/games/${game.id}.js`);
  }
  files.add('js/hub.js');
  files.add('css/hub.css');
  for (const f of EXTRA_PRECACHE) files.add(f);

  // Anything under js/ that exists but nobody listed still belongs offline.
  for (const dir of ['js/core', 'js/gen', 'js/games']) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full)) {
      if (name.endsWith('.js')) files.add(`${dir}/${name}`);
    }
  }

  return [...files].sort();
}

function serviceWorker(precache) {
  // Hash the bytes actually being cached: a changed file therefore always
  // produces a new cache name, which removes the manual-bump footgun.
  const hash = createHash('sha256');
  for (const file of precache) {
    if (file === './') continue;
    const path = join(ROOT, file);
    hash.update(file);
    hash.update(existsSync(path) ? readFileSync(path) : Buffer.from('missing'));
  }
  const version = hash.digest('hex').slice(0, 12);

  return `/* Generated by tools/build.mjs — do not edit by hand.
   CACHE is a hash of the precached bytes, so any content change invalidates
   the old cache automatically. */

var CACHE = 'games-${version}';

var PRECACHE = ${JSON.stringify(precache, null, 2).replace(/\n/g, '\n')};

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Add files individually. cache.addAll is atomic, so one 404 would
      // reject the whole install and leave the app with no offline support
      // at all; a single missing file should not cost us everything.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
          return null;
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== CACHE) return caches.delete(name);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network first so a reload picks up a new build,
  // fall back to the cached page, then to the offline placeholder. Without
  // the fallback an offline navigation to an uncached URL is a browser error
  // page, which looks like the whole app is broken.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('index.html') || caches.match('offline.html');
        });
      })
    );
    return;
  }

  // Everything else is immutable for the life of a cache version.
  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
`;
}

/* --- offline fallback ----------------------------------------------------- */

function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title: `Offline · ${SITE.name}`, description: 'This page is not available offline.' })}
</head>
<body>
<div class="app">
  <div class="placeholder">
    <h1 style="font-size:1.25rem;margin-bottom:8px">Not cached yet</h1>
    <p>This page has not been saved to your device. Reconnect once and it will work offline from then on.</p>
    <p style="margin-top:16px"><a class="btn btn--primary" href="index.html">All games</a></p>
  </div>
</div>
</body>
</html>
`;
}

/* --- run ------------------------------------------------------------------ */

for (const game of GAMES) {
  if (game.legacy) continue;
  emit(`${game.id}.html`, gamePage(game));
}
emit('index.html', hubPage());
emit('offline.html', offlinePage());
emit('manifest.webmanifest', manifest());

// The worker hashes file contents, so it must be written last.
emit('sw.js', serviceWorker(collectPrecache()));

console.log(written.join('\n'));

if (CHECK && drift) {
  console.error(`\n${drift} generated file(s) out of date. Run: node tools/build.mjs`);
  process.exit(1);
}
console.log(CHECK ? '\nGenerated files are up to date.' : '\nBuild complete.');

/* 2048 with real sliding tiles, undo, and three board sizes. */

import { el, appBar, toast, haptic, HAPTIC, celebrate, resultDialog, createTimer,
         formatTime } from '../core/ui.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import { createRng } from '../core/rng.js';
import { read, write } from '../core/store.js';
import * as prefs from '../core/prefs.js';

const GAME = '2048';
const SIZES = [4, 5, 6];
const UNDO_DEPTH = 12;

/* Warm hues for small tiles rising to the brand amber at 2048. */
const TILE_STYLE = {
  2:    ['oklch(0.88 0.01 85)',  'oklch(0.25 0.01 85)'],
  4:    ['oklch(0.84 0.03 82)',  'oklch(0.25 0.01 85)'],
  8:    ['oklch(0.72 0.13 62)',  'oklch(0.99 0 0)'],
  16:   ['oklch(0.68 0.15 50)',  'oklch(0.99 0 0)'],
  32:   ['oklch(0.64 0.17 38)',  'oklch(0.99 0 0)'],
  64:   ['oklch(0.60 0.19 28)',  'oklch(0.99 0 0)'],
  128:  ['oklch(0.70 0.15 95)',  'oklch(0.20 0.01 85)'],
  256:  ['oklch(0.73 0.16 90)',  'oklch(0.20 0.01 85)'],
  512:  ['oklch(0.76 0.17 85)',  'oklch(0.20 0.01 85)'],
  1024: ['oklch(0.79 0.17 82)',  'oklch(0.20 0.01 85)'],
  2048: ['oklch(0.82 0.18 80)',  'oklch(0.18 0.01 85)'],
};

let state = null;
let timer = null;
let nextTileId = 1;
const nodes = {};

/* Best score is per board size and survives a new game, so it lives outside
   the session save rather than in the generic stats buckets (which track
   times, not scores). */
const bestScore = (n) => read(`best:2048:${n}`, 0);
const setBestScore = (n, value) => write(`best:2048:${n}`, value);

const styleFor = (value) => TILE_STYLE[value] || ['oklch(0.30 0.04 300)', 'oklch(0.95 0 0)'];

function fontSize(value, n) {
  const base = n === 4 ? 1 : n === 5 ? 0.82 : 0.68;
  const digits = String(value).length;
  const scale = digits <= 2 ? 2.1 : digits === 3 ? 1.7 : digits === 4 ? 1.35 : 1.05;
  return `${(scale * base).toFixed(2)}rem`;
}

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.sizeTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Board size' },
    SIZES.map((n) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { size: n },
      text: `${n}×${n}`, onclick: () => setSize(n),
    })));

  nodes.score = el('span', { class: 'hud__value', text: '0' });
  nodes.best = el('span', { class: 'hud__value', text: '0' });
  nodes.time = el('span', { class: 'hud__value', text: '00:00' });

  nodes.grid = el('div', { class: 't2048-grid' });
  nodes.layer = el('div', { class: 't2048-layer' });
  nodes.frame = el('div', {
    class: 't2048-frame', role: 'application',
    'aria-label': 'Sliding tile board. Use arrow keys or swipe.',
    tabindex: '0',
  }, [nodes.grid, nodes.layer]);

  nodes.winBar = el('div', { class: 't2048-win', hidden: true });

  app.append(
    appBar({
      title: '2048',
      actions: [
        { name: 'undo', icon: 'undo', label: 'Undo', onClick: undo },
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New game', onClick: () => newGame() },
      ],
    }),
    nodes.sizeTabs,
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Score' }), nodes.score]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Best' }), nodes.best]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.time]),
    ]),
    nodes.frame,
    nodes.winBar,
    el('p', { class: 't2048-hint', text: 'Swipe, or use arrow keys / WASD. Z undoes.' }),
  );
}

/* --- model ---------------------------------------------------------------- */

const emptyCells = (tiles, n) => {
  const taken = new Set(tiles.map((t) => t.r * n + t.c));
  const free = [];
  for (let i = 0; i < n * n; i++) if (!taken.has(i)) free.push(i);
  return free;
};

function spawn(rng = state.rng) {
  const free = emptyCells(state.tiles, state.n);
  if (!free.length) return null;
  const at = free[Math.floor(rng.next() * free.length)];
  const tile = {
    id: nextTileId++,
    value: rng.next() < 0.9 ? 2 : 4,
    r: Math.floor(at / state.n),
    c: at % state.n,
    isNew: true,
  };
  state.tiles.push(tile);
  return tile;
}

/** Slide and merge along one direction. Returns whether anything moved. */
function slide(direction) {
  const n = state.n;
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' || direction === 'down';

  let moved = false;
  let gained = 0;
  const survivors = [];

  for (let line = 0; line < n; line++) {
    const inLine = state.tiles
      .filter((t) => (horizontal ? t.r === line : t.c === line))
      .sort((a, b) => (horizontal ? a.c - b.c : a.r - b.r));
    if (forward) inLine.reverse();

    const out = [];
    for (let i = 0; i < inLine.length; i++) {
      const tile = inLine[i];
      const previous = out[out.length - 1];
      if (previous && !previous.merged && previous.value === tile.value) {
        previous.value *= 2;
        previous.merged = true;
        gained += previous.value;
        // The absorbed tile slides onto its partner, then disappears.
        tile.absorbedBy = previous;
        moved = true;
        continue;
      }
      out.push(tile);
    }

    out.forEach((tile, index) => {
      const position = forward ? n - 1 - index : index;
      const nextR = horizontal ? line : position;
      const nextC = horizontal ? position : line;
      if (tile.r !== nextR || tile.c !== nextC) moved = true;
      tile.r = nextR;
      tile.c = nextC;
      survivors.push(tile);
    });

    for (const tile of inLine) {
      if (!tile.absorbedBy) continue;
      tile.r = tile.absorbedBy.r;
      tile.c = tile.absorbedBy.c;
    }
  }

  return { moved, gained, survivors };
}

function canMove() {
  const n = state.n;
  if (state.tiles.length < n * n) return true;
  const at = new Map(state.tiles.map((t) => [t.r * n + t.c, t.value]));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = at.get(r * n + c);
      if (c + 1 < n && at.get(r * n + c + 1) === v) return true;
      if (r + 1 < n && at.get((r + 1) * n + c) === v) return true;
    }
  }
  return false;
}

function snapshot() {
  state.history.push({
    tiles: state.tiles.map((t) => ({ id: t.id, value: t.value, r: t.r, c: t.c })),
    score: state.score,
  });
  if (state.history.length > UNDO_DEPTH) state.history.shift();
}

/* --- moves ---------------------------------------------------------------- */

function move(direction) {
  if (!state || state.over) return;

  snapshot();
  state.tiles.forEach((t) => { t.merged = false; t.isNew = false; t.absorbedBy = null; });

  const { moved, gained, survivors } = slide(direction);
  if (!moved) { state.history.pop(); return; }

  state.score += gained;
  if (state.score > state.best) {
    state.best = state.score;
    setBestScore(state.n, state.best);
  }

  // Paint the slide with every tile still present, then drop the absorbed
  // ones on the next frame so they visibly travel to their merge partner.
  renderTiles();

  const absorbed = state.tiles.filter((t) => t.absorbedBy);
  state.tiles = survivors;

  haptic(gained ? HAPTIC.commit : HAPTIC.tap);

  setTimeout(() => {
    if (!state) return;
    absorbed.forEach((t) => nodes.layer.querySelector(`[data-tile="${t.id}"]`)?.remove());
    spawn();

    if (!state.won && state.tiles.some((t) => t.value >= 2048)) {
      state.won = true;
      showWinBar();
      celebrate();
      haptic(HAPTIC.win);
      stats.record(GAME, { won: true, bucket: `${state.n}x${state.n}`, timeSec: timer.seconds() });
    }

    renderTiles();
    renderHud();

    if (!canMove()) finish();
    else persist();
  }, 115);
}

function undo() {
  if (!state || !state.history.length) { haptic(HAPTIC.reject); return; }
  const previous = state.history.pop();
  state.tiles = previous.tiles;
  state.score = previous.score;
  state.over = false;
  nodes.layer.replaceChildren();
  renderTiles();
  renderHud();
  persist();
  haptic(HAPTIC.tap);
}

function finish() {
  state.over = true;
  timer.pause();
  persist();
  stats.record(GAME, { won: false, bucket: `${state.n}x${state.n}`, timeSec: timer.seconds() });

  const highest = Math.max(...state.tiles.map((t) => t.value));
  resultDialog({
    title: 'No moves left',
    bodyHtml: `Score <strong>${state.score}</strong><br>Best tile <strong>${highest}</strong>` +
              `<br>Best score <strong>${state.best}</strong>`,
    primary: { label: 'New game', onClick: () => newGame() },
    extra: { label: 'Share result', onClick: share },
    secondary: { label: 'Undo last move', onClick: undo },
  });
}

function share() {
  const highest = Math.max(...state.tiles.map((t) => t.value));
  shareResult(shareHeader([
    '2048', `${state.n}×${state.n}`, `score ${state.score}`,
    `best tile ${highest}`, formatTime(timer.seconds()),
  ]));
}

function showWinBar() {
  nodes.winBar.hidden = false;
  nodes.winBar.replaceChildren(
    el('span', { class: 'chip', text: '2048 reached' }),
    el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: 'Keep going',
      onclick: () => { nodes.winBar.hidden = true; } }),
    el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'New game',
      onclick: () => newGame() }),
  );
}

/* --- lifecycle ------------------------------------------------------------ */

function newGame(size = state?.n || 4) {
  const best = bestScore(size);
  state = {
    n: size,
    tiles: [],
    score: 0,
    best,
    history: [],
    over: false,
    won: false,
    rng: createRng(null),
  };
  nextTileId = 1;
  nodes.layer.replaceChildren();
  nodes.winBar.hidden = true;
  buildGrid();
  spawn();
  spawn();
  timer = createTimer((s) => { nodes.time.textContent = formatTime(s); });
  timer.reset(0);
  timer.start();
  renderTiles();
  renderHud();
  persist();
}

function setSize(n) {
  if (state?.n === n) return;
  newGame(n);
}

function persist() {
  if (!state) return;
  session.save(GAME, {
    n: state.n,
    tiles: state.tiles.map((t) => ({ id: t.id, value: t.value, r: t.r, c: t.c })),
    score: state.score,
    best: state.best,
    over: state.over,
    won: state.won,
    elapsed: timer?.seconds() || 0,
  }, {
    label: `${state.n}×${state.n} · ${state.score}`,
    detail: state.over ? 'Finished' : `${state.tiles.length} tiles`,
  });
}

function restore(saved) {
  state = {
    n: saved.n || 4,
    tiles: saved.tiles || [],
    score: saved.score || 0,
    best: Math.max(saved.best || 0, bestScore(saved.n || 4)),
    history: [],
    over: !!saved.over,
    won: !!saved.won,
    rng: createRng(null),
  };
  nextTileId = Math.max(0, ...state.tiles.map((t) => t.id)) + 1;
  buildGrid();
  timer = createTimer((s) => { nodes.time.textContent = formatTime(s); });
  timer.reset(saved.elapsed || 0);
  if (!state.over) timer.start();
  renderTiles();
  renderHud();
  if (state.won) showWinBar();
}

/* --- rendering ------------------------------------------------------------ */

function buildGrid() {
  const n = state.n;
  nodes.frame.style.setProperty('--n', n);
  nodes.frame.style.setProperty('--gap', n === 4 ? '8px' : n === 5 ? '7px' : '6px');
  nodes.grid.replaceChildren(...Array.from({ length: n * n }, () => el('div', { class: 't2048-cell' })));
  nodes.sizeTabs.querySelectorAll('[data-size]').forEach((btn) => {
    btn.setAttribute('aria-checked', String(Number(btn.dataset.size) === n));
  });
}

function renderTiles() {
  const n = state.n;
  const present = new Set();

  for (const tile of state.tiles) {
    present.add(tile.id);
    let node = nodes.layer.querySelector(`[data-tile="${tile.id}"]`);
    const [bg, fg] = styleFor(tile.value);
    const pos = `translate(calc(${tile.c} * (100% + var(--gap))), calc(${tile.r} * (100% + var(--gap))))`;

    if (!node) {
      node = el('div', { class: 't2048-tile', dataset: { tile: tile.id } });
      node.style.setProperty('--size', `calc((100% - ${(n - 1)} * var(--gap)) / ${n})`);
      nodes.layer.append(node);
      if (tile.isNew) node.classList.add('is-new');
    }

    node.style.setProperty('--pos', pos);
    node.style.transform = pos;
    node.style.background = bg;
    node.style.color = fg;
    node.style.fontSize = fontSize(tile.value, n);
    node.textContent = String(tile.value);

    if (tile.merged) {
      node.classList.remove('is-merged');
      void node.offsetWidth;
      node.classList.add('is-merged');
    }
  }

  for (const node of [...nodes.layer.children]) {
    if (!present.has(Number(node.dataset.tile))) node.remove();
  }
}

function renderHud() {
  nodes.score.textContent = String(state.score);
  nodes.best.textContent = String(state.best);
}

function openStats() {
  showStats(GAME, {
    title: '2048 statistics',
    buckets: SIZES.map((n) => ({ key: `${n}x${n}`, label: `${n}×${n}` })),
    showStreak: false,
  });
}

/* --- input ---------------------------------------------------------------- */

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
  h: 'left', l: 'right', k: 'up', j: 'down',
};

document.addEventListener('keydown', (event) => {
  if (document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); undo(); return; }
  const direction = KEYS[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

let touchStart = null;

function attachTouch() {
  nodes.frame.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, t: Date.now() };
  }, { passive: true });

  nodes.frame.addEventListener('touchmove', (event) => { event.preventDefault(); }, { passive: false });

  nodes.frame.addEventListener('touchend', (event) => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    const dt = Date.now() - touchStart.t;
    touchStart = null;
    if (dt > 900) return;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
}

document.addEventListener('visibilitychange', () => {
  if (!state || state.over) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();
attachTouch();

const saved = session.load(GAME);
if (saved?.tiles?.length) restore(saved);
else newGame(4);

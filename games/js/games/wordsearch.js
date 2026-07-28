/* Word Search. Drag across a straight line of letters to claim a word. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { LANGUAGES, LANGUAGE_CODES, load as loadWords } from '../core/words.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'wordsearch';
const LEVELS = ['easy', 'medium', 'hard'];

let state = null;
let timer = null;
const nodes = {};

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.levelTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Difficulty' },
    LEVELS.map((level) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { level },
      text: level[0].toUpperCase() + level.slice(1), onclick: () => setDifficulty(level),
    })));

  nodes.langTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Language' },
    LANGUAGE_CODES.map((code) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { lang: code },
      text: LANGUAGES[code].label, onclick: () => setLanguage(code),
    })));

  nodes.timer = el('span', { class: 'hud__value', text: '00:00' });
  nodes.found = el('span', { class: 'hud__value', text: '0' });
  nodes.board = el('div', { class: 'ws-board', role: 'grid', 'aria-label': 'Letter grid' });
  nodes.words = el('div', { class: 'ws-words' });

  app.append(
    appBar({
      title: 'Word Search',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New grid', onClick: () => start() },
      ],
    }),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center' },
      [nodes.levelTabs, nodes.langTabs]),
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.timer]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Found' }), nodes.found]),
    ]),
    el('div', { class: 'ws-wrap' }, [nodes.board]),
    nodes.words,
    el('p', { class: 'ws-hint', text: 'Drag from the first letter to the last. Any direction counts.' }),
  );
}

/* --- lifecycle ------------------------------------------------------------ */

async function start(difficulty = state?.difficulty || 'easy', lang = state?.lang || 'en') {
  timer?.pause();
  nodes.board.replaceChildren(el('div', { class: 'placeholder' },
    [el('div', { class: 'spinner' }), 'Building a grid…']));
  await nextPaint();

  const [answers, guesses] = await Promise.all([
    loadWords(lang, 'answers'), loadWords(lang, 'guesses'),
  ]);
  const words = [...new Set([...answers, ...guesses])];
  if (!words.length) {
    nodes.board.replaceChildren(el('div', { class: 'placeholder',
      text: 'Word list unavailable. Reconnect once so it can be cached.' }));
    return;
  }

  const puzzle = await generate('wordsearch', { difficulty, words, lang });
  if (!puzzle?.placed.length) { toast('Could not build a grid'); return; }

  state = {
    difficulty, lang,
    size: puzzle.size,
    grid: puzzle.grid,
    placed: puzzle.placed,
    found: [],
    over: false,
    elapsed: 0,
  };

  timer = createTimer(onTick);
  timer.reset(0);
  timer.start();
  buildBoard();
  render();
  persist();
}

function restore(saved) {
  state = saved;
  timer = createTimer(onTick);
  timer.reset(saved.elapsed || 0);
  if (!state.over) timer.start();
  buildBoard();
  render();
}

function onTick(seconds) {
  nodes.timer.textContent = formatTime(seconds);
  if (state && !state.over) {
    state.elapsed = seconds;
    if (seconds % 5 === 0) persist();
  }
}

function persist() {
  if (!state) return;
  session.save(GAME, { ...state, elapsed: timer?.seconds() ?? state.elapsed }, {
    label: `${state.difficulty} · ${LANGUAGES[state.lang].label}`,
    detail: state.over ? 'Complete' : `${state.found.length}/${state.placed.length} found`,
  });
}

function setDifficulty(level) { if (state?.difficulty !== level) start(level, state.lang); }
function setLanguage(lang) { if (state?.lang !== lang) start(state.difficulty, lang); }

/* --- board ---------------------------------------------------------------- */

function buildBoard() {
  const available = Math.min(window.innerWidth - 32, 520);
  const cell = Math.max(19, Math.min(36, Math.floor(available / state.size) - 1));
  nodes.board.style.setProperty('--cell', `${cell}px`);
  nodes.board.style.gridTemplateColumns = `repeat(${state.size}, var(--cell))`;

  nodes.cells = state.grid.map((letter, i) => el('button', {
    type: 'button', class: 'ws-cell', role: 'gridcell', dataset: { index: i },
    text: letter,
    'aria-label': `${letter}, row ${Math.floor(i / state.size) + 1} column ${(i % state.size) + 1}`,
  }));
  nodes.board.replaceChildren(...nodes.cells);
  attachSelection();
}

/* --- selection ------------------------------------------------------------ */

let drag = null;

/** Cells on the straight line from a to b, or null if not a line. */
function lineBetween(a, b) {
  const size = state.size;
  const r1 = Math.floor(a / size);
  const c1 = a % size;
  const r2 = Math.floor(b / size);
  const c2 = b % size;
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  const lenR = Math.abs(r2 - r1);
  const lenC = Math.abs(c2 - c1);
  if (lenR && lenC && lenR !== lenC) return null;

  const steps = Math.max(lenR, lenC);
  const cells = [];
  for (let i = 0; i <= steps; i++) cells.push((r1 + dr * i) * size + (c1 + dc * i));
  return cells;
}

function attachSelection() {
  const indexAt = (x, y) => {
    const node = document.elementFromPoint(x, y);
    return node?.classList.contains('ws-cell') ? Number(node.dataset.index) : -1;
  };

  const paint = (cells) => {
    nodes.cells.forEach((n) => n.classList.remove('is-selecting'));
    for (const i of cells || []) nodes.cells[i].classList.add('is-selecting');
  };

  nodes.board.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('.ws-cell');
    if (!node || !state || state.over) return;
    event.preventDefault();
    nodes.board.setPointerCapture?.(event.pointerId);
    drag = { from: Number(node.dataset.index), cells: [Number(node.dataset.index)] };
    paint(drag.cells);
  });

  nodes.board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const to = indexAt(event.clientX, event.clientY);
    if (to < 0) return;
    const cells = lineBetween(drag.from, to);
    if (!cells) return;
    drag.cells = cells;
    paint(cells);
  });

  const end = () => {
    if (!drag) return;
    const cells = drag.cells;
    drag = null;
    paint(null);
    if (cells.length > 1) claim(cells);
    render();
  };

  nodes.board.addEventListener('pointerup', end);
  nodes.board.addEventListener('pointercancel', end);
}

function claim(cells) {
  const forward = cells.join(',');
  const backward = [...cells].reverse().join(',');

  const hit = state.placed.find((entry) => {
    if (state.found.includes(entry.word)) return false;
    const key = entry.cells.join(',');
    return key === forward || key === backward;
  });

  if (!hit) { haptic(HAPTIC.reject); return; }

  state.found.push(hit.word);
  haptic(HAPTIC.commit);
  toast(hit.word.toUpperCase(), 900);
  persist();

  if (state.found.length === state.placed.length) finish();
}

/* --- end ------------------------------------------------------------------ */

function finish() {
  state.over = true;
  timer.pause();
  state.elapsed = timer.seconds();
  persist();
  celebrate();
  haptic(HAPTIC.win);

  stats.record(GAME, { won: true, bucket: state.difficulty, timeSec: state.elapsed });

  resultDialog({
    title: 'All found',
    bodyHtml: `<strong>${state.placed.length}</strong> words in <strong>${formatTime(state.elapsed)}</strong>`,
    primary: { label: 'New grid', onClick: () => start() },
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Word Search', LANGUAGES[state.lang].label, state.difficulty,
      `${state.placed.length} words`, formatTime(state.elapsed),
    ])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function openStats() {
  showStats(GAME, {
    title: 'Word Search statistics',
    buckets: LEVELS.map((l) => ({ key: l, label: l[0].toUpperCase() + l.slice(1) })),
    showStreak: false,
  });
}

/* --- rendering ------------------------------------------------------------ */

function render() {
  if (!state) return;

  nodes.levelTabs.querySelectorAll('[data-level]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.level === state.difficulty)));
  nodes.langTabs.querySelectorAll('[data-lang]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.lang === state.lang)));

  nodes.found.textContent = `${state.found.length}/${state.placed.length}`;

  const foundCells = new Set();
  for (const entry of state.placed) {
    if (state.found.includes(entry.word)) entry.cells.forEach((c) => foundCells.add(c));
  }
  nodes.cells.forEach((node, i) => node.classList.toggle('is-found', foundCells.has(i)));

  nodes.words.replaceChildren(...state.placed.map((entry) => el('span', {
    class: `ws-word${state.found.includes(entry.word) ? ' is-found' : ''}`,
    text: entry.word,
  })));
}

document.addEventListener('visibilitychange', () => {
  if (!state || state.over) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.grid && saved.placed) restore(saved);
else start('easy', 'en');

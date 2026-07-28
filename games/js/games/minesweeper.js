/* Minesweeper. Boards are generated after the first tap so it is always
   safe, and only layouts solvable without guessing are used. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, iconSvg, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { PRESETS, neighbours } from '../gen/minesweeper.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import { read, write } from '../core/store.js';
import * as prefs from '../core/prefs.js';

const GAME = 'minesweeper';
const LEVELS = ['easy', 'medium', 'hard'];

const SETTINGS_KEY = 'settings:minesweeper';
const settings = { flagMode: false, noGuess: true, ...read(SETTINGS_KEY, {}) };
const saveSettings = () => write(SETTINGS_KEY, settings);

let state = null;
let timer = null;
const nodes = {};

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.levelTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Difficulty' },
    LEVELS.map((level) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { level },
      text: `${level[0].toUpperCase()}${level.slice(1)}`, onclick: () => setDifficulty(level),
    })));

  nodes.timer = el('span', { class: 'hud__value', text: '00:00' });
  nodes.remaining = el('span', { class: 'hud__value', text: '0' });
  nodes.board = el('div', { class: 'mine-board', role: 'grid', 'aria-label': 'Minefield' });

  nodes.flagBtn = el('button', {
    type: 'button', class: 'btn btn--secondary btn--sm', 'aria-pressed': String(settings.flagMode),
    onclick: toggleFlagMode,
  });

  app.append(
    appBar({
      title: 'Minesweeper',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New game', onClick: () => start() },
      ],
    }),
    nodes.levelTabs,
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.timer]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Mines left' }), nodes.remaining]),
    ]),
    el('div', { class: 'mine-toggle' }, [nodes.flagBtn]),
    el('div', { class: 'mine-wrap' }, [nodes.board]),
    el('p', { class: 'mine-hint',
      text: 'Long-press or right-click to flag. Tap a number with all its mines flagged to clear around it.' }),
  );
  syncFlagButton();
}

function syncFlagButton() {
  nodes.flagBtn.textContent = settings.flagMode ? 'Mode: flag' : 'Mode: reveal';
  nodes.flagBtn.setAttribute('aria-pressed', String(settings.flagMode));
}

function toggleFlagMode() {
  settings.flagMode = !settings.flagMode;
  saveSettings();
  syncFlagButton();
  haptic(HAPTIC.tap);
}

/* --- lifecycle ------------------------------------------------------------ */

function start(difficulty = state?.difficulty || 'easy') {
  timer?.pause();
  const preset = PRESETS[difficulty];

  state = {
    difficulty,
    width: preset.width,
    height: preset.height,
    mineCount: preset.mines,
    mines: null,          // laid on the first tap
    counts: null,
    open: new Uint8Array(preset.width * preset.height),
    flags: new Uint8Array(preset.width * preset.height),
    started: false,
    over: false,
    won: false,
    elapsed: 0,
  };

  timer = createTimer(onTick);
  timer.reset(0);
  buildBoard();
  render();
}

function restore(saved) {
  state = {
    ...saved,
    open: Uint8Array.from(saved.open || []),
    flags: Uint8Array.from(saved.flags || []),
  };
  timer = createTimer(onTick);
  timer.reset(saved.elapsed || 0);
  buildBoard();
  if (state.started && !state.over) timer.start();
  render();
}

function onTick(seconds) {
  nodes.timer.textContent = formatTime(seconds);
  if (state && state.started && !state.over) {
    state.elapsed = seconds;
    if (seconds % 5 === 0) persist();
  }
}

function persist() {
  if (!state) return;
  session.save(GAME, {
    ...state,
    open: Array.from(state.open),
    flags: Array.from(state.flags),
    elapsed: timer?.seconds() ?? state.elapsed,
  }, {
    label: `${state.difficulty} · ${state.width}×${state.height}`,
    detail: state.over ? (state.won ? 'Cleared' : 'Lost') : `${minesLeft()} mines left`,
  });
}

const minesLeft = () => state.mineCount - state.flags.reduce((n, f) => n + f, 0);

/* --- board ---------------------------------------------------------------- */

function buildBoard() {
  const { width, height } = state;
  const available = Math.min(window.innerWidth - 32, 560);
  const cell = Math.max(20, Math.min(38, Math.floor(available / width) - 1));

  nodes.board.style.setProperty('--cell', `${cell}px`);
  nodes.board.style.gridTemplateColumns = `repeat(${width}, var(--cell))`;

  nodes.cells = [];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < width * height; i++) {
    const node = el('button', {
      type: 'button', class: 'mine-cell', role: 'gridcell', dataset: { index: i },
      'aria-label': `Row ${Math.floor(i / width) + 1} column ${(i % width) + 1}`,
    });
    nodes.cells.push(node);
    frag.append(node);
  }
  nodes.board.replaceChildren(frag);
  attachInput();
}

/* --- input ---------------------------------------------------------------- */

let pressTimer = 0;
let longPressed = false;

function attachInput() {
  nodes.board.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const node = event.target.closest('.mine-cell');
    if (node) toggleFlag(Number(node.dataset.index));
  });

  nodes.board.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('.mine-cell');
    if (!node || event.button === 2) return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longPressed = true;
      toggleFlag(Number(node.dataset.index));
    }, 380);
  });

  const cancel = () => { clearTimeout(pressTimer); };
  nodes.board.addEventListener('pointerup', cancel);
  nodes.board.addEventListener('pointercancel', () => { cancel(); longPressed = true; });
  nodes.board.addEventListener('pointerleave', cancel);

  nodes.board.addEventListener('click', (event) => {
    const node = event.target.closest('.mine-cell');
    if (!node) return;
    if (longPressed) { longPressed = false; return; }
    const index = Number(node.dataset.index);
    if (settings.flagMode || event.shiftKey) toggleFlag(index);
    else primary(index);
  });
}

/* --- rules ---------------------------------------------------------------- */

async function layMines(safeIndex) {
  nodes.board.style.opacity = '0.55';
  await nextPaint();

  const board = await generate('minesweeper', {
    difficulty: state.difficulty, safeIndex, noGuess: settings.noGuess,
  });

  nodes.board.style.opacity = '';
  if (!board) { toast('Could not build a board'); return false; }

  state.mines = board.mines;
  state.counts = board.counts;
  state.started = true;
  if (!board.noGuess) toast('This board may need one guess', 2200);
  timer.start();
  return true;
}

async function primary(index) {
  if (!state || state.over) return;
  if (state.flags[index]) return;

  if (!state.started) {
    if (!(await layMines(index))) return;
  }

  if (state.open[index]) { chord(index); return; }

  if (state.mines[index]) { lose(index); return; }

  reveal(index);
  haptic(HAPTIC.tap);
  render();
  persist();
  checkWin();
}

/** Clicking a satisfied number opens its remaining neighbours. */
function chord(index) {
  const count = state.counts[index];
  if (count <= 0) return;
  const around = neighbours(state.width, state.height, index);
  const flags = around.filter((n) => state.flags[n]).length;
  if (flags !== count) return;

  for (const n of around) {
    if (state.flags[n] || state.open[n]) continue;
    if (state.mines[n]) { lose(n); return; }
    reveal(n);
  }
  haptic(HAPTIC.commit);
  render();
  persist();
  checkWin();
}

function reveal(index) {
  const stack = [index];
  while (stack.length) {
    const cur = stack.pop();
    if (state.open[cur] || state.flags[cur]) continue;
    state.open[cur] = 1;
    if (state.counts[cur] === 0) {
      for (const n of neighbours(state.width, state.height, cur)) {
        if (!state.open[n]) stack.push(n);
      }
    }
  }
}

function toggleFlag(index) {
  if (!state || state.over || state.open[index]) return;
  state.flags[index] = state.flags[index] ? 0 : 1;
  haptic(HAPTIC.tap);
  render();
  persist();
}

function checkWin() {
  const total = state.width * state.height;
  let opened = 0;
  for (let i = 0; i < total; i++) if (state.open[i]) opened += 1;
  if (opened !== total - state.mineCount) return;

  state.over = true;
  state.won = true;
  timer.pause();
  state.elapsed = timer.seconds();
  for (let i = 0; i < total; i++) if (state.mines[i]) state.flags[i] = 1;
  render();
  persist();
  celebrate();
  haptic(HAPTIC.win);

  stats.record(GAME, {
    won: true, bucket: state.difficulty, timeSec: state.elapsed,
  });

  const best = stats.summary(GAME, state.difficulty).bestTime;
  resultDialog({
    title: 'Cleared',
    bodyHtml: `<strong>${state.difficulty}</strong> in <strong>${formatTime(state.elapsed)}</strong>` +
      (best === state.elapsed ? '<br>New best time.' : ''),
    primary: { label: 'New game', onClick: () => start() },
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Minesweeper', state.difficulty, `${state.width}×${state.height}`, formatTime(state.elapsed),
    ])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function lose(index) {
  state.over = true;
  state.won = false;
  timer.pause();
  state.elapsed = timer.seconds();
  state.hit = index;
  for (let i = 0; i < state.mines.length; i++) if (state.mines[i]) state.open[i] = 1;
  render();
  persist();
  haptic(HAPTIC.reject);

  stats.record(GAME, { won: false, bucket: state.difficulty, timeSec: state.elapsed });

  resultDialog({
    title: 'Boom',
    bodyHtml: 'You hit a mine.<br>Every board here is solvable without guessing, so there was a deduction available.',
    primary: { label: 'New game', onClick: () => start() },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

/* --- rendering ------------------------------------------------------------ */

const FLAG_ICON = '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/></svg>';
const MINE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>';

function setDifficulty(level) { if (state?.difficulty !== level) start(level); }

function render() {
  if (!state) return;

  nodes.levelTabs.querySelectorAll('[data-level]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.level === state.difficulty)));
  nodes.remaining.textContent = String(state.started ? minesLeft() : state.mineCount);

  for (let i = 0; i < nodes.cells.length; i++) {
    const node = nodes.cells[i];
    node.className = 'mine-cell';
    node.innerHTML = '';

    const isMine = state.mines?.[i];

    if (state.flags[i] && !(state.over && !state.won && !isMine)) {
      node.classList.add('is-flag');
      node.innerHTML = FLAG_ICON;
      node.setAttribute('aria-label', 'Flagged');
      continue;
    }

    if (state.over && !state.won && state.flags[i] && !isMine) {
      node.classList.add('is-open', 'is-wrong-flag');
      node.innerHTML = FLAG_ICON;
      continue;
    }

    if (!state.open[i]) { node.setAttribute('aria-label', 'Hidden'); continue; }

    node.classList.add('is-open');
    if (isMine) {
      node.classList.add('is-mine');
      if (i === state.hit) node.style.filter = 'brightness(1.25)';
      node.innerHTML = MINE_ICON;
      node.setAttribute('aria-label', 'Mine');
      continue;
    }

    const count = state.counts[i];
    if (count > 0) {
      node.textContent = String(count);
      node.classList.add(`mine-n${count}`);
    }
    node.setAttribute('aria-label', count > 0 ? `${count} adjacent mines` : 'Empty');
  }
}

function openStats() {
  showStats(GAME, {
    title: 'Minesweeper statistics',
    buckets: LEVELS.map((l) => ({ key: l, label: l[0].toUpperCase() + l.slice(1) })),
    showStreak: false,
  });
}

document.addEventListener('visibilitychange', () => {
  if (!state || state.over || !state.started) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.width && saved.open) restore(saved);
else start('easy');

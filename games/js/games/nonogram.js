/* Nonogram: drag to paint, mark cells you have ruled out, daily puzzles. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, iconSvg, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { dateKey, dailySeed } from '../core/rng.js';
import { FILLED } from '../gen/nonogram.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'nonogram';
const LEVELS = ['easy', 'medium', 'hard'];

/* Player marks, distinct from the generator's solution encoding. */
const BLANK = 0;
const PAINT = 1;
const CROSS = 2;

let state = null;
let timer = null;
const nodes = {};

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.modeTabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Mode' },
    [['daily', 'Daily'], ['practice', 'Practice']].map(([value, label]) =>
      el('button', { type: 'button', class: 'segmented__item', role: 'tab',
        dataset: { mode: value }, text: label, onclick: () => setMode(value) })));

  nodes.levelTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Size' },
    LEVELS.map((level) => el('button', { type: 'button', class: 'segmented__item', role: 'radio',
      dataset: { level }, text: level[0].toUpperCase() + level.slice(1),
      onclick: () => setDifficulty(level) })));

  nodes.toolTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Tool' },
    [[PAINT, 'Fill'], [CROSS, 'Mark']].map(([value, label]) =>
      el('button', { type: 'button', class: 'segmented__item', role: 'radio',
        dataset: { tool: value }, text: label, onclick: () => setTool(value) })));

  nodes.timer = el('span', { class: 'hud__value', text: '00:00' });
  nodes.progress = el('span', { class: 'hud__value', text: '0' });
  nodes.mistakes = el('span', { class: 'hud__value', text: '0' });

  nodes.colClues = el('div', { class: 'nono-col-clues' });
  nodes.rowClues = el('div', { class: 'nono-row-clues' });
  nodes.board = el('div', { class: 'nono-board', role: 'grid', 'aria-label': 'Nonogram grid' });

  nodes.layout = el('div', { class: 'nono-layout' }, [
    el('div', { class: 'nono-corner' }), nodes.colClues, nodes.rowClues, nodes.board,
  ]);

  app.append(
    appBar({
      title: 'Nonogram',
      actions: [
        { name: 'undo', icon: 'undo', label: 'Undo', onClick: undo },
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New puzzle', onClick: () => start({ fresh: true }) },
      ],
    }),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center' },
      [nodes.modeTabs, nodes.levelTabs]),
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.timer]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Filled' }), nodes.progress]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Errors' }), nodes.mistakes]),
    ]),
    nodes.toolTabs,
    el('div', { class: 'nono-wrap' }, [nodes.layout]),
    el('p', { class: 'nono-hint',
      text: 'Drag to paint a line. Right-click or the Mark tool rules a cell out.' }),
  );
}

/* --- lifecycle ------------------------------------------------------------ */

async function start({ fresh = false } = {}) {
  const mode = state?.mode || 'daily';
  const difficulty = state?.difficulty || 'easy';
  const today = dateKey();

  timer?.pause();
  nodes.board.replaceChildren(el('div', { class: 'placeholder' },
    [el('div', { class: 'spinner' }), 'Building a puzzle…']));
  await nextPaint();

  const seed = mode === 'daily' && !fresh ? dailySeed(`${GAME}:${difficulty}`, today) : null;
  const puzzle = await generate('nonogram', { difficulty, seed });
  if (!puzzle) { toast('Could not build a puzzle. Try again.'); return; }

  state = {
    mode, difficulty, date: today,
    width: puzzle.width,
    height: puzzle.height,
    rowClues: puzzle.rowClues,
    colClues: puzzle.colClues,
    solution: puzzle.solution,
    marks: new Array(puzzle.width * puzzle.height).fill(BLANK),
    tool: PAINT,
    errors: 0,
    history: [],
    solved: false,
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
  state = { ...saved, history: saved.history || [] };
  timer = createTimer(onTick);
  timer.reset(saved.elapsed || 0);
  if (!state.solved) timer.start();
  buildBoard();
  render();
}

function onTick(seconds) {
  nodes.timer.textContent = formatTime(seconds);
  if (state && !state.solved) {
    state.elapsed = seconds;
    if (seconds % 5 === 0) persist();
  }
}

function persist() {
  if (!state) return;
  const target = state.solution.filter((v) => v === FILLED).length;
  const done = state.marks.filter((m, i) => m === PAINT && state.solution[i] === FILLED).length;
  session.save(GAME, { ...state, elapsed: timer?.seconds() ?? state.elapsed }, {
    label: `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.width}×${state.height}`,
    detail: state.solved ? 'Solved' : `${done}/${target} filled`,
  });
}

/* --- board ---------------------------------------------------------------- */

function buildBoard() {
  const { width, height, rowClues, colClues } = state;

  // Size cells so the whole puzzle plus its clue gutters fits the viewport.
  const longestRow = Math.max(...rowClues.map((c) => c.length));
  const longestCol = Math.max(...colClues.map((c) => c.length));
  const available = Math.min(nodes.layout.parentElement.clientWidth || 360, 560);
  const cell = Math.max(13, Math.min(30, Math.floor((available - longestRow * 13 - 12) / width)));
  const clueSize = Math.max(8, Math.round(cell * 0.46));

  nodes.layout.style.setProperty('--cell', `${cell}px`);
  nodes.layout.style.setProperty('--clue-size', `${clueSize}px`);

  nodes.board.style.gridTemplateColumns = `repeat(${width}, var(--cell))`;
  nodes.colClues.style.gridTemplateColumns = `repeat(${width}, var(--cell))`;
  nodes.colClues.style.minHeight = `${longestCol * clueSize * 1.25 + 6}px`;
  nodes.rowClues.style.gridTemplateRows = `repeat(${height}, var(--cell))`;

  nodes.colClues.replaceChildren(...colClues.map((clue, c) =>
    el('div', { class: 'nono-clue', dataset: { col: c } },
      clue.filter((n) => n > 0).map((n) => el('span', { text: String(n) })))));

  nodes.rowClues.replaceChildren(...rowClues.map((clue, r) =>
    el('div', { class: 'nono-clue', dataset: { row: r } },
      clue.filter((n) => n > 0).map((n) => el('span', { text: String(n) })))));

  nodes.cells = [];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < width * height; i++) {
    const r = Math.floor(i / width);
    const c = i % width;
    const node = el('button', {
      type: 'button', class: 'nono-cell', role: 'gridcell', dataset: { index: i },
      'aria-label': `Row ${r + 1} column ${c + 1}`,
    });
    if (c % 5 === 0 && c > 0) node.classList.add('block-col');
    if (r % 5 === 0 && r > 0) node.classList.add('block-row');
    nodes.cells.push(node);
    frag.append(node);
  }
  nodes.board.replaceChildren(frag);
  attachPainting();
}

/* --- painting ------------------------------------------------------------- */

let drag = null;

function attachPainting() {
  const indexFromPoint = (x, y) => {
    const node = document.elementFromPoint(x, y);
    return node?.classList.contains('nono-cell') ? Number(node.dataset.index) : -1;
  };

  const begin = (index, tool) => {
    if (!state || state.solved || index < 0) return;
    pushHistory();
    // Dragging applies one consistent action: whatever the first cell became.
    const current = state.marks[index];
    drag = { tool, value: current === tool ? BLANK : tool, touched: new Set() };
    apply(index);
  };

  const apply = (index) => {
    if (!drag || index < 0 || drag.touched.has(index)) return;
    drag.touched.add(index);
    setMark(index, drag.value);
  };

  nodes.board.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('.nono-cell');
    if (!node) return;
    event.preventDefault();
    nodes.board.setPointerCapture?.(event.pointerId);
    const tool = event.button === 2 || event.ctrlKey ? CROSS : state.tool;
    begin(Number(node.dataset.index), tool);
  });

  nodes.board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    apply(indexFromPoint(event.clientX, event.clientY));
  });

  const end = () => {
    if (!drag) return;
    drag = null;
    render();
    persist();
    if (isSolved()) finish();
  };

  nodes.board.addEventListener('pointerup', end);
  nodes.board.addEventListener('pointercancel', end);
  nodes.board.addEventListener('contextmenu', (event) => event.preventDefault());
}

function pushHistory() {
  state.history.push({ marks: state.marks.slice(), errors: state.errors });
  if (state.history.length > 60) state.history.shift();
}

function setMark(index, value) {
  const previous = state.marks[index];
  if (previous === value) return;
  state.marks[index] = value;

  // Painting a cell the picture does not contain is a real mistake; crossing
  // one out never is, so only the former counts.
  if (value === PAINT && state.solution[index] !== FILLED) {
    state.errors += 1;
    haptic(HAPTIC.reject);
  } else {
    haptic(HAPTIC.tap);
  }

  const node = nodes.cells[index];
  node.classList.toggle('filled', value === PAINT);
  node.classList.toggle('marked', value === CROSS);
  node.classList.toggle('is-error', value === PAINT && state.solution[index] !== FILLED);
}

function undo() {
  if (!state?.history.length || state.solved) { haptic(HAPTIC.reject); return; }
  const previous = state.history.pop();
  state.marks = previous.marks;
  state.errors = previous.errors;
  render();
  persist();
}

function isSolved() {
  for (let i = 0; i < state.solution.length; i++) {
    const wanted = state.solution[i] === FILLED;
    if (wanted !== (state.marks[i] === PAINT)) return false;
  }
  return true;
}

/* --- clue completion ------------------------------------------------------ */

/** Grey out a clue once its line matches, the standard progress cue. */
function lineDone(cells) {
  const runs = [];
  let run = 0;
  for (const filled of cells) {
    if (filled) run += 1;
    else if (run) { runs.push(run); run = 0; }
  }
  if (run) runs.push(run);
  return runs;
}

function sameRuns(a, b) {
  const left = a.filter((n) => n > 0);
  return left.length === b.length && left.every((n, i) => n === b[i]);
}

/* --- end of game ---------------------------------------------------------- */

function finish() {
  state.solved = true;
  timer.pause();
  state.elapsed = timer.seconds();
  render();
  persist();
  celebrate();
  haptic(HAPTIC.win);

  const { streak } = stats.record(GAME, {
    won: true, bucket: state.difficulty, timeSec: state.elapsed,
    daily: state.mode === 'daily', date: state.date,
  });

  resultDialog({
    title: 'Picture complete',
    bodyHtml: `<strong>${state.width}×${state.height}</strong> in <strong>${formatTime(state.elapsed)}</strong>` +
      `<br>${state.errors === 0 ? 'No mistakes.' : `${state.errors} mistake${state.errors === 1 ? '' : 's'}.`}` +
      (state.mode === 'daily' ? `<br>Daily streak: <strong>${streak}</strong>` : ''),
    primary: { label: 'New puzzle', onClick: () => start({ fresh: true }) },
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Nonogram', `${state.width}×${state.height}`,
      state.mode === 'daily' ? state.date : 'practice',
      formatTime(state.elapsed), state.errors === 0 ? 'flawless' : `${state.errors} errors`,
    ])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function openStats() {
  showStats(GAME, {
    title: 'Nonogram statistics',
    buckets: LEVELS.map((l) => ({ key: l, label: l[0].toUpperCase() + l.slice(1) })),
  });
}

/* --- rendering ------------------------------------------------------------ */

function setMode(mode) { if (state?.mode !== mode) { state.mode = mode; start({ fresh: true }); } }
function setDifficulty(level) { if (state?.difficulty !== level) { state.difficulty = level; start({ fresh: true }); } }
function setTool(tool) { state.tool = Number(tool); render(); }

function render() {
  if (!state) return;

  nodes.modeTabs.querySelectorAll('[data-mode]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  nodes.levelTabs.querySelectorAll('[data-level]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.level === state.difficulty)));
  nodes.toolTabs.querySelectorAll('[data-tool]').forEach((b) =>
    b.setAttribute('aria-checked', String(Number(b.dataset.tool) === state.tool)));

  const { width, height } = state;
  const target = state.solution.filter((v) => v === FILLED).length;
  const done = state.marks.filter((m, i) => m === PAINT && state.solution[i] === FILLED).length;
  nodes.progress.textContent = `${done}/${target}`;
  nodes.mistakes.textContent = String(state.errors);

  for (let i = 0; i < state.marks.length; i++) {
    const node = nodes.cells[i];
    const mark = state.marks[i];
    node.classList.toggle('filled', mark === PAINT);
    node.classList.toggle('marked', mark === CROSS);
    node.classList.toggle('is-error', mark === PAINT && state.solution[i] !== FILLED);
  }

  for (let r = 0; r < height; r++) {
    const cells = Array.from({ length: width }, (_, c) => state.marks[r * width + c] === PAINT);
    nodes.rowClues.children[r]?.classList.toggle('is-done', sameRuns(state.rowClues[r], lineDone(cells)));
  }
  for (let c = 0; c < width; c++) {
    const cells = Array.from({ length: height }, (_, r) => state.marks[r * width + c] === PAINT);
    nodes.colClues.children[c]?.classList.toggle('is-done', sameRuns(state.colClues[c], lineDone(cells)));
  }
}

/* --- keyboard ------------------------------------------------------------- */

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); undo(); }
  if (event.key === 'x' || event.key === 'X') { event.preventDefault(); setTool(state.tool === PAINT ? CROSS : PAINT); }
});

document.addEventListener('visibilitychange', () => {
  if (!state || state.solved) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

window.addEventListener('resize', () => { if (state) { buildBoard(); render(); } });

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.solution && saved.marks) restore(saved);
else start();

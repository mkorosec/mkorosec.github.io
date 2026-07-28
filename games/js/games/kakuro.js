/* Kakuro: daily and practice, pencil marks, undo, combination helper. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, iconSvg, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { dateKey, dailySeed } from '../core/rng.js';
import { buildRuns, combosFor } from '../gen/kakuro.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'kakuro';
const LEVELS = ['easy', 'medium', 'hard'];

let state = null;
let timer = null;
let runs = null;
const nodes = {};

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.modeTabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Mode' },
    [['daily', 'Daily'], ['practice', 'Practice']].map(([value, label]) =>
      el('button', { type: 'button', class: 'segmented__item', role: 'tab',
        dataset: { mode: value }, text: label, onclick: () => setMode(value) })));

  nodes.levelTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Difficulty' },
    LEVELS.map((level) => el('button', { type: 'button', class: 'segmented__item', role: 'radio',
      dataset: { level }, text: level[0].toUpperCase() + level.slice(1),
      onclick: () => setDifficulty(level) })));

  nodes.timer = el('span', { class: 'hud__value', text: '00:00' });
  nodes.filled = el('span', { class: 'hud__value', text: '0' });
  nodes.board = el('div', { class: 'kakuro-board', role: 'grid', 'aria-label': 'Kakuro grid' });
  nodes.combo = el('p', { class: 'combo-help' });
  nodes.keypad = el('div', { class: 'keypad' });
  nodes.tools = el('div', { class: 'keypad', style: 'margin-top:8px' });

  app.append(
    appBar({
      title: 'Kakuro',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New puzzle', onClick: () => start({ fresh: true }) },
      ],
    }),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center' },
      [nodes.modeTabs, nodes.levelTabs]),
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.timer]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Filled' }), nodes.filled]),
    ]),
    el('div', { class: 'board-frame' }, [nodes.board]),
    nodes.combo,
    nodes.keypad,
    nodes.tools,
  );

  nodes.keys = Array.from({ length: 9 }, (_, k) => el('button', {
    type: 'button', class: 'keypad__key', text: String(k + 1),
    'aria-label': `Enter ${k + 1}`, onclick: () => enterDigit(k + 1),
  }));
  nodes.keypad.replaceChildren(...nodes.keys);

  nodes.noteToggle = el('button', {
    type: 'button', class: 'keypad__key', 'aria-pressed': 'false',
    'aria-label': 'Pencil marks', title: 'Pencil marks (N)',
    html: iconSvg('pencil'), onclick: toggleNotes,
  });

  nodes.tools.replaceChildren(
    nodes.noteToggle,
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Undo', title: 'Undo (Z)',
      html: iconSvg('undo'), onclick: undo }),
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Erase', title: 'Erase',
      html: iconSvg('erase'), onclick: () => enterDigit(0) }),
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
  const puzzle = await generate('kakuro', { difficulty, seed });
  if (!puzzle) { toast('Could not build a puzzle. Try again.'); return; }

  state = {
    mode, difficulty, date: today,
    size: puzzle.size,
    grid: puzzle.grid,
    clues: puzzle.clues,
    solution: puzzle.solution,
    board: new Array(puzzle.size * puzzle.size).fill(0),
    notes: Array.from({ length: puzzle.size * puzzle.size }, () => []),
    selected: -1,
    noteMode: false,
    history: [],
    solved: false,
    elapsed: 0,
  };

  runs = buildRuns(state.size, state.grid);
  timer = createTimer(onTick);
  timer.reset(0);
  timer.start();
  buildBoard();
  render();
  persist();
}

function restore(saved) {
  state = { ...saved, history: saved.history || [] };
  runs = buildRuns(state.size, state.grid);
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
  const open = openCells().length;
  const done = openCells().filter((i) => state.board[i]).length;
  session.save(GAME, { ...state, elapsed: timer?.seconds() ?? state.elapsed }, {
    label: `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.difficulty}`,
    detail: state.solved ? 'Solved' : `${done}/${open} filled`,
  });
}

const openCells = () => {
  const out = [];
  for (let i = 0; i < state.size * state.size; i++) if (state.grid[i] === 0) out.push(i);
  return out;
};

/* --- board ---------------------------------------------------------------- */

function buildBoard() {
  nodes.board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  nodes.cells = [];
  const frag = document.createDocumentFragment();

  for (let i = 0; i < state.size * state.size; i++) {
    if (state.grid[i] === 0) {
      const cell = el('button', {
        type: 'button', class: 'kakuro-cell is-open', role: 'gridcell',
        onclick: () => selectCell(i),
      });
      nodes.cells.push(cell);
      frag.append(cell);
      continue;
    }

    const clue = state.clues[i];
    const cell = el('div', { class: 'kakuro-cell is-block', role: 'gridcell' });
    if (clue && (clue.across !== undefined || clue.down !== undefined)) {
      cell.classList.add('kakuro-clue');
      const parts = [];
      if (clue.down !== undefined) parts.push(el('span', { class: 'down', text: String(clue.down) }));
      if (clue.across !== undefined) parts.push(el('span', { class: 'across', text: String(clue.across) }));
      cell.append(...parts);
      cell.setAttribute('aria-label', [
        clue.across !== undefined ? `across ${clue.across}` : '',
        clue.down !== undefined ? `down ${clue.down}` : '',
      ].filter(Boolean).join(', '));
    }
    nodes.cells.push(cell);
    frag.append(cell);
  }

  nodes.board.replaceChildren(frag);
}

/* --- interaction ---------------------------------------------------------- */

function setMode(mode) { if (state?.mode !== mode) { state.mode = mode; start({ fresh: true }); } }
function setDifficulty(level) { if (state?.difficulty !== level) { state.difficulty = level; start({ fresh: true }); } }

function selectCell(index) {
  if (!state || state.solved) return;
  state.selected = index;
  render();
}

function pushHistory() {
  state.history.push({ board: state.board.slice(), notes: state.notes.map((n) => n.slice()) });
  if (state.history.length > 150) state.history.shift();
}

function enterDigit(digit) {
  if (!state || state.solved) return;
  const i = state.selected;
  if (i < 0 || state.grid[i] !== 0) { toast('Pick a cell first'); return; }

  pushHistory();

  if (digit === 0) {
    state.board[i] = 0;
    state.notes[i] = [];
  } else if (state.noteMode) {
    const notes = state.notes[i];
    const at = notes.indexOf(digit);
    if (at >= 0) notes.splice(at, 1); else notes.push(digit);
    state.board[i] = 0;
  } else {
    state.board[i] = digit;
    state.notes[i] = [];
  }

  haptic(HAPTIC.tap);

  if (isComplete()) { finish(); return; }
  render();
  persist();
}

function toggleNotes() {
  state.noteMode = !state.noteMode;
  nodes.noteToggle.setAttribute('aria-pressed', String(state.noteMode));
  haptic(HAPTIC.tap);
}

function undo() {
  if (!state?.history.length || state.solved) { haptic(HAPTIC.reject); return; }
  const previous = state.history.pop();
  state.board = previous.board;
  state.notes = previous.notes;
  render();
  persist();
}

/* --- validation ----------------------------------------------------------- */

function runStatus(run, target) {
  let sum = 0;
  const seen = new Set();
  let filled = 0;
  let duplicate = false;
  for (const c of run.cells) {
    const v = state.board[c];
    if (!v) continue;
    filled += 1;
    if (seen.has(v)) duplicate = true;
    seen.add(v);
    sum += v;
  }
  const complete = filled === run.cells.length;
  return { sum, complete, duplicate, wrong: duplicate || (complete && sum !== target) || sum > target };
}

function cellHasError(index) {
  if (!state.board[index]) return false;
  const across = runs.across[runs.cellAcross[index]];
  const down = runs.down[runs.cellDown[index]];
  if (across && runStatus(across, state.clues[across.clueIdx].across).wrong) return true;
  if (down && runStatus(down, state.clues[down.clueIdx].down).wrong) return true;
  return false;
}

function isComplete() {
  for (const i of openCells()) if (!state.board[i]) return false;
  for (const run of runs.across) if (runStatus(run, state.clues[run.clueIdx].across).wrong) return false;
  for (const run of runs.down) if (runStatus(run, state.clues[run.clueIdx].down).wrong) return false;
  return true;
}

/* --- combination helper --------------------------------------------------- */

function comboText() {
  const i = state.selected;
  if (i < 0 || state.grid[i] !== 0) return '';

  const describe = (run, target, label) => {
    const combos = combosFor(run.cells.length, target);
    if (!combos.length) return '';
    const digitsOf = (mask) => {
      const out = [];
      for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) out.push(d);
      return out.join('');
    };
    const shown = combos.slice(0, 4).map(digitsOf).join(', ');
    const more = combos.length > 4 ? ` +${combos.length - 4} more` : '';
    return `<strong>${target}</strong> in ${run.cells.length} ${label}: ${shown}${more}`;
  };

  const across = runs.across[runs.cellAcross[i]];
  const down = runs.down[runs.cellDown[i]];
  return [
    across ? describe(across, state.clues[across.clueIdx].across, 'across') : '',
    down ? describe(down, state.clues[down.clueIdx].down, 'down') : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');
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
    title: 'Solved',
    bodyHtml: `<strong>${state.difficulty}</strong> in <strong>${formatTime(state.elapsed)}</strong>` +
      (state.mode === 'daily' ? `<br>Daily streak: <strong>${streak}</strong>` : ''),
    primary: { label: 'New puzzle', onClick: () => start({ fresh: true }) },
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader(
      ['Kakuro', state.mode === 'daily' ? `Daily ${state.date}` : 'Practice',
        state.difficulty, formatTime(state.elapsed)])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function openStats() {
  showStats(GAME, {
    title: 'Kakuro statistics',
    buckets: LEVELS.map((l) => ({ key: l, label: l[0].toUpperCase() + l.slice(1) })),
  });
}

/* --- rendering ------------------------------------------------------------ */

function render() {
  if (!state) return;

  nodes.modeTabs.querySelectorAll('[data-mode]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  nodes.levelTabs.querySelectorAll('[data-level]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.level === state.difficulty)));

  const open = openCells();
  nodes.filled.textContent = `${open.filter((i) => state.board[i]).length}/${open.length}`;

  const selected = state.selected;
  const inRun = new Set();
  if (selected >= 0 && state.grid[selected] === 0) {
    const across = runs.across[runs.cellAcross[selected]];
    const down = runs.down[runs.cellDown[selected]];
    across?.cells.forEach((c) => inRun.add(c));
    down?.cells.forEach((c) => inRun.add(c));
  }

  for (const i of open) {
    const cell = nodes.cells[i];
    cell.className = 'kakuro-cell is-open';
    if (i === selected) cell.classList.add('is-selected');
    else if (inRun.has(i)) cell.classList.add('is-run');
    if (cellHasError(i)) cell.classList.add('is-error');

    const value = state.board[i];
    if (value) {
      cell.textContent = String(value);
    } else if (state.notes[i]?.length) {
      cell.textContent = '';
      cell.append(el('span', { class: 'kakuro-notes' },
        Array.from({ length: 9 }, (_, k) =>
          el('span', { text: state.notes[i].includes(k + 1) ? String(k + 1) : '' }))));
    } else {
      cell.textContent = '';
    }

    const r = Math.floor(i / state.size) + 1;
    const c = (i % state.size) + 1;
    cell.setAttribute('aria-label', `Row ${r} column ${c}${value ? `, ${value}` : ', empty'}`);
  }

  nodes.combo.innerHTML = comboText();

  const selectedValue = selected >= 0 ? state.board[selected] : 0;
  nodes.keys.forEach((key, k) => key.setAttribute('aria-pressed', String(selectedValue === k + 1)));
}

/* --- keyboard ------------------------------------------------------------- */

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;

  if (key >= '1' && key <= '9') { event.preventDefault(); enterDigit(Number(key)); return; }
  if (key === 'Backspace' || key === 'Delete' || key === '0') { event.preventDefault(); enterDigit(0); return; }
  if (key === 'n' || key === 'N') { event.preventDefault(); toggleNotes(); return; }
  if (key === 'z' || key === 'Z') { event.preventDefault(); undo(); return; }
  if (key === 'Escape') { state.selected = -1; render(); return; }

  const deltas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (!deltas[key]) return;
  event.preventDefault();

  const open = openCells();
  if (state.selected < 0) { state.selected = open[0]; render(); return; }

  const [dr, dc] = deltas[key];
  let r = Math.floor(state.selected / state.size);
  let c = state.selected % state.size;
  for (let step = 0; step < state.size; step++) {
    r += dr; c += dc;
    if (r < 0 || r >= state.size || c < 0 || c >= state.size) break;
    const idx = r * state.size + c;
    if (state.grid[idx] === 0) { state.selected = idx; render(); return; }
  }
});

document.addEventListener('visibilitychange', () => {
  if (!state || state.solved) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.grid && saved.solution) restore(saved);
else start();

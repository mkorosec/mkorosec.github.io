/* Killer Sudoku: cages carry a sum and may not repeat a digit. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, iconSvg, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { dateKey, dailySeed } from '../core/rng.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'killer';
const LEVELS = ['easy', 'medium', 'hard'];

let state = null;
let timer = null;
const nodes = {};

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const isPeer = (a, b) => a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

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
  nodes.cageInfo = el('span', { class: 'hud__value', text: '—' });
  nodes.board = el('div', { class: 'killer-board', role: 'grid', 'aria-label': 'Killer sudoku grid' });
  nodes.keypad = el('div', { class: 'keypad' });
  nodes.tools = el('div', { class: 'keypad', style: 'margin-top:8px' });

  app.append(
    appBar({
      title: 'Killer Sudoku',
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
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Cage' }), nodes.cageInfo]),
    ]),
    el('div', { class: 'board-frame' }, [nodes.board]),
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
    'aria-label': 'Pencil marks', html: iconSvg('pencil'), onclick: toggleNotes,
  });

  nodes.tools.replaceChildren(
    nodes.noteToggle,
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Undo',
      html: iconSvg('undo'), onclick: undo }),
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Erase',
      html: iconSvg('erase'), onclick: () => enterDigit(0) }),
  );
}

/* --- lifecycle ------------------------------------------------------------ */

async function start({ fresh = false } = {}) {
  const mode = state?.mode || 'daily';
  const difficulty = state?.difficulty || 'easy';
  const today = dateKey();

  timer?.pause();
  nodes.board.replaceChildren(el('div', { class: 'placeholder', style: 'grid-column:1/-1' },
    [el('div', { class: 'spinner' }), 'Building a puzzle…']));
  await nextPaint();

  const seed = mode === 'daily' && !fresh ? dailySeed(`${GAME}:${difficulty}`, today) : null;
  const puzzle = await generate('killer', { difficulty, seed });
  if (!puzzle) { toast('Could not build a puzzle. Try again.'); return; }

  state = {
    mode, difficulty, date: today,
    cages: puzzle.cages,
    cageOf: puzzle.cageOf,
    givens: puzzle.givens,
    solution: puzzle.solution,
    board: puzzle.givens.slice(),
    notes: Array.from({ length: 81 }, () => []),
    selected: -1,
    noteMode: false,
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
  session.save(GAME, { ...state, elapsed: timer?.seconds() ?? state.elapsed }, {
    label: `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.difficulty}`,
    detail: state.solved ? 'Solved' : `${state.board.filter(Boolean).length}/81 filled`,
  });
}

/* --- board ---------------------------------------------------------------- */

function buildBoard() {
  nodes.cells = [];
  const frag = document.createDocumentFragment();

  // The sum label goes on the cage's top-left cell, and each cell draws only
  // the dashed edges where its cage stops.
  const sumCell = new Map();
  for (const [index, cage] of state.cages.entries()) {
    sumCell.set(index, Math.min(...cage.cells));
  }

  for (let i = 0; i < 81; i++) {
    const cell = el('button', {
      type: 'button', class: 'killer-cell', role: 'gridcell',
      onclick: () => selectCell(i),
    });

    const cage = state.cageOf[i];
    const edge = (neighbour, sameRow) => {
      if (neighbour < 0 || neighbour > 80) return 'dashed';
      if (sameRow && rowOf(neighbour) !== rowOf(i)) return 'dashed';
      return state.cageOf[neighbour] === cage ? 'none' : 'dashed';
    };

    const outline = el('span', { class: 'killer-cage-line' });
    outline.style.setProperty('--edge-top', edge(i - 9, false));
    outline.style.setProperty('--edge-bottom', edge(i + 9, false));
    outline.style.setProperty('--edge-left', colOf(i) === 0 ? 'dashed' : edge(i - 1, true));
    outline.style.setProperty('--edge-right', colOf(i) === 8 ? 'dashed' : edge(i + 1, true));
    cell.append(outline);

    if (sumCell.get(cage) === i) {
      cell.append(el('span', { class: 'killer-sum', text: String(state.cages[cage].sum) }));
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
  if (i < 0) { toast('Pick a cell first'); return; }
  if (state.givens[i]) { haptic(HAPTIC.reject); return; }

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

  if (state.board.every((v, k) => v === state.solution[k])) { finish(); return; }
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

function cageStatus(cageIndex) {
  const cage = state.cages[cageIndex];
  let sum = 0;
  let filled = 0;
  const seen = new Set();
  let duplicate = false;
  for (const c of cage.cells) {
    const v = state.board[c];
    if (!v) continue;
    filled += 1;
    if (seen.has(v)) duplicate = true;
    seen.add(v);
    sum += v;
  }
  const complete = filled === cage.cells.length;
  return { sum, complete, duplicate, target: cage.sum, wrong: duplicate || sum > cage.sum || (complete && sum !== cage.sum) };
}

function cellWrong(i) {
  const v = state.board[i];
  if (!v) return false;
  for (let k = 0; k < 81; k++) {
    if (k !== i && state.board[k] === v && isPeer(i, k)) return true;
  }
  return cageStatus(state.cageOf[i]).wrong;
}

/* --- end ------------------------------------------------------------------ */

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
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Killer Sudoku', state.mode === 'daily' ? `Daily ${state.date}` : 'Practice',
      state.difficulty, formatTime(state.elapsed),
    ])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function openStats() {
  showStats(GAME, {
    title: 'Killer Sudoku statistics',
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

  nodes.filled.textContent = `${state.board.filter(Boolean).length}/81`;

  const selected = state.selected;
  const cage = selected >= 0 ? state.cageOf[selected] : -1;
  nodes.cageInfo.textContent = cage >= 0
    ? `${cageStatus(cage).sum}/${state.cages[cage].sum}`
    : '—';

  for (let i = 0; i < 81; i++) {
    const cell = nodes.cells[i];
    const value = state.board[i];

    cell.classList.toggle('is-given', !!state.givens[i]);
    cell.classList.toggle('is-selected', i === selected);
    cell.classList.toggle('is-peer', selected >= 0 && i !== selected && isPeer(i, selected)
      && state.cageOf[i] !== cage);
    cell.classList.toggle('is-cage', selected >= 0 && i !== selected && state.cageOf[i] === cage);
    cell.classList.toggle('is-wrong', cellWrong(i));

    // Keep the cage outline and sum label; replace only the value/notes.
    cell.querySelector('.killer-value')?.remove();
    cell.querySelector('.killer-notes')?.remove();

    if (value) {
      cell.append(el('span', { class: 'killer-value', text: String(value) }));
    } else if (state.notes[i]?.length) {
      cell.append(el('span', { class: 'killer-notes' },
        Array.from({ length: 9 }, (_, k) =>
          el('span', { text: state.notes[i].includes(k + 1) ? String(k + 1) : '' }))));
    }

    cell.setAttribute('aria-label',
      `Row ${rowOf(i) + 1} column ${colOf(i) + 1}${value ? `, ${value}` : ', empty'}, cage sum ${state.cages[state.cageOf[i]].sum}`);
  }

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
  if (state.selected < 0) { state.selected = 0; render(); return; }
  const [dr, dc] = deltas[key];
  const r = (rowOf(state.selected) + dr + 9) % 9;
  const c = (colOf(state.selected) + dc + 9) % 9;
  state.selected = r * 9 + c;
  render();
});

document.addEventListener('visibilitychange', () => {
  if (!state || state.solved) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.cages && saved.solution) restore(saved);
else start();

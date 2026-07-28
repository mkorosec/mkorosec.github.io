/* Sudoku: daily and practice, pencil marks, undo, hints, saved progress. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog, createDialog, iconSvg, nextPaint } from '../core/ui.js';
import { generate } from '../core/generate.js';
import { dateKey, dailySeed } from '../core/rng.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { read, write } from '../core/store.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'sudoku';
const LEVELS = ['easy', 'medium', 'hard'];
const MISTAKE_LIMIT = 3;
const HINT_ALLOWANCE = 3;

const SETTINGS_KEY = 'settings:sudoku';
const defaults = { mistakeLimit: true, highlightPeers: true, autoClean: true };
const settings = { ...defaults, ...read(SETTINGS_KEY, {}) };
const saveSettings = () => write(SETTINGS_KEY, settings);

/* --- state ---------------------------------------------------------------- */

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
      el('button', {
        type: 'button', class: 'segmented__item', role: 'tab', dataset: { mode: value },
        text: label, onclick: () => setMode(value),
      })));

  nodes.levelTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Difficulty' },
    LEVELS.map((level) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { level },
      text: level[0].toUpperCase() + level.slice(1), onclick: () => setDifficulty(level),
    })));

  nodes.timer = el('span', { class: 'hud__value', text: '00:00' });
  nodes.mistakes = el('span', { class: 'mistake-dots' },
    Array.from({ length: MISTAKE_LIMIT }, () => el('span', { class: 'mistake-dot' })));
  nodes.hints = el('span', { class: 'hud__value', text: String(HINT_ALLOWANCE) });
  nodes.label = el('span', { class: 'hud__value', text: '' });

  nodes.board = el('div', { class: 'sudoku-board', role: 'grid', 'aria-label': 'Sudoku grid' });
  nodes.keypad = el('div', { class: 'keypad', role: 'group', 'aria-label': 'Number pad' });
  nodes.tools = el('div', { class: 'keypad', style: 'margin-top:8px' });

  app.append(
    appBar({
      title: 'Sudoku',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'settings', icon: 'settings', label: 'Settings', onClick: openSettings },
        { name: 'new', icon: 'refresh', label: 'New puzzle', onClick: () => startGame({ fresh: true }) },
      ],
    }),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center' },
      [nodes.modeTabs, nodes.levelTabs]),
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.timer]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Mistakes' }), nodes.mistakes]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Hints' }), nodes.hints]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Puzzle' }), nodes.label]),
    ]),
    el('div', { class: 'board-frame' }, [nodes.board]),
    nodes.keypad,
    nodes.tools,
  );

  buildBoard();
  buildKeypad();
}

function buildBoard() {
  nodes.cells = [];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 81; i++) {
    const cell = el('button', {
      type: 'button', class: 'sudoku-cell', role: 'gridcell',
      onclick: () => selectCell(i),
    });
    nodes.cells.push(cell);
    frag.append(cell);
  }
  nodes.board.replaceChildren(frag);
}

function buildKeypad() {
  nodes.keys = [];
  nodes.keypad.replaceChildren(...Array.from({ length: 9 }, (_, k) => {
    const digit = k + 1;
    const count = el('span', { class: 'keypad__count' });
    const key = el('button', {
      type: 'button', class: 'keypad__key', onclick: () => enterDigit(digit),
    }, [String(digit), count]);
    key._count = count;
    nodes.keys.push(key);
    return key;
  }));

  nodes.noteToggle = el('button', {
    type: 'button', class: 'keypad__key', 'aria-pressed': 'false',
    'aria-label': 'Pencil marks', title: 'Pencil marks (N)',
    html: iconSvg('pencil'), onclick: toggleNotes,
  });

  nodes.tools.replaceChildren(
    nodes.noteToggle,
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Undo', title: 'Undo (Z)',
      html: iconSvg('undo'), onclick: undo }),
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Erase', title: 'Erase (Backspace)',
      html: iconSvg('erase'), onclick: () => enterDigit(0) }),
    el('button', { type: 'button', class: 'keypad__key', 'aria-label': 'Hint', title: 'Hint (H)',
      html: iconSvg('hint'), onclick: useHint }),
  );
}

/* --- game lifecycle ------------------------------------------------------- */

function emptyNotes() { return Array.from({ length: 81 }, () => []); }

async function startGame({ fresh = false } = {}) {
  const mode = state?.mode || 'daily';
  const difficulty = state?.difficulty || 'medium';
  const today = dateKey();

  if (mode === 'daily' && !fresh && stats.dailyDone(GAME, today)) {
    // Already played today: show the result rather than silently replaying.
    const done = session.load(GAME);
    if (done?.date === today && (done.solved || done.failed)) {
      restore(done);
      return;
    }
  }

  timer?.pause();
  showLoading();

  const seed = mode === 'daily' ? dailySeed(`${GAME}:${difficulty}`, today) : null;
  await nextPaint();

  const puzzle = await generate('sudoku', { difficulty, seed });
  if (!puzzle) { toast('Could not build a puzzle. Try again.'); return; }

  state = {
    mode,
    difficulty,
    date: today,
    puzzle: puzzle.puzzle,
    solution: puzzle.solution,
    board: puzzle.puzzle.slice(),
    notes: emptyNotes(),
    selected: -1,
    mistakes: 0,
    hintsUsed: 0,
    noteMode: false,
    history: [],
    solved: false,
    failed: false,
    elapsed: 0,
    rating: puzzle.rating,
  };

  timer = createTimer(onTick);
  timer.reset(0);
  timer.start();
  render();
  persist();
}

function showLoading() {
  nodes.board.replaceChildren(el('div', {
    class: 'placeholder',
    style: 'grid-column:1/-1;align-self:center',
  }, [el('div', { class: 'spinner' }), 'Building a puzzle…']));
}

function restore(saved) {
  state = { ...saved, history: saved.history || [] };
  timer = createTimer(onTick);
  timer.reset(saved.elapsed || 0);
  buildBoard();
  if (!state.solved && !state.failed) timer.start();
  render();
}

function onTick(seconds) {
  nodes.timer.textContent = formatTime(seconds);
  if (state && !state.solved && !state.failed) {
    state.elapsed = seconds;
    if (seconds % 5 === 0) persist();
  }
}

function persist() {
  if (!state) return;
  const filled = state.board.filter(Boolean).length;
  session.save(GAME, { ...state, elapsed: timer?.seconds() ?? state.elapsed }, {
    label: state.solved ? 'Solved' : `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.difficulty}`,
    detail: state.solved || state.failed ? '' : `${filled}/81 filled · ${formatTime(state.elapsed)}`,
  });
}

/* --- interaction ---------------------------------------------------------- */

function setMode(mode) {
  if (state?.mode === mode) return;
  state = { ...(state || {}), mode };
  startGame({ fresh: true });
}

function setDifficulty(difficulty) {
  if (state?.difficulty === difficulty) return;
  state = { ...(state || {}), difficulty };
  startGame({ fresh: true });
}

function selectCell(index) {
  if (!state || state.solved || state.failed) return;
  state.selected = index;
  render();
}

function pushHistory() {
  state.history.push({
    board: state.board.slice(),
    notes: state.notes.map((n) => n.slice()),
    mistakes: state.mistakes,
  });
  if (state.history.length > 200) state.history.shift();
}

function enterDigit(digit) {
  if (!state || state.solved || state.failed) return;
  const index = state.selected;
  if (index < 0) { toast('Pick a cell first'); return; }
  if (state.puzzle[index] !== 0) { haptic(HAPTIC.reject); return; }

  pushHistory();

  if (digit === 0) {
    state.board[index] = 0;
    state.notes[index] = [];
    haptic(HAPTIC.tap);
    render();
    persist();
    return;
  }

  if (state.noteMode) {
    const notes = state.notes[index];
    const at = notes.indexOf(digit);
    if (at >= 0) notes.splice(at, 1); else notes.push(digit);
    state.board[index] = 0;
    haptic(HAPTIC.tap);
    render();
    persist();
    return;
  }

  state.board[index] = digit;
  state.notes[index] = [];

  if (settings.autoClean) {
    for (let i = 0; i < 81; i++) {
      if (!isPeer(i, index)) continue;
      const at = state.notes[i].indexOf(digit);
      if (at >= 0) state.notes[i].splice(at, 1);
    }
  }

  if (digit !== state.solution[index]) {
    state.mistakes += 1;
    haptic(HAPTIC.reject);
    if (settings.mistakeLimit && state.mistakes >= MISTAKE_LIMIT) {
      finish(false);
      return;
    }
  } else {
    haptic(HAPTIC.commit);
  }

  if (state.board.every((v, i) => v === state.solution[i])) { finish(true); return; }

  render();
  persist();
}

function toggleNotes() {
  if (!state) return;
  state.noteMode = !state.noteMode;
  nodes.noteToggle.setAttribute('aria-pressed', String(state.noteMode));
  haptic(HAPTIC.tap);
}

function undo() {
  if (!state || !state.history.length || state.solved || state.failed) return;
  const previous = state.history.pop();
  state.board = previous.board;
  state.notes = previous.notes;
  state.mistakes = previous.mistakes;
  haptic(HAPTIC.tap);
  render();
  persist();
}

function useHint() {
  if (!state || state.solved || state.failed) return;
  if (state.hintsUsed >= HINT_ALLOWANCE) { toast('No hints left'); haptic(HAPTIC.reject); return; }

  const empty = [];
  for (let i = 0; i < 81; i++) {
    if (state.board[i] !== state.solution[i]) empty.push(i);
  }
  if (!empty.length) return;

  const target = state.selected >= 0 && empty.includes(state.selected)
    ? state.selected
    : empty[Math.floor(Math.random() * empty.length)];

  pushHistory();
  state.hintsUsed += 1;
  state.board[target] = state.solution[target];
  state.notes[target] = [];
  state.selected = target;
  haptic(HAPTIC.commit);

  if (state.board.every((v, i) => v === state.solution[i])) { finish(true); return; }

  render();
  nodes.cells[target].classList.add('is-hinted');
  persist();
}

/* --- end of game ---------------------------------------------------------- */

function finish(won) {
  state.solved = won;
  state.failed = !won;
  timer.pause();
  const seconds = timer.seconds();
  state.elapsed = seconds;
  render();
  persist();

  const { streak } = stats.record(GAME, {
    won,
    bucket: state.difficulty,
    timeSec: seconds,
    daily: state.mode === 'daily',
    date: state.date,
  });

  if (won) {
    haptic(HAPTIC.win);
    celebrate();
  }

  const summary = stats.summary(GAME, state.difficulty);
  const lines = won
    ? `<strong>${state.difficulty}</strong> in <strong>${formatTime(seconds)}</strong><br>` +
      `${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'}, ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` +
      (state.mode === 'daily' ? `<br>Daily streak: <strong>${streak}</strong>` : '') +
      (summary.bestTime === seconds && summary.won > 1 ? '<br>New best time.' : '')
    : `Three mistakes on <strong>${state.difficulty}</strong>.<br>Turn the mistake limit off in settings to play without it.`;

  resultDialog({
    title: won ? 'Solved' : 'Out of lives',
    bodyHtml: lines,
    primary: { label: state.mode === 'daily' ? 'Play practice' : 'New puzzle',
      onClick: () => { if (state.mode === 'daily') setMode('practice'); else startGame({ fresh: true }); } },
    extra: won ? { label: 'Share result', onClick: share } : null,
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

function share() {
  const header = shareHeader([
    'Sudoku',
    state.mode === 'daily' ? `Daily ${state.date}` : 'Practice',
    state.difficulty,
    formatTime(state.elapsed),
  ]);
  const detail = `${state.mistakes === 0 ? 'Flawless' : `${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'}`}` +
    `${state.hintsUsed ? `, ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ', no hints'}`;
  shareResult(`${header}\n${detail}`);
}

/* --- dialogs -------------------------------------------------------------- */

function openStats() {
  showStats(GAME, {
    title: 'Sudoku statistics',
    buckets: LEVELS.map((level) => ({ key: level, label: level[0].toUpperCase() + level.slice(1) })),
  });
}

function openSettings() {
  const dlg = createDialog({ wide: true });

  const toggle = (key, label, hint) => {
    const btn = el('button', {
      type: 'button', class: 'switch', role: 'switch',
      'aria-checked': String(settings[key]), 'aria-label': label,
    });
    btn.addEventListener('click', () => {
      settings[key] = !settings[key];
      btn.setAttribute('aria-checked', String(settings[key]));
      saveSettings();
      render();
    });
    return el('div', { class: 'setting' }, [
      el('div', { class: 'setting__text' }, [
        el('div', { class: 'setting__label', text: label }),
        el('div', { class: 'setting__hint', text: hint }),
      ]),
      btn,
    ]);
  };

  dlg.setContent(
    el('div', { class: 'dialog__header' }, [
      el('h2', { class: 'dialog__title', style: 'margin:0', text: 'Settings' }),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close',
        html: iconSvg('close'), onclick: () => dlg.close() }),
    ]),
    toggle('mistakeLimit', 'Three-mistake limit',
      'Off means a wrong digit is still flagged, but the puzzle never ends on you.'),
    toggle('highlightPeers', 'Highlight row, column and box',
      'Shades the cells that constrain the one you picked.'),
    toggle('autoClean', 'Tidy pencil marks',
      'Removes a digit from the notes of every affected cell when you place it.'),
  );
  dlg.open();
}

/* --- rendering ------------------------------------------------------------ */

function render() {
  if (!state) return;

  nodes.modeTabs.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.mode === state.mode));
  });
  nodes.levelTabs.querySelectorAll('[data-level]').forEach((btn) => {
    btn.setAttribute('aria-checked', String(btn.dataset.level === state.difficulty));
  });
  nodes.label.textContent = state.mode === 'daily' ? state.date.slice(5) : (state.rating || state.difficulty);

  nodes.mistakes.querySelectorAll('.mistake-dot').forEach((dot, i) => {
    dot.classList.toggle('is-used', i < state.mistakes);
  });
  nodes.hints.textContent = String(HINT_ALLOWANCE - state.hintsUsed);

  if (nodes.cells.length !== 81 || !nodes.board.contains(nodes.cells[0])) buildBoard();

  const selected = state.selected;
  const selectedValue = selected >= 0 ? state.board[selected] : 0;

  for (let i = 0; i < 81; i++) {
    const cell = nodes.cells[i];
    const value = state.board[i];
    const given = state.puzzle[i] !== 0;
    const wrong = value !== 0 && value !== state.solution[i];

    cell.className = 'sudoku-cell';
    if (given) cell.classList.add('is-given');
    if (wrong) cell.classList.add('is-wrong');
    if (i === selected) cell.classList.add('is-selected');
    else if (settings.highlightPeers && selected >= 0 && isPeer(i, selected)) cell.classList.add('is-peer');
    if (selectedValue && value === selectedValue && i !== selected) cell.classList.add('is-match');

    if (value) {
      cell.textContent = String(value);
    } else if (state.notes[i]?.length) {
      cell.textContent = '';
      cell.append(el('span', { class: 'sudoku-notes' },
        Array.from({ length: 9 }, (_, k) =>
          el('span', { text: state.notes[i].includes(k + 1) ? String(k + 1) : '' }))));
    } else {
      cell.textContent = '';
    }

    cell.setAttribute('aria-label',
      `Row ${rowOf(i) + 1} column ${colOf(i) + 1}${value ? `, ${value}` : ', empty'}${given ? ', given' : ''}`);
  }

  const counts = new Array(10).fill(0);
  for (const v of state.board) if (v) counts[v] += 1;
  nodes.keys.forEach((key, k) => {
    const digit = k + 1;
    const left = 9 - counts[digit];
    key._count.textContent = String(Math.max(0, left));
    key.classList.toggle('is-exhausted', left <= 0);
    key.setAttribute('aria-pressed', String(selectedValue === digit));
    key.setAttribute('aria-label', `Place ${digit}, ${Math.max(0, left)} remaining`);
  });
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
  if (key === 'h' || key === 'H') { event.preventDefault(); useHint(); return; }
  if (key === 'Escape') { state.selected = -1; render(); return; }

  const deltas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (deltas[key]) {
    event.preventDefault();
    if (state.selected < 0) { state.selected = 0; render(); return; }
    const [dr, dc] = deltas[key];
    const r = (rowOf(state.selected) + dr + 9) % 9;
    const c = (colOf(state.selected) + dc + 9) % 9;
    state.selected = r * 9 + c;
    render();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!state || state.solved || state.failed) return;
  if (document.hidden) { timer.pause(); persist(); } else timer.start();
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.board && saved.solution) restore(saved);
else startGame();

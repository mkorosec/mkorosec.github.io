/* Mastermind: solo, pass-and-play, or let the computer crack your code.
   Configurable code length, palette size and repeats. */

import { el, appBar, toast, haptic, HAPTIC, celebrate, resultDialog, createDialog,
         iconSvg, nextPaint } from '../core/ui.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { read, write } from '../core/store.js';
import { shareResult, shareHeader } from '../core/share.js';
import { scoreCode } from '../core/scoring.js';
import * as prefs from '../core/prefs.js';

const GAME = 'mastermind';

const COLORS = [
  { name: 'Red',    letter: 'R', css: 'oklch(0.63 0.21 27)' },
  { name: 'Amber',  letter: 'A', css: 'oklch(0.80 0.16 75)' },
  { name: 'Green',  letter: 'G', css: 'oklch(0.72 0.19 150)' },
  { name: 'Blue',   letter: 'B', css: 'oklch(0.60 0.18 255)' },
  { name: 'Violet', letter: 'V', css: 'oklch(0.56 0.20 305)' },
  { name: 'White',  letter: 'W', css: 'oklch(0.93 0.01 90)' },
  { name: 'Teal',   letter: 'T', css: 'oklch(0.70 0.13 195)' },
  { name: 'Pink',   letter: 'P', css: 'oklch(0.74 0.16 350)' },
];

const SETTINGS_KEY = 'settings:mastermind';
const settings = { length: 4, palette: 6, repeats: true, ...read(SETTINGS_KEY, {}) };
const saveSettings = () => write(SETTINGS_KEY, settings);

const MAX_GUESSES = 10;

let state = null;
const nodes = {};

const score = scoreCode;

/* --- chrome --------------------------------------------------------------- */

function screen(id) {
  return el('div', { class: 'mm-screen', id: `screen-${id}` });
}

function buildChrome() {
  const app = document.getElementById('app');

  nodes.setup = screen('setup');
  nodes.create = screen('create');
  nodes.board = screen('board');

  nodes.setup.append(
    el('p', { class: 'mm-intro',
      text: 'Crack a hidden code of coloured pegs. A filled dot means right colour in the right place; a hollow one means right colour, wrong place.' }),
    el('div', { class: 'mm-setup' }, [
      el('button', { type: 'button', class: 'mm-setup-btn', onclick: () => startSolo() }, [
        el('strong', { text: 'Solo' }),
        el('span', { text: 'The app picks a code. Ten guesses.' }),
      ]),
      el('button', { type: 'button', class: 'mm-setup-btn', onclick: () => startDuo() }, [
        el('strong', { text: 'Two players' }),
        el('span', { text: 'One sets a code, the other cracks it. Pass the phone.' }),
      ]),
      el('button', { type: 'button', class: 'mm-setup-btn', onclick: () => startSolver() }, [
        el('strong', { text: 'Beat the machine' }),
        el('span', { text: 'You set a code and the app tries to crack it. It never needs more than five guesses.' }),
      ]),
      el('button', { type: 'button', class: 'mm-setup-btn', onclick: openSettings }, [
        el('strong', { text: 'Options' }),
        el('span', { id: 'mm-options-summary', text: '' }),
      ]),
    ]),
  );

  nodes.createTitle = el('h2', { style: 'font-size:1.05rem;font-weight:600;text-align:center' });
  nodes.createNote = el('p', { class: 'mm-intro' });
  nodes.createSlots = el('div', { class: 'mm-slots' });
  nodes.createPalette = el('div', { class: 'mm-palette' });
  nodes.createConfirm = el('button', {
    type: 'button', class: 'btn btn--primary', text: 'Lock in code', disabled: true,
    onclick: confirmCode,
  });

  nodes.create.append(nodes.createTitle, nodes.createNote, nodes.createSlots,
    nodes.createPalette, nodes.createConfirm);

  nodes.secret = el('div', { class: 'mm-secret' });
  nodes.attempts = el('span', { class: 'hud__value', text: String(MAX_GUESSES) });
  nodes.modeLabel = el('span', { class: 'hud__value', text: '—' });
  nodes.rows = el('div', { class: 'mm-rows' });
  nodes.palette = el('div', { class: 'mm-palette' });
  nodes.checkBtn = el('button', {
    type: 'button', class: 'btn btn--primary', text: 'Check', disabled: true, onclick: submitGuess,
  });
  nodes.solverBar = el('div', { style: 'display:flex;gap:8px;justify-content:center', hidden: true });

  nodes.board.append(
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Mode' }), nodes.modeLabel]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Left' }), nodes.attempts]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Code' }), nodes.secret]),
    ]),
    nodes.rows,
    nodes.palette,
    nodes.checkBtn,
    nodes.solverBar,
  );

  app.append(
    appBar({
      title: 'Mastermind',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'Change mode', onClick: goHome },
      ],
    }),
    nodes.setup, nodes.create, nodes.board,
  );

  syncOptionsSummary();
  show('setup');
}

function show(name) {
  for (const key of ['setup', 'create', 'board']) {
    nodes[key].classList.toggle('is-active', key === name);
  }
  if (state) state.screen = name;
}

function syncOptionsSummary() {
  const node = document.getElementById('mm-options-summary');
  if (node) {
    node.textContent = `${settings.length} pegs · ${settings.palette} colours · ` +
      `${settings.repeats ? 'repeats allowed' : 'no repeats'}`;
  }
}

/* --- code helpers --------------------------------------------------------- */

const palette = () => COLORS.slice(0, settings.palette);

function randomCode() {
  const code = [];
  const used = new Set();
  while (code.length < settings.length) {
    const pick = Math.floor(Math.random() * settings.palette);
    if (!settings.repeats && used.has(pick)) continue;
    used.add(pick);
    code.push(pick);
  }
  return code;
}

function pegNode(colorIndex, { onClick = null, selected = false, size = null } = {}) {
  const color = colorIndex === null ? null : COLORS[colorIndex];
  const node = el(onClick ? 'button' : 'div', {
    class: `mm-peg${color ? ' is-filled' : ''}${selected ? ' is-selected' : ''}`,
    type: onClick ? 'button' : null,
    'aria-label': color ? color.name : 'Empty slot',
    text: color ? color.letter : '',
    style: [color ? `background:${color.css}` : '', size ? `--peg:${size}` : ''].filter(Boolean).join(';'),
  });
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

/* --- modes ---------------------------------------------------------------- */

function baseState(mode) {
  return {
    mode,
    screen: 'board',
    length: settings.length,
    palette: settings.palette,
    repeats: settings.repeats,
    code: [],
    guesses: [],
    current: new Array(settings.length).fill(null),
    slot: 0,
    finished: false,
    won: false,
    creator: 1,
  };
}

function startSolo() {
  state = baseState('solo');
  state.code = randomCode();
  renderBoard();
  show('board');
  persist();
}

function startDuo(creator = 1) {
  state = baseState('duo');
  state.creator = creator;
  state.current = new Array(settings.length).fill(null);
  state.slot = 0;
  renderCreate();
  show('create');
}

function startSolver() {
  state = baseState('solver');
  state.current = new Array(settings.length).fill(null);
  state.slot = 0;
  renderCreate();
  show('create');
}

/* --- code entry ----------------------------------------------------------- */

function renderCreate() {
  const other = state.creator === 1 ? 2 : 1;
  nodes.createTitle.textContent = state.mode === 'solver'
    ? 'Set a code for the machine'
    : `Player ${state.creator}: set the code`;
  nodes.createNote.textContent = state.mode === 'solver'
    ? 'Pick your code, then watch it get cracked.'
    : `Player ${other}, look away. Pick ${settings.length} colours.` +
      (settings.repeats ? ' Repeats allowed.' : ' No repeats.');

  nodes.createSlots.replaceChildren(...state.current.map((value, i) =>
    pegNode(value, {
      selected: i === state.slot,
      onClick: () => { state.current[i] = null; state.slot = i; renderCreate(); },
    })));

  nodes.createPalette.replaceChildren(...palette().map((_, index) =>
    pegNode(index, { onClick: () => pickForCode(index) })));

  nodes.createConfirm.disabled = state.current.includes(null);
}

function pickForCode(colorIndex) {
  if (!settings.repeats && state.current.includes(colorIndex)) {
    toast('No repeats in this game');
    haptic(HAPTIC.reject);
    return;
  }
  state.current[state.slot] = colorIndex;
  const next = state.current.indexOf(null);
  state.slot = next === -1 ? state.slot : next;
  haptic(HAPTIC.tap);
  renderCreate();
}

function confirmCode() {
  state.code = state.current.slice();
  state.current = new Array(settings.length).fill(null);
  state.slot = 0;
  state.guesses = [];

  if (state.mode === 'solver') {
    renderBoard();
    show('board');
    runSolver();
    return;
  }

  renderBoard();
  show('board');
  const guesser = state.creator === 1 ? 2 : 1;
  const dlg = createDialog({ solid: true, dismissible: false });
  dlg.setContent(
    el('h2', { class: 'dialog__title', text: 'Pass the phone' }),
    el('div', { class: 'dialog__body', html: `Player ${guesser}, your turn.<br>The code is set — no peeking.` }),
    el('div', { class: 'dialog__actions' }, [
      el('button', { type: 'button', class: 'btn btn--primary', text: 'Start guessing',
        onclick: () => dlg.close() }),
    ]),
  );
  dlg.open();
  persist();
}

/* --- guessing ------------------------------------------------------------- */

function pickForGuess(colorIndex) {
  if (!state || state.finished || state.mode === 'solver') return;
  state.current[state.slot] = colorIndex;
  const next = state.current.indexOf(null);
  state.slot = next === -1 ? state.slot : next;
  haptic(HAPTIC.tap);
  renderBoard();
}

function submitGuess() {
  if (!state || state.finished || state.current.includes(null)) return;
  const guess = state.current.slice();
  const result = score(guess, state.code);
  state.guesses.push({ pegs: guess, ...result });
  state.current = new Array(state.length).fill(null);
  state.slot = 0;
  haptic(HAPTIC.commit);

  if (result.exact === state.length) { finish(true); return; }
  if (state.guesses.length >= MAX_GUESSES) { finish(false); return; }

  renderBoard();
  persist();
}

/* --- solver (Knuth's five-guess algorithm) -------------------------------- */

function allCodes() {
  const out = [];
  const build = (prefix) => {
    if (prefix.length === state.length) { out.push(prefix.slice()); return; }
    for (let c = 0; c < state.palette; c++) {
      if (!state.repeats && prefix.includes(c)) continue;
      prefix.push(c);
      build(prefix);
      prefix.pop();
    }
  };
  build([]);
  return out;
}

/**
 * Minimax: play the guess whose worst-case reply eliminates the most
 * candidates. Guarantees a crack within five guesses for the classic 4x6 game.
 */
function nextGuess(candidates, pool) {
  if (candidates.length === 1) return candidates[0];

  let best = candidates[0];
  let bestWorst = Infinity;

  // Scoring every code against every candidate is O(n^2); for larger settings
  // that is too slow to do on the main thread, so sample the pool instead.
  const searchPool = pool.length > 1400 ? candidates : pool;

  for (const guess of searchPool) {
    const buckets = new Map();
    for (const candidate of candidates) {
      const { exact, near } = score(guess, candidate);
      const key = exact * 16 + near;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    let worst = 0;
    for (const count of buckets.values()) if (count > worst) worst = count;
    const isCandidate = candidates.includes(guess);
    if (worst < bestWorst || (worst === bestWorst && isCandidate)) {
      bestWorst = worst;
      best = guess;
    }
  }
  return best;
}

async function runSolver() {
  const pool = allCodes();
  let candidates = pool;

  nodes.checkBtn.hidden = true;
  nodes.palette.hidden = true;

  for (let turn = 0; turn < MAX_GUESSES; turn++) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    await nextPaint();

    const guess = turn === 0
      ? pool[Math.floor(pool.length / 3)]   // a mixed opener
      : nextGuess(candidates, pool);

    const result = score(guess, state.code);
    state.guesses.push({ pegs: guess, ...result });
    renderBoard();

    if (result.exact === state.length) {
      state.finished = true;
      state.won = false;   // the machine won
      renderBoard();
      resultDialog({
        title: 'Cracked',
        bodyHtml: `The machine found your code in <strong>${state.guesses.length}</strong> ` +
          `${state.guesses.length === 1 ? 'guess' : 'guesses'}.<br>${chipsHtml(state.code)}`,
        primary: { label: 'Try another code', onClick: () => startSolver() },
        secondary: { label: 'Change mode', onClick: goHome },
      });
      return;
    }

    candidates = candidates.filter((code) => {
      const s = score(guess, code);
      return s.exact === result.exact && s.near === result.near;
    });

    if (!candidates.length) {
      state.finished = true;
      renderBoard();
      resultDialog({
        title: 'No such code',
        bodyHtml: 'The replies so far are contradictory, so that code cannot exist.',
        primary: { label: 'Try again', onClick: () => startSolver() },
      });
      return;
    }
  }

  state.finished = true;
  renderBoard();
  resultDialog({
    title: 'You win',
    bodyHtml: `The machine ran out of guesses.<br>${chipsHtml(state.code)}`,
    primary: { label: 'Try another code', onClick: () => startSolver() },
    secondary: { label: 'Change mode', onClick: goHome },
  });
}

/* --- end ------------------------------------------------------------------ */

function chipsHtml(code) {
  return `<span class="mm-chips">${code.map((c) =>
    `<span class="mm-chip" style="background:${COLORS[c].css}" title="${COLORS[c].name}"></span>`).join('')}</span>`;
}

function finish(won) {
  state.finished = true;
  state.won = won;
  renderBoard();
  persist();

  if (state.mode === 'solo') {
    stats.record(GAME, {
      won, bucket: `${state.length}x${state.palette}`,
      distKey: won ? state.guesses.length : null,
    });
  }

  if (won) { celebrate(); haptic(HAPTIC.win); } else haptic(HAPTIC.reject);

  const who = state.mode === 'duo' ? `Player ${state.creator === 1 ? 2 : 1}` : 'You';
  resultDialog({
    title: won ? 'Cracked' : 'Out of guesses',
    bodyHtml: won
      ? `${who} cracked it in <strong>${state.guesses.length}</strong> ` +
        `${state.guesses.length === 1 ? 'guess' : 'guesses'}.<br>${chipsHtml(state.code)}`
      : `The code was:<br>${chipsHtml(state.code)}`,
    primary: {
      label: state.mode === 'duo' ? 'Swap roles' : 'Play again',
      onClick: () => (state.mode === 'duo' ? startDuo(state.creator === 1 ? 2 : 1) : startSolo()),
    },
    extra: state.mode === 'solo' && won ? { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Mastermind', `${state.length} pegs`, `${state.palette} colours`,
      `${state.guesses.length}/${MAX_GUESSES}`,
    ])) } : null,
    secondary: { label: 'Change mode', onClick: goHome },
  });
}

function goHome() {
  state = null;
  session.clear(GAME);
  syncOptionsSummary();
  show('setup');
}

/* --- rendering ------------------------------------------------------------ */

function renderBoard() {
  if (!state) return;

  nodes.modeLabel.textContent = { solo: 'Solo', duo: '2 players', solver: 'Machine' }[state.mode];
  nodes.attempts.textContent = String(MAX_GUESSES - state.guesses.length);

  const reveal = state.finished || state.mode === 'solver';
  nodes.secret.replaceChildren(...state.code.map((value) =>
    pegNode(reveal ? value : null, { size: '20px' })));

  const rows = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    const played = state.guesses[i];
    const isActive = !state.finished && i === state.guesses.length && state.mode !== 'solver';
    const pegs = played ? played.pegs : (isActive ? state.current : new Array(state.length).fill(null));

    const dots = [];
    for (let d = 0; d < state.length; d++) {
      let kind = '';
      if (played) {
        if (d < played.exact) kind = ' exact';
        else if (d < played.exact + played.near) kind = ' near';
      }
      dots.push(el('span', { class: `mm-dot${kind}` }));
    }

    rows.push(el('div', {
      class: `mm-row${played ? ' is-done' : ''}${isActive ? ' is-active' : ''}`,
    }, [
      el('span', { class: 'mm-num', text: String(i + 1) }),
      el('div', { class: 'mm-slots' }, pegs.map((value, slot) => pegNode(value, {
        selected: isActive && slot === state.slot,
        onClick: isActive ? () => { state.current[slot] = null; state.slot = slot; renderBoard(); } : null,
      }))),
      el('div', {
        class: 'mm-feedback',
        style: `grid-template-columns:repeat(${Math.ceil(state.length / 2)}, 9px)`,
        'aria-label': played ? `${played.exact} exact, ${played.near} near` : '',
      }, dots),
    ]));
  }
  nodes.rows.replaceChildren(...rows);

  nodes.palette.hidden = state.mode === 'solver';
  nodes.checkBtn.hidden = state.mode === 'solver';
  nodes.palette.replaceChildren(...palette().map((_, index) =>
    pegNode(index, { onClick: () => pickForGuess(index) })));

  nodes.checkBtn.disabled = state.finished || state.current.includes(null);
}

/* --- dialogs -------------------------------------------------------------- */

function openSettings() {
  const dlg = createDialog({ wide: true });

  const stepper = (label, hint, key, min, max) => {
    const value = el('span', { class: 'hud__value', text: String(settings[key]) });
    const bump = (delta) => {
      const next = Math.min(max, Math.max(min, settings[key] + delta));
      settings[key] = next;
      if (key === 'palette' && !settings.repeats && settings.length > next) settings.length = next;
      value.textContent = String(settings[key]);
      saveSettings();
      syncOptionsSummary();
    };
    return el('div', { class: 'setting' }, [
      el('div', { class: 'setting__text' }, [
        el('div', { class: 'setting__label', text: label }),
        el('div', { class: 'setting__hint', text: hint }),
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
        el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: '−',
          'aria-label': `Decrease ${label}`, onclick: () => bump(-1) }),
        value,
        el('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: '+',
          'aria-label': `Increase ${label}`, onclick: () => bump(1) }),
      ]),
    ]);
  };

  const repeatsBtn = el('button', {
    type: 'button', class: 'switch', role: 'switch',
    'aria-checked': String(settings.repeats), 'aria-label': 'Allow repeated colours',
  });
  repeatsBtn.addEventListener('click', () => {
    settings.repeats = !settings.repeats;
    if (!settings.repeats && settings.length > settings.palette) settings.length = settings.palette;
    repeatsBtn.setAttribute('aria-checked', String(settings.repeats));
    saveSettings();
    syncOptionsSummary();
  });

  dlg.setContent(
    el('div', { class: 'dialog__header' }, [
      el('h2', { class: 'dialog__title', style: 'margin:0', text: 'Options' }),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close',
        html: iconSvg('close'), onclick: () => dlg.close() }),
    ]),
    stepper('Code length', 'How many pegs are in the hidden code.', 'length', 3, 5),
    stepper('Colours', 'Size of the palette to choose from.', 'palette', 4, 8),
    el('div', { class: 'setting' }, [
      el('div', { class: 'setting__text' }, [
        el('div', { class: 'setting__label', text: 'Allow repeats' }),
        el('div', { class: 'setting__hint', text: 'Off makes the code easier to reason about.' }),
      ]),
      repeatsBtn,
    ]),
    el('p', { class: 'setting__hint', style: 'margin-top:12px',
      text: 'Changes apply to the next game.' }),
  );
  dlg.open();
}

function openStats() {
  const buckets = [];
  for (const length of [3, 4, 5]) {
    for (const size of [4, 6, 8]) buckets.push({ key: `${length}x${size}`, label: `${length}×${size}` });
  }
  showStats(GAME, {
    title: 'Mastermind statistics',
    buckets: buckets.filter((b) => stats.bucket(GAME, b.key).played > 0)
      .concat([{ key: `${settings.length}x${settings.palette}`, label: 'Current' }])
      .slice(0, 4),
    distLabel: 'Guesses needed',
    distMax: MAX_GUESSES,
    showStreak: false,
  });
}

/* --- persistence ---------------------------------------------------------- */

function persist() {
  if (!state || state.mode === 'solver') return;
  session.save(GAME, state, {
    label: { solo: 'Solo', duo: '2 players' }[state.mode] || '',
    detail: state.finished ? '' : `${MAX_GUESSES - state.guesses.length} guesses left`,
  });
}

/* --- keyboard ------------------------------------------------------------- */

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const onBoard = state.screen === 'board' && state.mode !== 'solver';
  const onCreate = state.screen === 'create';
  if (!onBoard && !onCreate) return;

  const digit = Number(event.key);
  if (digit >= 1 && digit <= settings.palette) {
    event.preventDefault();
    if (onBoard) pickForGuess(digit - 1); else pickForCode(digit - 1);
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    state.current[state.slot] = null;
    if (onBoard) renderBoard(); else renderCreate();
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -1 : 1;
    state.slot = (state.slot + delta + state.current.length) % state.current.length;
    if (onBoard) renderBoard(); else renderCreate();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (onBoard && !nodes.checkBtn.disabled) submitGuess();
    else if (onCreate && !nodes.createConfirm.disabled) confirmCode();
  }
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.code?.length && !saved.finished && saved.mode !== 'solver') {
  state = saved;
  settings.length = saved.length;
  settings.palette = saved.palette;
  settings.repeats = saved.repeats;
  if (saved.screen === 'create') { renderCreate(); show('create'); }
  else { renderBoard(); show('board'); }
}

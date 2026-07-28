/* Klondike solitaire.

   Interaction is tap-to-select then tap-to-place rather than drag. On a phone
   a drag across a seven-column tableau is fiddly and easy to drop wrong; two
   taps always land where you meant, and a double tap sends a card to its
   foundation. */

import { el, appBar, toast, haptic, HAPTIC, formatTime, createTimer, celebrate,
         resultDialog } from '../core/ui.js';
import { createRng } from '../core/rng.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { read, write } from '../core/store.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'solitaire';

const SUITS = [
  { pip: '♠', color: 'black' },
  { pip: '♥', color: 'red' },
  { pip: '♦', color: 'red' },
  { pip: '♣', color: 'black' },
];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SETTINGS_KEY = 'settings:solitaire';
const settings = { draw: 1, ...read(SETTINGS_KEY, {}) };
const saveSettings = () => write(SETTINGS_KEY, settings);

let state = null;
let timer = null;
const nodes = {};

/* --- model ---------------------------------------------------------------- */

/* Piles: stock, waste, foundation0..3, tableau0..6 */
const isRed = (card) => SUITS[card.suit].color === 'red';

function newDeck(rng) {
  const deck = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ id: suit * 13 + rank, suit, rank, up: false });
  }
  return rng.shuffle(deck);
}

function deal(rng) {
  const deck = newDeck(rng);
  const tableau = Array.from({ length: 7 }, () => []);
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.up = row === col;
      tableau[col].push(card);
    }
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
  };
}

const pile = (name) => {
  if (name === 'stock') return state.stock;
  if (name === 'waste') return state.waste;
  const [kind, index] = name.split(':');
  return kind === 'f' ? state.foundations[Number(index)] : state.tableau[Number(index)];
};

/** May `card` (with the cards on top of it) go onto `target`? */
function canPlace(cards, targetName) {
  const first = cards[0];
  const target = pile(targetName);

  if (targetName.startsWith('f:')) {
    if (cards.length !== 1) return false;
    if (!target.length) return first.rank === 1;
    const top = target[target.length - 1];
    return top.suit === first.suit && first.rank === top.rank + 1;
  }

  if (targetName.startsWith('t:')) {
    if (!target.length) return first.rank === 13;
    const top = target[target.length - 1];
    if (!top.up) return false;
    return isRed(top) !== isRed(first) && first.rank === top.rank - 1;
  }

  return false;
}

/** The face-up run starting at `index`, if it is a legal sequence to move. */
function movableFrom(pileName, index) {
  const source = pile(pileName);
  if (index < 0 || index >= source.length) return null;
  if (!source[index].up) return null;

  if (pileName === 'waste' || pileName.startsWith('f:')) {
    return index === source.length - 1 ? [source[index]] : null;
  }

  const run = source.slice(index);
  for (let i = 1; i < run.length; i++) {
    const above = run[i - 1];
    const card = run[i];
    if (!card.up || isRed(above) === isRed(card) || card.rank !== above.rank - 1) return null;
  }
  return run;
}

/* --- moves ---------------------------------------------------------------- */

function snapshot() {
  state.history.push(JSON.stringify({
    stock: state.stock, waste: state.waste,
    foundations: state.foundations, tableau: state.tableau,
    score: state.score, moves: state.moves,
  }));
  if (state.history.length > 60) state.history.shift();
}

function undo() {
  if (!state?.history.length) { haptic(HAPTIC.reject); return; }
  const previous = JSON.parse(state.history.pop());
  Object.assign(state, previous);
  state.selection = null;
  render();
  persist();
  haptic(HAPTIC.tap);
}

function drawFromStock() {
  if (state.won) return;
  snapshot();

  if (!state.stock.length) {
    if (!state.waste.length) { state.history.pop(); return; }
    // Recycling costs a little score, as in the scored Klondike rules.
    state.stock = state.waste.reverse().map((c) => ({ ...c, up: false }));
    state.waste = [];
    state.score = Math.max(0, state.score - (settings.draw === 1 ? 100 : 0));
  } else {
    for (let i = 0; i < settings.draw && state.stock.length; i++) {
      const card = state.stock.pop();
      card.up = true;
      state.waste.push(card);
    }
  }

  state.moves += 1;
  state.selection = null;
  haptic(HAPTIC.tap);
  render();
  persist();
}

function moveCards(fromName, index, toName) {
  const source = pile(fromName);
  const cards = movableFrom(fromName, index);
  if (!cards || !canPlace(cards, toName)) return false;

  snapshot();
  source.splice(index, cards.length);
  pile(toName).push(...cards);

  if (toName.startsWith('f:')) state.score += 10;
  else if (fromName.startsWith('f:')) state.score = Math.max(0, state.score - 15);
  else if (fromName === 'waste') state.score += 5;

  // Turn over whatever the move exposed.
  if (fromName.startsWith('t:') && source.length && !source[source.length - 1].up) {
    source[source.length - 1].up = true;
    state.score += 5;
  }

  state.moves += 1;
  state.selection = null;
  if (!timer.isRunning()) timer.start();
  haptic(HAPTIC.commit);
  render();
  persist();
  checkWin();
  return true;
}

/** Send a card straight to a foundation if it will go. */
function toFoundation(fromName, index) {
  const source = pile(fromName);
  if (index !== source.length - 1) return false;
  for (let f = 0; f < 4; f++) {
    if (moveCards(fromName, index, `f:${f}`)) return true;
  }
  return false;
}

function autoFinish() {
  // Only offered once nothing is face-down; then the rest is mechanical.
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 200) {
    moved = false;
    for (const name of ['waste', ...state.tableau.map((_, i) => `t:${i}`)]) {
      const source = pile(name);
      if (!source.length) continue;
      if (toFoundation(name, source.length - 1)) { moved = true; break; }
    }
  }
}

function everythingUp() {
  return state.stock.length === 0 && state.waste.length <= 1
    && state.tableau.every((column) => column.every((card) => card.up));
}

function checkWin() {
  if (state.foundations.reduce((n, f) => n + f.length, 0) !== 52) return;
  state.won = true;
  timer.pause();
  state.elapsed = timer.seconds();
  render();
  persist();
  celebrate(document.body, 90);
  haptic(HAPTIC.win);

  const bonus = state.elapsed > 30 ? Math.floor(700000 / state.elapsed) : 0;
  state.score += bonus;

  stats.record(GAME, {
    won: true, bucket: `draw${settings.draw}`, timeSec: state.elapsed,
  });

  resultDialog({
    title: 'Out in the open',
    bodyHtml: `Cleared in <strong>${formatTime(state.elapsed)}</strong> ` +
      `over <strong>${state.moves}</strong> moves.<br>Score <strong>${state.score}</strong>` +
      (bonus ? ` <span style="opacity:.7">(incl. ${bonus} time bonus)</span>` : ''),
    primary: { label: 'New deal', onClick: () => newGame() },
    extra: { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Solitaire', `draw ${settings.draw}`, formatTime(state.elapsed),
      `${state.moves} moves`, `score ${state.score}`,
    ])) },
    secondary: { label: 'Statistics', onClick: openStats },
  });
}

/* --- interaction ---------------------------------------------------------- */

let lastTap = { key: '', at: 0 };

function onCardTap(pileName, index) {
  if (!state || state.won) return;
  if (!timer.isRunning()) timer.start();

  const source = pile(pileName);
  const card = source[index];

  // Face-down tableau card: only the top one flips, and only by tapping it.
  if (!card.up) {
    if (pileName.startsWith('t:') && index === source.length - 1) {
      snapshot();
      card.up = true;
      state.score += 5;
      state.moves += 1;
      haptic(HAPTIC.tap);
      render();
      persist();
    }
    return;
  }

  const key = `${pileName}:${index}`;
  const now = Date.now();
  if (lastTap.key === key && now - lastTap.at < 400) {
    lastTap = { key: '', at: 0 };
    if (!toFoundation(pileName, index)) haptic(HAPTIC.reject);
    return;
  }
  lastTap = { key, at: now };

  const selection = state.selection;

  if (selection && selection.pile === pileName && selection.index === index) {
    state.selection = null;
    render();
    return;
  }

  if (selection) {
    // Tapping another card means "put my selection on this pile".
    if (moveCards(selection.pile, selection.index, pileName)) return;
  }

  if (!movableFrom(pileName, index)) { haptic(HAPTIC.reject); return; }
  state.selection = { pile: pileName, index };
  haptic(HAPTIC.tap);
  render();
}

function onPileTap(pileName) {
  if (!state || state.won) return;
  if (pileName === 'stock') { drawFromStock(); return; }
  const selection = state.selection;
  if (!selection) return;
  if (!moveCards(selection.pile, selection.index, pileName)) haptic(HAPTIC.reject);
}

/* --- rendering ------------------------------------------------------------ */

function cardNode(card, pileName, index, offset) {
  const node = el('div', {
    class: `sol-card ${SUITS[card.suit].color}${card.up ? '' : ' is-down'}`,
    style: `top:${offset}px;z-index:${index + 1}`,
    role: 'button',
    tabindex: '0',
    'aria-label': card.up ? `${RANKS[card.rank]} of ${SUITS[card.suit].pip}` : 'Face-down card',
  });

  if (card.up) {
    node.append(
      el('span', { class: 'sol-rank', text: RANKS[card.rank] }),
      el('span', { class: 'sol-pip', text: SUITS[card.suit].pip }),
    );
  }

  const selection = state.selection;
  if (selection && selection.pile === pileName && index >= selection.index) {
    node.classList.add('is-selected');
  }

  node.addEventListener('click', (event) => { event.stopPropagation(); onCardTap(pileName, index); });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCardTap(pileName, index); }
  });
  return node;
}

function renderPile(host, pileName, { fan = false, slotLabel = '' } = {}) {
  const cards = pile(pileName);
  host.replaceChildren();
  host.onclick = () => onPileTap(pileName);

  if (!cards.length) {
    host.append(el('div', { class: 'sol-slot', text: slotLabel }));
    return;
  }

  const style = getComputedStyle(nodes.table);
  const stackUp = parseFloat(style.getPropertyValue('--stack')) || 22;
  const stackDown = parseFloat(style.getPropertyValue('--stack-down')) || 11;
  const cardHeight = parseFloat(style.getPropertyValue('--card-h')) || 82;

  // A fanned pile shows its whole run; the waste shows at most the last three
  // (draw-three), and any other pile shows only its top card.
  const start = fan
    ? (pileName === 'waste' ? Math.max(0, cards.length - 3) : 0)
    : cards.length - 1;

  let offset = 0;
  let lastOffset = 0;
  for (let index = start; index < cards.length; index++) {
    lastOffset = offset;
    host.append(cardNode(cards[index], pileName, index, offset));
    if (fan) offset += cards[index].up ? stackUp : stackDown;
  }

  host.style.minHeight = `${lastOffset + cardHeight}px`;
}

function render() {
  if (!state) return;

  nodes.time.textContent = formatTime(timer?.seconds() || 0);
  nodes.moves.textContent = String(state.moves);
  nodes.score.textContent = String(state.score);
  nodes.drawBtn.textContent = `Draw ${settings.draw}`;

  renderPile(nodes.stock, 'stock', { slotLabel: state.waste.length ? '↻' : '' });
  renderPile(nodes.waste, 'waste', { fan: settings.draw > 1 });
  state.foundations.forEach((_, i) =>
    renderPile(nodes.foundations[i], `f:${i}`, { slotLabel: SUITS[i].pip }));
  state.tableau.forEach((_, i) =>
    renderPile(nodes.columns[i], `t:${i}`, { fan: true }));

  nodes.autoBtn.hidden = !(everythingUp() && !state.won);
}

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.time = el('span', { class: 'hud__value', text: '00:00' });
  nodes.moves = el('span', { class: 'hud__value', text: '0' });
  nodes.score = el('span', { class: 'hud__value', text: '0' });

  nodes.stock = el('div', { class: 'sol-pile', 'aria-label': 'Stock' });
  nodes.waste = el('div', { class: 'sol-pile', 'aria-label': 'Waste' });
  nodes.foundations = Array.from({ length: 4 }, (_, i) =>
    el('div', { class: 'sol-pile', 'aria-label': `Foundation ${i + 1}` }));
  nodes.columns = Array.from({ length: 7 }, (_, i) =>
    el('div', { class: 'sol-pile sol-pile--tableau', 'aria-label': `Column ${i + 1}` }));

  nodes.drawBtn = el('button', {
    type: 'button', class: 'btn btn--secondary btn--sm', onclick: toggleDraw,
  });
  nodes.autoBtn = el('button', {
    type: 'button', class: 'btn btn--primary btn--sm', text: 'Finish it', hidden: true,
    onclick: () => { autoFinish(); render(); },
  });

  nodes.table = el('div', { class: 'sol-table' }, [
    el('div', { class: 'sol-top' }, [
      nodes.stock, nodes.waste, el('div'), ...nodes.foundations,
    ]),
    el('div', { class: 'sol-tableau' }, nodes.columns),
  ]);

  app.append(
    appBar({
      title: 'Solitaire',
      actions: [
        { name: 'undo', icon: 'undo', label: 'Undo', onClick: undo },
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New deal', onClick: () => newGame() },
      ],
    }),
    el('div', { class: 'hud' }, [
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Time' }), nodes.time]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Moves' }), nodes.moves]),
      el('div', { class: 'hud__stat' }, [el('span', { class: 'hud__label', text: 'Score' }), nodes.score]),
    ]),
    el('div', { class: 'sol-controls' }, [nodes.drawBtn, nodes.autoBtn]),
    nodes.table,
    el('p', { class: 'sol-hint',
      text: 'Tap a card, then tap where it goes. Double-tap sends it to a foundation.' }),
  );
}

function toggleDraw() {
  settings.draw = settings.draw === 1 ? 3 : 1;
  saveSettings();
  toast(`Draw ${settings.draw} — starts a new deal`, 1600);
  newGame();
}

function openStats() {
  showStats(GAME, {
    title: 'Solitaire statistics',
    buckets: [{ key: 'draw1', label: 'Draw 1' }, { key: 'draw3', label: 'Draw 3' }],
    showStreak: false,
  });
}

/* --- lifecycle ------------------------------------------------------------ */

function newGame() {
  const dealt = deal(createRng(null));
  state = {
    ...dealt,
    selection: null,
    history: [],
    score: 0,
    moves: 0,
    won: false,
    elapsed: 0,
  };
  timer = createTimer((s) => { nodes.time.textContent = formatTime(s); });
  timer.reset(0);
  render();
  persist();
}

function restore(saved) {
  state = { ...saved, selection: null, history: saved.history || [] };
  timer = createTimer((s) => { nodes.time.textContent = formatTime(s); });
  timer.reset(saved.elapsed || 0);
  render();
}

function persist() {
  if (!state) return;
  const done = state.foundations.reduce((n, f) => n + f.length, 0);
  session.save(GAME, {
    stock: state.stock, waste: state.waste,
    foundations: state.foundations, tableau: state.tableau,
    score: state.score, moves: state.moves, won: state.won,
    elapsed: timer?.seconds() ?? state.elapsed,
  }, {
    label: `Klondike · draw ${settings.draw}`,
    detail: state.won ? 'Cleared' : `${done}/52 home`,
  });
}

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); undo(); }
  if (event.key === ' ') { event.preventDefault(); drawFromStock(); }
  if (event.key === 'Escape' && state.selection) { state.selection = null; render(); }
});

document.addEventListener('visibilitychange', () => {
  if (!state || state.won) return;
  if (document.hidden) { timer.pause(); persist(); } else if (state.moves) timer.start();
});

window.addEventListener('resize', () => { if (state) render(); });

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.tableau && !saved.won) restore(saved);
else newGame();

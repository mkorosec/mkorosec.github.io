/* Wordle: daily and practice, English and Slovenian, hard mode, share grid. */

import { el, appBar, toast, haptic, HAPTIC, celebrate, resultDialog, createDialog,
         iconSvg } from '../core/ui.js';
import { LANGUAGES, LANGUAGE_CODES, load as loadWords, guessSet, isLetter } from '../core/words.js';
import { createRng, dateKey, dailySeed } from '../core/rng.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { read, write } from '../core/store.js';
import { shareResult, shareHeader, emojiGrid } from '../core/share.js';
import { scoreWord } from '../core/scoring.js';
import * as prefs from '../core/prefs.js';

const GAME = 'wordle';
const LENGTH = 5;
const TRIES = 6;

const SETTINGS_KEY = 'settings:wordle';
const settings = { hardMode: false, ...read(SETTINGS_KEY, {}) };
const saveSettings = () => write(SETTINGS_KEY, settings);

let state = null;
let answers = [];
let accepted = new Set();
const nodes = {};

/* --- scoring -------------------------------------------------------------- */

const scoreGuess = scoreWord;

function letterStates() {
  const rank = { absent: 0, present: 1, correct: 2 };
  const map = {};
  for (const guess of state.guesses) {
    const score = scoreGuess(guess, state.target);
    for (let i = 0; i < guess.length; i++) {
      const current = map[guess[i]];
      if (!current || rank[score[i]] > rank[current]) map[guess[i]] = score[i];
    }
  }
  return map;
}

/** Hard mode: revealed hints must be reused. Returns a complaint or null. */
function hardModeViolation(guess) {
  if (!settings.hardMode || !state.guesses.length) return null;
  const last = state.guesses[state.guesses.length - 1];
  const score = scoreGuess(last, state.target);

  for (let i = 0; i < LENGTH; i++) {
    if (score[i] === 'correct' && guess[i] !== last[i]) {
      return `Position ${i + 1} must be ${last[i].toUpperCase()}`;
    }
  }
  for (let i = 0; i < LENGTH; i++) {
    if (score[i] === 'present' && !guess.includes(last[i])) {
      return `Guess must contain ${last[i].toUpperCase()}`;
    }
  }
  return null;
}

/* --- chrome --------------------------------------------------------------- */

function buildChrome() {
  const app = document.getElementById('app');

  nodes.modeTabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Mode' },
    [['daily', 'Daily'], ['practice', 'Practice']].map(([value, label]) =>
      el('button', {
        type: 'button', class: 'segmented__item', role: 'tab', dataset: { mode: value },
        text: label, onclick: () => setMode(value),
      })));

  nodes.langTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Language' },
    LANGUAGE_CODES.map((code) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { lang: code },
      text: LANGUAGES[code].label, onclick: () => setLanguage(code),
    })));

  nodes.board = el('div', { class: 'wordle-board', role: 'group', 'aria-label': 'Guesses' });
  nodes.keyboard = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Keyboard' });

  app.append(
    appBar({
      title: 'Wordle',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'settings', icon: 'settings', label: 'Settings', onClick: openSettings },
        { name: 'new', icon: 'refresh', label: 'New word', onClick: () => start({ fresh: true }) },
      ],
    }),
    el('div', { class: 'wordle-controls' }, [nodes.modeTabs, nodes.langTabs]),
    nodes.board,
    nodes.keyboard,
  );
}

/* --- lifecycle ------------------------------------------------------------ */

async function loadLanguage(lang) {
  answers = (await loadWords(lang, 'answers')).filter((w) => w.length === LENGTH);
  accepted = new Set([...(await guessSet(lang))].filter((w) => w.length === LENGTH));
}

function pickTarget(lang, seed) {
  if (!answers.length) return null;
  const rng = createRng(seed);
  return answers[Math.floor(rng.next() * answers.length)];
}

async function start({ fresh = false } = {}) {
  const mode = state?.mode || 'daily';
  const lang = state?.lang || 'en';
  const today = dateKey();

  await loadLanguage(lang);
  if (!answers.length) {
    nodes.board.replaceChildren(el('div', { class: 'placeholder',
      text: 'Word list unavailable. Reconnect once so it can be cached.' }));
    return;
  }

  const seed = mode === 'daily' && !fresh ? dailySeed(`${GAME}:${lang}`, today) : null;

  state = {
    mode, lang, date: today,
    target: pickTarget(lang, seed),
    guesses: [],
    current: '',
    finished: false,
    won: false,
  };

  render();
  persist();
}

function restore(saved) {
  state = saved;
  loadLanguage(saved.lang).then(() => {
    render();
    if (state.finished) showEndDialog(false);
  });
}

function persist() {
  if (!state) return;
  session.save(GAME, state, {
    label: `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${LANGUAGES[state.lang].label}`,
    detail: state.finished ? '' : `${state.guesses.length}/${TRIES} guesses`,
  });
}

/* --- interaction ---------------------------------------------------------- */

function setMode(mode) {
  if (state?.mode === mode) return;
  state.mode = mode;
  start({ fresh: mode === 'practice' });
}

function setLanguage(lang) {
  if (state?.lang === lang) return;
  state.lang = lang;
  start({ fresh: state.mode === 'practice' });
}

function press(key) {
  if (!state || state.finished) return;

  if (key === 'enter') { submit(); return; }
  if (key === 'back') {
    if (state.current) { state.current = state.current.slice(0, -1); render(); }
    return;
  }
  if (!isLetter(state.lang, key)) return;
  if (state.current.length >= LENGTH) return;

  state.current += key.toLowerCase();
  haptic(HAPTIC.tap);
  render();
}

function reject(message) {
  toast(message);
  haptic(HAPTIC.reject);
  const row = nodes.board.children[state.guesses.length];
  if (!row) return;
  row.classList.add('is-invalid');
  row.addEventListener('animationend', () => row.classList.remove('is-invalid'), { once: true });
}

function submit() {
  if (state.current.length !== LENGTH) { reject('Not enough letters'); return; }
  if (!accepted.has(state.current)) { reject('Not in word list'); return; }

  const violation = hardModeViolation(state.current);
  if (violation) { reject(violation); return; }

  const guess = state.current;
  state.guesses.push(guess);
  state.current = '';
  haptic(HAPTIC.commit);

  const won = guess === state.target;
  const done = won || state.guesses.length >= TRIES;

  render({ revealRow: state.guesses.length - 1 });

  if (!done) { persist(); return; }

  state.finished = true;
  state.won = won;
  persist();

  stats.record(GAME, {
    won,
    bucket: state.lang,
    distKey: won ? state.guesses.length : null,
    daily: state.mode === 'daily',
    date: state.date,
  });

  // Let the reveal animation finish before the dialog covers the board.
  setTimeout(() => showEndDialog(true), 900);
}

/* --- end of game ---------------------------------------------------------- */

function shareText() {
  const rows = state.guesses.map((g) => scoreGuess(g, state.target));
  const header = shareHeader([
    'Wordle',
    LANGUAGES[state.lang].label,
    state.mode === 'daily' ? state.date : 'practice',
    `${state.won ? state.guesses.length : 'X'}/${TRIES}${settings.hardMode ? '*' : ''}`,
  ]);
  return `${header}\n\n${emojiGrid(rows, prefs.get('colorblind'))}`;
}

function showEndDialog(animate) {
  const streak = stats.liveStreak(GAME);
  if (state.won && animate) {
    haptic(HAPTIC.win);
    celebrate();
  }

  const body = state.won
    ? `Solved in <strong>${state.guesses.length}</strong> ${state.guesses.length === 1 ? 'try' : 'tries'}.` +
      (state.mode === 'daily' ? `<br>Daily streak: <strong>${streak}</strong>` : '')
    : `The word was <strong>${state.target.toUpperCase()}</strong>.`;

  resultDialog({
    title: state.won ? 'Got it' : 'Out of tries',
    bodyHtml: `${body}<div class="share-grid">${emojiGrid(
      state.guesses.map((g) => scoreGuess(g, state.target)), prefs.get('colorblind'),
    ).replace(/\n/g, '<br>')}</div>`,
    primary: { label: 'Share result', onClick: () => shareResult(shareText()) },
    extra: { label: 'Statistics', onClick: openStats },
    secondary: { label: 'New word', onClick: () => { state.mode = 'practice'; start({ fresh: true }); } },
  });
}

function openStats() {
  showStats(GAME, {
    title: 'Wordle statistics',
    buckets: LANGUAGE_CODES.map((code) => ({ key: code, label: LANGUAGES[code].label })),
    distLabel: 'Guess distribution',
    distMax: TRIES,
    highlight: state?.won ? state.guesses.length : null,
  });
}

function openSettings() {
  const dlg = createDialog({ wide: true });
  const row = (label, hint, checked, onToggle) => {
    const btn = el('button', {
      type: 'button', class: 'switch', role: 'switch',
      'aria-checked': String(checked), 'aria-label': label,
    });
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onToggle(next);
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
    row('Hard mode', 'Any revealed hint must be used in later guesses.',
      settings.hardMode, (on) => {
        if (on && state.guesses.length && !state.finished) {
          toast('Hard mode can only be switched on before the first guess');
          return;
        }
        settings.hardMode = on;
        saveSettings();
      }),
    row('High-contrast cues', 'Orange and blue instead of green and yellow, plus shape markers.',
      prefs.get('colorblind'), (on) => { prefs.set('colorblind', on); render(); }),
  );
  dlg.open();
}

/* --- rendering ------------------------------------------------------------ */

function render({ revealRow = -1 } = {}) {
  if (!state) return;

  nodes.modeTabs.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.mode === state.mode));
  });
  nodes.langTabs.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-checked', String(btn.dataset.lang === state.lang));
  });

  const rows = [];
  for (let r = 0; r < TRIES; r++) {
    const row = el('div', { class: 'wordle-row' });
    const guess = state.guesses[r];
    const isCurrent = r === state.guesses.length && !state.finished;
    const score = guess ? scoreGuess(guess, state.target) : null;

    for (let c = 0; c < LENGTH; c++) {
      const tile = el('div', { class: 'wordle-tile' });
      if (guess) {
        tile.textContent = guess[c];
        tile.classList.add('is-filled', score[c]);
        if (r === revealRow) {
          tile.classList.add('is-revealing');
          tile.style.animationDelay = `${c * 90}ms`;
        }
        if (state.won && r === state.guesses.length - 1) {
          tile.classList.add('is-winning');
          tile.style.animationDelay = `${500 + c * 80}ms`;
        }
      } else if (isCurrent) {
        tile.textContent = state.current[c] || '';
        if (state.current[c]) tile.classList.add('is-filled');
        else if (c === state.current.length) tile.classList.add('is-active');
      }
      row.append(tile);
    }
    rows.push(row);
  }
  nodes.board.replaceChildren(...rows);

  const states = letterStates();
  const layout = LANGUAGES[state.lang].rows;
  nodes.keyboard.replaceChildren(...layout.map((keys, index) => {
    const row = el('div', { class: 'keyboard-row' });
    if (index === layout.length - 1) {
      row.append(el('button', {
        type: 'button', class: 'key is-wide', text: 'Enter',
        'aria-label': 'Submit guess', onclick: () => press('enter'),
      }));
    }
    for (const key of keys) {
      const btn = el('button', {
        type: 'button', class: `key${states[key] ? ` ${states[key]}` : ''}`,
        text: key, 'aria-label': key, onclick: () => press(key),
      });
      row.append(btn);
    }
    if (index === layout.length - 1) {
      row.append(el('button', {
        type: 'button', class: 'key is-wide', html: iconSvg('erase'),
        'aria-label': 'Delete letter', onclick: () => press('back'),
      }));
    }
    return row;
  }));
}

/* --- keyboard ------------------------------------------------------------- */

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === 'Enter') { event.preventDefault(); press('enter'); return; }
  if (event.key === 'Backspace') { event.preventDefault(); press('back'); return; }
  // Accept whatever the language's alphabet contains, so a Slovenian layout
  // can type c, s and z with carons directly.
  if (event.key.length === 1 && isLetter(state.lang, event.key)) {
    event.preventDefault();
    press(event.key.toLowerCase());
  }
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.target && saved.date === dateKey()) restore(saved);
else start();

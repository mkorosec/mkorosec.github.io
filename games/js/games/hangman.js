/* Hangman, English and Slovenian, using the shared word lists. */

import { el, appBar, haptic, HAPTIC, celebrate, resultDialog } from '../core/ui.js';
import { LANGUAGES, LANGUAGE_CODES, load as loadWords, isLetter } from '../core/words.js';
import { createRng } from '../core/rng.js';
import * as stats from '../core/stats.js';
import { showStats } from '../core/statsview.js';
import * as session from '../core/session.js';
import { shareResult, shareHeader } from '../core/share.js';
import * as prefs from '../core/prefs.js';

const GAME = 'hangman';
const LIVES = 6;

/* Drawn in order, one per wrong guess. */
const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];

let state = null;
let pool = [];
const nodes = {};

/* --- chrome --------------------------------------------------------------- */

function gallows() {
  return `<svg viewBox="0 0 200 220" role="img" aria-label="Hangman drawing">
    <path d="M20 210 H120" />
    <path d="M50 210 V20 H140" />
    <path d="M140 20 V50" />
    <circle class="hm-part hm-body" data-part="head" cx="140" cy="70" r="20" />
    <path class="hm-part hm-body" data-part="torso" d="M140 90 V145" />
    <path class="hm-part hm-body" data-part="armL" d="M140 105 L112 130" />
    <path class="hm-part hm-body" data-part="armR" d="M140 105 L168 130" />
    <path class="hm-part hm-body" data-part="legL" d="M140 145 L114 185" />
    <path class="hm-part hm-body" data-part="legR" d="M140 145 L166 185" />
  </svg>`;
}

function buildChrome() {
  const app = document.getElementById('app');

  nodes.langTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Language' },
    LANGUAGE_CODES.map((code) => el('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { lang: code },
      text: LANGUAGES[code].label, onclick: () => setLanguage(code),
    })));

  nodes.stage = el('div', { class: 'hm-stage', html: gallows() });
  nodes.lives = el('div', { class: 'hm-lives' },
    Array.from({ length: LIVES }, () => el('span', { class: 'hm-life' })));
  nodes.word = el('div', { class: 'hm-word', role: 'status', 'aria-live': 'polite' });
  nodes.keyboard = el('div', { class: 'keyboard' });

  app.append(
    appBar({
      title: 'Hangman',
      actions: [
        { name: 'stats', icon: 'stats', label: 'Statistics', onClick: openStats },
        { name: 'new', icon: 'refresh', label: 'New word', onClick: () => start() },
      ],
    }),
    nodes.langTabs,
    nodes.stage,
    nodes.lives,
    nodes.word,
    nodes.keyboard,
  );
}

/* --- lifecycle ------------------------------------------------------------ */

async function start(lang = state?.lang || 'en') {
  // Longer words make a better hangman than the five-letter answer list.
  const [answers, guesses] = await Promise.all([
    loadWords(lang, 'answers'), loadWords(lang, 'guesses'),
  ]);
  const letters = LANGUAGES[lang].rows.flat();
  pool = [...new Set([...answers, ...guesses])]
    .filter((w) => w.length >= 4 && [...w].every((ch) => letters.includes(ch)));

  if (!pool.length) {
    nodes.word.replaceChildren(el('div', { class: 'placeholder',
      text: 'Word list unavailable. Reconnect once so it can be cached.' }));
    return;
  }

  const rng = createRng(null);
  state = {
    lang,
    target: pool[Math.floor(rng.next() * pool.length)],
    guessed: [],
    wrong: 0,
    over: false,
    won: false,
  };
  render();
  persist();
}

function persist() {
  if (!state) return;
  session.save(GAME, state, {
    label: LANGUAGES[state.lang].label,
    detail: state.over ? '' : `${LIVES - state.wrong} lives left`,
  });
}

function setLanguage(lang) { if (state?.lang !== lang) start(lang); }

/* --- play ----------------------------------------------------------------- */

function guess(letter) {
  if (!state || state.over || state.guessed.includes(letter)) return;
  state.guessed.push(letter);

  if (state.target.includes(letter)) {
    haptic(HAPTIC.commit);
    if ([...state.target].every((ch) => state.guessed.includes(ch))) finish(true);
  } else {
    state.wrong += 1;
    haptic(HAPTIC.reject);
    if (state.wrong >= LIVES) finish(false);
  }

  render();
  persist();
}

function finish(won) {
  state.over = true;
  state.won = won;
  if (won) { celebrate(); haptic(HAPTIC.win); }

  stats.record(GAME, {
    won, bucket: state.lang, distKey: won ? state.wrong : null,
  });

  setTimeout(() => resultDialog({
    title: won ? 'Saved' : 'Hanged',
    bodyHtml: won
      ? `You got <strong>${state.target.toUpperCase()}</strong> with ` +
        `${LIVES - state.wrong} ${LIVES - state.wrong === 1 ? 'life' : 'lives'} to spare.`
      : `The word was <strong>${state.target.toUpperCase()}</strong>.`,
    primary: { label: 'New word', onClick: () => start() },
    extra: won ? { label: 'Share result', onClick: () => shareResult(shareHeader([
      'Hangman', LANGUAGES[state.lang].label,
      `${state.wrong}/${LIVES} wrong`, `${state.target.length} letters`,
    ])) } : null,
    secondary: { label: 'Statistics', onClick: openStats },
  }), 350);
}

function openStats() {
  showStats(GAME, {
    title: 'Hangman statistics',
    buckets: LANGUAGE_CODES.map((c) => ({ key: c, label: LANGUAGES[c].label })),
    distLabel: 'Wrong guesses when winning',
    distMax: LIVES,
    showStreak: false,
  });
}

/* --- rendering ------------------------------------------------------------ */

function render() {
  if (!state) return;

  nodes.langTabs.querySelectorAll('[data-lang]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.lang === state.lang)));

  nodes.stage.querySelectorAll('.hm-part').forEach((part) => {
    part.classList.toggle('is-shown', PARTS.indexOf(part.dataset.part) < state.wrong);
  });

  nodes.lives.querySelectorAll('.hm-life').forEach((dot, i) => {
    dot.classList.toggle('is-lost', i < state.wrong);
  });

  nodes.word.replaceChildren(...[...state.target].map((ch) => {
    const known = state.guessed.includes(ch) || state.over;
    const missed = state.over && !state.won && !state.guessed.includes(ch);
    return el('span', {
      class: `hm-slot${missed ? ' is-missed' : ''}`,
      text: known ? ch : ' ',
    });
  }));
  nodes.word.setAttribute('aria-label',
    `Word: ${[...state.target].map((ch) => (state.guessed.includes(ch) ? ch : 'blank')).join(' ')}`);

  nodes.keyboard.replaceChildren(...LANGUAGES[state.lang].rows.map((row) =>
    el('div', { class: 'keyboard-row' }, row.map((letter) => {
      const used = state.guessed.includes(letter);
      const hit = used && state.target.includes(letter);
      return el('button', {
        type: 'button',
        class: `key${used ? (hit ? ' correct' : ' absent') : ''}`,
        text: letter,
        'aria-label': letter,
        disabled: used || state.over,
        onclick: () => guess(letter),
      });
    }))));
}

/* --- keyboard ------------------------------------------------------------- */

document.addEventListener('keydown', (event) => {
  if (!state || document.querySelector('.overlay.is-open')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.length !== 1) return;
  const letter = event.key.toLowerCase();
  if (!isLetter(state.lang, letter)) return;
  event.preventDefault();
  guess(letter);
});

/* --- boot ----------------------------------------------------------------- */

prefs.applyColorblind();
buildChrome();

const saved = session.load(GAME);
if (saved?.target && !saved.over) {
  state = saved;
  loadWords(saved.lang, 'answers').then(() => render());
} else {
  start('en');
}

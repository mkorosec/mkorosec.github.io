/* The single registry of games.
 *
 * The build tool uses this to emit each game's HTML shell, the hub page, the
 * web manifest and the service-worker precache list. Adding a game means
 * adding one entry here plus its js/games/<id>.js — nothing else needs to
 * know about it, and nothing can drift out of sync. */

export const SITE = {
  name: 'Games',
  shortName: 'Games',
  description: 'Offline puzzle games that work with the radios off. No install, no account, no network.',
  themeDark: '#0b0905',
  themeLight: '#fbfaf8',
};

/** Inline SVG bodies for the hub cards, drawn on a 24x24 grid. */
const ICONS = {
  sudoku: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  killer: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h7V3M14 21v-7h7" stroke-dasharray="2 2"/><path d="M10 10h4v4h-4z"/>',
  wordle: '<rect x="2" y="4" width="6" height="6" rx="1"/><rect x="9" y="4" width="6" height="6" rx="1"/><rect x="16" y="4" width="6" height="6" rx="1"/><rect x="2" y="12" width="6" height="6" rx="1"/><rect x="9" y="12" width="6" height="6" rx="1"/><rect x="16" y="12" width="6" height="6" rx="1"/>',
  kakuro: '<rect x="2" y="2" width="20" height="20" rx="2"/><line x1="2" y1="8" x2="8" y2="2"/><line x1="8" y1="14" x2="14" y2="8"/><line x1="14" y1="20" x2="20" y2="14"/>',
  nonogram: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/><rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none"/><rect x="15" y="15" width="4" height="4" fill="currentColor" stroke="none"/><rect x="4" y="15" width="4" height="4" fill="currentColor" stroke="none"/>',
  minesweeper: '<rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><path d="M12 5.5v1.8M12 16.7v1.8M5.5 12h1.8M16.7 12h1.8"/>',
  2048: '<rect x="2" y="2" width="8" height="8" rx="1.5"/><rect x="14" y="2" width="8" height="8" rx="1.5"/><rect x="2" y="14" width="8" height="8" rx="1.5"/><rect x="14" y="14" width="8" height="8" rx="1.5"/>',
  wordsearch: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6.5 7.5h11M6.5 12h11M6.5 16.5h6"/><circle cx="17" cy="16.5" r="3.2"/><path d="M19.4 18.9L21.5 21"/>',
  hangman: '<path d="M5 21h9M6.5 21V4h8"/><path d="M14.5 4v3"/><circle cx="14.5" cy="9.5" r="2.5"/><path d="M14.5 12v4.5M14.5 14l-2 2M14.5 14l2 2"/>',
  mastermind: '<circle cx="4.8" cy="14" r="2.2"/><circle cx="10.4" cy="14" r="2.2"/><circle cx="16" cy="14" r="2.2"/><circle cx="21.6" cy="14" r="2.2"/><circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="6" r="1.1" fill="currentColor" stroke="none" opacity="0.5"/>',
  solitaire: '<rect x="2.5" y="5" width="12" height="16" rx="2" transform="rotate(-9 8.5 13)"/><rect x="9.5" y="4" width="12" height="16" rx="2"/><path d="M15.5 9.5l2 2.4 2-2.4a1.6 1.6 0 10-2-1.9 1.6 1.6 0 10-2 1.9z"/>',
  chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M13 8H7M17 12H7" opacity="0.5"/>',
};

/**
 * @typedef {object} GameEntry
 * @property {string} id        file name stem and storage namespace
 * @property {string} title
 * @property {string} blurb     one line, shown on the hub card
 * @property {string} badge
 * @property {string} section
 * @property {string} [css]     extra stylesheet under css/
 * @property {boolean} [daily]  offers a date-seeded daily puzzle
 * @property {boolean} [legacy] hand-written page the builder must not touch
 */

/** @type {GameEntry[]} */
export const GAMES = [
  {
    id: 'sudoku', title: 'Sudoku', section: 'Puzzles', badge: 'Daily',
    blurb: 'Fill the grid. Difficulty is rated by the technique it needs, not the clue count.',
    icon: ICONS.sudoku, css: 'sudoku.css', daily: true,
  },
  {
    id: 'nonogram', title: 'Nonogram', section: 'Puzzles', badge: 'Daily',
    blurb: 'Reveal the hidden picture from the number clues. Never needs a guess.',
    icon: ICONS.nonogram, css: 'nonogram.css', daily: true,
  },
  {
    id: 'kakuro', title: 'Kakuro', section: 'Puzzles', badge: 'Daily',
    blurb: 'Fill each run so it adds up to its clue, with no digit repeated.',
    icon: ICONS.kakuro, css: 'kakuro.css', daily: true,
  },
  {
    id: 'killer', title: 'Killer Sudoku', section: 'Puzzles', badge: '3 levels',
    blurb: 'Sudoku with cage sums instead of starting digits.',
    icon: ICONS.killer, css: 'killer.css', daily: true,
  },
  {
    id: 'minesweeper', title: 'Minesweeper', section: 'Puzzles', badge: 'No guessing',
    blurb: 'Clear the board. Every layout is solvable by logic alone.',
    icon: ICONS.minesweeper, css: 'minesweeper.css',
  },
  {
    id: 'wordle', title: 'Wordle', section: 'Words', badge: 'Daily',
    blurb: 'Guess the five-letter word in six tries. English and Slovenian.',
    icon: ICONS.wordle, css: 'wordle.css', daily: true,
  },
  {
    id: 'wordsearch', title: 'Word Search', section: 'Words', badge: '2 languages',
    blurb: 'Find every hidden word in the grid.',
    icon: ICONS.wordsearch, css: 'wordsearch.css',
  },
  {
    id: 'hangman', title: 'Hangman', section: 'Words', badge: '2 languages',
    blurb: 'Guess the word one letter at a time before the drawing finishes.',
    icon: ICONS.hangman, css: 'hangman.css',
  },
  {
    id: 'solitaire', title: 'Solitaire', section: 'Cards', badge: 'Klondike',
    blurb: 'Klondike, draw one or three. Tap a card, tap where it goes.',
    icon: ICONS.solitaire, css: 'solitaire.css',
  },
  {
    id: '2048', title: '2048', section: 'Arcade', badge: 'Undo',
    blurb: 'Slide and merge tiles to reach 2048. Three board sizes.',
    icon: ICONS['2048'], css: '2048.css',
  },
  {
    id: 'mastermind', title: 'Mastermind', section: 'Two players', badge: 'Pass & play',
    blurb: 'Crack the colour code, alone or against someone next to you.',
    icon: ICONS.mastermind, css: 'mastermind.css',
  },
  {
    id: 'chat', title: 'Offline Chat', section: 'Two players', badge: 'Same Wi-Fi',
    blurb: 'Pair by QR code and chat with no server in between.',
    icon: ICONS.chat, legacy: true,
  },
];

/** Files the service worker must have cached for the app to run offline. */
export const EXTRA_PRECACHE = [
  'css/theme.css',
  'css/ui.css',
  'js/core/boot.js',
  'js/core/ui.js',
  'js/core/store.js',
  'js/core/rng.js',
  'js/core/prefs.js',
  'js/core/stats.js',
  'js/core/statsview.js',
  'js/core/session.js',
  'js/core/share.js',
  'js/core/generate.js',
  'js/core/words.js',
  'js/gen/worker.js',
  'js/gen/sudoku.js',
  'js/gen/kakuro.js',
  'js/gen/nonogram.js',
  'js/gen/minesweeper.js',
  'js/gen/wordsearch.js',
  'js/gen/killer.js',
  'assets/fonts/inter-latin.woff2',
  'assets/fonts/inter-latin-ext.woff2',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'words-en.json',
  'words-sl.json',
  'guesses-en.json',
  'guesses-sl.json',
  'manifest.webmanifest',
];

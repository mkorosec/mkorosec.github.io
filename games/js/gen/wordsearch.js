/* Word search grids. Reuses the existing bilingual word lists. */

import { createRng } from '../core/rng.js';

const DIRECTIONS = [
  { dr: 0,  dc: 1,  name: 'E'  },
  { dr: 1,  dc: 0,  name: 'S'  },
  { dr: 1,  dc: 1,  name: 'SE' },
  { dr: -1, dc: 1,  name: 'NE' },
  { dr: 0,  dc: -1, name: 'W'  },
  { dr: -1, dc: 0,  name: 'N'  },
  { dr: -1, dc: -1, name: 'NW' },
  { dr: 1,  dc: -1, name: 'SW' },
];

export const PRESETS = {
  easy:   { size: 10, wordCount: 6,  directions: 3, minLen: 4, maxLen: 8 },
  medium: { size: 13, wordCount: 9,  directions: 6, minLen: 4, maxLen: 10 },
  hard:   { size: 16, wordCount: 12, directions: 8, minLen: 5, maxLen: 12 },
};

const ALPHABETS = {
  en: 'abcdefghijklmnopqrstuvwxyz',
  sl: 'abcčdefghijklmnoprsštuvzž',
};

function canPlace(grid, size, word, row, col, dir) {
  for (let i = 0; i < word.length; i++) {
    const r = row + dir.dr * i;
    const c = col + dir.dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const existing = grid[r * size + c];
    if (existing && existing !== word[i]) return false;
  }
  return true;
}

function place(grid, size, word, row, col, dir) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const idx = (row + dir.dr * i) * size + (col + dir.dc * i);
    grid[idx] = word[i];
    cells.push(idx);
  }
  return cells;
}

/**
 * @param {object} opts
 * @param {string[]} opts.words   candidate words (any length; filtered here)
 * @param {string} [opts.lang]    picks the filler alphabet
 * @returns {{size:number, grid:string[], placed:Array<{word:string,cells:number[]}>,
 *            difficulty:string}}
 */
export function generate({
  difficulty = 'easy', rng = createRng(), words = [], lang = 'en',
} = {}) {
  const preset = PRESETS[difficulty] || PRESETS.easy;
  const { size, wordCount, directions, minLen, maxLen } = preset;
  const dirs = DIRECTIONS.slice(0, directions);
  const alphabet = ALPHABETS[lang] || ALPHABETS.en;

  const pool = rng.shuffle(
    [...new Set(words.map((w) => w.toLowerCase().trim()))]
      .filter((w) => w.length >= minLen && w.length <= Math.min(maxLen, size)),
  );

  const grid = new Array(size * size).fill('');
  const placed = [];

  for (const word of pool) {
    if (placed.length >= wordCount) break;

    // Try random positions rather than scanning, so repeated grids differ.
    const spots = rng.shuffle(Array.from({ length: size * size }, (_, i) => i));
    let done = false;
    for (const spot of spots) {
      if (done) break;
      const row = Math.floor(spot / size);
      const col = spot % size;
      for (const dir of rng.shuffle(dirs)) {
        if (!canPlace(grid, size, word, row, col, dir)) continue;
        placed.push({ word, cells: place(grid, size, word, row, col, dir) });
        done = true;
        break;
      }
    }
  }

  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = alphabet[Math.floor(rng.next() * alphabet.length)];
  }

  return { size, grid, placed, difficulty, lang };
}

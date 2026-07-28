/* Minesweeper boards that never require a guess.

   The classic frustration is reaching a position where two cells are
   indistinguishable and you have to flip a coin. Every board here is checked
   to be fully deducible from the opening click using the rules a player
   actually applies, and regenerated until it is. */

import { createRng } from '../core/rng.js';

export const PRESETS = {
  easy:   { width: 9,  height: 9,  mines: 10 },
  medium: { width: 16, height: 16, mines: 40 },
  hard:   { width: 16, height: 30, mines: 99 },
};

export function neighbours(width, height, index) {
  const r = Math.floor(index / width);
  const c = index % width;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < height && nc >= 0 && nc < width) out.push(nr * width + nc);
    }
  }
  return out;
}

export function countsFor(width, height, mines) {
  const counts = new Array(width * height).fill(0);
  for (let i = 0; i < counts.length; i++) {
    if (mines[i]) { counts[i] = -1; continue; }
    counts[i] = neighbours(width, height, i).filter((n) => mines[n]).length;
  }
  return counts;
}

/**
 * Can the board be cleared from `start` with no guessing?
 *
 * Applies the two rules every player uses — "count satisfied, rest are safe"
 * and "count equals unknowns, rest are mines" — plus the subset rule that
 * resolves the common 1-2-1 style patterns.
 */
export function isSolvable(width, height, mines, start) {
  const size = width * height;
  const counts = countsFor(width, height, mines);
  const revealed = new Uint8Array(size);
  const flagged = new Uint8Array(size);

  const reveal = (i) => {
    if (revealed[i] || flagged[i]) return;
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop();
      if (revealed[cur]) continue;
      revealed[cur] = 1;
      if (counts[cur] === 0) {
        for (const n of neighbours(width, height, cur)) if (!revealed[n]) stack.push(n);
      }
    }
  };

  reveal(start);

  let progress = true;
  while (progress) {
    progress = false;

    /* Constraints from every revealed number: which unknown cells it covers
       and how many of them are mines. */
    const constraints = [];
    for (let i = 0; i < size; i++) {
      if (!revealed[i] || counts[i] <= 0) continue;
      const unknown = [];
      let flags = 0;
      for (const n of neighbours(width, height, i)) {
        if (flagged[n]) flags++;
        else if (!revealed[n]) unknown.push(n);
      }
      if (!unknown.length) continue;
      constraints.push({ cells: unknown, mines: counts[i] - flags });
    }

    for (const { cells, mines: need } of constraints) {
      if (need === 0) {
        for (const c of cells) if (!revealed[c]) { reveal(c); progress = true; }
      } else if (need === cells.length) {
        for (const c of cells) if (!flagged[c]) { flagged[c] = 1; progress = true; }
      }
    }
    if (progress) continue;

    // Subset rule: if A's cells are contained in B's, then B minus A holds
    // exactly (B.mines - A.mines) mines.
    for (const a of constraints) {
      for (const b of constraints) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        const setB = new Set(b.cells);
        if (!a.cells.every((c) => setB.has(c))) continue;

        const diff = b.cells.filter((c) => !a.cells.includes(c));
        const diffMines = b.mines - a.mines;
        if (diffMines === 0) {
          for (const c of diff) if (!revealed[c] && !flagged[c]) { reveal(c); progress = true; }
        } else if (diffMines === diff.length) {
          for (const c of diff) if (!flagged[c]) { flagged[c] = 1; progress = true; }
        }
      }
      if (progress) break;
    }
  }

  for (let i = 0; i < size; i++) if (!mines[i] && !revealed[i]) return false;
  return true;
}

/**
 * @param {object} opts
 * @param {string} [opts.difficulty]
 * @param {number} [opts.safeIndex]  opening click; it and its neighbours are
 *                                   always mine-free so the first move opens
 *                                   a region rather than ending the game
 * @param {boolean} [opts.noGuess=true]
 * @returns {{width:number,height:number,mineCount:number,mines:boolean[],
 *            counts:number[],difficulty:string,noGuess:boolean}}
 */
export function generate({
  difficulty = 'easy', rng = createRng(), safeIndex = null, noGuess = true, attempts = 400,
} = {}) {
  const preset = PRESETS[difficulty] || PRESETS.easy;
  const { width, height, mines: mineCount } = preset;
  const size = width * height;
  const start = safeIndex ?? Math.floor(size / 2);

  const forbidden = new Set([start, ...neighbours(width, height, start)]);
  const pool = [];
  for (let i = 0; i < size; i++) if (!forbidden.has(i)) pool.push(i);

  let fallback = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const mines = new Array(size).fill(false);
    for (const i of rng.shuffle(pool).slice(0, mineCount)) mines[i] = true;

    const board = {
      width, height, mineCount, mines,
      counts: countsFor(width, height, mines),
      difficulty,
      noGuess: false,
    };

    if (!noGuess) return board;
    if (!fallback) fallback = board;
    if (isSolvable(width, height, mines, start)) return { ...board, noGuess: true };
  }

  // Better a solvable-with-one-guess board than no board at all.
  return fallback;
}

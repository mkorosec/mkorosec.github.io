/* Killer Sudoku: a sudoku grid with no givens, where dashed "cages" carry a
   sum and may not repeat a digit. Reuses the sudoku solution generator. */

import { createRng } from '../core/rng.js';
import { fullGrid, PEERS, CELLS, rowOf, colOf } from './sudoku.js';

/* Larger cages blow up the search, so hard keeps a single given to bound the
   worst case rather than occasionally stalling for seconds. */
export const PRESETS = {
  easy:   { maxCage: 3, givens: 6 },
  medium: { maxCage: 4, givens: 2 },
  hard:   { maxCage: 5, givens: 1 },
};

const orthNeighbours = (i) => {
  const r = rowOf(i);
  const c = colOf(i);
  const out = [];
  if (r > 0) out.push(i - 9);
  if (r < 8) out.push(i + 9);
  if (c > 0) out.push(i - 1);
  if (c < 8) out.push(i + 1);
  return out;
};

/** Partition the grid into orthogonally-connected cages of distinct digits. */
function makeCages(solution, maxCage, rng) {
  const cageOf = new Array(CELLS).fill(-1);
  const cages = [];

  for (const start of rng.shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
    if (cageOf[start] !== -1) continue;

    const cells = [start];
    const digits = new Set([solution[start]]);
    cageOf[start] = cages.length;
    const target = 1 + Math.floor(rng.next() * maxCage);

    while (cells.length < target) {
      const options = [];
      for (const cell of cells) {
        for (const n of orthNeighbours(cell)) {
          if (cageOf[n] === -1 && !digits.has(solution[n])) options.push(n);
        }
      }
      if (!options.length) break;
      const next = options[Math.floor(rng.next() * options.length)];
      cells.push(next);
      digits.add(solution[next]);
      cageOf[next] = cages.length;
    }

    cages.push({ cells, sum: cells.reduce((t, c) => t + solution[c], 0) });
  }

  return { cages, cageOf };
}

/**
 * Count solutions honouring sudoku rules, cage sums and cage distinctness.
 */
export function countSolutions(cages, cageOf, givens, limit = 2) {
  const board = givens.slice();
  const cageState = cages.map((cage) => ({
    remaining: cage.cells.length,
    left: cage.sum,
    used: new Set(),
  }));

  for (let i = 0; i < CELLS; i++) {
    if (!board[i]) continue;
    const st = cageState[cageOf[i]];
    st.remaining--;
    st.left -= board[i];
    st.used.add(board[i]);
  }

  const minRest = (n) => (n * (n + 1)) / 2;
  const maxRest = (n) => (n * (19 - n)) / 2;

  let count = 0;

  const legal = (pos, digit) => {
    for (const p of PEERS[pos]) if (board[p] === digit) return false;
    const st = cageState[cageOf[pos]];
    if (st.used.has(digit)) return false;
    const after = st.left - digit;
    const rest = st.remaining - 1;
    if (after < minRest(rest) || after > maxRest(rest)) return false;
    return true;
  };

  (function search() {
    if (count >= limit) return;

    let best = -1;
    let bestOptions = 10;
    for (let i = 0; i < CELLS; i++) {
      if (board[i]) continue;
      let n = 0;
      for (let d = 1; d <= 9; d++) if (legal(i, d)) n++;
      if (n === 0) return;
      if (n < bestOptions) { bestOptions = n; best = i; if (n === 1) break; }
    }
    if (best === -1) { count++; return; }

    const st = cageState[cageOf[best]];
    for (let d = 1; d <= 9; d++) {
      if (!legal(best, d)) continue;
      board[best] = d;
      st.remaining--; st.left -= d; st.used.add(d);
      search();
      st.used.delete(d); st.left += d; st.remaining++;
      board[best] = 0;
      if (count >= limit) return;
    }
  })();

  return count;
}

/**
 * @returns {{cages:Array<{cells:number[],sum:number}>, cageOf:number[],
 *            givens:number[], solution:number[], difficulty:string}}
 */
export function generate({ difficulty = 'easy', rng = createRng(), attempts = 40 } = {}) {
  const preset = PRESETS[difficulty] || PRESETS.easy;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const solution = fullGrid(rng);
    const { cages, cageOf } = makeCages(solution, preset.maxCage, rng);

    // A few starting digits on the gentler levels; the hard board has none.
    const givens = new Array(CELLS).fill(0);
    for (const i of rng.shuffle(Array.from({ length: CELLS }, (_, k) => k)).slice(0, preset.givens)) {
      givens[i] = solution[i];
    }

    if (countSolutions(cages, cageOf, givens, 2) !== 1) continue;

    return { cages, cageOf, givens, solution, difficulty };
  }

  return null;
}

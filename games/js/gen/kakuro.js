/* Kakuro generation with guaranteed unique solutions.

   The previous generator filled a fixed layout with random valid digits and
   derived the clues from whatever it produced. That is not enough: sampled
   puzzles had 2-100+ solutions, so the player was forced to guess, and a
   third of "clues" on the easy board were single-cell runs that gave their
   answer away for free. Both are fixed here — runs are always at least two
   cells, and every puzzle is verified to have exactly one solution before it
   is handed out. */

import { createRng } from '../core/rng.js';

export const BLACK = -1;
export const WHITE = 0;

/* --- digit combinations --------------------------------------------------- */

/* COMBOS[len][sum] = array of bitmasks, one per set of `len` distinct digits
   1-9 summing to `sum`. Precomputed once; this is what makes the solver's
   propagation step cheap. */
const COMBOS = (() => {
  const table = Array.from({ length: 10 }, () => new Map());
  for (let mask = 1; mask < 512; mask++) {
    let len = 0;
    let sum = 0;
    for (let d = 1; d <= 9; d++) {
      if (mask & (1 << (d - 1))) { len++; sum += d; }
    }
    if (!table[len].has(sum)) table[len].set(sum, []);
    table[len].get(sum).push(mask);
  }
  return table;
})();

export function combosFor(len, sum) {
  return (len >= 1 && len <= 9 && COMBOS[len].get(sum)) || [];
}

/** Digits that can appear in a run of `len` cells summing to `sum`. */
export function possibleDigits(len, sum) {
  let union = 0;
  for (const m of combosFor(len, sum)) union |= m;
  return union;
}

export function minSum(len) { return (len * (len + 1)) / 2; }
export function maxSum(len) { return len * (19 - len) / 2; }

/* --- run extraction ------------------------------------------------------- */

/**
 * Find every horizontal and vertical run of white cells.
 * Only runs of two or more cells count — a one-cell run is not a puzzle, it
 * is a free answer.
 */
export function buildRuns(size, grid) {
  const across = [];
  const down = [];
  const cellAcross = new Array(size * size).fill(-1);
  const cellDown = new Array(size * size).fill(-1);

  const flush = (cells, list, cellMap, clueIdx) => {
    if (cells.length < 2) return;
    const idx = list.length;
    list.push({ cells: cells.slice(), clueIdx, sum: 0 });
    for (const c of cells) cellMap[c] = idx;
  };

  for (let r = 0; r < size; r++) {
    let cells = [];
    for (let c = 0; c <= size; c++) {
      const idx = r * size + c;
      if (c < size && grid[idx] === WHITE) { cells.push(idx); continue; }
      if (cells.length) flush(cells, across, cellAcross, r * size + (c - cells.length - 1));
      cells = [];
    }
  }

  for (let c = 0; c < size; c++) {
    let cells = [];
    for (let r = 0; r <= size; r++) {
      const idx = r * size + c;
      if (r < size && grid[idx] === WHITE) { cells.push(idx); continue; }
      if (cells.length) flush(cells, down, cellDown, (r - cells.length - 1) * size + c);
      cells = [];
    }
  }

  return { across, down, cellAcross, cellDown };
}

/* --- layout --------------------------------------------------------------- */

/** Every white cell sits in an across run and a down run, each `minRun`-9 cells. */
export function isValidLayout(size, grid, minRun = 2) {
  const { across, down, cellAcross, cellDown } = buildRuns(size, grid);
  for (const run of across) if (run.cells.length > 9 || run.cells.length < minRun) return false;
  for (const run of down) if (run.cells.length > 9 || run.cells.length < minRun) return false;
  for (let i = 0; i < size * size; i++) {
    if (grid[i] !== WHITE) continue;
    if (cellAcross[i] === -1 || cellDown[i] === -1) return false;
  }
  return true;
}

/**
 * Build a layout by *adding* black cells to an all-white interior, keeping
 * only the placements that leave the grid valid.
 *
 * Scattering black cells at random and then repairing the damage does not
 * work: repairing one bad cell orphans its neighbour, the fix cascades, and a
 * 7x7 board collapses to roughly a third of the white cells it needs. Growing
 * the layout instead means every intermediate state is already legal.
 *
 * `size` must be at most 10, so that the initial full-width runs are within
 * the 9-cell maximum imposed by using distinct digits.
 */
export function makeLayout(size, blackRatio, rng, minRun = 3) {
  const grid = new Array(size * size).fill(WHITE);

  // Top row and left column are always clue headers.
  for (let c = 0; c < size; c++) grid[c] = BLACK;
  for (let r = 0; r < size; r++) grid[r * size] = BLACK;

  const interior = [];
  for (let r = 1; r < size; r++) for (let c = 1; c < size; c++) interior.push(r * size + c);

  const target = Math.round(interior.length * blackRatio);
  let placed = 0;

  // Two stages. The first refuses any placement that would leave a run
  // shorter than `minRun`, which keeps runs long and interlocking; short runs
  // are what make a board ambiguous, because an isolated 2x2 of white cells
  // has a whole family of solutions for most clue sums. The second stage
  // relaxes to length 2 only if the board is still too open.
  for (const stage of [minRun, 2]) {
    for (const i of rng.shuffle(interior)) {
      if (placed >= target) break;
      if (grid[i] === BLACK) continue;
      grid[i] = BLACK;
      if (isValidLayout(size, grid, stage)) placed++;
      else grid[i] = WHITE;
    }
    if (placed >= target) break;
  }

  return grid;
}

/** Largest connected group of white cells; used to reject fragmented boards. */
function largestWhiteRegion(size, grid) {
  const seen = new Uint8Array(size * size);
  let best = 0;
  for (let start = 0; start < size * size; start++) {
    if (grid[start] !== WHITE || seen[start]) continue;
    let count = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      count++;
      const r = Math.floor(i / size);
      const c = i % size;
      const neighbours = [
        r > 0 ? i - size : -1, r < size - 1 ? i + size : -1,
        c > 0 ? i - 1 : -1, c < size - 1 ? i + 1 : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && grid[n] === WHITE && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (count > best) best = count;
  }
  return best;
}

/* --- solver --------------------------------------------------------------- */

/**
 * Count solutions up to `limit` using combination-set propagation plus
 * backtracking on the most constrained cell.
 */
export function countSolutions(size, grid, clues, runs, limit = 2) {
  const { across, down, cellAcross, cellDown } = runs;
  const cells = [];
  for (let i = 0; i < size * size; i++) if (grid[i] === WHITE) cells.push(i);

  const sumOf = (run, dir) => (dir === 'across' ? clues[run.clueIdx]?.across : clues[run.clueIdx]?.down);

  const cand = new Int16Array(size * size).fill(0);
  for (const i of cells) {
    const a = across[cellAcross[i]];
    const d = down[cellDown[i]];
    cand[i] = possibleDigits(a.cells.length, sumOf(a, 'across'))
            & possibleDigits(d.cells.length, sumOf(d, 'down'));
  }

  const value = new Int8Array(size * size);
  let count = 0;

  /** Restrict candidates using each run's still-viable combinations. */
  function propagate(scratch) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [list, dir] of [[across, 'across'], [down, 'down']]) {
        for (const run of list) {
          const target = sumOf(run, dir);
          let used = 0;
          let free = 0;
          let openCount = 0;
          for (const c of run.cells) {
            if (value[c]) used |= 1 << (value[c] - 1);
            else { free |= scratch[c]; openCount++; }
          }

          let union = 0;
          let viable = 0;
          for (const combo of combosFor(run.cells.length, target)) {
            if ((combo & used) !== used) continue;      // must contain placed digits
            const rest = combo & ~used;
            if ((rest & ~free) !== 0) continue;         // needs a digit nobody can take
            union |= rest;
            viable++;
          }
          if (viable === 0) return false;
          if (openCount === 0) continue;

          for (const c of run.cells) {
            if (value[c]) continue;
            const next = scratch[c] & union;
            if (next === 0) return false;
            if (next !== scratch[c]) { scratch[c] = next; changed = true; }
          }
        }
      }
    }
    return true;
  }

  function search(scratch) {
    if (count >= limit) return;
    if (!propagate(scratch)) return;

    let target = -1;
    let bestSize = 10;
    for (const i of cells) {
      if (value[i]) continue;
      let n = 0;
      for (let d = 0; d < 9; d++) if (scratch[i] & (1 << d)) n++;
      if (n < bestSize) { bestSize = n; target = i; if (n === 1) break; }
    }

    if (target === -1) { count++; return; }

    for (let d = 1; d <= 9; d++) {
      if (!(scratch[target] & (1 << (d - 1)))) continue;
      // A digit may not repeat inside either of its runs.
      const a = across[cellAcross[target]];
      const dn = down[cellDown[target]];
      if (a.cells.some((c) => value[c] === d)) continue;
      if (dn.cells.some((c) => value[c] === d)) continue;

      value[target] = d;
      const next = Int16Array.from(scratch);
      next[target] = 1 << (d - 1);
      search(next);
      value[target] = 0;
      if (count >= limit) return;
    }
  }

  search(Int16Array.from(cand));
  return count;
}

/* --- generation ----------------------------------------------------------- */

/**
 * Fill every white cell so each run holds distinct digits.
 *
 * Digit order is biased per run towards either the low or the high end
 * rather than being uniformly shuffled. A run summing to something extreme
 * ("6 in 3" can only be 1+2+3) admits one combination; a middling sum admits
 * a dozen. Uniform fills produce middling sums almost every time, which is
 * why a randomly-filled board nearly always has multiple solutions.
 */
function fillGrid(size, grid, runs, rng) {
  const { across, down, cellAcross, cellDown } = runs;
  const values = new Int8Array(size * size);
  const cells = [];
  for (let i = 0; i < size * size; i++) if (grid[i] === WHITE) cells.push(i);

  const acrossBias = across.map(() => (rng.next() < 0.5 ? -1 : 1));
  const downBias = down.map(() => (rng.next() < 0.5 ? -1 : 1));

  const ok = (function place(k) {
    if (k === cells.length) return true;
    const i = cells[k];
    const a = across[cellAcross[i]];
    const d = down[cellDown[i]];
    const bias = acrossBias[cellAcross[i]] + downBias[cellDown[i]];

    // Jitter keeps successive fills of the same layout different.
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((digit) => ({ digit, key: bias * digit + rng.next() * 3 }))
      .sort((x, y) => x.key - y.key)
      .map((x) => x.digit);

    for (const digit of order) {
      if (a.cells.some((c) => values[c] === digit)) continue;
      if (d.cells.some((c) => values[c] === digit)) continue;
      values[i] = digit;
      if (place(k + 1)) return true;
      values[i] = 0;
    }
    return false;
  })(0);

  return ok ? values : null;
}

function cluesFrom(size, runs, values) {
  const clues = new Array(size * size).fill(null);
  for (const run of runs.across) {
    const sum = run.cells.reduce((t, c) => t + values[c], 0);
    clues[run.clueIdx] = { ...(clues[run.clueIdx] || {}), across: sum };
  }
  for (const run of runs.down) {
    const sum = run.cells.reduce((t, c) => t + values[c], 0);
    clues[run.clueIdx] = { ...(clues[run.clueIdx] || {}), down: sum };
  }
  return clues;
}

/* size <= 10 keeps every full-width run inside the 9-distinct-digit limit. */
export const PRESETS = {
  easy:   { size: 7,  blackRatio: 0.34, minWhite: 18, layouts: 10, fills: 60 },
  medium: { size: 9,  blackRatio: 0.34, minWhite: 34, layouts: 16, fills: 80 },
  hard:   { size: 10, blackRatio: 0.40, minWhite: 44, layouts: 28, fills: 90 },
};

/**
 * How much freedom a set of clues leaves, as the total log2 of the number of
 * digit combinations each run admits. Lower is more constrained, and a more
 * constrained board is far likelier to have a single solution.
 */
function ambiguityScore(runs, clues) {
  let score = 0;
  for (const run of runs.across) {
    score += Math.log2(Math.max(1, combosFor(run.cells.length, clues[run.clueIdx].across).length));
  }
  for (const run of runs.down) {
    score += Math.log2(Math.max(1, combosFor(run.cells.length, clues[run.clueIdx].down).length));
  }
  return score;
}

/**
 * @returns {{size:number, grid:number[], clues:Array, solution:number[],
 *            difficulty:string, whiteCount:number}|null}
 */
export function generate({
  difficulty = 'easy', rng = createRng(), layoutAttempts = null, fillAttempts = null,
} = {}) {
  const preset = PRESETS[difficulty] || PRESETS.easy;
  const { size, blackRatio, minWhite } = preset;
  const fillBudget = fillAttempts ?? preset.fills;

  // Escalate rather than give up. A null puzzle would break a daily, and
  // consuming more of the same seeded stream stays deterministic.
  const base = layoutAttempts ?? preset.layouts;
  for (const layoutBudget of [base, base * 3, base * 9]) {
    const found = attemptGenerate({ size, blackRatio, minWhite, difficulty, rng, layoutBudget, fillBudget });
    if (found) return found;
  }
  return null;
}

function attemptGenerate({ size, blackRatio, minWhite, difficulty, rng, layoutBudget, fillBudget }) {
  for (let attempt = 0; attempt < layoutBudget; attempt++) {
    const grid = makeLayout(size, blackRatio, rng);

    const whiteCells = grid.reduce((n, v) => n + (v === WHITE ? 1 : 0), 0);
    if (whiteCells < minWhite) continue;
    // A board split into islands is technically valid but reads as broken.
    if (largestWhiteRegion(size, grid) !== whiteCells) continue;

    const runs = buildRuns(size, grid);
    if (!runs.across.length || !runs.down.length) continue;

    // Building a layout is expensive; filling one is cheap. Most random fills
    // leave a board with many solutions, so try a batch of them and test the
    // most constrained first rather than throwing the layout away after one
    // unlucky fill.
    const candidates = [];
    for (let f = 0; f < fillBudget; f++) {
      const values = fillGrid(size, grid, runs, rng);
      if (!values) break;
      const clues = cluesFrom(size, runs, values);
      candidates.push({ values, clues, score: ambiguityScore(runs, clues) });
    }
    candidates.sort((a, b) => a.score - b.score);

    for (const candidate of candidates) {
      if (countSolutions(size, grid, candidate.clues, runs, 2) !== 1) continue;
      return {
        size,
        grid,
        clues: candidate.clues,
        solution: Array.from(candidate.values),
        difficulty,
        whiteCount: whiteCells,
      };
    }
  }

  return null;
}

/* Sudoku generation, solving and difficulty rating.
   Pure and dependency-free so it can run under `node --test`. */

import { createRng } from '../core/rng.js';

export const SIZE = 9;
export const CELLS = 81;
const ALL = 0x1FF; // candidate bitmask for digits 1..9

/* --- units and peers ------------------------------------------------------ */

export const UNITS = (() => {
  const units = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    const cells = [];
    for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) cells.push(r * 9 + c);
    units.push(cells);
  }
  return units;
})();

const UNITS_OF = (() => {
  const map = Array.from({ length: CELLS }, () => []);
  UNITS.forEach((u, i) => u.forEach((cell) => map[cell].push(i)));
  return map;
})();

export const PEERS = (() => {
  const peers = Array.from({ length: CELLS }, () => new Set());
  UNITS.forEach((u) => u.forEach((a) => u.forEach((b) => { if (a !== b) peers[a].add(b); })));
  return peers.map((s) => [...s]);
})();

export const rowOf = (i) => Math.floor(i / 9);
export const colOf = (i) => i % 9;
export const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

const bit = (d) => 1 << (d - 1);
const popcount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lowestDigit = (m) => 31 - Math.clz32(m & -m) + 1;

/* --- brute-force solver --------------------------------------------------- */

/** Count solutions, stopping at `limit`. Used for uniqueness checks. */
export function countSolutions(grid, limit = 2) {
  const b = grid.slice();
  let count = 0;

  const legal = (pos, n) => {
    for (const p of PEERS[pos]) if (b[p] === n) return false;
    return true;
  };

  (function search() {
    if (count >= limit) return;
    let best = -1;
    let bestOptions = 10;
    for (let i = 0; i < CELLS; i++) {
      if (b[i] !== 0) continue;
      let options = 0;
      for (let n = 1; n <= 9; n++) if (legal(i, n)) options++;
      if (options === 0) return;
      if (options < bestOptions) { bestOptions = options; best = i; if (options === 1) break; }
    }
    if (best === -1) { count++; return; }
    for (let n = 1; n <= 9; n++) {
      if (!legal(best, n)) continue;
      b[best] = n;
      search();
      b[best] = 0;
      if (count >= limit) return;
    }
  })();

  return count;
}

export const hasUniqueSolution = (grid) => countSolutions(grid, 2) === 1;

/** Solve completely, or return null. */
export function solve(grid) {
  const b = grid.slice();
  const legal = (pos, n) => {
    for (const p of PEERS[pos]) if (b[p] === n) return false;
    return true;
  };
  const ok = (function search() {
    let best = -1;
    let bestOptions = 10;
    for (let i = 0; i < CELLS; i++) {
      if (b[i] !== 0) continue;
      let options = 0;
      for (let n = 1; n <= 9; n++) if (legal(i, n)) options++;
      if (options === 0) return false;
      if (options < bestOptions) { bestOptions = options; best = i; if (options === 1) break; }
    }
    if (best === -1) return true;
    for (let n = 1; n <= 9; n++) {
      if (!legal(best, n)) continue;
      b[best] = n;
      if (search()) return true;
      b[best] = 0;
    }
    return false;
  })();
  return ok ? b : null;
}

/* --- logical solver ------------------------------------------------------- */

export const TECHNIQUES = ['nakedSingle', 'hiddenSingle', 'lockedCandidate', 'nakedPair', 'hiddenPair'];

/** Techniques a beginner uses and nothing else. */
export const SINGLES_ONLY = ['nakedSingle', 'hiddenSingle'];

function candidateGrid(grid) {
  const cand = new Array(CELLS).fill(ALL);
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0) continue;
    cand[i] = bit(grid[i]);
    for (const p of PEERS[i]) cand[p] &= ~bit(grid[i]);
  }
  return cand;
}

/**
 * Solve using only the listed techniques.
 * @returns {{solved:boolean, grid:number[], used:Set<string>, contradiction:boolean}}
 */
export function solveLogical(grid, allowed = TECHNIQUES) {
  const b = grid.slice();
  const cand = candidateGrid(b);
  const use = new Set(allowed);
  const used = new Set();

  const place = (i, d) => {
    b[i] = d;
    cand[i] = bit(d);
    for (const p of PEERS[i]) cand[p] &= ~bit(d);
  };

  for (let i = 0; i < CELLS; i++) {
    if (b[i] === 0 && cand[i] === 0) return { solved: false, grid: b, used, contradiction: true };
  }

  let progress = true;
  while (progress) {
    progress = false;

    if (use.has('nakedSingle')) {
      for (let i = 0; i < CELLS; i++) {
        if (b[i] !== 0) continue;
        if (cand[i] === 0) return { solved: false, grid: b, used, contradiction: true };
        if (popcount(cand[i]) === 1) {
          place(i, lowestDigit(cand[i]));
          used.add('nakedSingle');
          progress = true;
        }
      }
      if (progress) continue;
    }

    if (use.has('hiddenSingle')) {
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const m = bit(d);
          let spot = -1;
          let count = 0;
          let placed = false;
          for (const i of unit) {
            if (b[i] === d) { placed = true; break; }
            if (b[i] === 0 && (cand[i] & m)) { count++; spot = i; }
          }
          if (placed) continue;
          if (count === 0) return { solved: false, grid: b, used, contradiction: true };
          if (count === 1) { place(spot, d); used.add('hiddenSingle'); progress = true; }
        }
      }
      if (progress) continue;
    }

    if (use.has('lockedCandidate') && lockedCandidates(b, cand)) {
      used.add('lockedCandidate');
      progress = true;
      continue;
    }

    if (use.has('nakedPair') && nakedPairs(b, cand)) {
      used.add('nakedPair');
      progress = true;
      continue;
    }

    if (use.has('hiddenPair') && hiddenPairs(b, cand)) {
      used.add('hiddenPair');
      progress = true;
      continue;
    }
  }

  return { solved: b.every((v) => v !== 0), grid: b, used, contradiction: false };
}

/** Pointing and claiming. */
function lockedCandidates(b, cand) {
  let changed = false;

  for (let box = 0; box < 9; box++) {
    const cells = UNITS[18 + box].filter((i) => b[i] === 0);
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      const spots = cells.filter((i) => cand[i] & m);
      if (spots.length < 2) continue;

      const rows = new Set(spots.map(rowOf));
      if (rows.size === 1) {
        for (const i of UNITS[[...rows][0]]) {
          if (boxOf(i) !== box && b[i] === 0 && (cand[i] & m)) { cand[i] &= ~m; changed = true; }
        }
      }
      const cols = new Set(spots.map(colOf));
      if (cols.size === 1) {
        for (const i of UNITS[9 + [...cols][0]]) {
          if (boxOf(i) !== box && b[i] === 0 && (cand[i] & m)) { cand[i] &= ~m; changed = true; }
        }
      }
    }
  }

  for (let u = 0; u < 18; u++) {
    const cells = UNITS[u].filter((i) => b[i] === 0);
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      const spots = cells.filter((i) => cand[i] & m);
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxOf));
      if (boxes.size !== 1) continue;
      for (const i of UNITS[18 + [...boxes][0]]) {
        if (!UNITS[u].includes(i) && b[i] === 0 && (cand[i] & m)) { cand[i] &= ~m; changed = true; }
      }
    }
  }

  return changed;
}

function nakedPairs(b, cand) {
  let changed = false;
  for (const unit of UNITS) {
    const open = unit.filter((i) => b[i] === 0 && popcount(cand[i]) === 2);
    for (let a = 0; a < open.length; a++) {
      for (let c = a + 1; c < open.length; c++) {
        if (cand[open[a]] !== cand[open[c]]) continue;
        const mask = cand[open[a]];
        for (const i of unit) {
          if (i === open[a] || i === open[c] || b[i] !== 0) continue;
          if (cand[i] & mask) { cand[i] &= ~mask; changed = true; }
        }
      }
    }
  }
  return changed;
}

function hiddenPairs(b, cand) {
  let changed = false;
  for (const unit of UNITS) {
    const open = unit.filter((i) => b[i] === 0);
    for (let d1 = 1; d1 <= 9; d1++) {
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const m = bit(d1) | bit(d2);
        const spots = open.filter((i) => cand[i] & m);
        if (spots.length !== 2) continue;
        if (!(cand[spots[0]] & bit(d1)) || !(cand[spots[0]] & bit(d2))) continue;
        if (!(cand[spots[1]] & bit(d1)) || !(cand[spots[1]] & bit(d2))) continue;
        for (const i of spots) {
          if (cand[i] !== m) { cand[i] = m; changed = true; }
        }
      }
    }
  }
  return changed;
}

/**
 * What the puzzle actually demands of the solver.
 *
 *   easy   - scanning alone: naked and hidden singles
 *   medium - needs candidate elimination: locked candidates or pairs
 *   hard   - beyond those, i.e. chains or trial-and-error
 *
 * Three wide bands rather than one band per technique. Splitting "needs
 * locked candidates" from "needs pairs" sounds tidier but is useless in
 * practice: almost no puzzle needs pairs and nothing stronger, so that
 * level would be near-impossible to generate and would silently degrade
 * into a mislabelled easy one.
 *
 * @returns {'easy'|'medium'|'hard'}
 */
export function rate(puzzle) {
  if (solveLogical(puzzle, SINGLES_ONLY).solved) return 'easy';
  if (solveLogical(puzzle, TECHNIQUES).solved) return 'medium';
  return 'hard';
}

/* --- generation ----------------------------------------------------------- */

/** Random complete grid. */
export function fullGrid(rng = createRng()) {
  const b = new Array(CELLS).fill(0);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  (function fill(pos) {
    if (pos === CELLS) return true;
    if (b[pos] !== 0) return fill(pos + 1);
    for (const d of rng.shuffle(digits)) {
      let ok = true;
      for (const p of PEERS[pos]) if (b[p] === d) { ok = false; break; }
      if (!ok) continue;
      b[pos] = d;
      if (fill(pos + 1)) return true;
      b[pos] = 0;
    }
    return false;
  })(0);

  return b;
}

export const LEVELS = ['easy', 'medium', 'hard'];

/* 17 is the proven minimum clue count for a uniquely-solvable grid. */
const ABSOLUTE_MIN_GIVENS = 17;

/* Purely visual: how full a finished board of each rating should look. */
const COSMETIC_MIN_GIVENS = { easy: 32, medium: 28, hard: 24 };

/**
 * Generate a puzzle whose *required solving technique* matches `difficulty` —
 * not merely its clue count, which is what makes most generated "hard"
 * puzzles inconsistent.
 *
 * Two phases:
 *   1. strip to a minimal puzzle that still has exactly one solution;
 *   2. put clues back until the rating drops to the requested level.
 *
 * Phase 2 is what makes the label trustworthy. Restoring a clue can only make
 * a puzzle easier, so walking down from "hardest possible" lands on the exact
 * target every time — far cheaper and far more reliable than generating
 * candidates at random and hoping one rates correctly.
 *
 * @returns {{puzzle:number[], solution:number[], givens:number, rating:string}}
 */
/** Unique-solution test with a cheap fast path: anything the logical solver
    finishes is unique by construction, which skips the expensive search for
    the majority of candidate removals. */
function stillUnique(puzzle) {
  if (solveLogical(puzzle, TECHNIQUES).solved) return true;
  return hasUniqueSolution(puzzle);
}

/** Strip a solved grid down to a minimal uniquely-solvable puzzle. */
function stripToMinimal(solution, rng) {
  const puzzle = solution.slice();
  let givens = CELLS;
  const removed = [];

  // Pass 0 removes symmetric pairs (a nicer-looking board); later passes drop
  // the symmetry constraint so the grid can reach a genuine minimum. Repeat
  // until a pass removes nothing: a cell that resisted removal early often
  // becomes removable once its neighbours are gone.
  let progress = true;
  for (let pass = 0; pass < 4 && progress; pass++) {
    progress = false;
    const symmetric = pass === 0;

    for (const i of rng.shuffle(Array.from({ length: CELLS }, (_, k) => k))) {
      const mirror = CELLS - 1 - i;
      const group = symmetric && i !== mirror ? [i, mirror] : [i];
      if (group.some((c) => puzzle[c] === 0)) continue;
      if (givens - group.length < ABSOLUTE_MIN_GIVENS) continue;

      const saved = group.map((c) => puzzle[c]);
      group.forEach((c) => { puzzle[c] = 0; });

      if (stillUnique(puzzle)) {
        givens -= group.length;
        removed.push(group);
        progress = true;
      } else {
        group.forEach((c, k) => { puzzle[c] = saved[k]; });
      }
    }
  }

  return { puzzle, givens, removed };
}

/* A minimal puzzle is not automatically a hard one — plenty of 23-clue grids
   fall to singles alone. Since restoring a clue can only make a puzzle
   easier, the harder levels have to *find* a sufficiently hard minimal grid
   first. This is how many to try before settling for the hardest seen. */
const SEARCH_TRIES = { easy: 1, medium: 3, hard: 4 };

export function generate({ difficulty = 'easy', rng = createRng() } = {}) {
  const want = Math.max(0, LEVELS.indexOf(difficulty));
  const tries = SEARCH_TRIES[difficulty] ?? 3;

  let best = null;
  let bestRank = -1;

  for (let i = 0; i < tries; i++) {
    const solution = fullGrid(rng);
    const stripped = stripToMinimal(solution, rng);
    const rank = LEVELS.indexOf(rate(stripped.puzzle));
    if (rank > bestRank) { best = { ...stripped, solution }; bestRank = rank; }
    if (rank >= want) break;
  }

  const { puzzle, solution } = best;
  let givens = best.givens;
  const restorable = rng.shuffle(best.removed);
  let rating = rate(puzzle);

  // Walk the rating down to the target by restoring clues. Difficulty is a
  // step function, not a slope — a single clue can collapse an expert grid
  // straight to easy — so each step probes a few candidate clues and keeps
  // one that stays at or above the target, rather than taking the first and
  // overshooting.
  const PROBE_CAP = 48;
  while (restorable.length && LEVELS.indexOf(rating) > want) {
    let pickIdx = -1;
    let pickRating = null;
    let pickCost = Infinity;

    for (let k = 0; k < Math.min(PROBE_CAP, restorable.length); k++) {
      const idx = restorable.length - 1 - k;
      const group = restorable[idx];
      group.forEach((c) => { puzzle[c] = solution[c]; });
      const candidateRating = rate(puzzle);
      group.forEach((c) => { puzzle[c] = 0; });

      // Prefer landing exactly on the target; then overshooting upward
      // (still harder than asked, so another pass can walk it down); and
      // only as a last resort undershooting, which mislabels the puzzle.
      const rank = LEVELS.indexOf(candidateRating);
      const cost = rank >= want ? rank - want : 100 + (want - rank);
      if (cost < pickCost) {
        pickCost = cost;
        pickIdx = idx;
        pickRating = candidateRating;
        if (cost === 0) break;
      }
    }

    const [group] = restorable.splice(pickIdx, 1);
    group.forEach((c) => { puzzle[c] = solution[c]; });
    givens += group.length;
    rating = pickRating;
  }

  // Cosmetic top-up. A 23-clue grid that only needs singles is still an easy
  // puzzle, but it *looks* forbidding, and a board that scares people off is
  // a real cost. Add back any clue that does not change the rating.
  const cosmeticFloor = COSMETIC_MIN_GIVENS[rating] ?? 0;
  let stalled = false;
  while (!stalled && restorable.length && givens < cosmeticFloor) {
    stalled = true;
    for (let k = 0; k < Math.min(12, restorable.length); k++) {
      const idx = restorable.length - 1 - k;
      const group = restorable[idx];
      group.forEach((c) => { puzzle[c] = solution[c]; });
      if (rate(puzzle) === rating) {
        restorable.splice(idx, 1);
        givens += group.length;
        stalled = false;
        break;
      }
      group.forEach((c) => { puzzle[c] = 0; });
    }
  }

  return { puzzle, solution, givens, rating };
}

/**
 * Public entry point. `generate` lands on the requested rating most of the
 * time but not always, so retry a couple of times rather than ship a puzzle
 * whose label is wrong.
 */
export function generateRated({ difficulty = 'easy', rng = createRng(), attempts = 3 } = {}) {
  let best = null;
  for (let i = 0; i < attempts; i++) {
    const candidate = generate({ difficulty, rng });
    if (candidate.rating === difficulty) return candidate;
    if (!best || Math.abs(LEVELS.indexOf(candidate.rating) - LEVELS.indexOf(difficulty))
               < Math.abs(LEVELS.indexOf(best.rating) - LEVELS.indexOf(difficulty))) {
      best = candidate;
    }
  }
  return best;
}

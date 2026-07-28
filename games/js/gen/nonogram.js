/* Nonogram (Picross) generation.

   Every puzzle is verified solvable by pure line-by-line logic, which also
   proves it has exactly one solution — so the player is never asked to
   guess. */

import { createRng } from '../core/rng.js';

export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;

/** Run lengths of filled cells, e.g. [1,1,0,1] -> [2,1]. */
export function lineClues(cells) {
  const clues = [];
  let run = 0;
  for (const c of cells) {
    if (c === FILLED) run++;
    else if (run) { clues.push(run); run = 0; }
  }
  if (run) clues.push(run);
  return clues.length ? clues : [0];
}

/**
 * Every arrangement of `clues` in a line of `length`, as {filled, empty}
 * bitmasks. Cached: the same (clues, length) pair recurs constantly.
 */
const placementCache = new Map();

function placements(clues, length) {
  const key = `${length}|${clues.join(',')}`;
  const hit = placementCache.get(key);
  if (hit) return hit;

  const out = [];
  const blocks = clues[0] === 0 ? [] : clues;

  (function place(index, start, filledMask) {
    if (index === blocks.length) {
      out.push(filledMask);
      return;
    }
    const remaining = blocks.slice(index + 1).reduce((t, n) => t + n + 1, 0);
    const last = length - remaining - blocks[index];
    for (let s = start; s <= last; s++) {
      let mask = filledMask;
      for (let k = 0; k < blocks[index]; k++) mask |= 1 << (s + k);
      place(index + 1, s + blocks[index] + 1, mask);
    }
  })(0, 0, 0);

  placementCache.set(key, out);
  return out;
}

/**
 * Narrow one line against its clues.
 * @returns {number[]|null} updated states, or null if the line is impossible
 */
export function solveLine(states, clues) {
  const length = states.length;
  const valid = placements(clues, length).filter((mask) => {
    for (let i = 0; i < length; i++) {
      const isFilled = (mask >> i) & 1;
      if (states[i] === FILLED && !isFilled) return false;
      if (states[i] === EMPTY && isFilled) return false;
    }
    return true;
  });

  if (!valid.length) return null;

  const next = states.slice();
  for (let i = 0; i < length; i++) {
    if (states[i] !== UNKNOWN) continue;
    let anyFilled = false;
    let anyEmpty = false;
    for (const mask of valid) {
      if ((mask >> i) & 1) anyFilled = true; else anyEmpty = true;
      if (anyFilled && anyEmpty) break;
    }
    if (anyFilled && !anyEmpty) next[i] = FILLED;
    else if (anyEmpty && !anyFilled) next[i] = EMPTY;
  }
  return next;
}

/**
 * Solve using only line-by-line deduction — exactly what a human does.
 * @returns {{solved:boolean, grid:number[]}}
 */
export function solveLogical(width, height, rowClues, colClues) {
  const grid = new Array(width * height).fill(UNKNOWN);

  let progress = true;
  while (progress) {
    progress = false;

    for (let r = 0; r < height; r++) {
      const line = Array.from({ length: width }, (_, c) => grid[r * width + c]);
      const next = solveLine(line, rowClues[r]);
      if (!next) return { solved: false, grid };
      for (let c = 0; c < width; c++) {
        if (next[c] !== grid[r * width + c]) { grid[r * width + c] = next[c]; progress = true; }
      }
    }

    for (let c = 0; c < width; c++) {
      const line = Array.from({ length: height }, (_, r) => grid[r * width + c]);
      const next = solveLine(line, colClues[c]);
      if (!next) return { solved: false, grid };
      for (let r = 0; r < height; r++) {
        if (next[r] !== grid[r * width + c]) { grid[r * width + c] = next[r]; progress = true; }
      }
    }
  }

  return { solved: grid.every((v) => v !== UNKNOWN), grid };
}

export const PRESETS = {
  easy:   { width: 10, height: 10, fill: 0.58 },
  medium: { width: 15, height: 15, fill: 0.52 },
  hard:   { width: 20, height: 20, fill: 0.48 },
};

/**
 * @returns {{width:number,height:number,rowClues:number[][],colClues:number[][],
 *            solution:number[],difficulty:string}}
 */
export function generate({ difficulty = 'easy', rng = createRng(), attempts = 80 } = {}) {
  const preset = PRESETS[difficulty] || PRESETS.easy;
  const { width, height, fill } = preset;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const solution = Array.from({ length: width * height }, () => (rng.next() < fill ? FILLED : EMPTY));

    // A blank row or column is legal but reads as a mistake in the artwork.
    let degenerate = false;
    for (let r = 0; r < height && !degenerate; r++) {
      degenerate = !solution.slice(r * width, r * width + width).includes(FILLED);
    }
    for (let c = 0; c < width && !degenerate; c++) {
      degenerate = true;
      for (let r = 0; r < height; r++) if (solution[r * width + c] === FILLED) { degenerate = false; break; }
    }
    if (degenerate) continue;

    const rowClues = Array.from({ length: height }, (_, r) =>
      lineClues(solution.slice(r * width, r * width + width)));
    const colClues = Array.from({ length: width }, (_, c) =>
      lineClues(Array.from({ length: height }, (_, r) => solution[r * width + c])));

    // Line-solvable implies both "no guessing needed" and "exactly one
    // solution", so this single check covers fairness and uniqueness.
    const result = solveLogical(width, height, rowClues, colClues);
    if (!result.solved) continue;

    return { width, height, rowClues, colClues, solution, difficulty };
  }

  return null;
}

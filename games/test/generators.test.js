/* Generator invariants.
 *
 * These guard the two defects that shipped in the original code: Kakuro
 * puzzles with more than one solution, and Wordle answers that could never be
 * guessed. Both were invisible without a test like this. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../js/core/rng.js';
import * as sudoku from '../js/gen/sudoku.js';
import * as kakuro from '../js/gen/kakuro.js';
import * as nonogram from '../js/gen/nonogram.js';
import * as minesweeper from '../js/gen/minesweeper.js';
import * as killer from '../js/gen/killer.js';
import * as wordsearch from '../js/gen/wordsearch.js';

const parse = (s) => s.split('').map((c) => (c === '.' ? 0 : Number(c)));

/* --- sudoku --------------------------------------------------------------- */

test('sudoku: rates known puzzles correctly', () => {
  // AI Escargot needs techniques beyond singles and pairs.
  const escargot = parse('1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..');
  assert.equal(sudoku.countSolutions(escargot, 2), 1);
  assert.equal(sudoku.rate(escargot), 'hard');

  // A textbook beginner grid falls to naked and hidden singles alone.
  const easy = parse('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
  assert.equal(sudoku.rate(easy), 'easy');
  assert.ok(sudoku.solveLogical(easy, sudoku.SINGLES_ONLY).solved);
});

test('sudoku: generated puzzles are unique and match their label', () => {
  for (const difficulty of sudoku.LEVELS) {
    for (let i = 0; i < 4; i++) {
      const puzzle = sudoku.generateRated({ difficulty, rng: createRng(`t-${difficulty}-${i}`) });
      assert.ok(puzzle, `${difficulty} produced nothing`);
      assert.equal(sudoku.countSolutions(puzzle.puzzle, 2), 1,
        `${difficulty} puzzle does not have exactly one solution`);
      assert.equal(puzzle.rating, difficulty,
        `${difficulty} puzzle actually rates ${puzzle.rating}`);
      // Clues must agree with the solution they were carved from.
      puzzle.puzzle.forEach((v, k) => {
        if (v !== 0) assert.equal(v, puzzle.solution[k]);
      });
    }
  }
});

test('sudoku: the same seed always gives the same puzzle', () => {
  const a = sudoku.generateRated({ difficulty: 'medium', rng: createRng('daily:2026-07-28') });
  const b = sudoku.generateRated({ difficulty: 'medium', rng: createRng('daily:2026-07-28') });
  assert.deepEqual(a.puzzle, b.puzzle);
});

/* --- kakuro --------------------------------------------------------------- */

test('kakuro: every puzzle has exactly one solution', () => {
  for (const difficulty of Object.keys(kakuro.PRESETS)) {
    for (let i = 0; i < 3; i++) {
      const puzzle = kakuro.generate({ difficulty, rng: createRng(`k-${difficulty}-${i}`) });
      assert.ok(puzzle, `${difficulty} produced nothing`);
      const runs = kakuro.buildRuns(puzzle.size, puzzle.grid);
      assert.equal(
        kakuro.countSolutions(puzzle.size, puzzle.grid, puzzle.clues, runs, 2), 1,
        `${difficulty} puzzle is ambiguous`,
      );
    }
  }
});

test('kakuro: no run is shorter than two cells', () => {
  for (const difficulty of Object.keys(kakuro.PRESETS)) {
    const puzzle = kakuro.generate({ difficulty, rng: createRng(`kr-${difficulty}`) });
    const runs = kakuro.buildRuns(puzzle.size, puzzle.grid);
    for (const run of [...runs.across, ...runs.down]) {
      assert.ok(run.cells.length >= 2, 'a one-cell run gives its answer away');
      assert.ok(run.cells.length <= 9, 'a run longer than nine cannot hold distinct digits');
    }
  }
});

test('kakuro: every white cell belongs to an across and a down run', () => {
  const puzzle = kakuro.generate({ difficulty: 'medium', rng: createRng('kw') });
  const runs = kakuro.buildRuns(puzzle.size, puzzle.grid);
  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    if (puzzle.grid[i] !== kakuro.WHITE) continue;
    assert.notEqual(runs.cellAcross[i], -1, `cell ${i} has no across run`);
    assert.notEqual(runs.cellDown[i], -1, `cell ${i} has no down run`);
  }
});

test('kakuro: the stored solution satisfies its own clues', () => {
  const puzzle = kakuro.generate({ difficulty: 'easy', rng: createRng('ks') });
  const runs = kakuro.buildRuns(puzzle.size, puzzle.grid);
  for (const [list, key] of [[runs.across, 'across'], [runs.down, 'down']]) {
    for (const run of list) {
      const values = run.cells.map((c) => puzzle.solution[c]);
      assert.equal(new Set(values).size, values.length, 'digit repeats inside a run');
      assert.equal(values.reduce((t, v) => t + v, 0), puzzle.clues[run.clueIdx][key]);
    }
  }
});

/* --- nonogram ------------------------------------------------------------- */

test('nonogram: clue reading', () => {
  const { FILLED: F, EMPTY: E } = nonogram;
  assert.deepEqual(nonogram.lineClues([F, F, E, F]), [2, 1]);
  assert.deepEqual(nonogram.lineClues([E, E, E]), [0]);
  assert.deepEqual(nonogram.lineClues([F, F, F]), [3]);
});

test('nonogram: puzzles are solvable by line logic alone', () => {
  for (const difficulty of Object.keys(nonogram.PRESETS)) {
    const puzzle = nonogram.generate({ difficulty, rng: createRng(`n-${difficulty}`) });
    assert.ok(puzzle, `${difficulty} produced nothing`);
    const solved = nonogram.solveLogical(
      puzzle.width, puzzle.height, puzzle.rowClues, puzzle.colClues,
    );
    assert.ok(solved.solved, `${difficulty} needs guessing`);
    assert.deepEqual(solved.grid, puzzle.solution, 'line solver found a different picture');
  }
});

/* --- minesweeper ---------------------------------------------------------- */

test('minesweeper: first click is safe and boards need no guessing', () => {
  for (const difficulty of Object.keys(minesweeper.PRESETS)) {
    const preset = minesweeper.PRESETS[difficulty];
    const safe = Math.floor((preset.width * preset.height) / 2) + 3;
    const board = minesweeper.generate({ difficulty, rng: createRng(`m-${difficulty}`), safeIndex: safe });

    assert.equal(board.mines.filter(Boolean).length, preset.mines, 'wrong mine count');
    assert.equal(board.mines[safe], false, 'mine under the opening click');
    for (const n of minesweeper.neighbours(preset.width, preset.height, safe)) {
      assert.equal(board.mines[n], false, 'opening click would not open a region');
    }
    assert.ok(board.noGuess, `${difficulty} board requires a guess`);
    assert.ok(minesweeper.isSolvable(preset.width, preset.height, board.mines, safe));
  }
});

/* --- killer --------------------------------------------------------------- */

test('killer: cages tile the grid, sum correctly, and the puzzle is unique', () => {
  for (const difficulty of Object.keys(killer.PRESETS)) {
    const puzzle = killer.generate({ difficulty, rng: createRng(`ks-${difficulty}`) });
    assert.ok(puzzle, `${difficulty} produced nothing`);

    const covered = new Set(puzzle.cages.flatMap((c) => c.cells));
    assert.equal(covered.size, 81, 'cages do not cover every cell exactly once');

    for (const cage of puzzle.cages) {
      const values = cage.cells.map((c) => puzzle.solution[c]);
      assert.equal(new Set(values).size, values.length, 'digit repeats inside a cage');
      assert.equal(values.reduce((t, v) => t + v, 0), cage.sum, 'cage sum is wrong');
    }

    assert.equal(
      killer.countSolutions(puzzle.cages, puzzle.cageOf, puzzle.givens, 2), 1,
      `${difficulty} killer puzzle is ambiguous`,
    );
  }
});

/* --- word search ---------------------------------------------------------- */

test('wordsearch: placed words really read off the grid', () => {
  const words = ['plane', 'cloud', 'runway', 'window', 'flight', 'engine', 'cabin', 'pilot',
    'tray', 'seat', 'aisle', 'wing', 'landing', 'takeoff'];
  for (const difficulty of Object.keys(wordsearch.PRESETS)) {
    const grid = wordsearch.generate({ difficulty, rng: createRng(`w-${difficulty}`), words });
    assert.ok(grid.placed.length > 0, 'nothing was placed');
    for (const entry of grid.placed) {
      assert.equal(entry.cells.map((c) => grid.grid[c]).join(''), entry.word);
    }
    assert.ok(grid.grid.every((ch) => ch.length === 1), 'a cell is empty');
  }
});

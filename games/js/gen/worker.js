/* Generator worker. Puzzle generation is a hundred milliseconds on a laptop
   and can be a second or two on a cheap phone; running it here keeps taps,
   scrolling and the spinner responsive while it happens. */

import { createRng } from '../core/rng.js';
import * as sudoku from './sudoku.js';
import * as kakuro from './kakuro.js';
import * as nonogram from './nonogram.js';
import * as minesweeper from './minesweeper.js';
import * as wordsearch from './wordsearch.js';
import * as killer from './killer.js';

const GENERATORS = {
  sudoku: (o, rng) => sudoku.generateRated({ ...o, rng }),
  kakuro: (o, rng) => kakuro.generate({ ...o, rng }),
  nonogram: (o, rng) => nonogram.generate({ ...o, rng }),
  minesweeper: (o, rng) => minesweeper.generate({ ...o, rng }),
  wordsearch: (o, rng) => wordsearch.generate({ ...o, rng }),
  killer: (o, rng) => killer.generate({ ...o, rng }),
};

self.addEventListener('message', (event) => {
  const { id, kind, opts = {} } = event.data || {};
  const make = GENERATORS[kind];
  if (!make) {
    self.postMessage({ id, error: `Unknown generator: ${kind}` });
    return;
  }
  try {
    const { seed = null, ...rest } = opts;
    self.postMessage({ id, result: make(rest, createRng(seed)) });
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
});

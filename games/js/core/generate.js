/* Client side of the generator worker, with an in-thread fallback. */

let worker = null;
let nextId = 1;
const pending = new Map();
let workerBroken = false;

function ensureWorker() {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL('../gen/worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error));
      else entry.resolve(data.result);
    });
    worker.addEventListener('error', () => {
      // Module workers are unavailable or blocked; fall back permanently.
      workerBroken = true;
      worker = null;
      pending.forEach((entry) => entry.reject(new Error('worker-failed')));
      pending.clear();
    });
  } catch {
    workerBroken = true;
  }
  return worker;
}

/** Generate off the main thread; falls back to generating in-thread. */
export async function generate(kind, opts = {}) {
  const w = ensureWorker();
  if (w) {
    try {
      return await new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, kind, opts });
      });
    } catch {
      // fall through to the synchronous path
    }
  }
  return generateInline(kind, opts);
}

async function generateInline(kind, opts) {
  const { createRng } = await import('./rng.js');
  const { seed = null, ...rest } = opts;
  const rng = createRng(seed);
  switch (kind) {
    case 'sudoku': return (await import('../gen/sudoku.js')).generateRated({ ...rest, rng });
    case 'kakuro': return (await import('../gen/kakuro.js')).generate({ ...rest, rng });
    case 'nonogram': return (await import('../gen/nonogram.js')).generate({ ...rest, rng });
    case 'minesweeper': return (await import('../gen/minesweeper.js')).generate({ ...rest, rng });
    case 'wordsearch': return (await import('../gen/wordsearch.js')).generate({ ...rest, rng });
    case 'killer': return (await import('../gen/killer.js')).generate({ ...rest, rng });
    default: throw new Error(`Unknown generator: ${kind}`);
  }
}

/** Warm the worker so the first puzzle does not pay module-loading cost. */
export function prewarm() { ensureWorker(); }

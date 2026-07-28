/* Seeded RNG, date handling and streak bookkeeping. */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createRng, dateKey, dailySeed, isNextDay, hashSeed, mulberry32 } from '../js/core/rng.js';

/* stats.js writes through store.js, which needs a localStorage. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}
globalThis.localStorage = new MemoryStorage();

const stats = await import('../js/core/stats.js');

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

/* --- rng ------------------------------------------------------------------ */

test('rng: a seed reproduces the same stream', () => {
  const a = createRng('seed-1');
  const b = createRng('seed-1');
  const first = Array.from({ length: 20 }, () => a.next());
  const second = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(first, second);
});

test('rng: different seeds diverge', () => {
  const a = Array.from({ length: 10 }, createRng('seed-1').next);
  const b = Array.from({ length: 10 }, createRng('seed-2').next);
  assert.notDeepEqual(a, b);
});

test('rng: values stay in range and shuffle preserves membership', () => {
  const rng = createRng(42);
  for (let i = 0; i < 500; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `${v} out of range`);
    const n = rng.int(3, 7);
    assert.ok(n >= 3 && n <= 7, `${n} out of range`);
  }
  const source = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = rng.shuffle(source);
  assert.deepEqual([...shuffled].sort((x, y) => x - y), source);
  assert.deepEqual(source, [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle mutated its input');
});

test('rng: mulberry32 is stable for a fixed seed', () => {
  assert.equal(mulberry32(hashSeed('x')()) === mulberry32(hashSeed('x')()), false,
    'each call returns a fresh generator');
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  assert.equal(a(), b());
});

/* --- dates ---------------------------------------------------------------- */

test('dateKey formats the local calendar day', () => {
  assert.equal(dateKey(new Date(2026, 6, 28)), '2026-07-28');
  assert.equal(dateKey(new Date(2026, 0, 1)), '2026-01-01');
});

test('dailySeed is stable per game and day', () => {
  assert.equal(dailySeed('sudoku', '2026-07-28'), 'sudoku:2026-07-28');
  assert.notEqual(dailySeed('sudoku', '2026-07-28'), dailySeed('sudoku', '2026-07-29'));
});

test('isNextDay handles month and year boundaries', () => {
  assert.ok(isNextDay('2026-07-28', '2026-07-29'));
  assert.ok(isNextDay('2026-07-31', '2026-08-01'));
  assert.ok(isNextDay('2026-12-31', '2027-01-01'));
  assert.ok(!isNextDay('2026-07-28', '2026-07-30'));
  assert.ok(!isNextDay('2026-07-28', '2026-07-28'));
  assert.ok(!isNextDay(null, '2026-07-28'));
});

/* --- stats ---------------------------------------------------------------- */

test('stats: a win on consecutive days extends the streak', () => {
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  stats.record('g', { won: true, daily: true, date: '2026-07-02' });
  stats.record('g', { won: true, daily: true, date: '2026-07-03' });
  assert.equal(stats.liveStreak('g', '2026-07-03'), 3);
  assert.equal(stats.load('g').daily.best, 3);
});

test('stats: a skipped day restarts the streak', () => {
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  stats.record('g', { won: true, daily: true, date: '2026-07-03' });
  assert.equal(stats.liveStreak('g', '2026-07-03'), 1);
  assert.equal(stats.load('g').daily.best, 1);
});

test('stats: a loss breaks the streak but keeps the best', () => {
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  stats.record('g', { won: true, daily: true, date: '2026-07-02' });
  stats.record('g', { won: false, daily: true, date: '2026-07-03' });
  assert.equal(stats.liveStreak('g', '2026-07-03'), 0);
  assert.equal(stats.load('g').daily.best, 2);
});

test('stats: a stale streak reads as zero', () => {
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  // Two days later without playing: the stored number is 1, but it has lapsed.
  assert.equal(stats.load('g').daily.streak, 1);
  assert.equal(stats.liveStreak('g', '2026-07-04'), 0);
});

test('stats: playing the same day twice does not double-count the streak', () => {
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  stats.record('g', { won: true, daily: true, date: '2026-07-01' });
  assert.equal(stats.liveStreak('g', '2026-07-01'), 1);
  assert.ok(stats.dailyDone('g', '2026-07-01'));
});

test('stats: buckets track wins, best time and distribution separately', () => {
  stats.record('g', { won: true, bucket: 'easy', timeSec: 100, distKey: 3 });
  stats.record('g', { won: true, bucket: 'easy', timeSec: 60, distKey: 4 });
  stats.record('g', { won: false, bucket: 'easy' });
  stats.record('g', { won: true, bucket: 'hard', timeSec: 500 });

  const easy = stats.summary('g', 'easy');
  assert.equal(easy.played, 3);
  assert.equal(easy.won, 2);
  assert.equal(easy.bestTime, 60);
  assert.equal(easy.winRate, 67);
  assert.equal(easy.avgTime, 80);
  assert.deepEqual(easy.dist, { 3: 1, 4: 1 });

  assert.equal(stats.summary('g', 'hard').bestTime, 500);
  assert.equal(stats.summary('g', 'never-played').played, 0);
});

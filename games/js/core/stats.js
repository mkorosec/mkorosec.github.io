/* Per-game statistics and daily streaks, stored locally.

   Shape, per game:
   {
     v: 1,
     buckets: {                     // one per difficulty/variant
       "<bucket>": {
         played, won, bestTime, totalTime,
         dist: { "<n>": count }     // guesses/mistakes histogram, optional
       }
     },
     daily: { streak, best, lastDate, lastWon }
   }
*/

import { read, write } from './store.js';
import { dateKey, isNextDay } from './rng.js';

const VERSION = 1;

const emptyBucket = () => ({ played: 0, won: 0, bestTime: null, totalTime: 0, dist: {} });
const emptyStats = () => ({ v: VERSION, buckets: {}, daily: { streak: 0, best: 0, lastDate: null, lastWon: false } });

export function load(game) {
  const raw = read(`stats:${game}`, null);
  if (!raw || raw.v !== VERSION) return emptyStats();
  return { ...emptyStats(), ...raw, daily: { ...emptyStats().daily, ...(raw.daily || {}) } };
}

export function bucket(game, name = 'default') {
  return { ...emptyBucket(), ...(load(game).buckets?.[name] || {}) };
}

/**
 * Record one finished game.
 *
 * @param {string} game
 * @param {object} result
 * @param {boolean} result.won
 * @param {string} [result.bucket='default']  difficulty or variant key
 * @param {number} [result.timeSec]
 * @param {number|string} [result.distKey]    histogram bin (e.g. guess count)
 * @param {boolean} [result.daily=false]      counts toward the streak
 * @param {string} [result.date]              date key, defaults to today
 * @returns {{streak:number, best:number, isRecord:boolean}}
 */
export function record(game, result) {
  const {
    won, bucket: bucketName = 'default', timeSec = null,
    distKey = null, daily = false, date = dateKey(),
  } = result;

  const stats = load(game);
  const b = { ...emptyBucket(), ...(stats.buckets[bucketName] || {}) };

  b.played += 1;
  if (won) {
    b.won += 1;
    if (typeof timeSec === 'number') {
      b.totalTime += timeSec;
      if (b.bestTime === null || timeSec < b.bestTime) b.bestTime = timeSec;
    }
    if (distKey !== null) b.dist[distKey] = (b.dist[distKey] || 0) + 1;
  }
  stats.buckets[bucketName] = b;

  let isRecord = false;
  if (won && typeof timeSec === 'number' && b.bestTime === timeSec) {
    // Only a record if there was a previous completion to beat.
    isRecord = b.won > 1;
  }

  if (daily) {
    const d = stats.daily;
    if (d.lastDate !== date) {
      if (won) d.streak = isNextDay(d.lastDate, date) && d.lastWon ? d.streak + 1 : 1;
      else d.streak = 0;
      d.lastDate = date;
      d.lastWon = won;
      if (d.streak > d.best) d.best = d.streak;
    }
  }

  write(`stats:${game}`, stats);
  return { streak: stats.daily.streak, best: stats.daily.best, isRecord };
}

/** Has today's daily already been finished? */
export function dailyDone(game, date = dateKey()) {
  return load(game).daily.lastDate === date;
}

/**
 * A streak is "live" if it was extended today or yesterday; otherwise it has
 * lapsed and should be shown as 0 even though the stored number is stale.
 */
export function liveStreak(game, date = dateKey()) {
  const d = load(game).daily;
  if (!d.lastDate || !d.lastWon) return 0;
  if (d.lastDate === date || isNextDay(d.lastDate, date)) return d.streak;
  return 0;
}

export function summary(game, bucketName = 'default') {
  const b = bucket(game, bucketName);
  return {
    ...b,
    winRate: b.played ? Math.round((b.won / b.played) * 100) : 0,
    avgTime: b.won ? Math.round(b.totalTime / b.won) : null,
  };
}

export function reset(game) {
  write(`stats:${game}`, emptyStats());
}

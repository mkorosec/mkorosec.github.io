/* Seedable RNG.

   Daily puzzles need every device to generate byte-identical puzzles from a
   date alone, with no server involved. Math.random cannot do that, so all
   generators take an rng argument and default to an unseeded one. */

/** String -> 32-bit seed (xmur3). */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32-bit seed -> float in [0,1) (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string|number|null} seed  null/undefined => nondeterministic
 * @returns {{next:()=>number, int:(min:number,max:number)=>number,
 *            pick:<T>(a:T[])=>T, shuffle:<T>(a:T[])=>T[]}}
 */
export function createRng(seed) {
  let next;
  if (seed === null || seed === undefined) {
    next = Math.random;
  } else {
    const n = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed))();
    next = mulberry32(n);
  }

  const int = (min, max) => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/** Local-calendar date key, e.g. "2026-07-28". Local, not UTC: the daily
    should roll over at the player's midnight, not Greenwich's. */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Stable seed string for one game's puzzle on one day. */
export function dailySeed(game, key = dateKey()) {
  return `${game}:${key}`;
}

/** Whether `b` is the calendar day immediately after `a` (both date keys). */
export function isNextDay(a, b) {
  if (!a || !b) return false;
  const pa = new Date(a + 'T00:00:00');
  const pb = new Date(b + 'T00:00:00');
  return Math.round((pb - pa) / 86400000) === 1;
}

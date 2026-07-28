/* Guess scoring, kept free of any DOM so it can be unit tested.

   Both rules below are the ones people get wrong when a guess repeats a
   letter or colour: a duplicate may only be marked "present" as many times as
   it actually occurs in the answer, and exact matches are claimed first. */

/**
 * Wordle-style per-letter result.
 * @param {string} guess
 * @param {string} target  same length as guess
 * @returns {Array<'correct'|'present'|'absent'>}
 */
export function scoreWord(guess, target) {
  const result = new Array(guess.length).fill('absent');
  const remaining = {};

  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) result[i] = 'correct';
    else remaining[target[i]] = (remaining[target[i]] || 0) + 1;
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    if (remaining[guess[i]] > 0) {
      result[i] = 'present';
      remaining[guess[i]] -= 1;
    }
  }

  return result;
}

/**
 * Mastermind peg counts.
 * @returns {{exact:number, near:number}} exact = right colour, right place;
 *          near = right colour, wrong place
 */
export function scoreCode(guess, secret) {
  let exact = 0;
  const secretRest = {};
  const guessRest = {};

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) { exact += 1; continue; }
    secretRest[secret[i]] = (secretRest[secret[i]] || 0) + 1;
    guessRest[guess[i]] = (guessRest[guess[i]] || 0) + 1;
  }

  let near = 0;
  for (const key of Object.keys(guessRest)) {
    near += Math.min(guessRest[key], secretRest[key] || 0);
  }

  return { exact, near };
}

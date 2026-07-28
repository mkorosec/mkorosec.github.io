/* Guess scoring. The repeated-letter cases are the ones clones get wrong. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreWord, scoreCode } from '../js/core/scoring.js';

test('wordle: plain hit, miss and misplacement', () => {
  assert.deepEqual(scoreWord('crane', 'crane'),
    ['correct', 'correct', 'correct', 'correct', 'correct']);
  assert.deepEqual(scoreWord('zzzzz', 'crane'),
    ['absent', 'absent', 'absent', 'absent', 'absent']);
  // r, a and n all land in place; only the leading e is displaced.
  assert.deepEqual(scoreWord('erank', 'crane'),
    ['present', 'correct', 'correct', 'correct', 'absent']);
});

test('wordle: a repeated letter is only credited as often as it occurs', () => {
  // "speed" has one e in the wrong place and one exact; the guess's third e
  // must come back absent rather than present.
  assert.deepEqual(scoreWord('eeeee', 'crane'),
    ['absent', 'absent', 'absent', 'absent', 'correct']);

  // Two guessed l's but only one in the answer: the first takes it, the
  // second must come back absent rather than both showing as present.
  assert.deepEqual(scoreWord('llama', 'kilos'),
    ['present', 'absent', 'absent', 'absent', 'absent']);

  // Both e's here are already exact, so the guess's leading e has nothing
  // left to claim.
  assert.deepEqual(scoreWord('geese', 'these'),
    ['absent', 'absent', 'correct', 'correct', 'correct']);
});

test('wordle: exact matches are claimed before misplacements', () => {
  const result = scoreWord('abbey', 'babes');
  assert.equal(result.filter((r) => r === 'correct').length, 2);
  assert.equal(result[4], 'absent');
});

test('mastermind: exact and near counts', () => {
  assert.deepEqual(scoreCode([0, 1, 2, 3], [0, 1, 2, 3]), { exact: 4, near: 0 });
  assert.deepEqual(scoreCode([3, 2, 1, 0], [0, 1, 2, 3]), { exact: 0, near: 4 });
  assert.deepEqual(scoreCode([0, 0, 0, 0], [0, 1, 2, 3]), { exact: 1, near: 0 });
  assert.deepEqual(scoreCode([0, 1, 0, 1], [1, 0, 2, 3]), { exact: 0, near: 2 });
  assert.deepEqual(scoreCode([4, 4, 4, 4], [0, 1, 2, 3]), { exact: 0, near: 0 });
});

test('mastermind: exact plus near never exceeds the code length', () => {
  const codes = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) codes.push([a, b, a, b]);
  for (const guess of codes) {
    for (const secret of codes) {
      const { exact, near } = scoreCode(guess, secret);
      assert.ok(exact + near <= 4, `${guess} vs ${secret} scored ${exact}+${near}`);
    }
  }
});

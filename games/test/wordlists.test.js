/* Word-list schema.
 *
 * 22% of the Slovenian answers used to be unwinnable: 18 were not five
 * letters, and 24 more contained carons the keyboard could not type. Both
 * classes are checked here so they cannot come back. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { LANGUAGES, LANGUAGE_CODES, alphabet } from '../js/core/words.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (name) => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));

for (const lang of LANGUAGE_CODES) {
  const answers = load(`words-${lang}.json`);
  const guesses = load(`guesses-${lang}.json`);

  test(`${lang}: every word is exactly five letters`, () => {
    for (const list of [['answers', answers], ['guesses', guesses]]) {
      const bad = list[1].filter((w) => [...w].length !== 5);
      assert.deepEqual(bad, [], `${list[0]} contains non-five-letter entries`);
    }
  });

  test(`${lang}: every letter can be typed on this language's keyboard`, () => {
    const typeable = alphabet(lang);
    for (const [name, list] of [['answers', answers], ['guesses', guesses]]) {
      for (const word of list) {
        for (const ch of word) {
          assert.ok(typeable.has(ch),
            `${name} word "${word}" uses "${ch}", which is not on the ${lang} keyboard`);
        }
      }
    }
  });

  test(`${lang}: every answer is an accepted guess`, () => {
    const accepted = new Set(guesses);
    const missing = answers.filter((w) => !accepted.has(w));
    assert.deepEqual(missing, [], 'answers missing from the guess list');
  });

  test(`${lang}: no duplicates and a usable pool size`, () => {
    assert.equal(new Set(answers).size, answers.length, 'duplicate answers');
    assert.ok(answers.length >= 100, `only ${answers.length} answers`);
  });
}

test('the Slovenian keyboard covers the whole alphabet, carons included', () => {
  const keys = alphabet('sl');
  for (const ch of 'čšž') assert.ok(keys.has(ch), `missing ${ch}`);
  // Letters that are not part of Slovenian should not be offered.
  for (const ch of 'qwxy') assert.ok(!keys.has(ch), `${ch} is not a Slovenian letter`);
  assert.equal(LANGUAGES.sl.rows.flat().length, new Set(LANGUAGES.sl.rows.flat()).size,
    'a key is duplicated across rows');
});

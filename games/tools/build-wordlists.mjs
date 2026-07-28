/* Clean and validate the Wordle word lists.
 *
 * Two defects are fixed here:
 *   - 18 of 172 Slovenian answers were not five letters ("delo", "njegov"),
 *     so the target could never be guessed;
 *   - many entries were truncated stems rather than words ("kakšn", "prišl",
 *     "zemlj", "življ"), which are unguessable for a different reason.
 *
 * Words with c/s/z carons stay in — a Slovenian word game without them would
 * be a poor one. The keyboard now carries those keys instead.
 *
 * Run: node tools/build-wordlists.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ALPHABET = {
  en: /^[a-z]{5}$/,
  sl: /^[a-zčšžćđ]{5}$/,
};

/* Truncated stems and transliteration slips found in the original list. */
const SL_REJECT = new Set([
  'kakšn', 'počut', 'prišl', 'začet', 'zadnj', 'zemlj', 'zivlj', 'življ',
  'dvign', 'majhn', 'manjk', 'nasme', 'ponov', 'stopn', 'vashi', 'imetj',
  'jabol', 'pilom', 'knjig', 'kater', 'rešit', 'podat', 'nared', 'bodem',
  'sanja', 'lepih', 'novih', 'vsake', 'tolik', 'nekom', 'prvim', 'vajin',
  'drevu', 'bregu', 'koncu', 'plesa', 'sliša', 'smejo', 'znajo', 'imelo',
]);

/* Common five-letter Slovenian words, in base forms, to replace what was cut. */
const SL_ADD = [
  'banka', 'bitka', 'blago', 'bolan', 'brada', 'drevo', 'grozd', 'hrana',
  'jesen', 'jezik', 'junak', 'kamen', 'kazen', 'konec', 'korak', 'kotel',
  'kralj', 'kuhar', 'lonec', 'lučka', 'mesec', 'metla', 'mleko', 'mnogo',
  'mokro', 'nekaj', 'nizek', 'noben', 'oblak', 'pekel', 'pesem', 'pismo',
  'potok', 'prsti', 'rokav', 'rumen', 'sadje', 'sanje', 'skala', 'slama',
  'sonce', 'stara', 'stari', 'steza', 'stric', 'sveča', 'svoje', 'tanek',
  'teden', 'topel', 'trije', 'ulica', 'veter', 'vrtec', 'zajec', 'zdrav',
  'zlato', 'želja', 'žarek', 'širok',
];

const clean = (words, lang, reject = new Set()) => [
  ...new Set(
    words
      .map((w) => String(w).toLowerCase().trim())
      .filter((w) => ALPHABET[lang].test(w))
      .filter((w) => !reject.has(w)),
  ),
].sort();

function load(name) {
  return JSON.parse(readFileSync(join(ROOT, name), 'utf8'));
}

function save(name, words) {
  writeFileSync(join(ROOT, name), `${JSON.stringify(words)}\n`);
  return words.length;
}

function report(name, before, after) {
  console.log(`${name.padEnd(18)} ${String(before).padStart(5)} -> ${String(after).padStart(5)}  (${before - after} removed)`);
}

const answersEn = load('words-en.json');
const answersSl = load('words-sl.json');
const guessesEn = load('guesses-en.json');
const guessesSl = load('guesses-sl.json');

const outAnswersEn = clean(answersEn, 'en');
const outAnswersSl = clean([...answersSl, ...SL_ADD], 'sl', SL_REJECT);

// Every answer must also be an accepted guess.
const outGuessesEn = clean([...guessesEn, ...outAnswersEn], 'en');
const outGuessesSl = clean([...guessesSl, ...outAnswersSl], 'sl', SL_REJECT);

report('words-en.json', answersEn.length, save('words-en.json', outAnswersEn));
report('words-sl.json', answersSl.length, save('words-sl.json', outAnswersSl));
report('guesses-en.json', guessesEn.length, save('guesses-en.json', outGuessesEn));
report('guesses-sl.json', guessesSl.length, save('guesses-sl.json', outGuessesSl));

for (const [lang, answers, guesses] of [
  ['en', outAnswersEn, outGuessesEn],
  ['sl', outAnswersSl, outGuessesSl],
]) {
  const missing = answers.filter((w) => !guesses.includes(w));
  if (missing.length) throw new Error(`${lang}: answers missing from guess list: ${missing.join(', ')}`);
  if (!answers.length) throw new Error(`${lang}: no answers left`);
}

console.log('\nAll answers are five letters, in-alphabet, and present in the guess list.');

/* Word lists for Wordle, Word Search and Hangman.

   Fetched once and mirrored into localStorage. The service worker already
   serves them from cache offline; the mirror is a second net for the case
   where a game page is opened before the worker has finished installing. */

import { read, write } from './store.js';

export const LANGUAGES = {
  en: {
    label: 'English',
    /* Letters the on-screen keyboard offers, and the only ones accepted from
       a physical keyboard. */
    rows: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    ],
  },
  sl: {
    label: 'Slovenščina',
    /* The Slovenian alphabet has no q, w, x or y, but it does have c, s and z
       with carons. The old keyboard was a hard-coded English one, which made
       every answer containing them impossible to type. */
    rows: [
      ['e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'š'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'č', 'ž'],
      ['c', 'v', 'b', 'n', 'm'],
    ],
  },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES);

/** Flat set of typeable letters for a language. */
export function alphabet(lang) {
  return new Set((LANGUAGES[lang] || LANGUAGES.en).rows.flat());
}

export function isLetter(lang, char) {
  return alphabet(lang).has(String(char).toLowerCase());
}

async function fetchList(file, cacheKey) {
  try {
    const response = await fetch(file);
    if (response.ok) {
      const words = await response.json();
      if (Array.isArray(words) && words.length) {
        write(cacheKey, words);
        return words;
      }
    }
  } catch { /* offline before the worker installed */ }

  return read(cacheKey, []);
}

const memo = new Map();

/**
 * @param {'en'|'sl'} lang
 * @param {'answers'|'guesses'} kind
 * @returns {Promise<string[]>}
 */
export function load(lang, kind = 'answers') {
  const file = `${kind === 'answers' ? 'words' : 'guesses'}-${lang}.json`;
  const key = `words:${kind}:${lang}`;
  if (!memo.has(key)) memo.set(key, fetchList(file, key));
  return memo.get(key);
}

/** Answers plus the wider accepted-guess list, as a Set. */
export async function guessSet(lang) {
  const [answers, guesses] = await Promise.all([load(lang, 'answers'), load(lang, 'guesses')]);
  return new Set([...answers, ...guesses]);
}

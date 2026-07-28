/* Result sharing. Works fully offline: the native share sheet and the
   clipboard are both local, no network involved. */

import { toast } from './ui.js';

const SITE = 'mkorosec.github.io/games';

/** Clipboard with a synchronous fallback for browsers that block the async API. */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a result. Prefers the native sheet on mobile, falls back to clipboard.
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareResult(text) {
  const payload = `${text}\n${SITE}`;

  if (navigator.share) {
    try {
      await navigator.share({ text: payload });
      return 'shared';
    } catch (err) {
      // User dismissed the sheet: not an error, and not something to
      // silently turn into a clipboard write.
      if (err?.name === 'AbortError') return 'shared';
    }
  }

  if (await copy(payload)) {
    toast('Result copied to clipboard', 2000);
    return 'copied';
  }
  toast('Could not share result', 2000);
  return 'failed';
}

/**
 * Build the emoji grid used by guessing games.
 * @param {string[][]} rows  per-row cell states: 'correct' | 'present' | 'absent'
 * @param {boolean} colorblind  use the orange/blue palette
 */
export function emojiGrid(rows, colorblind = false) {
  const glyph = colorblind
    ? { correct: '🟧', present: '🟦', absent: '⬛' }
    : { correct: '🟩', present: '🟨', absent: '⬛' };
  return rows.map((r) => r.map((s) => glyph[s] || '⬛').join('')).join('\n');
}

/** Header line, e.g. "Wordle EN · Daily 2026-07-28 · 4/6". */
export function shareHeader(parts) {
  return parts.filter(Boolean).join(' · ');
}

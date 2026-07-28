/* Saved games.

   Two records per game: the full state (only the game reads it) and a small
   summary the hub reads to build its "Continue" row without having to
   understand any game's internals. */

import { read, write, remove, keys } from './store.js';

export function save(game, state, summary = {}) {
  write(`save:${game}`, state);
  write(`progress:${game}`, {
    game,
    label: summary.label || '',
    detail: summary.detail || '',
    href: summary.href || `${game}.html`,
    at: Date.now(),
  });
}

export function load(game, fallback = null) {
  return read(`save:${game}`, fallback);
}

export function clear(game) {
  remove(`save:${game}`);
  remove(`progress:${game}`);
}

/** Most recently touched first. */
export function listInProgress() {
  return keys()
    .filter((k) => k.startsWith('progress:'))
    .map((k) => read(k, null))
    .filter(Boolean)
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

/** Human-friendly "2 hours ago". */
export function ago(timestamp) {
  const mins = Math.round((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

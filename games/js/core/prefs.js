/* Cross-game preferences. Theme is applied by boot.js before first paint;
   this module owns reads/writes and notifies listeners. */

import { read, write } from './store.js';

const KEY = 'prefs';

const DEFAULTS = {
  theme: 'auto',       // 'auto' | 'light' | 'dark'
  haptics: true,
  colorblind: false,   // shape/letter cues in addition to colour
};

let cache = null;
const listeners = new Set();

export function all() {
  if (!cache) cache = { ...DEFAULTS, ...read(KEY, {}) };
  return cache;
}

export function get(name) {
  return all()[name];
}

export function set(name, value) {
  const next = { ...all(), [name]: value };
  cache = next;
  write(KEY, next);
  if (name === 'theme') applyTheme(next.theme);
  if (name === 'colorblind') applyColorblind(next.colorblind);
  listeners.forEach((fn) => fn(name, value));
  return value;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyTheme(theme = get('theme')) {
  const el = document.documentElement;
  if (theme === 'auto') delete el.dataset.theme;
  else el.dataset.theme = theme;
}

export function applyColorblind(on = get('colorblind')) {
  document.documentElement.classList.toggle('cb', !!on);
}

/** auto -> light -> dark -> auto */
export function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(get('theme')) + 1) % order.length];
  set('theme', next);
  return next;
}

export function resolvedTheme() {
  const t = get('theme');
  if (t !== 'auto') return t;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

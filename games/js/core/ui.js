/* Shared chrome: icons, app bar, dialogs, toasts, haptics, celebration.
   Everything a game needs that is not its board. */

import * as prefs from './prefs.js';

/* --- icons ---------------------------------------------------------------- */

const PATHS = {
  back:      '<path d="M15 18l-6-6 6-6"/>',
  close:     '<path d="M18 6 6 18M6 6l12 12"/>',
  erase:     '<path d="M18 6 6 18M6 6l12 12"/>',
  undo:      '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-5.6L3 10"/>',
  hint:      '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  pencil:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  refresh:   '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  stats:     '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  theme:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  share:     '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v14"/>',
  flag:      '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  help:      '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.2-1.6 2.4"/><path d="M12 17h.01"/>',
  play:      '<path d="M6 3l14 9-14 9z"/>',
};

/** @returns {string} inline SVG markup for `name` */
export function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;
}

/* --- element helper ------------------------------------------------------- */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c) node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

/* --- app bar -------------------------------------------------------------- */

/**
 * Standard header. The back link is the only escape route in an installed
 * PWA, so it is not optional.
 *
 * @param {{title:string, back?:string, actions?:Array<{
 *   name:string, icon:string, label:string, onClick:Function, pressed?:boolean
 * }>}} opts
 */
export function appBar({ title, back = 'index.html', actions = [] }) {
  const left = back
    ? el('a', { class: 'icon-btn', href: back, 'aria-label': 'Back to all games', html: iconSvg('back') })
    : el('span', { style: 'width:var(--tap)' });

  const actionEls = actions.map((a) => {
    const btn = el('button', {
      type: 'button',
      class: 'icon-btn',
      'aria-label': a.label,
      title: a.label,
      html: iconSvg(a.icon),
      onclick: a.onClick,
    });
    if (a.pressed !== undefined) btn.setAttribute('aria-pressed', String(!!a.pressed));
    if (a.name) btn.dataset.action = a.name;
    return btn;
  });

  actionEls.push(themeButton());

  return el('header', { class: 'app-bar' }, [
    left,
    el('h1', { class: 'app-bar__title', text: title }),
    el('div', { class: 'app-bar__actions' }, actionEls),
  ]);
}

function themeButton() {
  const btn = el('button', {
    type: 'button',
    class: 'icon-btn',
    'data-action': 'theme',
  });
  const sync = () => {
    const mode = prefs.get('theme');
    btn.innerHTML = iconSvg(prefs.resolvedTheme() === 'light' ? 'moon' : 'theme');
    const label = `Theme: ${mode}. Tap to change.`;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  btn.addEventListener('click', () => {
    const next = prefs.cycleTheme();
    sync();
    toast(`Theme: ${next}`, 1200);
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', sync);
  sync();
  return btn;
}

/* --- toast ---------------------------------------------------------------- */

let toastEl = null;
let toastTimer = 0;

export function toast(message, duration = 1600) {
  if (!toastEl) {
    toastEl = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), duration);
}

/* --- dialog --------------------------------------------------------------- */

/**
 * Modal with focus trap, Escape-to-close and backdrop dismissal.
 * Returns a handle so callers can re-open the same dialog cheaply.
 */
export function createDialog({ wide = false, solid = false, dismissible = true } = {}) {
  const body = el('div', { class: `dialog${wide ? ' dialog--wide' : ''}` });
  const overlay = el('div', {
    class: `overlay${solid ? ' overlay--solid' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
  }, [body]);
  document.body.append(overlay);

  let lastFocused = null;

  function focusables() {
    return [...body.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter((n) => !n.disabled && n.offsetParent !== null);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && dismissible) { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  overlay.addEventListener('click', (e) => {
    if (dismissible && e.target === overlay) close();
  });

  function open() {
    lastFocused = document.activeElement;
    overlay.classList.add('is-open');
    document.addEventListener('keydown', onKeydown, true);
    requestAnimationFrame(() => (focusables()[0] || body).focus?.());
  }

  function close() {
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown, true);
    lastFocused?.focus?.();
  }

  return {
    overlay,
    body,
    open,
    close,
    isOpen: () => overlay.classList.contains('is-open'),
    setContent(...nodes) { body.replaceChildren(...nodes); },
  };
}

/**
 * Convenience end-of-game dialog: title, HTML body, and up to two actions.
 */
export function resultDialog({ title, bodyHtml, primary, secondary, extra }) {
  const dlg = createDialog({});
  const actions = [];
  if (primary) {
    actions.push(el('button', {
      type: 'button', class: 'btn btn--primary', text: primary.label,
      onclick: () => { dlg.close(); primary.onClick?.(); },
    }));
  }
  if (extra) {
    actions.push(el('button', {
      type: 'button', class: 'btn btn--secondary', text: extra.label,
      onclick: () => extra.onClick?.(),
    }));
  }
  if (secondary) {
    actions.push(el('button', {
      type: 'button', class: 'btn btn--ghost', text: secondary.label,
      onclick: () => { dlg.close(); secondary.onClick?.(); },
    }));
  }
  dlg.setContent(
    el('h2', { class: 'dialog__title', text: title }),
    el('div', { class: 'dialog__body', html: bodyHtml }),
    el('div', { class: 'dialog__actions' }, actions),
  );
  dlg.open();
  return dlg;
}

/* --- feedback ------------------------------------------------------------- */

/** Short vibration, opt-out via preferences. No-op where unsupported. */
export function haptic(pattern = 12) {
  if (!prefs.get('haptics')) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export const HAPTIC = {
  tap: 8,
  commit: 14,
  reject: [18, 40, 18],
  win: [12, 60, 12, 60, 24],
};

const CONFETTI_COLORS = [
  'oklch(0.72 0.15 80)', 'oklch(0.74 0.15 100)', 'oklch(0.68 0.15 45)',
  'oklch(0.72 0.14 150)', 'oklch(0.66 0.16 20)', 'oklch(0.70 0.13 250)',
];

export function celebrate(host = document.body, count = 56) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const size = 4 + Math.random() * 8;
    frag.append(el('div', {
      class: 'confetti',
      style: `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
             `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};` +
             `animation-duration:${1.5 + Math.random() * 2.2}s;` +
             `animation-delay:${Math.random() * 0.7}s`,
    }));
  }
  host.append(frag);
  setTimeout(() => host.querySelectorAll('.confetti').forEach((n) => n.remove()), 5200);
}

/* --- formatting ----------------------------------------------------------- */

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  if (m < 60) return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

/* --- timer ---------------------------------------------------------------- */

/**
 * Wall-clock elapsed timer. Counting ticks drifts and, worse, stalls when a
 * backgrounded tab is throttled — so elapsed time is always derived from
 * timestamps and the interval only drives repaints.
 */
export function createTimer(onTick) {
  let elapsed = 0;
  let startedAt = 0;
  let handle = 0;

  const now = () => Date.now();
  const current = () => elapsed + (startedAt ? now() - startedAt : 0);

  function emit() { onTick?.(Math.floor(current() / 1000)); }

  return {
    start() {
      if (startedAt) return;
      startedAt = now();
      handle = setInterval(emit, 250);
      emit();
    },
    pause() {
      if (!startedAt) return;
      elapsed += now() - startedAt;
      startedAt = 0;
      clearInterval(handle);
      handle = 0;
      emit();
    },
    reset(seconds = 0) {
      elapsed = seconds * 1000;
      if (startedAt) startedAt = now();
      emit();
    },
    seconds: () => Math.floor(current() / 1000),
    isRunning: () => !!startedAt,
  };
}

/* --- misc ----------------------------------------------------------------- */

/** Yield to the browser so a spinner can actually paint before heavy work. */
export function nextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)));
}

export function mountSettingsButton(dialogFactory) {
  return { name: 'settings', icon: 'settings', label: 'Settings', onClick: dialogFactory };
}

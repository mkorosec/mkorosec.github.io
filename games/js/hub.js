/* Hub behaviour: the Continue row, the theme control and the install prompt. */

import { el, iconSvg, toast } from './core/ui.js';
import * as prefs from './core/prefs.js';
import { listInProgress, ago } from './core/session.js';
import { prewarm } from './core/generate.js';

const GAME_TITLES = new Map(
  [...document.querySelectorAll('.card')].map((card) => [
    card.getAttribute('href'),
    card.querySelector('.card-title')?.textContent || '',
  ]),
);

function renderContinue() {
  const section = document.getElementById('continue-section');
  const grid = document.getElementById('continue-grid');
  const entries = listInProgress().slice(0, 4);

  if (!entries.length) { section.hidden = true; return; }

  grid.replaceChildren(...entries.map((entry) => {
    const href = entry.href || `${entry.game}.html`;
    const title = GAME_TITLES.get(href) || entry.game;
    return el('a', { class: 'card', href }, [
      el('span', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: title }),
        el('span', { class: 'card-badge', text: ago(entry.at) }),
      ]),
      entry.label ? el('span', { class: 'card-resume', text: entry.label }) : null,
      entry.detail ? el('span', { class: 'card-blurb', text: entry.detail }) : null,
    ]);
  }));
  section.hidden = false;
}

function themeButton() {
  const btn = el('button', { type: 'button', class: 'btn btn--secondary btn--sm' });
  const sync = () => {
    const mode = prefs.get('theme');
    btn.innerHTML = '';
    btn.append(
      el('span', { html: iconSvg(prefs.resolvedTheme() === 'light' ? 'moon' : 'theme'),
        style: 'display:inline-flex;width:16px;height:16px' }),
      document.createTextNode(`Theme: ${mode}`),
    );
    btn.querySelector('svg').setAttribute('style', 'width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2');
  };
  btn.addEventListener('click', () => { prefs.cycleTheme(); sync(); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', sync);
  sync();
  return btn;
}

function colorblindButton() {
  const btn = el('button', { type: 'button', class: 'btn btn--secondary btn--sm' });
  const sync = () => {
    btn.textContent = `High-contrast cues: ${prefs.get('colorblind') ? 'on' : 'off'}`;
    btn.setAttribute('aria-pressed', String(!!prefs.get('colorblind')));
  };
  btn.addEventListener('click', () => { prefs.set('colorblind', !prefs.get('colorblind')); sync(); });
  sync();
  return btn;
}

function installButton() {
  const btn = el('button', {
    type: 'button', class: 'btn btn--primary btn--sm', text: 'Install app', hidden: true,
  });

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
    if (outcome === 'accepted') toast('Installed. It works with the radios off.', 2600);
  });

  window.addEventListener('appinstalled', () => { btn.hidden = true; });
  return btn;
}

document.getElementById('hub-actions').append(
  installButton(), themeButton(), colorblindButton(),
);

prefs.applyColorblind();
renderContinue();

// Spin the generator worker up now so the first puzzle a player opens does
// not also pay for loading the module graph.
prewarm();

/* The stats dialog, shared by every game. */

import { el, createDialog, formatTime, iconSvg } from './ui.js';
import * as stats from './stats.js';

/**
 * @param {string} game
 * @param {object} opts
 * @param {string} opts.title
 * @param {Array<{key:string,label:string}>} opts.buckets  difficulties to show
 * @param {string} [opts.distLabel]   histogram caption, omit to hide it
 * @param {number} [opts.distMax]     number of histogram bins
 * @param {string|number} [opts.highlight]  bin to emphasise (this game's result)
 * @param {boolean} [opts.showStreak=true]
 */
export function showStats(game, opts) {
  const {
    title = 'Statistics', buckets = [{ key: 'default', label: '' }],
    distLabel = null, distMax = 6, highlight = null, showStreak = true,
  } = opts || {};

  const dlg = createDialog({ wide: true });
  let active = buckets[0].key;

  function bucketSummary(key) {
    const s = stats.summary(game, key);
    return el('div', {}, [
      el('div', { class: 'stat-grid' }, [
        cell(s.played, 'Played'),
        cell(`${s.winRate}%`, 'Win rate'),
        cell(s.bestTime === null ? '—' : formatTime(s.bestTime), 'Best time'),
        cell(s.avgTime === null ? '—' : formatTime(s.avgTime), 'Average'),
      ]),
      distLabel ? distribution(key) : null,
    ]);
  }

  function cell(value, caption) {
    return el('div', { class: 'stat-grid__cell' }, [
      el('div', { class: 'stat-grid__num', text: String(value) }),
      el('div', { class: 'stat-grid__cap', text: caption }),
    ]);
  }

  function distribution(key) {
    const dist = stats.bucket(game, key).dist || {};
    const bins = Array.from({ length: distMax }, (_, i) => String(i + 1));
    const max = Math.max(1, ...bins.map((b) => dist[b] || 0));
    return el('div', {}, [
      el('div', { class: 'hud__label', style: 'margin-bottom:8px', text: distLabel }),
      el('div', { class: 'dist' }, bins.map((b) => {
        const n = dist[b] || 0;
        const isCurrent = String(highlight) === b && key === active;
        return el('div', { class: 'dist__row' }, [
          el('span', { text: b }),
          el('span', {
            class: `dist__bar${isCurrent ? ' is-current' : ''}`,
            style: `width:${Math.max(8, (n / max) * 100)}%`,
            text: String(n),
          }),
        ]);
      })),
    ]);
  }

  const content = el('div', {});

  function render() {
    const streak = stats.liveStreak(game);
    const best = stats.load(game).daily.best;

    const header = el('div', { class: 'dialog__header' }, [
      el('h2', { class: 'dialog__title', style: 'margin:0', text: title }),
      el('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Close',
        html: iconSvg('close'), onclick: () => dlg.close(),
      }),
    ]);

    const tabs = buckets.length > 1
      ? el('div', {
          class: 'segmented', role: 'tablist',
          style: 'margin-bottom:16px;width:fit-content',
        }, buckets.map((b) => el('button', {
          type: 'button', class: 'segmented__item', role: 'tab',
          'aria-selected': String(b.key === active), text: b.label,
          onclick: () => { active = b.key; render(); },
        })))
      : null;

    const streakRow = showStreak
      ? el('div', { class: 'stat-grid', style: 'grid-template-columns:repeat(2,1fr)' }, [
          cell(streak, 'Daily streak'),
          cell(best, 'Best streak'),
        ])
      : null;

    content.replaceChildren(...[header, tabs, streakRow, bucketSummary(active)].filter(Boolean));
  }

  render();
  dlg.setContent(content);
  dlg.open();
  return dlg;
}

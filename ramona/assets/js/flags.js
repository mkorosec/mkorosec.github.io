/* ============================================================
   FEATURE FLAGS
   ------------------------------------------------------------
   Lets us trial a feature on the live site without shipping it to
   visitors, and remove it later without leaving debris.

   Open the panel:      ?flags=panel
   Enable directly:     ?flags=ig-local        (shareable preview link)
   Several at once:     ?flags=panel,ig-local
   Clear everything:    ?flags=none

   Resolution order: URL parameter > localStorage > registry default.
   Everything defaults OFF, so a normal visitor sees nothing.

   An experiment's markup lives in <template data-flag="id"> in the page.
   Template contents are inert per the HTML spec — not rendered, scripts
   don't run, images aren't fetched — so a disabled flag costs nothing at
   all, not even a request. Enabling clones the template into place.

   See FEATURE-FLAGS.md for how to add and how to delete one.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- registry: the single source of truth ---------- */
  var FLAGS = [
    {
      // CSS-only experiment: the class this puts on <html> is all it does.
      // Remove this entry + the "experiment: hero-style" CSS block to delete it.
      id: 'hero-style',
      type: 'select',
      title: 'Hero styling',
      note: 'Alternatives to the spinning record. Pure CSS, no markup, no JS.',
      default: 'full',
      options: [
        { v: 'full',   label: 'Full-bleed photograph (default)' },
        { v: 'bare',   label: 'Photograph only' },
        { v: 'framed', label: 'Photograph + offset rule' },
        { v: 'nodisc', label: 'No record, keep bars' },
        { v: 'static', label: 'Record, not spinning' },
        // No CSS block for this one — a class nothing styles leaves the base
        // hero as authored, which is how the original is offered back.
        { v: 'record', label: 'Original — record + bars' }
      ]
    },
    {
      id: 'hero',
      type: 'select',
      title: 'Hero portrait',
      note: 'Which photograph the homepage leads with. Pick one, then bake it in by ' +
            'overwriting assets/img/photos/hero-portrait.jpg and deleting this flag.',
      options: [
        { v: '',  label: 'Current — 11 (default)' },
        { v: '1', label: '1 — Wall, monochrome' },
        { v: '2', label: '2 — Wall, edges faded' },
        { v: '3', label: '3 — Leather, monochrome' },
        { v: '4', label: '4 — Leather, red duotone' },
        { v: '5', label: '5 — Hat, monochrome' },
        { v: '6', label: '6 — Skyline, the legs frame' },
        { v: '7', label: '7 — Stone wall, leg raised' },
        { v: '8', label: '8 — On stage, mid-song' },
        { v: '9',  label: '9 — Orange on black, colour' },
        { v: '10', label: '10 — Orange on black, mono' },
        { v: '11', label: '11 — Brick wall, arms out' },
        { v: '12', label: '12 — Brick wall, red duotone' }
      ],
      onEnable: swapHero
    },
    {
      id: 'ig-local',
      title: 'Instagram — local mirror',
      note: 'Self-hosted copies of chosen posts, each linking out to Instagram. ' +
            'No third-party requests, no cookies, fast. Needs the images committed.',
      onEnable: renderLocalGrid
    },
    {
      id: 'ig-embed',
      title: 'Instagram — official embed',
      note: 'Real Instagram iframes via embed.js. Tokenless again since June 2026. ' +
            'Meta sees every visitor\'s IP and sets cookies — read the tradeoff in FEATURE-FLAGS.md.',
      onEnable: renderOfficialEmbeds
    },
    {
      id: 'ig-wall',
      title: 'Instagram — photo wall',
      default: true,
      when: function () { return !mq(MOBILE); },   // desktop
      note: 'What SnapWidget/Elfsight/LightWidget actually sell: only the photographs, ' +
            'tight grid, hover label, click opens the site lightbox. No iframe, no Meta, ' +
            'no subscription. On by default on desktop only.',
      onEnable: renderWall
    },
    {
      id: 'ig-strip',
      title: 'Instagram — scrolling strip',
      default: true,
      when: function () { return mq(MOBILE); },    // mobile
      note: 'Continuous film-strip of self-hosted tiles, in the site\'s existing marquee ' +
            'language. Pauses on hover, scrolls natively under reduced motion. Handles any ' +
            'number of posts. No third parties. On by default on mobile only.',
      onEnable: renderStrip
    }
  ];

  // 900px is the site's existing desktop/mobile boundary (same as the nav drawer).
  var MOBILE = '(max-width: 900px)';
  var mq = function (q) { return window.matchMedia(q).matches; };

  var LS_PREFIX = 'flag:';
  var LS_PANEL  = 'flag:_panel';
  var byId = {};
  FLAGS.forEach(function (f) { byId[f.id] = f; });

  /* ---------- resolve state ---------- */
  var params = new URLSearchParams(location.search);
  var urlList = (params.get('flags') || '').split(',')
                  .map(function (s) { return s.trim(); }).filter(Boolean);

  if (urlList.indexOf('none') !== -1) {
    // Clears overrides, so flags fall back to their registry defaults.
    FLAGS.forEach(function (f) { localStorage.removeItem(LS_PREFIX + f.id); });
    localStorage.removeItem(LS_PANEL);
    urlList = [];
  }

  var showPanel = urlList.indexOf('panel') !== -1 || localStorage.getItem(LS_PANEL) === '1';
  if (urlList.indexOf('panel') !== -1) localStorage.setItem(LS_PANEL, '1');

  // A flag named in the URL is turned on and remembered.
  // Choice flags take a value: ?flags=hero:3
  urlList.forEach(function (tok) {
    var bits = tok.split(':');
    var id = bits[0];
    if (!byId[id]) return;
    if (byId[id].type === 'select') {
      if (bits.length > 1) localStorage.setItem(LS_PREFIX + id, bits[1]);
    } else {
      localStorage.setItem(LS_PREFIX + id, '1');
    }
  });

  // A flag may ship ON. localStorage still wins, so it stays switchable:
  // '1' forces on, '0' forces off, absent falls back to the registry default.
  var isOn = function (id) {
    var stored = localStorage.getItem(LS_PREFIX + id);
    if (stored === '1') return true;      // explicit override always wins,
    if (stored === '0') return false;     // so the panel can force either way
    var f = byId[id];
    if (!f || !f.default) return false;
    // A default may be conditional on the viewport. Evaluated once at load, so
    // resizing across the breakpoint needs a reload to swap — acceptable for a
    // choice between two presentations of the same content.
    return f.when ? f.when() : true;
  };

  // Choice flags store a string rather than '1'. Empty means "leave the page alone".
  var valueOf = function (id) {
    var stored = localStorage.getItem(LS_PREFIX + id);
    if (stored !== null) return stored;          // explicit choice wins
    return (byId[id] && byId[id].default) || '';
  };

  /* ---------- public handle ---------- */
  window.Flags = {
    on: isOn,
    list: function () { return FLAGS.map(function (f) { return f.id; }); },
    set: function (id, v) {
      if (!byId[id]) return;
      if (byId[id].type === 'select') {
        if (v) localStorage.setItem(LS_PREFIX + id, String(v));
        else localStorage.removeItem(LS_PREFIX + id);
      } else {
        localStorage.setItem(LS_PREFIX + id, v ? '1' : '0');
      }
      location.reload();
    },
    value: valueOf
  };

  /* ---------- lazy manifest state ----------
     Declared before the activation loop below: `var` hoists the declaration
     but not the assignment, so initialising these further down would leave
     them undefined at the moment onEnable() runs. */
  var dataLoading = false, dataQueue = [];

  /* ---------- activate ---------- */
  FLAGS.forEach(function (f) {
    var active, arg;
    if (f.type === 'select') {
      arg = valueOf(f.id);
      active = arg !== '';
      if (active) document.documentElement.classList.add('flag-' + f.id + '-' + arg);
    } else {
      active = isOn(f.id);
      if (active) document.documentElement.classList.add('flag-' + f.id);
    }
    if (!active) return;

    var tpl = document.querySelector('template[data-flag="' + f.id + '"]');
    if (tpl) tpl.parentNode.insertBefore(tpl.content.cloneNode(true), tpl);

    if (typeof f.onEnable === 'function') {
      try { f.onEnable(arg); } catch (e) { console.warn('[flags] ' + f.id + ' failed:', e); }
    }
  });

  /* ---------- lazy post manifest ----------
     Loaded only when an Instagram experiment is actually on, so a visitor
     with the flags off fetches nothing for them — not even this file. */
  function withData(cb) {
    if (window.IG_POSTS) { cb(window.IG_POSTS); return; }
    dataQueue.push(cb);
    if (dataLoading) return;
    dataLoading = true;
    var s = document.createElement('script');
    s.src = 'assets/js/instagram-data.js';
    s.onload = function () {
      dataQueue.forEach(function (fn) { fn(window.IG_POSTS); });
      dataQueue = [];
    };
    s.onerror = function () { console.warn('[flags] instagram-data.js failed to load'); };
    document.head.appendChild(s);
  }

  /* Self-hosted variants may only render photographs she owns. Third-party
     posts stay embed-only — see the note at the top of instagram-data.js. */
  function ownPhotos(data) {
    return (data && data.posts || []).filter(function (p) {
      return p.image && p.owner === data.handle;
    });
  }

  /* ---------- experiment: local mirror ---------- */
  function renderLocalGrid() {
    var host = document.querySelector('[data-ig-local]');
    if (!host) return;
    withData(function (data) { paintLocal(host, data); });
  }

  function paintLocal(host, data) {
    if (!data || !data.posts || !data.posts.length) {
      host.innerHTML = '<p class="ig-note">No posts in <code>assets/js/instagram-data.js</code> yet.</p>';
      return;
    }
    var withImg = ownPhotos(data);
    if (!withImg.length) {
      host.innerHTML = '<p class="ig-note">No <code>image</code> set on any post yet — ' +
        'this variant serves self-hosted copies, so each entry needs a square JPEG.</p>';
      return;
    }
    host.innerHTML = withImg.map(function (p) {
      return '<a class="ig-tile" href="' + p.permalink + '" target="_blank" rel="noopener">' +
               '<img src="' + p.image + '" width="1000" height="1000" loading="lazy" decoding="async" alt="' +
                 (p.alt || '').replace(/"/g, '&quot;') + '">' +
               (p.caption ? '<span class="ig-cap">' + p.caption + '</span>' : '') +
             '</a>';
    }).join('');
  }

  /* ---------- experiment: hero portrait chooser ---------- */
  function swapHero(which) {
    var img = document.querySelector('.hero-portrait img');
    if (!img || !which) return;
    img.src = 'assets/img/photos/hero-opt-' + which + '.jpg';
    // These candidates are all 4:5, same as the slot, so the declared
    // width/height stay correct and nothing shifts.
  }

  /* ---------- experiment: photo wall ---------- */
  function renderWall() {
    var host = document.querySelector('[data-ig-wall]');
    if (!host) return;
    withData(function (data) { paintWall(host, data); });
  }

  function paintWall(host, data) {
    var withImg = ownPhotos(data);
    if (!withImg.length) {
      host.innerHTML = '<p class="ig-note">No <code>image</code> set on any post yet — ' +
        'this variant shows the photographs themselves, so each entry needs a square JPEG.</p>';
      return;
    }
    // class="gallery__item" deliberately: it opts these tiles into the site's
    // existing lightbox instead of introducing a second viewer.
    // Links straight out to Instagram, like the local mirror — no lightbox.
    host.innerHTML = withImg.map(function (p) {
      var esc = function (t) { return String(t || '').replace(/"/g, '&quot;'); };
      return '<a class="ig-wall__tile" href="' + p.permalink + '" target="_blank" rel="noopener">' +
               '<img src="' + p.image + '" width="1000" height="1000" loading="lazy"' +
                 ' decoding="async" alt="' + esc(p.alt) + '">' +
               (p.caption ? '<span class="ig-wall__cap">' + p.caption + '</span>' : '') +
             '</a>';
    }).join('');
  }

  /* ---------- experiment: scrolling strip ---------- */
  function renderStrip() {
    var host = document.querySelector('[data-ig-strip]');
    if (!host) return;
    withData(function (data) { paintStrip(host, data); });
  }

  function paintStrip(host, data) {
    if (!data || !data.posts || !data.posts.length) {
      host.innerHTML = '<p class="ig-note">No posts in <code>assets/js/instagram-data.js</code> yet.</p>';
      return;
    }
    var tile = function (p) {
      return '<a class="ig-strip__tile" href="' + p.permalink + '" target="_blank" rel="noopener">' +
               '<img src="' + p.image + '" width="1000" height="1000" loading="lazy" decoding="async" alt="' +
                 (p.alt || '').replace(/"/g, '&quot;') + '">' +
               (p.caption ? '<span class="ig-strip__cap">' + p.caption + '</span>' : '') +
             '</a>';
    };
    // Two identical runs, so translating the track by -50% loops seamlessly.
    var withImg = ownPhotos(data);
    if (!withImg.length) {
      host.innerHTML = '<p class="ig-note">No <code>image</code> set on any post yet.</p>';
      return;
    }
    var run = withImg.map(tile).join('');
    host.innerHTML = '<div class="ig-strip__track" style="--speed:' +
                     Math.max(24, withImg.length * 6) + 's">' + run + run + '</div>';
  }

  /* ---------- experiment: official embed ---------- */
  function renderOfficialEmbeds() {
    var host = document.querySelector('[data-ig-embed]');
    if (!host) return;
    withData(function (data) { paintEmbeds(host, data); });
  }

  /* Only a single post/reel can be embedded. A profile URL renders as a blank
     white box — the iframe loads and has nothing to show — so reject anything
     that isn't /p/, /reel/ or /tv/ and say so instead of rendering emptiness. */
  /* Instagram serves two equivalent shapes and people paste either:
       instagram.com/p/<code>/              (canonical)
       instagram.com/<username>/p/<code>/   (what the address bar usually shows)
     The optional username group backtracks, so the bare form still matches and
     "p" can never be swallowed as a username. */
  function postShortcode(url) {
    var m = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/.exec(url || '');
    return m ? m[1] : null;
  }

  /* embed.js expects the canonical permalink, so rebuild it from the shortcode
     instead of passing through whatever form was pasted in. */
  function canonicalPermalink(url) {
    var code = postShortcode(url);
    if (!code) return url;
    return 'https://www.instagram.com/' + (/\/reel\//.test(url) ? 'reel' : 'p') + '/' + code + '/';
  }

  function paintEmbeds(host, data) {
    if (!data || !data.posts || !data.posts.length) {
      host.innerHTML = '<p class="ig-note">No posts in <code>assets/js/instagram-data.js</code> yet.</p>';
      return;
    }

    var usable = data.posts.filter(function (p) { return postShortcode(p.permalink); });
    var rejected = data.posts.length - usable.length;

    if (!usable.length) {
      host.className = '';   // drop the grid so the notice reads as prose
      host.innerHTML =
        '<p class="ig-note"><b>Nothing to embed yet.</b> All ' + data.posts.length +
        ' entries in <code>assets/js/instagram-data.js</code> are profile URLs. ' +
        'The official embed only works on a single post, so each <code>permalink</code> ' +
        'needs to look like <code>https://www.instagram.com/p/&lt;shortcode&gt;/</code> — ' +
        'open a post on Instagram and copy the URL from the address bar. ' +
        'Reels (<code>/reel/</code>) work too.</p>';
      return;
    }

    host.innerHTML = usable.slice(0, data.embedLimit || 12).map(function (p) {
      return '<div class="ig-embed-card">' +
               '<div class="ig-embed-card__bar"><span>instagram.com</span><span>' +
                 postShortcode(p.permalink) + '</span></div>' +
               '<blockquote class="instagram-media" data-instgrm-permalink="' +
                 canonicalPermalink(p.permalink) + '" data-instgrm-version="14"></blockquote>' +
             '</div>';
    }).join('') +
    (function () {
      var bits = [];
      var limit = data.embedLimit || 12;
      if (usable.length > limit) {
        bits.push('showing ' + limit + ' of ' + usable.length +
                  ' posts (embedLimit in instagram-data.js)');
      }
      if (rejected) {
        bits.push(rejected + ' entr' + (rejected === 1 ? 'y' : 'ies') +
                  ' skipped — not post URLs');
      }
      return bits.length
        ? '<p class="ig-note" style="column-span:all">' + bits.join(' · ') + '.</p>'
        : '';
    })();

    // A <script> cloned from a template never executes, so load it here instead.
    if (window.instgrm) { window.instgrm.Embeds.process(); return; }
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = function () { if (window.instgrm) window.instgrm.Embeds.process(); };
    document.head.appendChild(s);
  }

  /* ---------- dev panel ---------- */
  if (!showPanel) return;

  var panel = document.createElement('aside');
  panel.className = 'flag-panel';
  panel.setAttribute('aria-label', 'Feature flags (development)');
  panel.innerHTML =
    '<div class="flag-panel__head"><b>Feature flags</b>' +
      '<button type="button" class="flag-panel__x" aria-label="Hide panel">×</button></div>' +
    '<div class="flag-panel__body"></div>' +
    '<div class="flag-panel__foot">' +
      '<button type="button" class="flag-panel__reset">Reset &amp; exit dev mode</button>' +
    '</div>';
  document.body.appendChild(panel);

  var body = panel.querySelector('.flag-panel__body');
  FLAGS.forEach(function (f) {
    var row = document.createElement('label');
    row.className = 'flag-row' + (f.type === 'select' ? ' flag-row--select' : '');
    var cb;
    if (f.type === 'select') {
      cb = document.createElement('select');
      f.options.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.v; op.textContent = o.label;
        cb.appendChild(op);
      });
      cb.value = valueOf(f.id);
      cb.addEventListener('change', function () { window.Flags.set(f.id, cb.value); });
    } else {
      cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isOn(f.id);
      cb.addEventListener('change', function () { window.Flags.set(f.id, cb.checked); });
    }
    var txt = document.createElement('span');
    txt.innerHTML = '<b>' + f.title + '</b><i>' + f.note + '</i><code>' + f.id + '</code>';
    row.appendChild(cb);
    row.appendChild(txt);
    body.appendChild(row);
  });

  panel.querySelector('.flag-panel__x').addEventListener('click', function () {
    localStorage.removeItem(LS_PANEL);
    panel.remove();
  });
  panel.querySelector('.flag-panel__reset').addEventListener('click', function () {
    FLAGS.forEach(function (f) { localStorage.removeItem(LS_PREFIX + f.id); });
    localStorage.removeItem(LS_PANEL);
    location.search = '';
  });
})();

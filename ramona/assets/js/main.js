/* ============================================================
   RAMONA IRGOLIČ — shared interactions
   No dependencies. Every feature degrades to working HTML.
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------
     Sticky header
     --------------------------------------------------------- */
  var head = $('.site-head');
  if (head) {
    var onScroll = function () { head.classList.toggle('is-solid', window.scrollY > 30); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------
     Mobile navigation drawer
     --------------------------------------------------------- */
  var toggle = $('.nav-toggle');
  var navWrap = $('.nav-wrap');
  if (toggle && navWrap) {
    var setNav = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      navWrap.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
    };
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Close on link activation, Escape, or growing past the breakpoint.
    $$('a', navWrap).forEach(function (a) {
      a.addEventListener('click', function () { setNav(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setNav(false); toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setNav(false);
    });
  }

  /* ---------------------------------------------------------
     Reveal on scroll
     --------------------------------------------------------- */
  var revealEls = $$('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------------------------------------------------------
     Count-up numbers
     --------------------------------------------------------- */
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, end = parseInt(el.getAttribute('data-count'), 10);
        var dur = 1400, t0 = null;
        requestAnimationFrame(function step(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        });
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------------------------------------------------------
     Equalizer bars
     --------------------------------------------------------- */
  $$('.eq').forEach(function (eq) {
    $$('i', eq).forEach(function (b, i) {
      b.style.setProperty('--h', (20 + Math.random() * 60).toFixed(0) + '%');
      b.style.animationDelay = (i * 0.09).toFixed(2) + 's';
      b.style.animationDuration = (1.2 + Math.random() * 1.4).toFixed(2) + 's';
    });
  });

  /* ---------------------------------------------------------
     Hero role ticker
     Pauses on hover/focus — WCAG 2.2.2 (auto-updating content
     running longer than 5s must be pausable).
     --------------------------------------------------------- */
  var ticker = $('[data-ticker]');
  if (ticker && !reduced) {
    var words = ticker.getAttribute('data-ticker').split('|');
    var wordEl = $('.word', ticker);
    var wi = 0, tickerPaused = false;
    if (wordEl && words.length > 1) {
      setInterval(function () {
        if (tickerPaused || document.hidden) return;
        wi = (wi + 1) % words.length;
        wordEl.style.transition = 'opacity .28s';
        wordEl.style.opacity = '0';
        setTimeout(function () {
          wordEl.textContent = words[wi];
          wordEl.style.opacity = '1';
        }, 280);
      }, 2600);
      ['mouseenter', 'focusin'].forEach(function (ev) {
        ticker.addEventListener(ev, function () { tickerPaused = true; });
      });
      ['mouseleave', 'focusout'].forEach(function (ev) {
        ticker.addEventListener(ev, function () { tickerPaused = false; });
      });
    }
  }

  /* ---------------------------------------------------------
     Language rotator — the same sentence, in her languages.
     Demonstrates the "50 languages" claim instead of asserting it.

     Latin script only: the site ships latin + latin-ext font subsets,
     so Cyrillic / Greek / CJK lines would fall back to a system font
     and break the typography. See LAUNCH-CHECKLIST.md to extend.
     --------------------------------------------------------- */
  var LINES = [
    ['English',         'en', 'Every language is beautiful when you sing it.'],
    ['Slovenščina',     'sl', 'Vsak jezik je lep, ko ga zapoješ.'],
    ['Deutsch',         'de', 'Jede Sprache ist schön, wenn man sie singt.'],
    ['Italiano',        'it', 'Ogni lingua è bella quando la canti.'],
    ['Español',         'es', 'Cada idioma es hermoso cuando lo cantas.'],
    ['Português',       'pt', 'Toda língua é bonita quando você a canta.'],
    ['Français',        'fr', 'Chaque langue est belle quand on la chante.'],
    ['Hrvatski',        'hr', 'Svaki jezik je lijep kad ga pjevaš.'],
    ['Bahasa Indonesia','id', 'Setiap bahasa itu indah ketika dinyanyikan.'],
    ['Norsk',           'nb', 'Hvert språk er vakkert når du synger det.'],
    ['Nederlands',      'nl', 'Elke taal is mooi als je hem zingt.'],
    ['Svenska',         'sv', 'Varje språk är vackert när du sjunger det.'],
    ['Català',          'ca', 'Cada llengua és bonica quan la cantes.'],
    ['Čeština',         'cs', 'Každý jazyk je krásný, když ho zpíváš.'],
    ['Slovenčina',      'sk', 'Každý jazyk je krásny, keď ho spievaš.'],
    ['Română',          'ro', 'Fiecare limbă e frumoasă când o cânți.'],
    ['Polski',          'pl', 'Każdy język jest piękny, gdy go śpiewasz.'],
    ['Türkçe',          'tr', 'Her dil söylendiğinde güzeldir.'],
    ['Kiswahili',       'sw', 'Kila lugha ni nzuri unapoiimba.'],
    ['Afrikaans',       'af', 'Elke taal is mooi as jy dit sing.'],
    ['Bahasa Melayu',   'ms', 'Setiap bahasa itu indah apabila dinyanyikan.']
  ];

  var rot = $('.lang-rot');
  if (rot) {
    var lineEl   = $('.lang-rot__line', rot);
    var nameEl   = $('[data-lang-name]', rot);
    var idxEl    = $('[data-lang-idx]', rot);
    var dotsEl   = $('.lang-rot__dots', rot);
    var pauseBtn = $('[data-lang-pause]', rot);
    var li = 0;
    var userPaused  = reduced;    // reduced-motion visitors start paused
    var hoverPaused = false;

    LINES.forEach(function () { dotsEl.appendChild(document.createElement('i')); });
    var dots = $$('i', dotsEl);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    var render = function (i) {
      var L = LINES[i];
      lineEl.textContent = L[2];
      lineEl.setAttribute('lang', L[1]);
      nameEl.textContent = L[0];
      nameEl.setAttribute('lang', L[1]);
      idxEl.textContent = pad(i + 1) + ' / ' + pad(LINES.length);
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
    };

    var advance = function () {
      li = (li + 1) % LINES.length;
      if (reduced) { render(li); return; }
      lineEl.classList.add('is-fading');
      setTimeout(function () { render(li); lineEl.classList.remove('is-fading'); }, 320);
    };

    render(0);
    setInterval(function () {
      if (userPaused || hoverPaused || document.hidden) return;
      advance();
    }, 3200);

    if (pauseBtn) {
      var syncBtn = function () {
        pauseBtn.setAttribute('aria-pressed', String(userPaused));
        pauseBtn.textContent = userPaused ? 'Play' : 'Pause';
      };
      pauseBtn.addEventListener('click', function () { userPaused = !userPaused; syncBtn(); });
      syncBtn();
    }
    ['mouseenter', 'focusin'].forEach(function (ev) {
      rot.addEventListener(ev, function () { hoverPaused = true; });
    });
    ['mouseleave', 'focusout'].forEach(function (ev) {
      rot.addEventListener(ev, function () { hoverPaused = false; });
    });
  }

  /* ---------------------------------------------------------
     Lightbox gallery
     --------------------------------------------------------- */
  var items = $$('.gallery__item');
  if (items.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Close viewer">ESC</button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous photo">&#8592;</button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next photo">&#8594;</button>' +
      '<div><img alt=""><p class="lightbox__cap"></p></div>';
    document.body.appendChild(lb);

    var lbImg = $('img', lb), lbCap = $('.lightbox__cap', lb);
    var cur = 0, lastFocus = null;

    var show = function (i) {
      cur = (i + items.length) % items.length;
      var a = items[cur];
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.getAttribute('data-alt') || '';
      lbCap.textContent = a.getAttribute('data-cap') || '';
    };
    var openLb = function (i) {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add('is-open');
      document.body.classList.add('nav-open');    // reuse the scroll lock
      $('.lightbox__close', lb).focus();
    };
    var closeLb = function () {
      lb.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      if (lastFocus) lastFocus.focus();
    };

    items.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); openLb(i); });
    });
    $('.lightbox__close', lb).addEventListener('click', closeLb);
    $('.lightbox__prev', lb).addEventListener('click', function () { show(cur - 1); });
    $('.lightbox__next', lb).addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape')     { closeLb(); return; }
      if (e.key === 'ArrowLeft')  { show(cur - 1); return; }
      if (e.key === 'ArrowRight') { show(cur + 1); return; }
      if (e.key === 'Tab') {                      // keep focus inside the dialog
        var f = $$('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------------------------------------------------------
     YouTube facade — load the player only when asked.
     A bare embed pulls ~1.5 MB and sets tracking cookies on page load.
     --------------------------------------------------------- */
  $$('.ytf').forEach(function (el) {
    // A facade with no video ID would be a button that does nothing. Mark it
    // as not-yet-available and take it out of the tab order instead.
    if (!el.getAttribute('data-yt')) {
      el.classList.add('ytf--empty');
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.setAttribute('aria-label', 'Video coming soon');
      var play = $('.ytf__play', el);
      if (play) play.remove();
      var t = $('.ytf__title', el);
      if (t) t.textContent = 'Video coming soon';
      return;
    }
    var load = function () {
      var id = el.getAttribute('data-yt');
      if (!id || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = el.getAttribute('data-title') || 'Video';
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      el.innerHTML = '';
      el.appendChild(f);
    };
    el.addEventListener('click', load);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(); }
    });
  });

  /* ---------------------------------------------------------
     Booking form guard
     The form ships with a placeholder endpoint. Rather than let
     enquiries vanish into a 404, disable it and say so until the
     real Formspree ID is filled in.
     --------------------------------------------------------- */
  var bookingForm = document.getElementById('bookingForm');
  if (bookingForm && /YOUR_FORM_ID/.test(bookingForm.getAttribute('action') || '')) {
    var warn = document.createElement('p');
    warn.className = 'form-warning';
    warn.setAttribute('role', 'status');
    warn.innerHTML = '<b>This form is not connected yet.</b> Create a form endpoint and paste ' +
                     'the ID into the action attribute of <code>contact.html</code> — see ' +
                     'LAUNCH-CHECKLIST.md item 5. Until then, nothing sent here would arrive.';
    bookingForm.insertBefore(warn, bookingForm.firstChild);
    bookingForm.addEventListener('submit', function (e) { e.preventDefault(); });
    $$('button[type=submit], input, select, textarea', bookingForm).forEach(function (el) {
      el.disabled = true;
    });
  }

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  $$('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();

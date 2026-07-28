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
     Quote rotator
     One bank of quotes, filtered per page by data-quote-set.
     Auto-advances, pauses on hover/focus, and has explicit
     prev / next / pause controls — WCAG 2.2.2.

     Text may contain a single "|": everything after it renders
     emphasised (red), matching the original two-tone quote style.
     --------------------------------------------------------- */
  var QUOTES = [
    { s:['all','story','voice'], c:'Ramona Irgolič · 24ur, March 2025',
      t:'Maybe not every language sounds beautiful when you speak it.|But every single one is beautiful when you sing it.' },
    { s:['all','voice'], c:'Ramona Irgolič · 24ur, March 2025',
      t:'I can sing in 50 languages. Of course I can’t speak them all fluently.|But I still have time.' },
    { s:['all','story'], c:'Ramona Irgolič',
      t:'I don’t know all these languages because I’m gifted.|It’s the fruit of hard, systematic work.' },
    { s:['all','story'], c:'The secret pleasure of the polyglot',
      t:'I love situations where people think I don’t speak their language.|It’s fun having control over when — and if — I reveal myself.' },
    { s:['all','story'], c:'On the world’s 7,000 languages',
      t:'When a language disappears, we lose not just words but a culture,|an identity, a unique perspective on what it means to be human.' },
    { s:['all','world'], c:'Ramona Irgolič · 24ur',
      t:'You’re never too old for new knowledge.|It’s only a lack of courage that keeps us in place.' },
    { s:['all','story'], c:'Ramona Irgolič · Dnevnik, 2025',
      t:'You know a language when you’re relaxed in it —|regardless of any grammatical mistake.' },
    { s:['all','world'], c:'On one working day in Norway',
      t:'It was quite hard to switch from one language to another.|But if you’re mentally rested, it’s no problem.' },
    { s:['all','world'], c:'Ramona Irgolič · Dnevnik, 2025',
      t:'Where will the road take me next?|Far.' },
    { s:['all','record'], c:'Planet TV, 2025',
      t:'Officially the 4th longest legs on the planet —|who wouldn’t stop at that fact?' },
    { s:['all','record'], c:'On the measurement',
      t:'I have a Thai modelling agency to thank —|they measured me.' },
    { s:['all','record'], c:'Marc Forster, director · Quantum of Solace',
      t:'Because I have long legs, he couldn’t get past me.|“Girl, I still have a film to shoot.”' },
    { s:['all','record'], c:'Anatole Taubman on set — the word was “hvala”',
      t:'If you give me a kiss on the cheek,|I’ll tell you a Slovenian word.' },
    { s:['all','voice'], c:'The Wedding Music Company, Singapore',
      t:'Her energetic stage-presence and strong voice leaves the audience|with great impression and enthusiasm.' },
    { s:['all','world','story'], c:'On Brazilian Portuguese',
      t:'I thought: my God, I’ll never learn that.|Then I lived in Brazil for two years.' },
    { s:['all','world'], c:'Ramona Irgolič',
      t:'My friends say I should be twice my age,|considering everything I’ve already lived through.' }
  ];

  $$('.quote-rot').forEach(function (band) {
    var set   = band.getAttribute('data-quote-set') || 'all';
    var bq    = $('blockquote', band);
    var cite  = $('cite', band);
    var idxEl = $('.quote-idx', band);
    var pause = $('.quote-pause', band);
    var list  = QUOTES.filter(function (q) { return q.s.indexOf(set) !== -1; });
    if (!bq || !cite || list.length < 2) return;

    var i = 0, userPaused = reduced, hoverPaused = false;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    var paint = function (n) {
      var q = list[n], parts = q.t.split('|');
      bq.innerHTML = '<span class="q-text">' + parts[0] +
        (parts[1] ? ' <em>' + parts[1] + '</em>' : '') + '</span>';
      cite.textContent = '— ' + q.c;
      if (idxEl) idxEl.textContent = pad(n + 1) + ' / ' + pad(list.length);
    };

    var go = function (step) {
      i = (i + step + list.length) % list.length;
      if (reduced) { paint(i); return; }
      bq.classList.add('is-fading'); cite.classList.add('is-fading');
      setTimeout(function () {
        paint(i);
        bq.classList.remove('is-fading'); cite.classList.remove('is-fading');
      }, 300);
    };

    paint(0);
    setInterval(function () {
      if (userPaused || hoverPaused || document.hidden) return;
      go(1);
    }, 6000);

    var prev = $('.quote-prev', band), next = $('.quote-next', band);
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    if (pause) {
      var sync = function () {
        pause.setAttribute('aria-pressed', String(userPaused));
        pause.textContent = userPaused ? 'Play' : 'Pause';
      };
      pause.addEventListener('click', function () { userPaused = !userPaused; sync(); });
      sync();
    }
    ['mouseenter', 'focusin'].forEach(function (ev) {
      band.addEventListener(ev, function () { hoverPaused = true; });
    });
    ['mouseleave', 'focusout'].forEach(function (ev) {
      band.addEventListener(ev, function () { hoverPaused = false; });
    });
  });

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

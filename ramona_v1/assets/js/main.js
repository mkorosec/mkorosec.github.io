/* RAMONA IRGOLIČ — shared interactions */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- sticky header solid on scroll ---- */
  var head = document.querySelector('.site-head');
  if (head) {
    var onScroll = function () {
      head.classList.toggle('is-solid', window.scrollY > 30);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll('.reveal');
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

  /* ---- role ticker (landing A) ---- */
  var ticker = document.querySelector('[data-ticker]');
  if (ticker) {
    var words = ticker.getAttribute('data-ticker').split('|');
    var wordEl = ticker.querySelector('.word');
    var wi = 0;
    if (wordEl && words.length) {
      setInterval(function () {
        wi = (wi + 1) % words.length;
        wordEl.style.opacity = '0';
        wordEl.style.transition = 'opacity .28s';
        setTimeout(function () {
          wordEl.textContent = words[wi];
          wordEl.style.opacity = '1';
        }, 280);
      }, 2400);
    }
  }

  /* ---- equalizer bars: random heights ---- */
  document.querySelectorAll('.eq').forEach(function (eq) {
    var bars = eq.querySelectorAll('i');
    bars.forEach(function (b, i) {
      b.style.setProperty('--h', (20 + Math.random() * 60).toFixed(0) + '%');
      b.style.animationDelay = (i * 0.09).toFixed(2) + 's';
      b.style.animationDuration = (1.2 + Math.random() * 1.4).toFixed(2) + 's';
    });
  });

  /* ---- live clock (variant C board) ---- */
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var tick = function () {
      var d = new Date();
      var p = function (n) { return String(n).padStart(2, '0'); };
      clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- split-flap text (variant C board) ---- */
  var FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·';
  function flapify(el) {
    var target = el.getAttribute('data-flap') || el.textContent;
    el.setAttribute('aria-label', target);
    el.textContent = '';
    var frag = document.createDocumentFragment();
    target.split('').forEach(function (c) {
      var s = document.createElement('span');
      if (c === ' ') { s.className = 'ch sp'; s.innerHTML = '&nbsp;'; }
      else { s.className = 'ch'; s.textContent = reduced ? c : '·'; s.dataset.final = c; }
      frag.appendChild(s);
    });
    el.appendChild(frag);
    return el.querySelectorAll('.ch:not(.sp)');
  }

  function animateFlaps(scope) {
    var chars = [];
    scope.querySelectorAll('[data-flap]').forEach(function (el) {
      var chs = flapify(el);
      chs.forEach(function (ch) { chars.push(ch); });
    });
    if (reduced) { return; }
    chars.forEach(function (ch, idx) {
      var final = ch.dataset.final;
      var startDelay = Math.min(idx * 18, 1400) + Math.random() * 250;
      var cycles = 4 + Math.floor(Math.random() * 8);
      setTimeout(function () {
        var n = 0;
        var iv = setInterval(function () {
          if (n >= cycles) {
            ch.textContent = final;
            clearInterval(iv);
          } else {
            ch.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
            n++;
          }
        }, 55);
      }, startDelay);
    });
  }

  var board = document.querySelector('.board');
  if (board) {
    animateFlaps(board);
    /* re-flip destination on row hover */
    board.querySelectorAll('.board-row').forEach(function (row) {
      var dest = row.querySelector('[data-flap]');
      if (!dest) return;
      var busy = false;
      row.addEventListener('mouseenter', function () {
        if (busy || reduced) return;
        busy = true;
        var chs = flapify(dest);
        var done = 0;
        chs.forEach(function (ch, i) {
          var final = ch.dataset.final;
          var cycles = 2 + i;
          var n = 0;
          var iv = setInterval(function () {
            if (n >= cycles) {
              ch.textContent = final;
              clearInterval(iv);
              if (++done === chs.length) busy = false;
            } else {
              ch.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
              n++;
            }
          }, 45);
        });
      });
    });
  }

  /* ---- count-up numbers with data-count ---- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target;
        var end = parseInt(el.getAttribute('data-count'), 10);
        var dur = 1400, t0 = null;
        function step(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }
})();

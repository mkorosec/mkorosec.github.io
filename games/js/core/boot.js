/* Classic (non-module) script, loaded blocking in <head> on every page.

   Two jobs that must happen before anything else:
     1. stamp the theme on <html> before first paint, so switching pages in a
        light-theme install never flashes the dark palette;
     2. register the service worker, which is what makes the app work with the
        radios off. Registering here rather than only on the hub means a
        bookmark straight into a game still installs the cache. */
(function () {
  'use strict';

  try {
    var raw = localStorage.getItem('g:prefs');
    var prefs = raw ? JSON.parse(raw) : null;
    if (prefs) {
      if (prefs.theme === 'light' || prefs.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', prefs.theme);
      }
      if (prefs.colorblind) document.documentElement.classList.add('cb');
    }
  } catch (e) { /* first run, or storage blocked */ }

  // Must be read synchronously: currentScript is null once we are inside a
  // callback. Resolving against this script's own URL keeps the registration
  // correct no matter which directory the calling page lives in.
  var self = document.currentScript && document.currentScript.src;
  var swUrl = self ? new URL('../../sw.js', self).href : 'sw.js';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swUrl).catch(function () {
        /* No offline support this session; the game itself still works. */
      });
    });
  }
})();

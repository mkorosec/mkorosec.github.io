/* ============================================================
   ANALYTICS — cookieless by design
   ------------------------------------------------------------
   Configure ONE of the options below, then the beacon loads on every
   page. Both are cookieless and store no personal data, so no consent
   banner is required in the EU. (Google Analytics 4 would need one —
   it sets cookies and transfers data to the US.)

   Option A — Cloudflare Web Analytics (free)
     1. dash.cloudflare.com -> Analytics -> Web Analytics -> Add a site
     2. Copy the token out of the snippet it gives you
     3. Paste it into CF_TOKEN below

   Option B — Plausible (~EUR 9/mo, EU-hosted, nicer reports)
     1. Set PLAUSIBLE_DOMAIN to the live hostname, e.g. 'ramonairgolic.com'
     2. Leave CF_TOKEN empty

   Leaving both empty ships no tracking at all, which is the current state.
   ============================================================ */
(function () {
  'use strict';

  var CF_TOKEN         = '';   // e.g. 'a1b2c3d4e5f6...'
  var PLAUSIBLE_DOMAIN = '';   // e.g. 'ramonairgolic.com'

  // Never measure local development.
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return;

  var s;
  if (CF_TOKEN) {
    s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
    document.head.appendChild(s);
  } else if (PLAUSIBLE_DOMAIN) {
    s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }
})();

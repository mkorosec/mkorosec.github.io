/* ============================================================
   ANALYTICS — cookieless by design
   ------------------------------------------------------------
   Every option here is cookieless and stores no personal data, so no consent
   banner is required in the EU. (Google Analytics 4 would need one — it sets
   cookies and transfers data to the US. Don't swap it in without adding one.)

   ACTIVE: GoatCounter. Open-source, EU-hosted (Netherlands), free for personal
   use, no cookies, no cross-site tracking, ~3 KB. Dashboard:
   https://mkorosec.goatcounter.com

   Alternatives, if you ever want to switch — set one and blank the others:
     GOATCOUNTER      the /count endpoint for your GoatCounter site
     CF_TOKEN         Cloudflare Web Analytics (free)
     PLAUSIBLE_DOMAIN Plausible (~EUR 9/mo, EU-hosted, nicer reports)

   Blanking all three ships no tracking at all.
   ============================================================ */
(function () {
  'use strict';

  var GOATCOUNTER      = 'https://mkorosec.goatcounter.com/count';
  var CF_TOKEN         = '';   // e.g. 'a1b2c3d4e5f6...'
  var PLAUSIBLE_DOMAIN = '';   // e.g. 'ramonairgolic.com'

  // Never measure local development.
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return;

  // Respect an explicit Do Not Track signal. GoatCounter collects nothing
  // personal either way, but honouring it costs nothing.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var s = document.createElement('script');
  s.async = true;

  if (GOATCOUNTER) {
    // GoatCounter's own snippet uses a protocol-relative src; https is spelled
    // out here so the file also behaves when opened over file://.
    s.setAttribute('data-goatcounter', GOATCOUNTER);
    s.src = 'https://gc.zgo.at/count.js';
  } else if (CF_TOKEN) {
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  } else if (PLAUSIBLE_DOMAIN) {
    s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
    s.src = 'https://plausible.io/js/script.js';
  } else {
    return;
  }

  document.head.appendChild(s);
})();

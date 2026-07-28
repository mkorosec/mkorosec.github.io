/* ============================================================
   WORLD MAP — the ten homes and the stages between them
   Leaflet is self-hosted (assets/vendor/leaflet).
   Map tiles come from CARTO; see privacy note on the contact page.
   ============================================================ */
(function () {
  'use strict';

  var el = document.getElementById('worldMap');
  if (!el || typeof L === 'undefined') return;

  // [lat, lng, name, note, kind]  — kind: 'home' | 'stage'
  var PLACES = [
    [49.9929,   8.2473, 'Mainz, Germany',        '01 · Born — a bilingual start',            'home'],
    [46.5547,  15.6459, 'Maribor, Slovenia',     '02 · Roots — home base since age ten',     'home'],
    [45.4642,   9.1900, 'Milan, Italy',          '03 · Runways, and Italian as a hobby',     'home'],
    [41.4425,  -8.2918, 'Guimarães, Portugal',   '04 · Erasmus year, University of Minho',   'home'],
    [-30.0346,-51.2177, 'Porto Alegre, Brazil',  '05 · The voice awakens',                   'home'],
    [51.5074,  -0.1278, 'London, UK',            '06 · The European leg',                    'home'],
    [1.3521,  103.8198, 'Singapore',             '07 · The Esplanade, twice',                'home'],
    [-6.2088, 106.8456, 'Jakarta, Indonesia',    '08 · The star years',                      'home'],
    [59.9139,  10.7522, 'Oslo, Norway',          '09 · Tour guide — 13 languages in a day',  'home'],
    [41.8781, -87.6298, 'Chicago, USA',          '10 · And beyond',                          'home'],
    [3.1390,  101.6869, 'Kuala Lumpur, Malaysia','Asia tour with The Platters',              'stage'],
    [13.7563, 100.5018, 'Bangkok, Thailand',     'Asia tour with The Platters',              'stage'],
    [36.1699,-115.1398, 'Las Vegas, USA',        'Miss Hawaiian Tropic',                     'stage'],
    [22.3193, 114.1694, 'Hong Kong',             'A chapter of its own',                     'stage']
  ];

  var map = L.map(el, {
    scrollWheelZoom: false,        // don't hijack the page scroll
    worldCopyJump: true,
    attributionControl: true
  }).setView([22, 20], 2);

  // Enable the wheel only once the map has been clicked into.
  map.on('focus', function () { map.scrollWheelZoom.enable(); });
  map.on('blur',  function () { map.scrollWheelZoom.disable(); });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 8,
    minZoom: 2
  }).addTo(map);

  var dot = function (kind) {
    var home = kind === 'home';
    return L.divIcon({
      className: '',
      html: '<span style="display:block;width:' + (home ? 15 : 9) + 'px;height:' + (home ? 15 : 9) + 'px;' +
            'border-radius:50%;background:' + (home ? '#e10600' : '#f4f1ea') + ';' +
            'box-shadow:' + (home ? '0 0 14px rgba(225,6,0,.9)' : '0 0 8px rgba(244,241,234,.5)') + ';' +
            'border:1px solid rgba(10,10,11,.6)"></span>',
      iconSize: home ? [15, 15] : [9, 9],
      iconAnchor: home ? [7, 7] : [4, 4]
    });
  };

  var homes = [];
  PLACES.forEach(function (p) {
    var m = L.marker([p[0], p[1]], { icon: dot(p[4]), title: p[2], riseOnHover: true }).addTo(map);
    m.bindPopup('<b>' + p[2] + '</b>' + p[3]);
    if (p[4] === 'home') homes.push([p[0], p[1]]);
  });

  // Thread the ten homes together in chronological order.
  L.polyline(homes, {
    color: '#e10600', weight: 1, opacity: 0.45, dashArray: '5 7'
  }).addTo(map);
})();

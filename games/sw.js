var CACHE_NAME = 'games-v1';

var PRECACHE = [
  './',
  'index.html',
  '2048.html',
  'chat.html',
  'kakuro.html',
  'mastermind.html',
  'sudoku.html',
  'wordle.html',
  'words-en.json',
  'words-sl.json',
  'guesses-en.json',
  'guesses-sl.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(names) {
        return Promise.all(names.map(function(name) {
          if (name !== CACHE_NAME) return caches.delete(name);
        }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

/* Cache-first: refreshes never hit the network for anything already cached.
   Anything new (e.g. Google Fonts) is cached at runtime on first load. */
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && (response.ok || response.type === 'opaque')) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});

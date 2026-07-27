# Games

When adding or changing any game file (HTML, JSON lists, etc.), bump the `CACHE_NAME` semver in `sw.js` (e.g. `games-v1` → `games-v2`). The service worker serves cache-first, so old files remain on devices until the cache name changes.

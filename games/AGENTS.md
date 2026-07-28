# Games

Offline-first PWA. Everything runs on the device; nothing is fetched at play
time once the service worker has installed.

## Generated files — never edit by hand

`index.html`, every `<game>.html`, `offline.html`, `manifest.webmanifest` and
`sw.js` are produced by `tools/build.mjs` from `games.config.mjs`. Edit the
config (or the templates in the build tool), then:

```
node tools/build.mjs
```

`sw.js`'s cache name is a hash of the precached bytes, so it invalidates
itself whenever a cached file changes. There is no `CACHE_NAME` to bump by
hand any more — that step used to be manual and was easy to forget, which left
stale files on devices indefinitely.

`chat.html` is marked `legacy: true` in the config and is *not* generated; it
is still the original hand-written page.

## Adding a game

1. Add an entry to `GAMES` in `games.config.mjs`.
2. Write `js/games/<id>.js` (an ES module) and, if needed, `css/<id>.css`.
3. Put any pure puzzle logic in `js/gen/<id>.js` so it can be unit tested.
4. `node tools/build.mjs`
5. Add the page to the `PAGES` list in `tools/smoke.mjs`.

## Checks

```
npm test          # generator invariants, word lists, scoring, streaks
npm run check     # fails if the generated files are stale
npm run smoke     # loads every page in Chromium, fails on any console error
npm run serve     # static server on :8123 for manual testing
npm run words     # re-validate and rewrite the word lists
```

CI runs the first three on every push touching `games/**`.

## Things that are load-bearing

- **Puzzle uniqueness.** Kakuro and Killer Sudoku verify a single solution
  before handing a puzzle out; Nonogram proves it by being line-solvable.
  Sudoku difficulty is the technique the puzzle *requires*, not its clue
  count. The tests assert all of this — do not relax them.
- **Word lists** must be exactly five letters and typeable on that language's
  on-screen keyboard (`js/core/words.js`). Slovenian includes č/š/ž and has no
  q/w/x/y.
- **Generation runs in a worker** (`js/gen/worker.js`) so the UI never blocks;
  `js/core/generate.js` falls back to the main thread if workers are
  unavailable.
- **Every page needs a back link.** Installed PWAs have no browser chrome, so
  `appBar()` is the only way out of a game.

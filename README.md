# mkorosec.github.io

Public portfolio and static project builds hosted on GitHub Pages.

Run `python3 -m http.server 4185` and open http://localhost:4185/portfolio/. The root `index.html` is intentionally empty; the portfolio is available directly at `/portfolio/`. Its styles and images are in `assets/portfolio/`.

The map quiz is published at `/map-games/` from [mkorosec/map-games](https://github.com/mkorosec/map-games). The source repository builds the quiz and copies its HTML, current static daily questions, and `dist/` into `map-games/` on pushes to `main`. Automatic daily-question generation is disabled. Old `/quiz/` links redirect to the new route while keeping the category fragment. Root `/#category` links no longer redirect because the homepage is intentionally blank.

The digital twin benchmark is an audited export from its separate source repository into `digital-twin-of-a-building/`. The blood tools and Ramona sites remain at their current paths. Offline games and their CI currently live in `games/`. Travelogue, HYROX Venues, and Visit Sabunike are linked from the portfolio at their own published URLs.

Only copy approved public build output into this repository. Each external publisher needs a fine-grained `PAGES_DEPLOY_TOKEN` secret with Contents write access to `mkorosec/mkorosec.github.io`.

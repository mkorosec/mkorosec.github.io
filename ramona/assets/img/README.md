# Images

## Replacing the photo placeholders

Everything in `photos/` is a generated placeholder that states its own filename, aspect
ratio and intended subject. **Replace the file at the same path with the same aspect
ratio** and the layout needs no other change — width/height are declared in the HTML, so
there is no layout shift while images load.

| File | Size | Aspect | Used on | Subject |
|---|---|---|---|---|
| `hero-portrait.jpg`  | 1000×1250 | 4:5  | `index.html` hero | Full length, shows the legs. The one image most visitors will see. |
| `voice-1.jpg`        | 1600×1067 | 3:2  | `music.html`      | On stage — Esplanade or equivalent |
| `voice-2.jpg`        | 1600×1067 | 3:2  | `music.html`      | Mid-performance, microphone, crowd visible |
| `voice-3.jpg`        | 1600×1067 | 3:2  | `music.html`      | Studio or rehearsal, candid |
| `world-1.jpg`        | 1600×1067 | 3:2  | `travel.html`     | On the road, recognisable place |
| `world-2.jpg`        | 1600×1067 | 3:2  | `travel.html`     | Norway / fjords — the guiding years |
| `world-3.jpg`        | 1600×1067 | 3:2  | `travel.html`     | Asia — Jakarta or Singapore |
| `record-1.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Runway, full length |
| `record-2.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Editorial fashion frame |
| `record-3.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Pageant / Las Vegas |
| `record-4.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Studio portrait, legs emphasised |
| `record-5.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Behind the scenes / film set |
| `record-6.jpg`       | 1000×1250 | 4:5  | `modelling.html`  | Recent editorial, 2025–26 |
| `story-portrait.jpg` | 1000×1250 | 4:5  | `story.html`      | Warm candid — laughing, off duty |
| `video-1.jpg`        | 1600×900  | 16:9 | `music.html`      | Thumbnail for the Val 202 conversation card |
| `video-2.jpg`        | 1600×900  | 16:9 | `music.html`      | Thumbnail for the YouTube channel card |

### Before you upload

- **Rights.** Modelling and press photographs usually belong to the photographer or
  agency. Confirm permission for each. Every frame has a caption slot if a credit is
  required.
- **Compress.** Aim for under ~250 KB per JPEG at quality 82–86. `jpegoptim` or Squoosh.
- **Crop to the stated ratio** — the CSS uses `object-fit: cover`, so anything off-ratio
  gets cropped from the centre and faces near an edge will be cut.

### Optional: modern formats

The markup uses plain `<img>`. To serve AVIF/WebP with a JPEG fallback, swap any frame to:

```html
<picture>
  <source srcset="assets/img/photos/hero-portrait.avif" type="image/avif">
  <source srcset="assets/img/photos/hero-portrait.webp" type="image/webp">
  <img src="assets/img/photos/hero-portrait.jpg" width="1000" height="1250"
       alt="…" loading="lazy" decoding="async">
</picture>
```

---

## Generated brand assets

These are real, finished assets — not placeholders.

| File | Purpose |
|---|---|
| `og-cover.jpg` / `.png` | 1200×630 social share card. Referenced by every page's `og:image`. |
| `favicon.svg` | Primary favicon, scales to any size |
| `favicon.ico` | 16/32/48 fallback for older browsers |
| `apple-touch-icon.png` | 180×180 iOS home screen |
| `icon-192.png`, `icon-512.png` | PWA manifest icons |
| `icon-maskable-512.png` | Android adaptive icon (inset to the 80% safe zone) |

The share card is typographic because there was no photograph to use. If you'd prefer a
portrait version, the build script is at
`/home/mkorosec/.claude/jobs/*/tmp/build-og.sh` — or just make a 1200×630 image by hand
and overwrite `og-cover.jpg`. Keep the text large: it is most often seen as a ~500px-wide
thumbnail in a feed.

> Note: `og:image` must be a **JPEG or PNG** — most platforms will not render an SVG share
> card. `og-cover.jpg` is the file the pages actually reference; `og-cover.png` is kept
> alongside it as the lossless master to re-export from.

> The six `record-*` frames all render as 4:5 thumbnails in the portfolio grid so the rows
> stay even. A landscape original is fine — the grid centre-crops it, and the lightbox opens
> the full uncropped image.

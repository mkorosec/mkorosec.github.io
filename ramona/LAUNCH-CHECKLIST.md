# Launch checklist — ramonairgolic site

Everything below is a placeholder that needs a real value before this goes to a mass
audience. The site works today; these are the things only Ramona (or a decision) can supply.

Items are ordered by how much they cost you if you skip them.

---

## 1. Domain — blocks everything SEO

The site currently lives at `https://mkorosec.github.io/ramona/`, a subfolder under
someone else's username, where the domain root is a geography quiz game.

- [ ] Register the domain (`ramonairgolic.com` or similar)
- [ ] Add a `CNAME` file at the **repository root** containing just the hostname
- [ ] Point the DNS `A`/`ALIAS` records at GitHub Pages
- [ ] Enable **Enforce HTTPS** in the repo's Pages settings
- [ ] Then run the find-and-replace below

Once the domain exists, one command updates every absolute URL:

```bash
cd ramona
grep -rl 'mkorosec.github.io/ramona' . --include='*.html' --include='*.xml' --include='*.txt' \
  | xargs sed -i 's#https://mkorosec.github.io/ramona#https://YOURDOMAIN.com#g'
```

Two files only take effect at a domain root, so they do nothing until this is done:
- `robots.txt` — crawlers only read `/robots.txt` at the root
- `404.html` — GitHub Pages serves the **repo root** `404.html`, not this one

---

## 2. Photographs — the single biggest visual gap

Every image on the site is currently a self-documenting placeholder that states its own
filename and purpose. Replace the file at the same path and it just works — sizes and
aspect ratios are already declared in the HTML, so nothing shifts.

See `assets/img/README.md` for the full spec table.

- [ ] Drop in 14 real photographs
- [ ] **Confirm usage rights for each one.** Modelling and press photos usually belong to
      the photographer or agency, not the model. A mass-audience site is exactly where
      that gets noticed.
- [ ] Add photographer credits where required (there's a caption slot on every frame)
- [ ] Re-generate `og-cover.jpg` with a real portrait if you'd rather it wasn't typographic

---

## 3. Video

The Voice page links straight out to YouTube rather than embedding a player, so no
request is made to YouTube and no cookie is set while a visitor is on the site.

- [x] Val 202 episode card → `youtube.com/watch?v=3ldRsy9OrN4`
- [x] Second card → the channel, `youtube.com/c/ramonairgolic`
- [ ] Swap the two thumbnails (`video-1.jpg`, `video-2.jpg`) for real stills
- [ ] To add more as performance videos go up: copy a `.vid-card` block in `music.html`
      and change the `href`, thumbnail, title and description. No JavaScript involved.

---

## 4. Social accounts

The footer and contact page currently link YouTube, Facebook and LinkedIn. For a singer
and model in 2026, **Instagram and TikTok are the two that matter most** and both are
missing. The markup is already in place, commented out.

- [ ] `index.html` footer — uncomment and fill the Instagram + TikTok links
- [ ] `contact.html` — same, in the "Follow" card
- [ ] Add both handles to the `sameAs` array in the JSON-LD block in `index.html`
- [ ] Repeat the footer edit across `music.html`, `travel.html`, `modelling.html`,
      `story.html`, `press.html` (the footer is duplicated per page — see note at the bottom)

---

## 5. Booking form

`contact.html` ships with `action="https://formspree.io/f/YOUR_FORM_ID"`.

Until that's replaced, the form **disables itself** and displays a red notice, so no
enquiry is ever silently lost.

- [ ] Create a form at [formspree.io](https://formspree.io) (the free tier is enough)
- [ ] Paste the ID into the `action` attribute
- [ ] Send a test enquiry and confirm it arrives
- [ ] Consider adding a direct booking email address to the contact sidebar as well

---

## 6. Analytics

`assets/js/analytics.js` has both options wired and both switched off. Whichever you pick
is **cookieless**, so no consent banner is needed in the EU. (Google Analytics 4 would
need one — it sets cookies and exports to the US.)

- [ ] Either: Cloudflare Web Analytics (free) — paste the token into `CF_TOKEN`
- [ ] Or: Plausible (~€9/mo, EU-hosted) — put the hostname in `PLAUSIBLE_DOMAIN`
- [ ] Verify hits register after deploying

Localhost is excluded automatically.

---

## 7. Claims to verify before the press does

The site has been reworded to state only what's defensible, but these should be confirmed
with Ramona:

| Claim | Current wording | What to check |
|---|---|---|
| **124 cm legs** | "Measured twice, officially, at 124 cm… reported as among the longest in the world" | Does she hold any **Guinness World Records** documentation? GWR maintains a single official *longest legs (female)* title awarded by its own adjudication. The "4th in the world" ranking traces to Slovenian press, not GWR — the site now says exactly that. If she has GWR paperwork, we can restate this much more strongly. |
| **Miss Universe, second attendant** | Stated as fact on `modelling.html` | Which year, and which national//regional competition? This is checkable and will be checked. |
| **Esplanade, two consecutive nights** | Reworded from "first foreign musician to perform twice in a row" to just the fact of the two nights | The "first foreign musician" superlative was dropped as unverifiable. Restore it only with a source. |
| **Quote: "You know a language when you're relaxed in it"** | Cited to *Dnevnik, 2025* on `story.html` | Unverified — I could not find this in Dnevnik. The similar quote on the homepage **was** verified and is now correctly attributed to 24ur, 14 March 2025. |
| **Quote on `modelling.html`** | Cited to *Planet TV, 2025* | Plausible given the Planet TV article, but unconfirmed. |

Also: the Slovenian Wikipedia entry is still a **draft** (`Osnutek:Ramona_Irgolič`).
Getting it accepted as a live article would meaningfully help search visibility and is
worth someone's afternoon.

---

## 8. Quotes

Every page's quote band rotates through a shared bank in `assets/js/main.js` (`QUOTES`).
Each entry is tagged so a page only shows relevant ones: the homepage uses `all` (16
quotes), then `voice` (3), `world` (5), `record` (4) and `story` (6). It auto-advances
every 6 s, pauses on hover/focus, and has explicit prev / pause / next buttons.

- [ ] **Read through all 16.** They were assembled from the site's existing copy plus the
      verified 24ur interview. Several are English renderings of Slovenian originals and
      should be adjusted to read the way she actually said them.
- [ ] Two are credited to *Dnevnik, 2025* and remain unverified — see item 7.
- [ ] To add more: append to `QUOTES` and set `s` to the page sets it belongs to. Text
      may contain one `|`; everything after it renders in red.

---

## 9. Nice-to-have, post-launch

- [ ] **Slovenian version.** Her audience is substantially Slovenian — the press coverage,
      *Kolo sreče*, Val 202 are all domestic. A `/sl/` translation with `hreflang` tags is
      the highest-value content addition after photos. Deliberately not machine-translated
      here: it's her biography, and it should be in her own words.
- [ ] A "sing in your language" widget — pick a language, hear a 15-second clip. This is
      the one feature with genuine viral potential; it turns the 50-language claim into
      something a visitor can test.
- [ ] Newsletter capture, if anyone will actually send one.

---

## Note on the duplicated header and footer

There is no build step: seven HTML files each carry their own copy of the header and
footer. That's deliberate — it keeps the repo deployable to GitHub Pages with zero
tooling, and it's the fastest thing to hand-edit.

The cost is that a nav or footer change is a seven-file edit. `sed -i` across
`*.html` handles most of it. If the page count grows much past this, it's worth
introducing a small static generator.

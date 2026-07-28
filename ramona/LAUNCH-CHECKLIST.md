# Launch checklist — ramonairgolic site

Everything below is a placeholder that needs a real value before this goes to a mass
audience. The site works today; these are the things only Ramona (or a decision) can supply.

Items are ordered by how much they cost you if you skip them.

---

## 1. Domain — SUPERSEDED

This copy under `mkorosec.github.io/ramona/` has been split into a standalone repo for
**ramonairgolic.com**, which is now the canonical source. Once that is live, delete this
`ramona/` folder so the two cannot drift.

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

## 4. Social accounts — done, but confirm the TikTok

She uses the same handle everywhere: **`ramonairgolic`**.

- [x] Instagram — <https://www.instagram.com/ramonairgolic/> (~12k followers).
      Independently confirmed: it's the only social profile listed in the external-links
      section of her Slovenian Wikipedia draft.
- [x] TikTok — <https://www.tiktok.com/@ramonairgolic>
- [x] Footers on all seven pages, the "Follow" card on `contact.html`, and the `sameAs`
      array in the homepage JSON-LD

- [ ] **Confirm the TikTok URL is right.** It's the one link here I could not verify
      directly — TikTok serves nothing to a plain fetch, so the evidence is search
      indexing only: two independent searches returned this handle, one of them a video
      whose description reads *"Join my multilingual adventure… #Polyglot #Multilingual
      #ramonairgolic #tiktokslovenia"*, which is unmistakably her. The handle also matches
      every other platform. Very likely correct, but worth one click.

Also found, not linked — decide whether you want them:

| Platform | URL | Note |
|---|---|---|
| X / Twitter | `x.com/ramonairgolic` | Low value for this audience |
| Threads | `threads.com/@ramonairgolic` | Same |
| Ko-fi | `ko-fi.com/ramonairgolic` | A tip jar — may not fit the tone of a booking site |

And a **public email**, `ramonairgolic@gmail.com`, appears in her profiles. I deliberately
did **not** put it on the contact page: publishing a personal Gmail on a mass-audience
site guarantees scraper spam. If she wants a visible address, use a dedicated one
(`booking@ramonairgolic.com` via the domain) rather than her personal inbox.

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
| **HYPIA member "No. 420"** | Stated on `index.html` and `story.html` | The HYPIA member page is now linked from the Story page and Press page as the primary source, and it **confirms the 12 December 2024 join date and the full language inventory exactly**. It does **not** show a member number, so "No. 420" is still only her own account of it. Either source it or drop the number — the membership itself is now solidly evidenced without it. |

**Good news on the inventory.** HYPIA's own page lists the levels identically to the Story
page — ten fluent, eight proficient, nine basic, Chinese and Greek in progress. That claim
is now backed by a primary source rather than assertion, which is a real credibility gain
on the page most likely to be doubted.

Two label differences are noted on the Press page: HYPIA records "Serbo-Croatian" (shown
here as "Croatian / Serbian") and "Sudanese" (shown here as *Sundanese*). The second is
almost certainly an error in the original declaration — Sudanese is a nationality, while
Sundanese is the West Javanese language, which fits her years in Indonesia. Worth having
her correct it with HYPIA directly.

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

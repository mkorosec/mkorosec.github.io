/* ============================================================
   INSTAGRAM POST MANIFEST
   ------------------------------------------------------------
   Drives all four Instagram experiments (see FEATURE-FLAGS.md):

     ig-embed  needs `permalink` only            — official Instagram iframe
     ig-wall   needs `image`                     — photo grid + lightbox
     ig-local  needs `image`                     — captioned grid
     ig-strip  needs `image`                     — scrolling strip

   `owner` is load-bearing, not documentation. Re-hosting her own photographs is
   fine; re-hosting someone else's is not. The three self-hosted variants render
   only entries where `owner` matches `handle` below. ig-embed shows everything,
   because an embed is the sanctioned way to display another account's public post
   and it carries their attribution automatically.

   Images are fetched with tools/fetch-ig-images.js (it also skips anything she
   does not own). Instagram CDN URLs are signed and expire in ~4 days, so local
   copies are the only durable option.

   STILL WANTED: a one-line `alt` per photo describing what is in it. The current
   value is a neutral fallback — Instagram only exposes a generic "Instagram post
   shared by @ramonairgolic", which is no better for a screen reader.
   ============================================================ */
window.IG_POSTS = {
  // How many posts ig-embed renders. Each is a separate iframe pulling a few
  // hundred KB from Meta, so 5-12 is sensible. Anything beyond the cap is
  // reported on the page, never dropped silently.
  embedLimit: 12,

  handle: 'ramonairgolic',
  profile: 'https://www.instagram.com/ramonairgolic/',

  // Image numbering has gaps (ig-10, ig-23 were the two removed /reel/ entries).
  // That is fine: each entry names its own `image`, nothing is positional.
  posts: [
    {
      permalink: 'https://www.instagram.com/p/Daib_NTMcCS/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-1.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DbVB02RosHu/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-2.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DbDGiU2MBQ5/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-3.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DazfaoksFY9/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-4.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DaDS8dTMFl4/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-5.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DZaJszvIb2G/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-6.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DXGmFAfjBv1/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-7.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DVMmgz9DPBZ/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-8.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DTPx7R9jKRF/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-9.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CT2z3hfonoJ/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-11.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CIgOGqSs8fB/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-12.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DNJmYqIt-6H/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-13.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/DC7irapNyGq/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-14.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/C_DRybrtWfO/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-15.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/C1fTwxoNhaf/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-16.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/Cv7_3TMtqll/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-17.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CuRAp2RNV-4/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-18.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/Clbc9vcNq4d/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-19.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CZJsq3QtRrF/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-20.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CXTRxSOrSND/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-21.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CO0jeeHpUV5/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-22.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CLU4t-csxMD/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-24.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      permalink: 'https://www.instagram.com/p/CLJk_WHsAfN/',
      owner: 'ramonairgolic',
      image: 'assets/img/photos/ig-25.jpg',
      alt: 'Photo from Ramona Irgolič\u2019s Instagram',
    },
    {
      // Not her account — embed only, never re-hosted.
      permalink: 'https://www.instagram.com/p/DWqcOT5iHun/',
      owner: 'the_global_nomad_',
    }
  ]
};

# Portfolio design

Scope: portfolio at `/portfolio/`. The root `index.html` is intentionally empty. Existing application interfaces retain their own designs.

The portfolio uses the catalogue layout: a sticky desktop introduction and an alphabetical list of eight published projects, with equal previews beside factual descriptions. Work in progress appears below the published projects. The earlier Ramona design remains linked from its entry.

Neutral light background (#fafbf8), dark green-grey text (#27312d), restrained rust accents (#a4442e). Self-hosted Archivo from the existing Ramona assets. Open spacing, thin rules, no gradients or shadows. Project previews are lazy-loaded static images in assets/portfolio/; Visit Sabunike uses a photograph of the apartments, and HYROX Venues uses a graphic preview until a screenshot is available.

At 1100px the introduction and previews narrow. At 850px the introduction moves above the list. At 600px and below, compact screenshots sit beside the project titles, with descriptions below. Links have visible keyboard focus, and a skip link leads to the projects.

The geography quiz lives at `/map-games/`. Historical `/quiz/` category fragments redirect there, preserving the fragment. Portfolio navigation uses `#projects` and stays on `/portfolio/`. Travelogue links to its independently deployed GitHub Pages site.

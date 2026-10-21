# Portfolio design

Scope: portfolio at /portfolio/ only. Existing application interfaces retain their own designs.

The portfolio uses the catalogue layout: a sticky desktop introduction and an alphabetical list of seven published projects, with equal screenshot previews beside factual descriptions. Work in progress appears below the published projects. The earlier Ramona design remains linked from its entry.

Neutral light background (#fafbf8), dark green-grey text (#27312d), restrained rust accents (#a4442e). Self-hosted Archivo from the existing Ramona assets. Open spacing, thin rules, no gradients or shadows. Project previews are lazy-loaded static images in assets/portfolio/; Visit Sabunike uses a photograph of the apartments.

At 1100px the introduction and previews narrow. At 850px the introduction moves above the list. At 600px and below, compact screenshots sit beside the project titles, with descriptions below. Links have visible keyboard focus, and a skip link leads to the projects.

The geography quiz lives at the root URL and /quiz/. Historical quiz category fragments continue to work at both routes. Portfolio navigation uses #projects and stays on /portfolio/. Travelogue links to its independently deployed GitHub Pages site.

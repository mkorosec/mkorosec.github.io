# Portfolio design

Scope: portfolio at /portfolio/ only. Existing application interfaces retain their own designs.

Neutral light background (#f5f6f3), dark green-grey text (#252f31), restrained rust accents. Self-hosted Archivo from the existing Ramona assets. Open spacing, square artwork fields, thin rules, no gradients or shadows. Two unequal featured columns and compact project rows provide variety without repeating a card template.

The first viewport shows the portfolio purpose and two real projects. Quarter-circle linework references Book of Shapes' Quarter Arc Truchet; a wireframe globe expresses Travelogue. Geometry is authored SVG; no generated raster artwork. Only the featured drawings move slightly on hover, with reduced-motion support.

At 900px project rows omit the category label and tighten their spacing. At 600px and below, featured projects stack. Project rows retain small motifs and a direct open link. Links have visible keyboard focus. Every project has a factual description; the earlier Ramona design remains discoverable.

The geography quiz lives at the root URL and /quiz/. Historical quiz category fragments continue to work at both routes. Portfolio navigation uses #projects and stays on /portfolio/. Travelogue links to its independently deployed GitHub Pages site.

References: https://godobject.dev/blog/10-tells-of-slop and https://bookofshapes.com/patterns/concentric_arc_truchet_2

## Alternative layouts

`portfolio-designs/` contains three reviewable alternatives; none is selected for /portfolio/ yet. Each lists the same seven published projects alphabetically with equal treatment. Directory: neutral light canvas, a sticky desktop introduction, and text-led rows. Gallery: actual screenshots in equal 16:11 fields with adjacent factual copy; lazy-loaded static images avoid live iframe costs. Combined trial (`catalogue.html`): the directory’s sticky desktop introduction and single list, with equal screenshot previews beside each project description. On small phones, compact screenshots sit beside the titles, with descriptions below. A comparison bar links the variants and original. The comparison pages are marked noindex.

# Cáirde Corrin - website

The website of Cáirde Corrin, a voluntary community group caring for the Glenabo and
Corrin catchment above Fermoy, Co. Cork: the trail and its stops, the species and
folklore of the place, field recordings, the group's proposals, and its news.

It is a static site. The pages are hand-written HTML kept as templates, built by
Eleventy and hosted on Netlify. Committee members post news, gallery photos and the home
page's social posts through a small editor at `/admin/`; everything else changes only
through this repository.

**Start with `docs/README.md`**, which lists every document and who it is for. If you
are going to change anything, read `docs/CONTRIBUTING.md` first: it carries the rules
that keep the site trustworthy.

## Running it locally

    npm install
    npm run build                         # writes _site/
    python3 tools/serve.py _site 8080     # then open http://localhost:8080

Use `tools/serve.py` rather than `python3 -m http.server`: the map needs the data files
served over HTTP, and the home page film needs Range requests, which the built-in server
does not answer.

## Structure

    site/                   Everything that deploys, and nothing else
      index.njk             Home - the film, then a descent from 213 m to the river at about 21 m
      trails/index.njk      Interactive map, the walked loop and its profile, the ten stops
      stops/stop-1..10.njk  One page per stop. Three recorded, seven reserved
      species/index.njk     13 species with determinations and reference photographs
      folklore/index.njk    Five stories summarised and linked to dúchas.ie
      recordings/index.njk  Nineteen field recordings from 11 April 2026, and three films
      water/index.njk       Strand 3, invasive species
      new-spaces/           Strand 2, the four phases, and two proposal pages
      about/ links/ credits/ privacy/ terms/
      news/index.njk        The News listing, ten to a page
      gallery/index.njk     The Gallery page
      sitemap.njk           Writes sitemap.xml
      _content/news/        News posts, one Markdown file each, mostly written in the editor
      _content/gallery/     Gallery photos, one file each, written in the editor
      _data/social.json     The home page's social posts, written in the editor
      _includes/            Layouts, the shared navigation, and the build's helpers
      admin/                The editor (Decap CMS), served from this site at a pinned version
      _redirects            The QR sign addresses /s/1 to /s/10. Never change these
      _headers              How long browsers keep each kind of file
      assets/               CSS, JavaScript, map data, images, audio, video, fonts
      assets/uploads/       Photos as uploaded in the editor. Never published as they are

    docs/                   The documents; docs/README.md is the index
    tools/                  Helper scripts, listed in tools/README.md. Not part of the build
    archive/                Masters and source material, including the raw GPS track. Not deployed, not tracked

## The QR signs

Signs on the trail carry `cairdecorrin.ie/s/1` to `/s/10`. Those addresses are
permanent: `site/_redirects` maps them to wherever the stop pages are, so pages can move
without reprinting a sign. Never change the `/s/N` side of those lines.

## Brand

    Forest      #24451A
    Green       #487629
    Light green #6E9B4A
    Blue        #009ADE
    Light blue  #7FD4FF
    Navy        #08304F
    Deep navy   #041E33

Type: EB Garamond (display), Inter (body), IBM Plex Mono (data and labels). The name
always carries the fada: Cáirde Corrin.

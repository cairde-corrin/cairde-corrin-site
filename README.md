# Cáirde Corrin - website

The website of Cáirde Corrin, a voluntary community group caring for the Glenabo and
Corrin catchment above Fermoy, Co. Cork: the trail and its stops, the species and
folklore of the place, field recordings, the group's proposals, and its news.

It is a static site, built by Eleventy and hosted on Netlify. Committee members change
it through an editor at `/admin/`: every page apart from privacy and terms is a list of
blocks they can add to, reorder and change, and they post news, gallery photos, articles
and new walked routes there too. The survey data, the measured figures, the credits a
licence requires, privacy, terms and the code change only through this repository.

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
      index.njk             Home: the film, then the page's blocks in full-width bands
      trails/index.njk      Interactive map, the list of stops, the walked loop, uploaded routes
      stops/stop-1..10.njk  One frame per stop. Recorded once its page has content; reserved until then
      species/ folklore/ recordings/ water/   Built from their blocks, like every page below
      new-spaces/           Strand 2, and its two proposal pages
      about/ links/ credits/
      privacy/ terms/       Written in the template; not in the editor
      news/index.njk        The News listing, ten to a page
      gallery/index.njk     The Gallery page
      articles/index.njk    Articles about the group published elsewhere, each linking out
                            (News, Gallery and Articles appear in the navigation once each
                            has an entry: _includes/nav.js)
      sitemap.njk           Writes sitemap.xml
      robots.txt
      _content/news/        News posts, one Markdown file each, written in the editor
      _content/gallery/     Gallery photos, one file each, written in the editor
      _content/articles/    Articles, one file each, written in the editor
      _data/pages/          Every editable page, as its blocks (one JSON file per page)
      _data/social.json     The home page's social posts, written in the editor
      _data/figures.json    The measured values the figure check compares the pages with
      _data/credits.json    The credits a licence requires, bound to what they credit
      _data/instagram.js    Reads the Behold feed at build; _instagram/ keeps the saved posts
      _includes/            Layouts, the navigation, the block renderer and the build's helpers
                            and checks (listed in docs/DEVELOPER-GUIDE.md)
      admin/                The editor (Decap CMS) at a pinned version, its settings, and the
                            scripts that strip photos and GPS tracks and check pages on save
      _redirects            The QR sign addresses /s/1 to /s/10. Never change these
      _headers              How long browsers keep each kind of file
      assets/               CSS, JavaScript, map data, images, audio, video, fonts
      assets/data/layers.njk  Writes the map's stops and uploaded routes, layers.json
      assets/uploads/       Photos and GPS tracks as uploaded in the editor. Never published as they are

    .github/workflows/      The editor-content check, the weekly rebuild, and the build check
                            that opens an issue when a page stops the website updating
    docs/                   The documents; docs/README.md is the index
    tools/                  Helper scripts and checks, listed in tools/README.md. Not part of the build
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

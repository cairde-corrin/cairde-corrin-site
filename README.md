# Cáirde Corrin - website

## Note: the hero is a scrubbed video, and Firefox gets a poster

The home hero is `site/assets/video/hero-1920.mp4` (7.99 MB, H.264 1920x1080, GOP 6,
two-pass at the CRF 22 bitrate, shadows and midtones lifted), scrubbed by scroll position. It replaced a 41-frame
WebP sequence that weighed 6.95 MB and carried a third of the frames.

Measured on the shipping file, 90 seeks across the clip:

    Chrome 151    60.6 seeks/s    34.4 distinct frames presented/s
    Safari        60.3 seeks/s    59.7 distinct frames presented/s
    Firefox       60.9 seeks/s     0.0 distinct frames presented/s

Firefox accepts every seek and paints nothing. That held for a 256 px version, a
0.7 second version and a 920 kbps version, so it is not codec, container, GOP length
or seek method. `site/assets/js/site.js` therefore measures at runtime, with
`requestVideoFrameCallback`, whether the engine actually presents frames while
seeking, and falls back to the poster if it does not. There is no user-agent test
anywhere in the file.

**Known cost.** The probe cannot run until the clip is buffered, so Firefox
downloads the whole 7.99 MB and then displays the poster. Measured on a cold
profile: 8.29 MB transferred, of which 7.99 MB is a video it never shows. A
Firefox visit that skipped the film would be 0.30 MB. That is the reason the
encode is CRF 22 rather than 18: 18 cost 11.91 MB for 2.6 dB nobody sees at
this size, and Firefox paid all of it. Worth revisiting again.

## The site

Static site. No framework. The build, `npm run build`, is Eleventy: it copies every
hand-written file in `site/` to `_site/` byte for byte, and renders only the News
section and `sitemap.xml`. Netlify publishes `_site/`. `python3 tools/compare_build.py`
proves every copied file is identical.

## Before you edit

Read `docs/CONTRIBUTING.md`. It carries the rules that keep this site
trustworthy: a build that changes nothing, nothing invented, the sign addresses never change,
and everything borrowed is credited.

## Local preview

The map fetches `assets/data/cairde-corrin.geojson`, which browsers block on
`file://`, and the hero video needs HTTP Range requests, which `http.server` does
not answer. Build, then serve the output with the local server in `tools/`:

    npm run build && python3 tools/serve.py _site 8080

Then open http://localhost:8080

    python3 tools/linkcheck.py --external      # every link, internal and out

## Structure

    site/                   Everything that deploys, and nothing else
      _content/news/        News posts, one Markdown file each. Built, not copied
      _includes/            The News layouts. Built, not copied
      news/index.njk        The News listing, ten to a page
      sitemap.njk           Writes sitemap.xml, adding each news post
      index.html            Home - scrubbed film, then a descent from 213 m to the river at about 21 m
      trails/index.html     Interactive map and the ten stops
      stops/stop-1..10.html One page per stop. Three recorded, seven reserved
      species/index.html    13 species with determinations and reference photographs
      folklore/index.html   Five stories summarised and linked to duchas.ie
      new-spaces/index.html Strand 2, four phases
      water/index.html      Strand 3, invasive species
      recordings/index.html Nineteen field recordings from 11 April 2026
      about/index.html      Vision, mission, partners
      links/index.html      Related sites
      credits/index.html    Every source, licence and attribution
      privacy/ terms/       Drafts. Not reviewed by a solicitor.
      _redirects            QR sign addresses - /s/1 to /s/10. Never change these.
      _headers              Cache-Control
      assets/css/site.css   All styling
      assets/js/site.js     Nav, reveals, carousel, hero video scrubber
      assets/js/map.js      Vector map
      assets/data/          GeoJSON and GPX
      assets/img/           Photography, logo, terrain basemap, species/ reference set
      assets/audio/         Nineteen field recordings and the stop 1 clip
      assets/video/         hero-1920.mp4
      assets/fonts/         Five subsetted woff2 faces

    docs/                   CONTRIBUTING.md, DEPLOY.md and PROJECT-SUMMARY.md
    source-data/            Inputs the site is made from. Tracked, never published.
    archive/                Masters and source material. Not deployed, not tracked.
    tools/                  serve.py, linkcheck.py, cdp.mjs and friends. Not part of the build.

## Brand

    Forest      #24451A
    Green       #487629
    Light green #6E9B4A
    Blue        #009ADE
    Light blue  #7FD4FF
    Navy        #08304F
    Deep navy   #041E33

Type: EB Garamond (display), Inter (body), IBM Plex Mono (data and labels).
The name always carries the fada: Cáirde Corrin.

## The QR scheme

Signs carry `cairdecorrin.ie/s/1` through `/s/10`. Those addresses are permanent.
`_redirects` maps them to the current page locations, so pages can move or the site
can be rebuilt entirely without reprinting a sign. Never change the `/s/N` addresses.

## Data accuracy

The catchment in `assets/data/` is flow-routed on the Copernicus GLO-30 elevation model
to the Glenabo's Blackwater confluence (`python3 tools/catchment.py --write`), and is good
to about one 30 m cell. The action area and the channel network were recovered from the
group's map images by georeferencing and raster tracing, and are good to roughly
10-20 m. Stop positions are phone GPS, good to 10-20 m.

Adequate for web mapping, navigation and discussion. Not adequate for boundary
definition, planning submissions or anything with a legal consequence.

The modelled channel network in `cairde-corrin.geojson` is partial: finer tributaries on
the source map did not trace cleanly. It is clipped to the catchment boundary, and no
length is published for it.

`assets/data/` holds one GeoJSON and one GPX, `glenabo-loop.gpx`: the walked loop with the
three stops and the outlet as waypoints. It replaced `points.gpx`, whose address redirects to it. The four single-feature GeoJSON files that
duplicated the combined one were removed.

## Still outstanding

- GPX traces of the routes beyond the Glenabo loop. The loop itself was walked with a
  GPS on 29 August 2026 and is published on the trails page, cleaned by
  `python3 tools/trail.py` from the raw track in `source-data/`, which is never published.
- Stop positions 4 to 10
- Audio recordings and transcripts
- Committee names and roles on the About page

## Needs confirmation before publication

Nothing here is wrong as far as we know. Each is an attribution or a
determination that no source in this repository establishes, so each is
either unnamed on the site or carried as proposed.

- **The local authority** on the About page. The 4-Phase Proposal says
  "local authority-managed sections" and does not name one. Cork County
  Council is the local authority for Fermoy, but that is our inference, so
  the card reads "the local authority" until the group confirms it.
- **Photographer** for the 4 and 11 April 2026 sets. The archive folder
  names the photographer, who has not yet agreed to be credited by name. Not published until the group confirms.
- **Pl@ntNet contributor** who made the plant records. Not published until
  the group confirms.
- **Ten species identifications** in the home page carousel. The alt text
  describes form only and names no species, pending the group's
  determination.
- **Tormentil** is carried on the species page as a proposed
  determination.

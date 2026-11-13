# tools

Helpers for maintaining and checking the site. **None of these is part of the
build**: nothing here has to run for the site to work, and nothing here is deployed. They exist so that anyone can repeat the
checks rather than take the published numbers on trust.

Everything is Python 3 with Pillow (plus numpy for the elevation and map tools), or Node
with no dependencies at all. `render_maps.py` also drives the installed Google Chrome.

| file | what it does |
|---|---|
| `serve.py` | Local server that mimics Netlify: gzip for text types, `Cache-Control` from the served folder's `_headers`, and **HTTP Range** so media can seek. `python3 tools/serve.py _site 8080` |
| `cdp.mjs` | Zero-dependency Chrome DevTools Protocol driver. Used to measure video scrubbing, check contrast, screenshot breakpoints and catch console errors. |
| `linkcheck.py` | Walks every page and reports dead internal links, missing assets and unreachable external URLs. `--reveal` also measures the scroll-reveal blocks and flags any taller than eight viewports. |
| `commons_fetch.py` | Finds a licensed Wikimedia Commons photograph per binomial, records photographer, licence and file page, and writes the local copies. |
| `photos_exif.py` | Reads GPS, elevation and timestamp out of the photograph archive and reports which frames fall inside the catchment. |
| `fetch_dem.py` | Downloads the Copernicus GLO-30 surface model and the FABDEM V1-2 bare-earth model covering the catchment, and the EGM2008 and OSGM15 geoid grids, into `~/.cache/cairde-corrin-dem`. FABDEM is read out of its 949 MB zip with range requests, one tile only. Raster data never enters the repository. Sources, resolution, datums and licences are in its docstring. |
| `dem_report.py` | Compares the stop elevations, the raw GPX in `archive/source-data/` and the catchment range against both models in Malin Head OD, measures canopy inflation, reproduces the AWS Terrain Tiles range the original catchment map used, reads the nearest OPW gauge, and, given the photograph folders, re-derives every recording elevation printed on the site from its source photograph. Read-only. `python3 tools/dem_report.py [photo folder ...]` |
| `catchment.py` | Delineates the Glenabo catchment by flow routing (Priority-Flood fill, D8, accumulation) on Copernicus and on FABDEM, tests sensitivity to the pour point, and compares the result with the published geometry. `python3 tools/catchment.py --write` regenerates the catchment in `site/assets/data/cairde-corrin.geojson` from the Copernicus routing only, with its area, elevation range, flow path, outlet and stop figures; FABDEM is a cross-check and nothing derived from it is written. An optional `outdir` gets the routed boundaries and a comparison image. |
| `render_maps.py` | Renders the two static maps on the home page, `map-catchment` and `map-action`, from the shipped data file, Copernicus relief and OpenStreetMap, by laying each out as a page and photographing it in headless Chrome at the size the site reserves. Figures in the maps are read from the data file. `python3 tools/render_maps.py` |
| `trail.py` | Publishes the walked Glenabo loop from the raw track in `archive/source-data/`: removes the stretches walked twice, simplifies only below half a pixel at the map's maximum zoom, drops timestamps, and writes the map layer into the GeoJSON, `glenabo-loop.gpx`, and the profile section of the trails page (`site/_includes/walked-loop.html`, shown by the trails page's "walked loop" block). `python3 tools/trail.py` |
| `compare_build.py` | Proves the build changed no copied file: compares every git-tracked file in `site/` (template sources excepted) with `_site/` by SHA-256 and byte by byte, fails on any difference, missing file or leaked template source, lists the generated pages, and prints the `_redirects` and `_headers` hashes side by side. `npm run build && python3 tools/compare_build.py` |
| `vendor_cms.sh` | Rebuilds `site/admin/vendor/` from npm at the pinned Decap CMS and Netlify Identity widget versions, after checking each tarball's SHA-256. The news editor then loads nothing from a CDN. `tools/vendor_cms.sh` |
| `selftest.js` | Checks the code that parses what an editor types or what a page contains: YouTube addresses, social post addresses, the navigation, the figure consistency check, the check that stops any generated page loading something from another website, and the editor's removal of EXIF, XMP and comments from photos before upload. No network, no build needed. `node tools/selftest.js` |
| `ldcheck.py` | Validates the structured data on every built page against the schema.org vocabulary: every type and property exists, each property is allowed on its type, nested types are accepted, and every `@id` reference is defined somewhere on the site. Downloads the vocabulary once into `.cache/`. `npm run build && python3 tools/ldcheck.py` |
| `diagram.py` | Draws `docs/how-it-works.svg`, the flow diagram in the developer guide, from the node and arrow lists in the script. `python3 tools/diagram.py` |

## Why the reveal height matters

`site.js` fades content in with an IntersectionObserver. Its `threshold` is a fraction
of the **target element's own area**, not of the viewport, so a block much taller than
the window can never reach a non-zero threshold however far you scroll, and would sit
at `opacity: 0` for good. The threshold is `0` today, which is safe at any height, but
`linkcheck.py --reveal` flags anything over eight viewports so a future edit cannot
reintroduce the problem quietly. It costs a local server and a headless Chrome, so it
is opt-in rather than part of the default run.

## Why serve.py rather than `python3 -m http.server`

The built-in server does not answer Range requests. Without them Chrome reports
`seekable: [[0,0]]` and silently ignores `currentTime`, so the scroll-driven hero
appears broken locally while working perfectly in production. `serve.py` also
reads `site/_headers`, so cache behaviour matches the live site.

# How the website works

For a developer taking the site over, or anyone who needs to understand it before changing
it. The rules for changing it are in `CONTRIBUTING.md`; the routine is `MAINTENANCE.md`.

![How the Cáirde Corrin website works: editors write in Decap and save through Git Gateway
to GitHub; publishing merges into main; Netlify builds the site with Eleventy and serves
it.](how-it-works.svg)

The diagram is drawn by `tools/diagram.py`; edit the node and arrow lists there and run
it, rather than editing the SVG.

## In one paragraph

A static site. The pages are hand-written HTML kept as Nunjucks templates in `site/`.
Eleventy builds them into `_site/` on Netlify, adding the shared navigation, the page text
and figures, the structured data and the security policy, re-encoding photos, and copying
every other file unchanged. Committee members change content through Decap CMS at
`/admin/`; they log in with Netlify Identity, and Netlify Git Gateway commits their changes
to GitHub as pull requests, which a check confines to content files. Publishing merges a
pull request into `main`, and Netlify rebuilds production. Developers work on `build`,
check it on the branch preview, and release by pull request. Visitors' browsers load
nothing from any other site until they press play on a video.

## The repository

    site/            everything that deploys (index: README.md, "Structure")
    site/_includes/  the build's code: layouts, nav, helpers (listed below)
    site/_data/      figures.json (measured values), credits.json (licence credits),
                     pages/ (every editable page, as blocks), social.json
    site/_content/   news, gallery and articles, one Markdown file each
    site/_instagram/ the saved Instagram posts and their re-encoded pictures
    site/admin/      the editor: index.html, config.yml, photos.js, tracks.js, checks.js,
                     editor.js, help.njk, site-photos.njk
    .github/         the editor-content-only check, the weekly rebuild and the build check
    docs/            the documents (index: docs/README.md)
    tools/           checks and generators (index: tools/README.md); none run in the build

## The build

`npm run build` runs Eleventy with `.eleventy.js`. In order:

1. **Copy.** Every file in `site/` that is not a template source is copied to `_site/`
   byte for byte (`addPassthroughCopy` with a filter). `tools/compare_build.py` proves it.
2. **Data.** `site/_data/figures.json` becomes `figures`, `site/_data/pages/*.json`
   becomes `pages`, `social.json` becomes `social`, and `instagram.js` reads the Behold
   feed into `instagram` (`_includes/instagram.js`; falls back to `site/_instagram/`).
   Collections: `news`, `gallery`, `articles`.
3. **Render.** Every `.njk` page renders. A global permalink keeps each page at the
   address it had as a hand-written file (`stops/stop-1.njk` to `stops/stop-1.html`).
   An editable page's `.njk` is a frame: its head, scripts and footer, with the title and
   summary from the page's "About this page" fields, the structured data from the
   `pageLd` filter (`_includes/ld.js`) and the main content from the `blocks` filter
   (`_includes/blocks.js`), both reading `site/_data/pages/<key>.json`. A broken or
   incomplete block throws, naming the page and block, so the build fails and the live
   site keeps its previous version (`CONTRIBUTING.md`, "Pages built from blocks").
   `_includes/nav.njk` and `footnav.njk` draw the navigation from `_includes/nav.js`.
4. **Transforms**, on every generated HTML page, in this order:
   - `uploads` (`_includes/images.js`): rewrites any `/assets/uploads/` image to its
     re-encoded sizes, and stops the build if a page would load anything from another site;
   - `ld` (`_includes/ld-pages.js`): adds a WebPage node, and builds the species and
     folklore lists from the pages' own markup;
   - `comments`: removes HTML comments from visitors' copies;
   - `csp` (`_includes/csp.js`): adds the Content Security Policy, allowing only the two
     known inline scripts by hash, and stops the build on any other;
   - `figures`: keeps a copy of each finished page for the figure consistency check
     (`_includes/figurecheck.js`), which runs once the build is done and prints a
     `[figures]` warning when two pages give the same figure differently. It never
     stops a build (`CONTRIBUTING.md`, "Where the figures live").

Filters worth knowing: `blocks` and `pageLd` (the editable pages), `prose` (one piece of
editor text, `_includes/prose.js`), `editLink`, `navItems`, `domain`, `socialPosts`,
`guide` (the editor's Help page).

## The content pipeline

| Content | Where it lives | Who changes it | How it reaches the page |
|---|---|---|---|
| Measured values | `site/_data/figures.json` | developers only | the trails map key and the trails structured data read `figures.*`; the figure check compares the pages with it |
| Every editable page | `site/_data/pages/*.json` | editors (Pages) | `{{ pages \| blocks("key", ...) }}` and `pageLd`; figures are plain words |
| Licence credits | `site/_data/credits.json` | developers only | beneath each credited photo, and on the credits page whenever what they credit is in use |
| The walked loop section | `site/_includes/walked-loop.html` | `tools/trail.py` only | the trails page's "walked loop" block |
| News posts | `site/_content/news/*.md` | editors (News) | `_includes/post.njk`, `/news/` |
| Gallery photos | `site/_content/gallery/*.md` | editors (Gallery) | `/gallery/` |
| Articles | `site/_content/articles/*.md` | editors (Articles) | `/articles/` |
| Social posts | `site/_data/social.json` | editors (Home page) | home page cards, `_includes/social.js`, when there is no Instagram feed |
| Instagram posts | Behold, saved in `site/_instagram/` | the group, on Instagram | home page carousel, `_includes/instagram.js` |
| Uploaded routes | a GPX file in `site/assets/uploads/` | editors (Trails, Walked route) | stripped in the browser (`site/admin/tracks.js`), cleaned at build (`_includes/gpx.js`); `/assets/data/routes/`, `/assets/data/layers.json` |
| Privacy, terms | the `.njk` page itself | developers only | as written |

An entry with `hidden: true` (the editor's "Take this off the website" tick) is added to
Eleventy's ignore list in `.eleventy.js`, so it produces no page, no list entry and no
encoded photos. Markdown is rendered with raw HTML off, everywhere. The trails page's walked-loop section,
its elevation profile and the GPX are generated by `tools/trail.py`; the home page maps by
`tools/render_maps.py`; the map data by `tools/catchment.py`.

## The image pipeline

1. **In the editor's browser** (`site/admin/photos.js`): a chosen photo is drawn onto a
   canvas, scaled to at most 2000 px, re-encoded as WebP (JPEG in Safari) and stripped of
   any metadata, then handed to Decap in place of the original. HEIC is converted where the
   browser can read it. Dropped and pasted photos are refused.
2. **Decap uploads** that copy to `site/assets/uploads/` with the post.
3. **At build** (`_includes/images.js`): each referenced upload is re-encoded with
   eleventy-img into WebP at 700, 1100 and 1800 px plus a 1200 px JPEG for sharing, under
   `/assets/img/news/`. Uploads themselves are never copied to `_site/`.

Video stills (`_includes/youtube.js`): a post's YouTube still is read from
`site/assets/img/video/` if committed, otherwise fetched from YouTube during the build and
written there. The page shows the still and a play button; `site.js` swaps in a
`youtube-nocookie.com` player only on click.

## The editor

- **Decap CMS 3.17.3**, served from `site/admin/vendor/` (pinned by `tools/vendor_cms.sh`).
  Settings: `site/admin/config.yml` (collections, fields, hints, the editorial workflow).
- **Netlify Identity** logs editors in (invite only). The widget is served from the same
  folder. Netlify's default emails link to the site root; the inline script at the top of
  `site/index.njk` forwards their tokens to `/admin/`.
- **Netlify Git Gateway** turns each save into a commit on a `cms/...` branch and a pull
  request; Publish merges it into `main`. It acts with a GitHub token (`SECURITY.md`).
- **`.github/workflows/editor-content-only.yml`** fails any editor pull request that
  touches anything but content files. With branch protection on `main` (`SECURITY.md`),
  that is what keeps an editor's session away from the build.
- `site/admin/index.html` loads `photos.js` and `editor.js` (Help button, hidden URL
  buttons) before Decap, and carries the editor's own Content Security Policy.
- "Edit this page" links on the public pages come from the `editLink` filter and appear
  only when `gotrue.user` is in the browser's storage.

## Deploying

Netlify builds from GitHub using `netlify.toml` (`npm run build`, publish `_site`, Node
24.13.0). `main` deploys production at `cairde-corrin.netlify.app`; `build` deploys the
branch preview at `build--cairde-corrin.netlify.app`; every pull request, including editor
drafts, gets a deploy preview. Details and checks: `DEPLOY.md`. The domain: `DOMAIN-SETUP.md`.

## Every integration, and where it is configured

| Service | What it does | Configured in |
|---|---|---|
| GitHub, `cairde-corrin/cairde-corrin-site` | the repository; branch protection; the Actions check | GitHub settings; `.github/workflows/` |
| Netlify hosting and builds | builds and serves the site and previews | Netlify project; `netlify.toml`; `site/_headers`, `site/_redirects` |
| Netlify Identity | editor logins | Netlify: Identity |
| Netlify Git Gateway | editor saves to GitHub | Netlify: Identity -> Services; `config.yml` `backend` |
| Decap CMS | the editor | `site/admin/config.yml`; `tools/vendor_cms.sh` |
| YouTube | video stills at build, the player after a click | `_includes/youtube.js`; `site/assets/js/site.js` |
| Behold | the group's Instagram posts, read at build | `FEED_ID` in `_includes/instagram.js`; Behold account |
| GitHub Actions schedule | rebuilds the live site weekly through a Netlify build hook | `.github/workflows/weekly-rebuild.yml`; secret `NETLIFY_BUILD_HOOK` |
| GitHub Actions build check | runs the build on every push to main and opens an issue when a page's content stops it | `.github/workflows/build-check.yml`; label `website-not-updated`; the run's own token |
| npm | Eleventy and eleventy-img at build | `package.json`, `package-lock.json` |
| Letshost | the domain, its DNS and its email | Letshost; `DOMAIN-SETUP.md` |
| schema.org | vocabulary for `tools/ldcheck.py`, downloaded once | `tools/ldcheck.py` |
| Copernicus, OpenStreetMap | elevation and base data for the tools | `tools/fetch_dem.py`, `tools/render_maps.py` |

There are no analytics, no forms, no server functions and no environment variables. The
one secret, the build hook address, lives in GitHub, not in the build.

## Checking a change

`DEPLOY.md`, "Checks before you deploy": the byte comparison, the link check, the
structured-data validator and the self-test. After any change to a layout, an include or
`.eleventy.js`, also diff the built pages against the previous build.

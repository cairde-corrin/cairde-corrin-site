# Contributing to cairdecorrin.ie

For anyone changing the site itself: its pages, figures, media or code. Committee
members posting news need `EDITOR-GUIDE.md` instead. Read the hard rules before changing
anything; the rest is reference.

## Repository layout

    site/         everything that deploys, and nothing else. Netlify publishes this.
    docs/         every document; docs/README.md is the index
    source-data/  inputs that the site is made from. Tracked, never published.
    archive/      masters and source material. Not deployed, not tracked.
    tools/        helper scripts. Not part of the build; nothing here has to run.

`source-data/` holds raw inputs, such as route exports, that are processed into files
under `site/`. Nothing in it is ever published directly: Netlify publishes only
`site/`, and nothing on the site links into `source-data/`. To publish something
derived from it, write the processed result into `site/` and commit both.

## What this is

A static website for a voluntary community group in Fermoy, Co. Cork, working on
the Glenabo and Corrin woodlands. Hand-written HTML, CSS and JavaScript, no framework.
The pages are Nunjucks templates that Eleventy renders, adding the shared header and
footer and the structured data; every other file is copied unchanged. News, gallery
photos and the home page's social posts can also be written in the editor at `/admin/`,
which commits them to `main`.

## Hard rules

- **The build copies files and renders pages.** `npm run build` runs Eleventy, which
  copies every asset in `site/` (images, audio, video, fonts, CSS, JavaScript, data,
  `_redirects`, `_headers`, the editor) to `_site/` byte for byte, and renders every page
  from a `.njk` or `.md` source. Netlify publishes `_site/`. Do not add plugins, a bundler,
  Tailwind or React without a decision to do so. After any change to the build,
  `npm run build && python3 tools/compare_build.py` must report no differences in the
  copied files.
- **The byte-for-byte guarantee covers the copied files, not the pages.** The 23
  hand-written pages (trails, the ten stops, species, folklore, recordings, water, new
  spaces and its two proposals, about, links, credits, privacy, terms) used to be copied
  exactly as written, so `compare_build.py` proved the build could not alter them. Like
  the home page, they are now templates, so that the header and footer come from one place
  (`_includes/nav.js`). Each page is still written out as it is in the repository apart
  from what the build adds: the header and footer, a second structured-data block
  (`_includes/ld-pages.js`) and the checks in `_includes/images.js`. But
  `compare_build.py` now lists them as generated rather than proving them unchanged, and
  **a change to a layout, an include or `.eleventy.js` reaches every page at once**,
  including the pages that carry the verified figures below (areas, heights, distances,
  coordinates, species determinations). After such a change, diff the built pages against
  the previous build and read every difference; a figure must never change as a side
  effect of a template edit.
- **Hyphens, never em or en dashes** as sentence punctuation. Use `-` throughout, in
  prose, in ranges and in data files.
- **The name is Cáirde Corrin**, always with the fada on the á.
- **Invent nothing.** Every figure, coordinate, area and species claim must trace to a
  source in this repository or to something the group supplied. Where a fact is not
  available, write "to be surveyed" or leave the section out. Do not fill a gap with
  something that merely sounds right. Accuracy is the point of this site: it exists to
  be read by a landowner and by people who know the ground.
- **Never change the `/s/N` addresses in `site/_redirects`.** They are reserved for
  interpretation signage in development, and once a sign is printed its address can
  never change. What a redirect points *at* may change freely.
- **Cite what is not ours.** Photographs from Wikimedia Commons carry the
  photographer and licence beneath them; that is a licence condition, not a courtesy.
  Folklore from dúchas.ie is summarised and linked, never reproduced.
- **No named living person, and no photograph of an identifiable person, without
  consent.**
- Keep `prefers-reduced-motion` respected and keyboard focus visible.
- Stop pages must stay light. They are read in a forest on a weak connection.

## Verified data - safe to cite

    Catchment area          about 3.6 km² (about 360 ha)          note 1
    Elevation range         21-213 m OD                           note 2
    Longest flow path       about 4 km                            note 3
    Outlet                  52.1333°N 8.3002°W, about 21 m OD, Munster Blackwater (HA 18)
    Proposed action area    9.9 km² (about 990 ha)                note 4
    Proposed loop route     up to 15 km
    Glenabo extension       ~600 m
    Stop 1 stream           52.12752°N 8.29878°W, about 60 m, bearing 159°, 11 Apr 2026 07:10
    Stop 2 plantation       52.12240°N 8.30604°W, about 110 m, bearing 292°, 11 Apr 2026 08:48
    Stop 3 mossy stand      52.12344°N 8.30538°W, about 105 m, bearing 106°, 11 Apr 2026 08:54

Times are Irish summer time (UTC+1), as the cameras recorded them.

1. The catchment in `site/assets/data/cairde-corrin.geojson` is the watershed of the
   Glenabo at its Blackwater confluence, flow-routed on Copernicus GLO-30
   (`python3 tools/catchment.py --write`). It measures 3.58 km², published as about
   3.6 km² and about 360 ha so that every figure adds up against the map. It is good to
   about one 30 m cell all round, roughly ±20 ha. For comparison only: c. 3.7 km²
   (Roughan & O'Donovan, Phase 1, January 2021), c. 3.92 km² (Phase 2, April 2022) and
   3.75 km² (flow routing on FABDEM V1-2, used as a check; FABDEM is CC BY-NC-SA, so
   nothing derived from it is shipped). Never quote 3.30 km² or 330 ha: that came from a
   traced map image whose boundary left out 0.36 km² in the south-east.
2. The low end is the river at the confluence, from OPW gauge 18124 Fermoy U/S Rowing,
   1.4 km downstream: gauge zero 21.187 m above Malin Head OD (OSGM15), levels
   20.6-22.1 m in October-November 2026. Model heights on open water are unreliable, so
   no model minimum is used. The high end is the highest Copernicus cell inside the
   boundary. Copernicus is a surface model accurate to about 4 m, and that cell is
   wooded: the bare-earth check puts the ground there about 9 m lower, and the highest
   bare ground inside the boundary at 208 m.
3. Measured cell to cell (D8) as 4.3 km, which overstates true length by up to about 8%.
4. A drawn proposal: the catchment with Glenabo Wood, Corrin Hill and Knockananig
   Reservoir added. Traced from the group's map and accurate to 10-20 m; the outline
   measures 9.86 km². Not re-derived.
5. Stop and photograph elevations come from the walk's own GPX (`source-data/`) and
   Copernicus, rounded to 5 m; they agree within 4-8 m at each stop. No elevation on the
   site is finer than 5 m, and every one carries "about". Never use photograph EXIF
   altitudes as they stand: the Pixel 8a used on 11 April records height above the
   ellipsoid, about 57 m above sea level here, so its photographs came down by about
   that much.
6. **One photograph elevation went up, not down, and is correct.** The 4 April image in
   the home page carousel (boulder-stream, 07:56) was taken on an iPhone 15 Pro Max,
   which records height above sea level, not above the ellipsoid. Its 125 m was never
   57 m out; it became about 130 m only to put it on the same source as every other
   figure (Copernicus reads 131.7 m there). Do not "correct" it back down.
7. Stop 2 is a few metres higher than Stop 3. Estimates of the difference run from 1 to
   6 m depending on the source, so the site gives no figure.
8. The walked loop is about 2.3 km with about 65 m of climbing, walked with a GPS on
   29 August 2026 and published by `python3 tools/trail.py` (map layer, profile, GPX).
   Its profile uses the track's own elevations, never photograph EXIF. The raw track in
   `source-data/` keeps its timestamps and is never published. Those timestamps carry a
   Z, which GPX defines as UTC, so the walk ran 07:59-09:08 Irish summer time; nothing
   else recorded that morning can confirm the clock, so publish the date only.
9. The channel network length and segment count are withdrawn. The drawn network is
   modelled, not walked, partial, and clipped to the catchment boundary. Publish no
   figure for it.
10. Positional accuracy: the catchment boundary is good to about one 30 m cell; the
   action area is traced and good to 10-20 m; stop and photograph positions are phone
   GPS, good to 10-20 m.

## Adding media

**Images.** Resize to 1800 / 1100 / 700 px wide WebP, quality 58-64, into
`site/assets/img/`. Name them `<subject>-<width>.webp`. Always give `width`, `height`,
`loading="lazy"` and real alt text describing what is in the frame.

    # batch resize a folder of photographs
    python3 -c "
    from PIL import Image, ImageOps; import glob, os
    for p in glob.glob('incoming/*.jpg'):
        im=ImageOps.exif_transpose(Image.open(p)); n=os.path.splitext(os.path.basename(p))[0]
        for w in (1800,1100,700):
            r=im.copy(); r.thumbnail((w,w*3),Image.LANCZOS)
            r.save(f'site/assets/img/{n}-{w}.webp','WEBP',quality=60,method=6)
    "

    # read GPS and elevation out of photograph EXIF. This is how stops 1-3 were placed.
    python3 tools/photos_exif.py /path/to/photos

Give an edited photograph a **new file name**. Images are cached for a year, so
overwriting one shows the old picture to anyone who has visited since.
The same goes for the two home page maps: `tools/render_maps.py` writes them under an
`EDITION` in the name; bump it on every redraw and update `site/index.njk`.

`site/assets/js/map.js` and `site/assets/data/cairde-corrin.geojson` change together, so
they are versioned together: bump `DATA_V` in `map.js` and the `?v=` on its script tag in
`site/trails/index.njk` whenever either changes. Without it a returning visitor can get
a new script with a day-old data file, or the reverse, and a new layer silently fails to
appear.

**Audio.** Mono, 64 kbps, MP3, into `site/assets/audio/`. Every clip needs a written
transcript inside the `<details class="transcript">` block on that stop page. This is
not optional: it covers deaf visitors and anyone with no signal.

**Hero film.** The home hero is a video scrubbed by scroll position, not a frame
sequence. Encode from the 4K master at 1920x1080, H.264, GOP 6. x264 cannot do CRF and
two-pass together, so find the CRF 22 bitrate first, then run two-pass at that target:

    G="curves=all='0/0 0.25/0.33 0.5/0.56 0.75/0.78 1/1'"   # lifts shadows and
                                                           # midtones, pins white
    F="-vf scale=1920:1080:flags=lanczos,$G -c:v libx264 -preset slower -g 6 \
       -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -an"
    ffmpeg -i archive/video/glenabo-hero.mp4 $F -crf 22 /tmp/probe.mp4
    BR=$(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 /tmp/probe.mp4)
    ffmpeg -i archive/video/glenabo-hero.mp4 $F -b:v $BR -pass 1 -f mp4 /dev/null
    ffmpeg -i archive/video/glenabo-hero.mp4 $F -b:v $BR -pass 2 -movflags +faststart \
      site/assets/video/hero-1920.mp4

The curve is a grade, not an invention: the morning was overcast and must still look
it. The curve ends at 1/1 so white cannot clip, and no saturation is added.

Short GOPs are what make it seekable. Do not raise the GOP length to save bytes; the
file stops being scrubbable and the hero silently falls back to a still.

`site/assets/js/site.js` measures at runtime whether the browser can actually scrub the
clip and falls back to the poster if it cannot, so the poster must always be current: it
is frame 1 of the clip, at `site/assets/img/hero-poster-{700,1100,1920}.{webp,avif}`.
AVIF is written by Pillow at quality 45, roughly equivalent to avifenc q58.

## Adding a news post

Most posts should be written in the editor at `/admin/` (`EDITOR-GUIDE.md`; how it is
wired up is in `DEPLOY.md`). It writes exactly the file described here and commits it to
`main`.
Writing the file by hand on `build` works too, and is the route for anything the editor
cannot do, such as the `-700` / `-1100` photo variants.

One Markdown file in `site/_content/news/`, named `YYYY-MM-DD-short-slug.md`. The
slug, without the date, becomes the address: `/news/short-slug/`. The front matter:

    title:    the headline
    date:     2026-11-11              the real publication date; it drives the order,
                                      the sitemap and the Article structured data
    author:   a name, or Cáirde Corrin
    summary:  one or two sentences for the listing and the page description
    hero:     optional: src, alt, width, height, and srcset for the -700 and -1100
              variants, so phones download the small one. width and height may be
              left out; the page then omits them rather than writing empty ones
    updated:  optional date of a significant later change, for dateModified
    gallery:  optional list of src, alt, width, height, caption
    youtube:  optional YouTube address or 11-character video ID, for the group's own
              videos only; shown as a click-to-load player (see below)

**Uploaded photos.** Photos uploaded through the news editor go to
`site/assets/uploads/` exactly as the editor's phone produced them, with the phone's
EXIF block, which holds the GPS position where the photo was taken, the time and the
phone model. They are never published as uploaded. At build time,
`site/_includes/images.js` re-encodes each one referenced by a post into WebP at 700,
1100 and 1800 px wide, with width and height, plus a 1200 px JPEG for social previews,
all under `/assets/img/news/`. Re-encoding drops the EXIF and XMP blocks, GPS
included; the colour profile is the only block kept. This covers the hero and gallery
fields and photos placed in the body of a post with the Image button: a build step
rewrites every `<img>` or link that points at `/assets/uploads/` in a generated page to the
processed copies. `assets/uploads/` is excluded from the copy, and
`tools/compare_build.py` fails if an original ever reaches `_site/`. This is a privacy
fix first: do not publish anything from `assets/uploads/` directly.

The build stops, naming the post or page, rather than publish a page that would be
broken or would break the site's promises: a reference to an upload that it cannot
rewrite, a photo it cannot read, or anything the browser would load from another
website by itself (an image, srcset entry, video poster, frame, script, embedded object,
stylesheet or preload link, or a CSS `url()`). This check runs on every generated page:
News, the gallery and the home page. The hand-written pages are copied without it.
`node tools/selftest.js` exercises it. On
Netlify a failed build leaves the previous deploy live, so the site never breaks; the
new post simply does not appear until the cause is fixed.

**iPhone photos and HEIC.** iPhones store photos as HEIC, which the build cannot read
(the prebuilt image library has no HEVC decoder). What Safari on an iPhone hands the
editor depends on how the photo is picked, according to WebKit's source
(`WKFileUploadPanel.mm` and the `PhotoPickerPrefersOriginalImageFormat` preference,
default off): **Photo Library** and **Take Photo** give a JPEG; **Choose File**, which
opens the Files app, gives the original HEIC. The editor page refuses a HEIC before it
is uploaded and tells the editor to pick it from Photo Library instead. This was read
from WebKit's code, not tried on an iPhone.

**The originals are still kept.** They enter the repository at full size, 2 to 13 MB
each from a phone, GPS and all, so the repository grows with every photo and keeps every
location in its history. **The repository is public**, so those locations would be
readable there even though the website never shows them. No photo has been uploaded yet;
whether to make the repository private, or to shrink and strip photos in the browser
before upload (not built), is the first decision in `OPEN-ITEMS.md`.

Each photo field in the news editor refuses files over 20 MB, as a backstop against
videos and very large files; ordinary phone photos (2.4 to 12.5 MB on the phone used
for the trail photographs) pass. The top-bar **Media** button, which uploaded straight
to `main` with no size check and no draft, is hidden on the editor page, and so are the
"Insert from URL" buttons of the body's Image button. Editor commits bypass the local
25 MB pre-commit hook.

Everything below the front matter is the body, in Markdown. Images follow the media
rules above: WebP at 1800 / 1100 / 700 px, a new file name for an edited picture, and
real alt text. The usual rules apply in full: invent nothing, name no living person
without consent, hyphens never dashes.

`sample: true` marks a placeholder for checking a layout on the branch preview. It adds
a notice and `noindex` to the post and keeps it out of the sitemap, but the post is
still listed on `/news/`, so a sample post must never be merged to `main`. The news
editor does not offer the field: editors practise with drafts, whose deploy previews
never reach production.

**Videos.** The `youtube` field takes the address of a video on the group's own
YouTube channel, in any of its usual forms, or the bare ID; anything else stops the
build. Use it only for videos the group made. The post shows a still with a play button,
served from this site, so nothing is requested from YouTube or Google when the page
loads. Pressing play makes `site.js` swap in a `youtube-nocookie.com` player;
`site/privacy/` describes what happens then.

The stills are kept in the repository, in `site/assets/img/video/` as
`<id>-<width>x<height>.webp`, so a normal build never contacts YouTube. When a post names
a video whose still is not there yet, the build (`site/_includes/youtube.js`) fetches it
once, writes it into that folder and says so in the build log. A video post therefore
works as soon as it is published, with nothing for anyone to do. Until the still is
committed, Netlify fetches it again on each build; committing it (`git switch build &&
git merge main && npm run build`, then commit `site/assets/img/video/`) is optional
tidying that takes YouTube out of the build altogether. If YouTube cannot be reached, or
the address is wrong or the video private, the build does not stop: the post shows the
play button on a plain panel, the build log names the video, and the still appears by
itself on a later build.

With no posts, `/news/` still exists and says so ("Nothing posted yet"), because the
listing sets `generatePageOnEmptyData`. Without that, an empty collection writes no
`/news/` page at all and the News link on every page 404s.

## The gallery and the home page's social posts

Both are edited in the news editor and committed to `main` like news posts.

**Gallery.** One Markdown file per photo in `site/_content/gallery/`, front matter only:

    image:    /assets/uploads/... - must be an upload; the build stops otherwise
    alt:      what is in the photo, for screen readers
    caption:  the line shown under the photo
    taken:    optional date the photo was taken, YYYY-MM-DD

The photo goes through exactly the same re-encoding as a news photo: WebP at 700, 1100
and 1800 px, no EXIF, XMP or GPS, original never published. `/gallery/` shows dated
photos newest first, then undated ones, newest added first, as cards with the hover zoom
the rest of the site uses. The entries make no pages of their own. With no photos the
page says so, and the navigation, the home page and the sitemap leave it out. Once it
has a photo, Gallery appears under Explore in the header, in the footer, and as a link
from the home page's photo section.

**Social posts.** `site/_data/social.json` holds up to three Instagram or Facebook post
addresses, each with a caption the editor types. The home page shows them as cards
linking out, in a section that only exists when the list is not empty. Nothing is
embedded and nothing is fetched from Meta, at build time or in the browser. The build
checks each address is an `https://` Instagram or Facebook address, removes the
share-tracking parameters (`igsh`, `mibextid` and the like) that identify whoever copied
the link, and stops on anything else.

**The home page is a template.** `site/index.njk` is the hand-written home page with
those two blocks added; everything else in it is written out exactly as it is.

## The navigation

Every page is a `.njk` template so that its header and footer come from one place:
`site/_includes/nav.js` defines the entries, `nav.njk` and `footnav.njk` write them. Apart
from those two includes (and the home page's two blocks above), each page is written out
exactly as it is in the repository. A page keeps its address: `trails/index.njk` builds
`trails/index.html`, `stops/stop-1.njk` builds `stops/stop-1.html`.

The header has five entries: **Trails** and **News** are links; **Explore**, **Our work**
and **About** each open a short list. To add a page, add it to a group in `nav.js`; the
header row does not grow. Add a sixth top-level entry only if it is as important as
Trails and News.

**The menu breakpoint is measured, not guessed.** The logo and the five entries need
566 px at the current 12 px nav type. At 680 px that leaves 114 px, 20%, spare, so the
row shows from 680 px up and folds behind **Menu** at 679 px and below. If you change the
entries, their wording or the nav type, re-measure (the header's padding, plus the
`.brand` and `.navlist` widths at a wide window) and move the `max-width` in `site.css` to
match.

**Nothing on the site is set below 11 px**, legends, captions, map labels and nav
included. Keep it that way. The elevation profile on the trails page is the one awkward
case: it is an SVG drawn 720 units wide that scales with the page, so its labels scale
too. Container queries in `site.css` step the label size with the profile's width so that
the labels never show under 11 px; check them if you change the profile.

## Adding a new stop

1. Copy `site/stops/stop-4.njk` as the shape.
2. Take position and bearing from the photograph EXIF. Do not estimate them. Take the
   elevation from a GPS track of the walk and Copernicus (`tools/dem_report.py`), rounded
   to 5 m, never from the EXIF altitude (see note 5 above).
3. Add the point to `site/assets/data/cairde-corrin.geojson` as a Point feature with
   `kind: "stop"`, `elevation_m`, `bearing_deg` and `recorded`.
4. Add the name to `STOPNO` in `site/assets/js/map.js` and the photograph slug to
   `PHOTO`. The `STOPNO` keys must match the feature names in the GeoJSON
   character for character, punctuation included.
5. Move the entry in `site/trails/index.njk` out of the `pending` state.

## Before you push

Build, then run the checks listed in `DEPLOY.md` ("Checks before you deploy"), and also:

    python3 tools/linkcheck.py --reveal

That flags any scroll-reveal block taller than eight viewports. Those fade in as one
slab, and the observer that reveals them measures a fraction of the element's own area,
so a tall enough block can stop revealing altogether if the threshold is ever raised
above zero.

After any change to a layout, an include or `.eleventy.js`, also diff the built pages
against the previous build and read every difference (see the hard rules).

## Commits and branches

**Commits are authored by the repository owner only.** No `Co-Authored-By` trailers,
no session links and no AI attribution, in commit messages or in pull request
descriptions. A message says what changed and why, in plain words, and nothing else.

After cloning, switch on the hook that refuses any file over 25 MB (Git cannot
ignore by size):

    git config core.hooksPath .githooks

Two branches:

    main    what is live. Netlify deploys every push to it.
    build   where all work happens. Never commit to main directly.

The one exception is the news editor at `/admin/`. It commits news posts, gallery
photos and the home page's social posts straight to `main`, bypassing `build`, and that is intended: it is for content,
never for code. Do not use it, or GitHub's web editor, to change anything else. Because
`main` moves on its own, run `git switch build && git merge main` before starting work
and before releasing, so the merge does not undo a post.

Work is done on `build` and released to `main` only after it has been checked on the
branch preview.

**Releasing a checked piece of work.**

1. Commit it on `build` and push: `git push origin build`.
2. Open a pull request from `build` into `main` on GitHub. Netlify posts a deploy
   preview URL on it.
3. Check the preview: run through "Checks after you deploy" in `docs/DEPLOY.md`
   against the preview URL rather than the live one.
4. Only when it passes, merge it as one merge commit, so the whole release can be
   undone in one step:

        git switch main
        git pull
        git merge --no-ff build -m "<what the release does>"
        git push origin main
        git switch build

   Merging the pull request on GitHub with "Create a merge commit" does the same.
   Do not squash or rebase-merge.

**Undoing a release.**

1. To get the live site back immediately, publish the previous deploy in Netlify
   (`MAINTENANCE.md`, "Putting the site back after a bad deploy"). This changes nothing
   in git.
2. Then undo it in git, so the next push does not bring it back. Find the release's
   merge commit with `git log --merges --oneline main`, and:

        git switch main
        git revert -m 1 <merge-commit>
        git push origin main

3. Bring `build` level with `main`: `git switch build && git merge main`.

To bring a reverted release back later, revert the revert on `build`
(`git revert <revert-commit>`) before merging again. Otherwise Git treats those
changes as already merged and leaves them out.

## Tone

Plain, specific, unhurried. Short declarative sentences. Let the numbers carry the
argument rather than adjectives. No marketing language, no exclamation marks, no
"nestled in the heart of". If a sentence could appear on any community website in
Ireland, rewrite it or delete it.

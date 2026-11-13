# Contributing to cairdecorrin.ie

For anyone changing the site itself: its pages, figures, media or code. Committee
members posting news need `EDITOR-GUIDE.md` instead. Read the hard rules before changing
anything; the rest is reference.

## Repository layout

    site/         everything that deploys, and nothing else. Netlify publishes this.
    docs/         every document; docs/README.md is the index
    archive/      masters and source material. Not deployed, not tracked.
    tools/        helper scripts. Not part of the build; nothing here has to run.

The repository is public, so it holds nothing that should not be. Raw inputs that
identify a person, such as the GPS track of the walked loop (it names who walked it and
records when, minute by minute), are kept in `archive/source-data/`, outside the
repository, and only their processed results are committed under `site/`.

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
- **The byte-for-byte guarantee covers the copied files, not the pages.** Every page is
  generated. Twenty-two of them (the home page, about, links, new spaces and its two
  proposals, all ten stops, water, credits, species, folklore, recordings, trails) are
  built from the editor's blocks ("Pages built from blocks" below); privacy and terms are
  templates written as they stand. `compare_build.py` lists all of them
  as generated rather than proving them unchanged, and
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
- **No private individual's name anywhere in the repository.** The repository is public,
  and everything in it, including its history, can be read and copied by anyone. That
  covers the docs, open items, code comments, data files, file metadata and commit
  messages. Refer to people by their role: "the photographer", "the oral-history
  contributor", "the developer". The names themselves are kept in the developer's own
  notes, outside the repository. The one exception is a credit the person has agreed to,
  published on the credits page: that is attribution they consented to. An unconfirmed
  credit is not. Licence attributions (the Wikimedia Commons photographers, the authors
  of a cited dataset) and the collectors named in published archive records such as
  dúchas.ie are credits of this kind.
- **Commit with a GitHub no-reply address, never a personal one.** Every commit records
  an email address, and in a public repository anyone can read it. This repository is
  set to use the developer's GitHub no-reply address (`git config user.email`, in
  `.git/config`). Anyone else committing here sets their own once in their clone:
  `git config user.email <ID>+<username>@users.noreply.github.com`, from GitHub ->
  Settings -> Emails, where **Keep my email addresses private** should also be on.
- Keep `prefers-reduced-motion` respected and keyboard focus visible.
- Stop pages must stay light. They are read in a forest on a weak connection.

## Where the figures live

Figures in the page text are ordinary words. Editors write every block-built page in
`site/_data/pages/*.json`, and a figure there
("about 360 hectares", "three hundred and sixty hectares") is typed like any other word:
nothing locks it. What protects the figures is a warning, not a lock.

**The figure consistency check** (`site/_includes/figurecheck.js`) runs at the end of every
build. It reads the text of every finished page, including titles, descriptions and the
structured data, finds the watched quantities in whatever form they are written (digits
or words, hectares or km², a range such as 21-213 m), and prints a `[figures]` warning
naming the pages when two of them give the same quantity differently. It also warns when
every page agrees but disagrees with the measured value. Counts of things that exist on the
website ("13 species", "Nineteen recordings", "Five stories", "Twelve photographs") are
compared the same way with how many there actually are, counted from the pages' blocks
(`counts()` in `_includes/blocks.js`). It never fails a build and never
holds back publishing: an editor's change goes live, and the warning in the Netlify
deploy log is the signal for whoever maintains the site to check it. A number is matched
to a quantity by the nearest label in front of it ("Catchment area", "action area",
"outlet") or a few words straight after it ("upstream of here", "of climbing"); a number
with no label is not checked, and a sentence that reports someone else's figure ("Other
delineations of the same catchment give c. 3.7 km²") is skipped. The watched quantities
are the `WATCH` list at the top of the file:

| Quantity | Measured value (`figures.json`) |
|---|---|
| Catchment area, in ha or km² | `catchment.area_ha` |
| Proposed action area, in ha or km² | `action_area.ha` |
| Area upstream of Stop 01 | `stops.s1.upstream_ha` |
| Highest point and outlet of the catchment (also as the range 21-213 m) | `catchment.elev_max_m`, `catchment.outlet_m` |
| Longest flow path | `catchment.flow_path_km` |
| Length, lowest and highest point, and climbing of the walked loop | `loop.*` |
| Length of the proposed loop route, and the Glenabo extension | `proposal.*` |
| Distance between the two photographs on the home page | `photo_pair.apart_m` |
| Number of recorded stops, and of stops still to survey | counted: stops whose page has content |
| Number of species, recordings, films and folklore stories | counted: the entries in those blocks |
| Number of strands of work, of phases, and of new-space projects | counted: points labelled Strand or Phase; cards linking to a new-space page |
| Number of species and invasive species reference photographs | counted: the credited photographs of each kind in use |

To add a quantity, add a line to `WATCH` and its measured value to `figures.json`, and a
case to `tools/selftest.js`.

**`site/_data/figures.json`** is no longer where the prose gets its figures. It keeps two
jobs: it is the measured value the check compares against, and it fills in the parts of
the trails page that describe the survey data rather than tell a story (the map's layer
key, and the structured data for the loop, the catchment and the action area). A stop's
position, height and bearing are fields on the stop's own page. The editor has no entry for it, and the
check in `.github/workflows/editor-content-only.yml` refuses any editor change to it. When
a measurement changes, change it there, with its source, on `build`, and the check then
lists every page whose wording still gives the old figure. The trails page's walked-loop
section, the elevation profile and the map data are generated by the tools from the
survey data and are not editable.

## Pages built from blocks

Every editable page is `site/_data/pages/<key>.json`:

    { "page":   { "title", "description", "subject": { "name", "description" } },
      "hero":   { the top of the page },
      "blocks": [ { "type": "text", ... }, { "type": "cards", "items": [...] }, ... ] }

`page` is the page's identity ("About this page" in the editor), `hero` the top of the
page, fixed and always first, and `blocks` the ordered list the editor adds to, removes
from, reorders and copies. The page's `.njk` is a frame: head, scripts and footer, with
`{{ pages | blocks("key", ...) }}` for the content and `{{ pages | pageLd("key", ...) }}`
for the structured data. `_includes/blocks.js` draws every block in the markup the
hand-written pages used, so converting them changed no page's content.

**The block types** are the sections the site was already made of; none was invented.
`LABELS` in `blocks.js` lists them with the names editors see:

| Block | Was |
|---|---|
| hero (fixed field) | the page head (eyebrow, title, lede); on the home page the film's words; on a stop the photo and stop details |
| Text | the home page's sections (eyebrow, heading, paragraphs, in a light, dark or tinted band), and headed paragraphs elsewhere, including the small source notes and the "In development" label |
| Figure box | the `figs` boxes on the home and trails pages |
| Single image | the home page's two map figures (`mapfig`) |
| Two photos side by side | the home page's broadleaf and conifer pair |
| Photo carousel | the home page's photograph carousel |
| Photo grid | the water page's four photographs |
| Numbered points | the strands (home), phases (new spaces) and do and do not lists (water) |
| Cards | the partners (about), the two proposals (new spaces), the invasive species (water) |
| List of links | the links page and the water page's recording bodies |
| Note box | the stop and new-spaces notes, and the species page's folded "About these photographs" |
| Pull quote | the quotation on the articles cards, now usable on any page |
| Button link | every `cta` button |
| YouTube video | the click-to-load video of the news posts |
| Recording | the "Listen" box on stop 1 |
| List of recordings, Films | the recordings page |
| Folklore story | each story on the folklore page |
| Species list | the species page's list |
| Credits list | the credits page's list |
| Interactive map, List of stops, The walked loop | the trails page's map, stop list and walked-loop section |
| Walked route | the walked-loop section's design, for a route an editor uploads as a GPS track |
| Posts from the group | the home page's Instagram carousel or social cards |

**Where blocks go.** The top of a page is a fixed field, not a block, so the editor's own
structure gives every page exactly one, always first. The map, the list of stops, the
walked loop and the posts from the group can appear once per page (they carry element ids
or a page-wide role); a second one stops the build. They are offered only on the page
they belong to. On the home page, each Text block opens a new band and the blocks after
it join that band; elsewhere, blocks follow one another in one column. Decap has no
button to copy a list item, so each block has a "Make a copy of this block when I save"
tick that `site/admin/editor.js` acts on when the entry is saved.

**A broken block stops the build.** Every block is checked as it is drawn: a missing
title, a photo without its description or not on this site, a "Two photos" block without
exactly two, a link that is neither a site path nor an `https://` address, a recording
that is not a file on the site or cannot be read as MP3, M4A or WAV, a story without its source, a stop without a position
near Fermoy. The error names the page file and the block number and kind, and Netlify
keeps the previous version live. The backstop against loading anything from another
website (`_includes/images.js`) still runs over every finished page, blocks included.

**Photos in blocks** are either one of the site's prepared sets (`/assets/img/name-700.webp`
and its siblings; the block uses every width and format on disk, as the hand-written page
did) or an editor's upload (`/assets/uploads/`, re-encoded at build like a news photo).
How each block writes its photos (sizes, which file is the fallback) is the `FRAMES`
table. **Films** are YouTube addresses, handled exactly as a news post's video
(`_includes/youtube.js`: the same pattern, the same self-hosted still, the same
click-to-load player). The three films already kept on the site stay as files; their size
is read from the MP4 itself (`mp4Size` in `blocks.js`), so nobody types pixel sizes.
**Recordings** are uploaded in the editor as MP3, M4A or WAV, and cleaned twice without
being re-encoded (`site/admin/audio.js`, shared by the editor and the build): in the
editor's browser before upload, and again at build, which publishes the cleaned copy under
`/assets/audio/uploads/` and never the upload itself. From an MP3 it removes every ID3v2
tag, an ID3v1 tag and an APE tag; from an M4A or MP4 it blanks the `udta`, `meta`, `uuid`
and `XMP_` boxes to `free` boxes of the same size (so no offset moves) and zeroes the
creation and modification times in `mvhd`, `tkhd` and `mdhd`; from a WAV it keeps only the
`fmt `, `data` and `fact` chunks. The sound frames are never touched. Ogg, Opus, WebM, WMA
and the like are refused, in the editor with a plain message, because their tags sit inside
the stream and cannot be removed without re-encoding. A recording's length (rounded to the
second) and its end time (start plus length, rounded up) are read from the file, so an
editor gives only the start time. **Who took a photo** is a field on every photo (`by`, default "Cáirde Corrin"); any
other name is shown beneath the photo as "Photo: <name>". A registered or Commons photo
always shows its licence credit instead.

**Derived, not requested.** A field the build can work out is not asked of an editor:

| What | Worked out from |
|---|---|
| A stop's sign line, "Stop 05 - cairdecorrin.ie/s/5" | its number |
| A stop's height | the elevation grid at its position (below); stops 1 to 3 keep their checked heights in a hidden `elevation` field, and the build warns if one strays more than 10 m from the grid, which means the stop was moved |
| A YouTube video's or film's title | YouTube's public oEmbed address, fetched with the still and kept in `site/_youtube/<id>.json`; a typed title still wins. Commit the file with the still, as the build log says |
| A recording's length and end time | the file (`audio.js`) |
| A photo's position, direction and time | its Exif, read in the editor's browser before the photo is stripped (`photos.js` `exif()`), offered to the editor and never uploaded; a caption's height comes from the elevation grid, never the camera's altitude |
| Where a link leads | a list of the built pages, `/admin/site-pages.json`, written after every build; another website or an email address is still typed |

**The elevation grid** (`site/admin/dem/copernicus-od.bin` and `.json`, 62 KB) is
Copernicus GLO-30 cut to the action area plus about 500 m by `tools/dem_clip.py`,
converted to metres above Malin Head OD, and read bilinearly by `site/admin/dem.js` in the
build and in the editor, to the nearest 5 m. It is the one piece of raster data in the
repository; the full tiles stay in `fetch_dem.py`'s cache. Rerun `dem_clip.py` only if the
action area grows past it, and check the three stop heights it prints.

**To add a block type:** a renderer in `R` and a name in `LABELS` (`blocks.js`), a type in
the `pages` collection of `site/admin/config.yml` (once, with an `&anchor`, then by alias on
each page that offers it), and a case in `tools/selftest.js`. Before pushing any change
to `blocks.js`, compare every built page with the previous build: the content of a page
must not change as a side effect.

## Structured data

Each page's JSON-LD is assembled by `forPage()` in `_includes/ld.js` from three places,
never from where its blocks happen to sit: the page's "About this page" fields, the
things its blocks list, and the survey data. Deleting or moving a block cannot change
what the page says it is. `_includes/ld-pages.js` then adds a WebPage node, named from
the page title, whose main entity is the page's own subject node.

| Page | Assembled from |
|---|---|
| Every page | the organisation and the website (fixed), and a breadcrumb from the page's place in the navigation |
| Home | a Place for the catchment: its name and description from "What this page is about", its outlet position from `figures.json` |
| Trails | the loop, as a TouristAttraction: name and description from "What this page is about", length, climb and range from `figures.json`, the stops it passes from the stops with content, its start from Stop 01's position; the catchment Place (name and description from the home page's fields, area and heights from `figures.json`); the action area Place from `figures.json` |
| A stop | a TouristAttraction named "Stop 0N - " and the stop's name, with the position, height and photo from the top of the stop's page |
| Species | an ItemList named by "What this page is about", one Taxon per entry of the species list blocks |
| Folklore | an ItemList named by "What this page is about", one CreativeWork per story block, each based on its dúchas.ie source |
| Recordings | an AudioObject per recording and a VideoObject per film, from those blocks |
| About, links, new spaces and its proposals, water, credits | the organisation, website and breadcrumb only |

`tools/ldcheck.py` validates the result against schema.org after every build.

## Credits a licence requires

Some credits are a condition of using other people's work: the photographer and licence
of each Wikimedia Commons photograph, the Copernicus elevation data behind the maps, the
Pl@ntNet species records, and the National Folklore Collection for the stories. Deleting
one would put the group in breach. They are not protected by locking pages. Each is bound
to the thing it credits, so it cannot be separated from it:

- **Photographs** from another source are registered in `site/_data/credits.json`, keyed by
  the file (`/assets/img/species/bilberry`). Wherever that photo appears, in any block on
  any page, its photographer and licence are written beneath it; the editor has no field
  for the credit, so it cannot be removed while the photo stays. To use a new photo from
  another source, add it to `assets/img/` and register it there.
- **Stories** carry their own source fields (volume, page, where collected, the dúchas.ie
  link); a story block without them stops the build.
- **The credits page** lists each required group (`groups` in `credits.json`) whenever what
  it credits is on the website: the elevation data with the two maps or the interactive
  map, the species records with a species list, the photographs with the photos, the
  folklore with any story. The editor places each group among the page's other entries
  as a "Credits a licence requires" entry and can move it; if it is removed, it is added
  back at the end of the page. Its wording, and the list of photographs and stories,
  come from the registry and the stories themselves, so they always match what is shown.

The editor has no entry for `credits.json`, and the editor-content check refuses an
editor change to it.

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
5. Stop and photograph elevations come from the walk's own GPX (`archive/source-data/`) and
   Copernicus, rounded to 5 m; they agree within 4-8 m at each stop. A stop added after
   stops 1 to 3, and a caption an editor fills in from a photo's position, takes Copernicus
   alone, at that position (the elevation grid above): it reads a few metres high under
   trees, which the rounding absorbs. No elevation on the
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
   `archive/source-data/` keeps its timestamps and is kept out of the repository. Those timestamps carry a
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

**Audio.** Mono, 64 kbps, MP3, into `site/assets/audio/`, with no tags: an encoder or a
phone leaves an ID3 tag (the published recordings carried `com.android.version` and the
encoder's name until they were stripped). Strip one without re-encoding with
`node -e "const a=require('./site/admin/audio.js'),f=process.argv[1],fs=require('fs');const r=a.clean(fs.readFileSync(f),f);fs.writeFileSync(f,r.bytes);console.log(r.removed)" FILE.mp3`;
the build warns about any recording that still has one. Every clip needs a written
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

**Uploaded photos.** A photo chosen in the editor is shrunk and re-encoded in the
editor's own browser before it is uploaded (`site/admin/index.html`): at most 2000 px on
the long side, as WebP, or as JPEG in Safari, which cannot write WebP. Only the pixels
survive the canvas, and any metadata the browser adds of its own is stripped, so the
phone's EXIF block, with the GPS position, the time and the phone model, never leaves
the device. What reaches `site/assets/uploads/`, and so the public repository, is a
file of roughly 0.7 to 1.5 MB with no EXIF, XMP or GPS. The camera's rotation is applied
before the tag is lost. Before that, `exif()` reads the position, direction and time from a
JPEG's Exif and keeps them in the page's memory only, so the photo field can offer them to
the editor (see "Derived, not requested"). Photos dragged or pasted onto the editor are refused, so nothing
reaches Decap without passing through this step. Uploads are still never published as
they are: at build time,
`site/_includes/images.js` re-encodes each one referenced by a post into WebP at 700,
1100 and 1800 px wide, with width and height, plus a 1200 px JPEG for social previews,
all under `/assets/img/news/`. Re-encoding drops the EXIF and XMP blocks, GPS
included; the colour profile is the only block kept. This covers the hero and gallery
fields and photos placed in the body of a post with the Image button: a build step
rewrites every `<img>` or link that points at `/assets/uploads/` in a generated page to the
processed copies. `assets/uploads/` is excluded from the copy, and
`tools/compare_build.py` fails if an upload ever reaches `_site/`. The build's re-encode is
the second line of defence: it strips metadata again, in case a file ever arrives by
another route (a hand commit, or GitHub's web editor).

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
(the prebuilt image library has no HEVC decoder). According to WebKit's source
(`WKFileUploadPanel.mm`), Safari on an iPhone hands the editor a JPEG for **Photo
Library** and **Take Photo**, and the original HEIC for **Choose File**. Safari can read
HEIC, so the browser-side step converts it like any other photo. A browser that cannot
read HEIC (Chrome or Firefox on a computer) refuses it before upload with an
explanation. Tested in Safari's engine and in Chrome and Firefox; not yet on a real
iPhone.

Each photo field also refuses files over 20 MB, as a backstop against videos and very
large files. It applies to the shrunk file, so in practice no photo meets it. The top-bar **Media** button, which uploaded straight
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
the link, and stops on anything else. These cards show only while the Instagram feed
below is not set up.

**The Instagram feed.** When `FEED_ID` in `site/_includes/instagram.js` is set, the home
page shows a carousel of the group's latest Instagram posts instead of the cards. Each
build reads the Behold feed (`https://feeds.behold.so/<FEED_ID>`), checks every post
(an `instagram.com` post address, a date, an `https://` picture), downloads any picture it
has not saved yet and re-encodes it with eleventy-img into WebP at 700 and 1100 px, which
drops all metadata. The posts and those WebP files are saved in `site/_instagram/`
(`feed.json` and `<id>-<width>x<height>.webp`); the build copies the pictures to
`/assets/img/instagram/` and never publishes the folder itself. A refresh replaces the
saved posts only when the feed and every new picture arrived, and removes pictures of
posts no longer in the feed. If anything fails, a 15-second timeout included, the build
uses what is saved and logs a warning; it never stops for Behold. Captions are cut to
160 characters, with en and em dashes turned into hyphens.

Like video stills, the saved posts only reach the repository when a developer commits
them: after a release, `git switch build && git merge main && npm run build`, then
commit `site/_instagram/`. Netlify refreshes them on every build regardless; committing
just moves the fallback forward. The carousel uses the same markup, styles and script as
the photo carousel (`.carousel`, scroll-snap, no autoplay), with square pictures.
`tools/selftest.js` covers the feed checks, the fallback and the pruning.

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

**Optional sections that fill up over time follow one rule.** The Gallery and Articles
each appear in the header and the footer once they have a published entry, and not
before (an entry in `nav.js` with `section:`). While one is empty its page is still built,
so an old link or bookmark works, but it shows only its empty-state message ("No
photographs yet. The first will appear here as soon as it is published."), is marked
noindex (`base.njk`, from the page's `section:` front matter) and is left out of
`sitemap.xml`. The home page's posts from the group behave the same way without a page:
the block shows the Instagram posts if there are any, otherwise the editor's social
posts, otherwise nothing. A new optional section joins this rule rather than inventing
its own.

**News is the deliberate exception.** It is always in the header, the footer and the
sitemap, and indexable, even with no posts; while empty it shows its own empty-state
message ("No news yet. The first post will appear here as soon as it is published.").
The Gallery and Articles are optional: an empty one is genuinely nothing to show, so it
stays out of sight. News is a core section of the site, and a visitor who finds no News
link reads it as missing rather than empty. Do not give News the `section:` front matter
or the `section:` entry in `nav.js` that would make it conditional.

**Every page must be reachable.** `site/_includes/reach.js` walks the built site from the
home page, following every visible link, and compares the pages built, the pages in
`sitemap.xml` and the pages reached. A built page no link leads to, a sitemap entry with no
page, a reachable indexable page missing from the sitemap, or a noindexed page in the
sitemap is a finding, unless `ALLOW` in that file names it with its reason: the editor and
its Help page, the Netlify email templates, a stop not yet surveyed, an empty Gallery or Articles (the
last two only while noindexed). The build prints findings as `[reach]` warnings and carries
on, because an editor can legitimately remove a page's only link (the New spaces cards are
the only way to its two proposals) and that must not stop publishing. The self-test fails
on any finding, so a developer cannot add a page with no way to reach it.
`node tools/reachcheck.js` prints the full report.

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

## Stops

All ten stops are editor pages (`site/_data/pages/stop_N.json`, one shared frame per stop in
`site/stops/`). A stop whose top-of-page title is empty is reserved: it shows "Not yet
surveyed", carries `noindex`, stays out of the sitemap and the structured data, and the
trails page lists it as to be surveyed. Once an editor fills in the top of its page, it
goes live everywhere at once: its own page, the trails page's list, the map
(`/assets/data/layers.json`), the sitemap, the loop's structured data and the figure
check's count of recorded stops. The previous and next links between stops follow the
recorded stops.

The position, height and bearing are fields on the stop's page. They should still come
from the photograph and the walk, not from memory: position and bearing from the
photograph's EXIF; elevation from a GPS track of the walk and Copernicus
(`tools/dem_report.py`), rounded to 5 m, never from the EXIF altitude (see note 5 above).
The survey data file `site/assets/data/cairde-corrin.geojson` no longer needs the stop: the
map draws stops from their pages, and uses the GeoJSON's three stops only if the layers file
cannot be loaded. After a stop goes live, the figure check flags every sentence that still
gives the old count ("Three stops recorded, seven to survey" on the trails page, "Seven of
the ten stops" in the terms); the terms page is a developer's edit.

## Routes from uploaded GPS tracks

Editors add a walked route to the trails page with a **Walked route** block: a name, some
text, and a GPX file. The file is stripped twice. In the editor's browser
(`site/admin/tracks.js`), before upload, it is rebuilt from positions and heights only, so
no time, name, app or phone reaches the public repository; a dropped or pasted GPX is
refused, because that path would skip the strip. At build (`site/_includes/gpx.js`) it is
treated the way `tools/trail.py` treated the walked loop: stretches walked twice are taken
out (any run of 30 m or more within 15 m of track already walked, so an out-and-back keeps
its outward leg once), the line is simplified at half a pixel at the map's maximum zoom
(Douglas-Peucker, 0.25 m), and only positions and heights are published, rounded. The page
gets the route's section with its own elevation profile and a clean GPX download
(`/assets/data/routes/<name>.gpx`); the map draws it as a dashed line under "Other routes".
The cleaning was checked against the walked loop: run on its published track it removes
nothing, and gives the same 2.27 km and 65 m of climbing.

**A track the build cannot use stops the build**, like any other broken block, with a plain
reason: the file is not GPX, it has no points or fewer than ten, fewer than four in five
points have a height (so no profile can be drawn), part of it is not near Fermoy, or less
than 100 m is left once the repeats are out. The live site keeps its previous version.

**The walked Glenabo loop is not one of these.** It was cleaned by hand, checked against all
three stops and published by `tools/trail.py` into `site/_includes/walked-loop.html`; its
block has nothing to edit. Replacing it is a deliberate job: rerun `tools/trail.py` on a new
raw track kept in `archive/`, check the result against the stops, and update `figures.json`.

## Checks before publishing, and what a failure says

Every check an editor can act on is in one file, `site/admin/checks.js`, in the editor's
own words ("Block 3 (Two photos side by side) needs exactly two photos, and it has 1. Add
or remove a photo, or use a different block."). It runs twice: in the editor when a page is
saved (`site/admin/editor.js`, Decap's `preSave` event), so a page that would stop the
build is not saved and its editor is told what to fix there and then; and in the build
(`_includes/blocks.js`), so a page that reached the repository some other way cannot be
published broken. Checks that need the site's files (does the photo exist, can the track be
read) run in the build only. To add a check, add it to `checks.js` with a case in
`tools/selftest.js`; the editor and the build then agree by construction.

When a page stops the build, the build's error lists every problem on that page in those
words, and the last thing in the log is a framed summary headed "THE WEBSITE WAS NOT
UPDATED" naming the page as it appears in the editor, the problems, what to do, and the
file. The live site keeps its previous version. Netlify's deploy log is visible only to
members of the Netlify team, so editors cannot read it, and Netlify's own failure emails
need a paid plan. Instead `.github/workflows/build-check.yml` runs the same build on every
push to main (Node from `netlify.toml`; actions pinned to release commits) and, when a
page's content stopped it, opens a `website-not-updated` issue from
`.cache/build-failure.json`, which the build writes only then. Watchers are emailed; one
issue per failure (a fingerprint of the page and its problems); the issue closes when the
build passes. Any other failure opens nothing. See `MAINTENANCE.md`, "When the website does
not update".

## Photographs from Wikimedia Commons

An editor can use a Commons photo by its file page address (the third button on every page
photo field). The rules are one file, `site/admin/commons.js`, used in the editor (which
asks the Commons API when the address is pasted, and refuses there and then) and in the
build (`site/_includes/commons.js`, which asks again). The credit comes from Commons'
metadata for the file: the author (`Artist`) and the licence (`LicenseShortName`,
`LicenseUrl`). **Without a clear author and an accepted licence, the photo is refused and
the reason given; an uncredited photo is never published.**

| Accepted | Refused |
|---|---|
| CC BY and CC BY-SA, versions 1.0 to 4.0, national ports included | GFDL and the Free Art Licence (they require the licence text to go with the photo) |
| CC0 | Any NonCommercial or NoDerivatives licence (cropping and resizing are changes) |
| Public domain | Plain "Attribution" templates and other bespoke terms |
| | Any file Commons marks with restrictions (personality rights, trademarks) |
| | A missing, unknown or anonymous author; a file that is not a photograph |

Each accepted photo is credited with its author, its licence (linked) and its file page
(linked), beneath it wherever it appears and on the credits page under "Photographs from
Wikimedia Commons", the same binding as `site/_data/credits.json` but filled from the
source. The build downloads the photo once, re-encodes it to WebP at 700, 1100 and 1800 px
with no metadata, and serves it from `/assets/img/commons/`; its credit is saved in
`site/_commons/<name>.json`. **Commit both** after a local build that fetched one (the log
says `[commons] fetched ... commit them`), as with YouTube stills: with them in the
repository, builds need no network for that photo. A refused photo stops the build as a
content failure (the plain summary, and a GitHub issue); Commons being unreachable stops
it without blaming the page, and the live site stays as it was.

## Photos already on the site

The page photo fields are a custom field (`sitephoto`, `site/admin/editor.js`) with two
buttons. **Choose a photo already on the website** reads `/admin/site-photos.json`, built
from every prepared set under `site/assets/img/` (`sitePhotos()` in `blocks.js`), and only
ever writes the chosen path into the field: it uploads nothing and offers no address
field. **Upload a new photo** opens Decap's media library inside the entry, exactly as the
standard photo field does, with the field's 20 MB cap and the draft workflow; the top-bar
Media button stays hidden (`site/admin/index.html`). A reused photo from another source
keeps its credit, because the credit is keyed to the file.

## Before you push

Build, then run the checks listed in `DEPLOY.md` ("Checks before you deploy"; the
self-test includes the reachability check, so build first), and also:

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

**Deleting something an editor took off the website.** Editors cannot delete a published
post, gallery photo or article (`SECURITY.md`, "Taking things down"); they tick **Take
this off the website**, which sets `hidden: true` and leaves the file out of the build.
To remove it for good, delete the Markdown file on `build`, and any photo in
`site/assets/uploads/` that nothing else uses, then release as usual. The files stay in
git history; if a photo must vanish from history too, that needs a history rewrite.

## Tone

Plain, specific, unhurried. Short declarative sentences. Let the numbers carry the
argument rather than adjectives. No marketing language, no exclamation marks, no
"nestled in the heart of". If a sentence could appear on any community website in
Ireland, rewrite it or delete it.

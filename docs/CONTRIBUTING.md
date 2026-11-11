# Contributing to cairdecorrin.ie

Notes for anyone editing this site. Read the hard rules before changing anything;
the rest is reference.

## Repository layout

    site/         everything that deploys, and nothing else. Netlify publishes this.
    docs/         this file, the deployment guide and the project summary
    source-data/  inputs that the site is made from. Tracked, never published.
    archive/      masters and source material. Not deployed, not tracked.
    tools/        helper scripts. Not a build step; nothing here has to run.

`source-data/` holds raw inputs, such as route exports, that are processed into files
under `site/`. Nothing in it is ever published directly: Netlify publishes only
`site/`, and nothing on the site links into `source-data/`. To publish something
derived from it, write the processed result into `site/` and commit both.

## What this is

A static website for a voluntary community group in Fermoy, Co. Cork, working on
the Glenabo and Corrin woodlands. Vanilla HTML, CSS and JavaScript. No build step,
no npm, no framework. Netlify publishes `site/` exactly as it sits.

## Hard rules

- **No build step.** Do not add npm, a bundler, Tailwind, React, or a `package.json`.
  Anything that has to be compiled before the site works breaks the one promise this
  repository makes: that the folder in front of you is the website.
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
8. The channel network length and segment count are withdrawn. The drawn network is
   modelled, not walked, partial, and clipped to the catchment boundary. Publish no
   figure for it.
9. Positional accuracy: the catchment boundary is good to about one 30 m cell; the
   action area is traced and good to 10-20 m; stop and photograph positions are phone
   GPS, good to 10-20 m.

## Adding media

**Images.** Resize to 1800 / 1100 / 700 px wide WebP, quality 58-64, into
`site/assets/img/`. Name them `<subject>-<width>.webp`. Always give `width`, `height`,
`loading="lazy"` and real alt text describing what is in the frame.

Give an edited photograph a **new file name**. Images are cached for a year, so
overwriting one shows the old picture to anyone who has visited since.

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

## Useful commands

    python3 tools/serve.py site 8080     # preview at http://localhost:8080
    python3 tools/linkcheck.py --external
    python3 tools/linkcheck.py --reveal  # scroll-reveal block heights

Use `tools/serve.py` rather than `python3 -m http.server`. The built-in server does not
answer Range requests, so the hero cannot seek and appears broken locally while working
in production. `serve.py` also reads `site/_headers`, so caching behaves as it will live.

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

## Adding a new stop

1. Copy `site/stops/stop-4.html` as the shape.
2. Take position, elevation and bearing from the photograph EXIF. Do not estimate them.
3. Add the point to `site/assets/data/cairde-corrin.geojson` as a Point feature with
   `kind: "stop"`, `elevation_m`, `bearing_deg` and `recorded`.
4. Add the name to `STOPNO` in `site/assets/js/map.js` and the photograph slug to
   `PHOTO`. The `STOPNO` keys must match the feature names in the GeoJSON
   character for character, punctuation included.
5. Move the entry in `site/trails/index.html` out of the `pending` state.

## Before you push

    python3 tools/linkcheck.py --external
    python3 tools/linkcheck.py --reveal

The second flags any scroll-reveal block taller than eight viewports. Those fade in as
one slab, and the observer that reveals them measures a fraction of the element's own
area, so a tall enough block can stop revealing altogether if the threshold is ever
raised above zero.

Then open the home page in Chrome or Safari and scroll: the hero should scrub. In
Firefox it should show a still and never move. Both are correct; Firefox accepts every
seek and paints nothing, which is why the capability is measured at runtime rather than
inferred from the browser name.

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

Work proceeds in phases. A phase is merged to `main` only after it has been checked
on its preview URL.

**Merging a verified phase.**

1. Commit the phase on `build` and push: `git push origin build`.
2. Open a pull request from `build` into `main` on GitHub. Netlify posts a deploy
   preview URL on it.
3. Check the preview: run through "Checks after you deploy" in `docs/DEPLOY.md`
   against the preview URL rather than the live one.
4. Only when it passes, merge it as one merge commit, so the whole phase can be
   undone in one step:

        git switch main
        git pull
        git merge --no-ff build -m "Phase N: <what the phase did>"
        git push origin main
        git switch build

   Merging the pull request on GitHub with "Create a merge commit" does the same.
   Do not squash or rebase-merge.

**Rolling back a phase.**

1. To get the live site back immediately, open Netlify, go to **Deploys**, pick the
   deploy before the merge and click **Publish deploy**. This changes nothing in git.
2. Then undo it in git, so the next push does not bring the phase back. Find the
   phase's merge commit with `git log --merges --oneline main`, and:

        git switch main
        git revert -m 1 <merge-commit>
        git push origin main

3. Bring `build` level with `main`: `git switch build && git merge main`.

To bring a reverted phase back later, revert the revert on `build`
(`git revert <revert-commit>`) before merging again. Otherwise Git treats those
changes as already merged and leaves them out.

## Tone

Plain, specific, unhurried. Short declarative sentences. Let the numbers carry the
argument rather than adjectives. No marketing language, no exclamation marks, no
"nestled in the heart of". If a sentence could appear on any community website in
Ireland, rewrite it or delete it.

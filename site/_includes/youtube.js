// A news post's video. The editor pastes a YouTube address or the 11-character video ID.
// The page shows a still and a play button, both served from this site, so nothing is
// requested from YouTube or Google until the visitor presses play; site.js then swaps
// in a youtube-nocookie.com player.
//
// The still is kept in the repository, in site/assets/img/video/ as <id>-<w>x<h>.webp,
// so a build never needs YouTube. When a post names a video with no still there yet, the
// build fetches it once from YouTube, re-encodes it into that folder and into _site/, and
// a developer commits the new files (docs/CONTRIBUTING.md). If YouTube cannot be reached
// the build carries on: the post shows the play button on a plain panel and the build log
// says which video to fetch later. A post is never held back by YouTube.
const fs = require('node:fs');
const path = require('node:path');
const Image = require('@11ty/eleventy-img').default;

const ID = /^[A-Za-z0-9_-]{11}$/;
const STILLS = path.join(__dirname, '..', 'assets', 'img', 'video');
const OUT = path.join(__dirname, '..', '..', '_site', 'assets', 'img', 'video');
const URL_PATH = '/assets/img/video/';
const said = new Set();  // Eleventy computes a post's data more than once; say each thing once
const say = (fn, msg) => { if (!said.has(msg)) { said.add(msg); fn(msg); } };

function youtubeId(value) {
  const s = String(value).trim();
  if (ID.test(s)) return s;
  let u = null;
  try { u = new URL(s); } catch (e) { /* not an address */ }
  const host = u ? u.hostname.replace(/^(?:www|m|music)\./, '') : '';
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/) || [])[1];
  }
  if (id && ID.test(id)) return id;
  throw new Error(`"${s}" is not a YouTube video address or video ID.`);
}

// The committed stills for one video, smallest first
function cached(id) {
  const files = fs.existsSync(STILLS) ? fs.readdirSync(STILLS) : [];
  // IDs are always 11 characters, so one can never be the start of another's file name
  return files.filter((f) => f.startsWith(id + '-')).map((f) => f.match(/-(\d+)x(\d+)\.webp$/))
    .filter(Boolean).map((m) => ({ file: m.input, width: +m[1], height: +m[2] }))
    .sort((a, b) => a.width - b.width);
}

async function fetchStill(id) {
  // maxresdefault is 1280 px but missing for some videos; hqdefault (480 px, letterboxed
  // to 4:3, cropped back to 16:9 by the CSS) exists for every public video.
  for (const still of ['maxresdefault', 'hqdefault']) {
    try {
      const webp = (await Image(`https://i.ytimg.com/vi/${id}/${still}.jpg`, {
        widths: [700, 1100], formats: ['webp'], outputDir: STILLS, urlPath: URL_PATH,
        filenameFormat: (hash, src, width, format) => `${id}-${width}w.${format}`,
      })).webp;
      // named <id>-<w>x<h>.webp so a later build knows the size without opening the file
      for (const s of webp) {
        const real = `${id}-${s.width}x${s.height}.webp`;
        if (path.basename(s.outputPath) !== real) fs.renameSync(s.outputPath, path.join(STILLS, real));
      }
      return true;
    } catch (e) { /* try the next size */ }
  }
  return false;
}

async function resolve(value, where) {
  if (!value) return null;
  let id;
  try { id = youtubeId(value); } catch (e) { throw new Error(`${where}: ${e.message}`); }
  if (!cached(id).length) {
    if (await fetchStill(id)) {
      say(console.log, `[youtube] ${where}: fetched the still for video ${id} into site/assets/img/video/; commit it.`);
    } else {
      say(console.warn, `[youtube] ${where}: could not fetch the still for video ${id}. The post shows the play `
        + 'button without it. Check the address is right and the video is public, then build again.');
      return { id };
    }
  }
  const stills = cached(id);
  // copy into _site too: the build's own copy of site/ may already have run
  fs.mkdirSync(OUT, { recursive: true });
  stills.forEach((s) => fs.copyFileSync(path.join(STILLS, s.file), path.join(OUT, s.file)));
  const main = stills[stills.length - 1];
  return { id, src: URL_PATH + main.file, width: main.width, height: main.height,
    srcset: stills.map((s) => `${URL_PATH}${s.file} ${s.width}w`) };
}

module.exports = { resolve, youtubeId, cached };

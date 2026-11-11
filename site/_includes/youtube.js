// A news post's video. The editor pastes a YouTube address or the 11-character video ID.
// The page shows a still and a play button, both served from this site, so nothing is
// requested from YouTube or Google until the visitor presses play; site.js then swaps
// in a youtube-nocookie.com player. The still is fetched from YouTube here, at build
// time, and re-encoded like an uploaded photo.
const Image = require('@11ty/eleventy-img').default;
const { OUT } = require('./images.js');

const ID = /^[A-Za-z0-9_-]{11}$/;

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

async function resolve(value, where) {
  if (!value) return null;
  let id;
  try { id = youtubeId(value); } catch (e) { throw new Error(`${where}: ${e.message}`); }
  // maxresdefault is 1280 px but missing for some videos; hqdefault (480 px, letterboxed
  // to 4:3, cropped back to 16:9 by the CSS) exists for every public video.
  for (const still of ['maxresdefault', 'hqdefault']) {
    try {
      const webp = (await Image(`https://i.ytimg.com/vi/${id}/${still}.jpg`,
        { ...OUT, widths: [700, 1100], formats: ['webp'] })).webp;
      const main = webp[webp.length - 1];
      return { id, src: main.url, width: main.width, height: main.height,
        srcset: webp.map((s) => `${s.url} ${s.width}w`) };
    } catch (e) { /* try the next size */ }
  }
  throw new Error(`${where}: could not fetch the still for YouTube video ${id}. Check that `
    + 'the address is right and the video is public, then build again.');
}

module.exports = { resolve, youtubeId };

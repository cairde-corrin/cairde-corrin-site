// Photos uploaded through the editor land in site/assets/uploads/ already shrunk to 2000 px
// and stripped of their metadata in the editor's browser (site/admin/index.html). They are
// still never published as uploaded. Each one is re-encoded here, at build time, into WebP
// at 700, 1100 and 1800 px wide, plus one 1200 px JPEG for social media previews.
//
// Re-encoding is the second line of defence: the output keeps no EXIF or XMP, so even a
// photo that reached the repository some other way, GPS and all, never shows a visitor
// its position, time or phone model. The one block kept is the ICC colour profile (eleventy-img always keeps it, so
// wide-gamut phone photos keep their colours); it holds no position, time or serial.
// fixOrientation bakes the camera's rotation into the pixels first, because the
// orientation tag is dropped along with everything else.
//
// resolve() handles the hero and gallery fields; rewriteHtml() handles photos placed in
// the body of a post, which reach the page as <img src="/assets/uploads/...">.
// Any other image path (the hand-made -700/-1100 files under /assets/img/) is returned
// unchanged, so posts that use them render exactly as before.
const path = require('node:path');
const Image = require('@11ty/eleventy-img').default; // the package is ESM; require() returns its namespace

const UPLOADS = '/assets/uploads/';
const SITE = path.join(__dirname, '..');
const OUT = {
  urlPath: '/assets/img/news/',
  outputDir: path.join(__dirname, '..', '..', '_site', 'assets', 'img', 'news'),
  fixOrientation: true,
};
const WIDTHS = [700, 1100, 1800];
const BODY_SIZES = '(min-width:900px) 760px, calc(100vw - 64px)';

async function encode(src, options) {
  try {
    return await Image(path.join(SITE, src), { ...OUT, ...options });
  } catch (e) {
    // The prebuilt image library cannot decode HEVC, so an iPhone HEIC photo fails here.
    // The editor converts or refuses HEIC before upload; this message is for anything that slips past.
    const heic = /\.hei[cf]$/i.test(src) || /HEVC|heif/i.test(e.message);
    throw new Error(`News photo ${src} could not be processed: ${heic
      ? 'it is an iPhone HEIC photo, which the build cannot read. Replace it with a JPEG.'
      : e.message}`);
  }
}

async function resolve(img) {
  if (!img || typeof img.src !== 'string' || !img.src.startsWith(UPLOADS)) return img;
  const webp = (await encode(img.src, { widths: WIDTHS, formats: ['webp'] })).webp;
  const og = (await encode(img.src, { widths: [1200], formats: ['jpeg'] })).jpeg[0];
  // webp is sorted by width; a photo narrower than 1800 px yields fewer, never upscaled, sizes
  const main = webp.find((s) => s.width >= 1100) || webp[webp.length - 1];
  return {
    ...img,
    src: main.url,
    width: main.width,
    height: main.height,
    srcset: webp.map((s) => `${s.url} ${s.width}w`),
    og: { src: og.url, width: og.width, height: og.height },
  };
}

async function replaceAsync(str, re, fn) {
  const found = [...str.matchAll(re)];
  const swaps = await Promise.all(found.map((m) => fn(...m)));
  let out = '', last = 0;
  found.forEach((m, i) => { out += str.slice(last, m.index) + swaps[i]; last = m.index + m[0].length; });
  return out + str.slice(last);
}

// The first thing in a page that the browser would fetch from another website on load,
// or null. Links a visitor chooses to follow (<a href>) are fine; this looks only at what
// loads by itself: media and frame sources, srcset entries, video posters, <object>,
// stylesheet/preload/icon <link>s and CSS url().
const LOADS = /<(img|source|video|audio|track|iframe|frame|script|embed|object|input|link)\b[^>]*>/gi;
const ATTR = /\s(src|srcset|poster|data|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const FETCHING_LINK = /\srel\s*=\s*["']?[^"'>]*\b(?:stylesheet|preload|modulepreload|prefetch|icon|manifest)\b/i;
const FAR = /^(?:https?:)?\/\//i;
function externalLoad(html) {
  for (const [tag, name] of html.matchAll(LOADS)) {
    const el = name.toLowerCase();
    if (el === 'link' && !FETCHING_LINK.test(tag)) continue;
    for (const [, attr, a, b, c] of tag.matchAll(ATTR)) {
      const at = attr.toLowerCase();
      if ((at === 'href') !== (el === 'link') || (at === 'data' && el !== 'object')) continue;
      const v = (a ?? b ?? c).trim();
      const urls = at === 'srcset' ? v.split(',').map((s) => s.trim().split(/\s+/)[0]) : [v];
      if (urls.some((u) => FAR.test(u))) return tag;
    }
  }
  const css = html.match(/url\(\s*["']?\s*(?:https?:)?\/\/[^)]*\)/i);
  return css ? css[0] : null;
}

// Rewrites every reference to an uploaded original in a finished page: <img> gets the
// processed sizes, a link gets the largest processed size. root is the page's relative
// prefix (../../ for a post), matching how every other link on the site is written.
// Anything still pointing at assets/uploads/ afterwards would 404, so the build stops.
// Runs on every generated page: News, the gallery and the home page.
async function rewriteHtml(html, root, where) {
  // The public site loads nothing from another website. A photo inserted into a post by
  // URL, or typed in as Markdown, would break that, so it stops the build instead.
  const outside = externalLoad(html);
  if (outside) {
    throw new Error(`${where} loads something from another website: ${outside}. `
      + 'The site loads nothing from other sites; upload the photo instead.');
  }
  if (!html.includes('assets/uploads/')) return html;
  const rel = (u) => root + u.slice(1);
  html = await replaceAsync(html, /<img\b[^>]*\ssrc="(\/assets\/uploads\/[^"]+)"[^>]*>/g, async (tag, src) => {
    const img = await resolve({ src: decodeURI(src) });
    const attrs = ` src="${rel(img.src)}" srcset="${img.srcset.map(rel).join(', ')}" sizes="${BODY_SIZES}"`
      + ` width="${img.width}" height="${img.height}" loading="lazy" decoding="async"`;
    return tag.replace(/\ssrc="[^"]*"/, attrs);
  });
  html = await replaceAsync(html, /\shref="(\/assets\/uploads\/[^"]+)"/g, async (attr, src) => {
    const img = await resolve({ src: decodeURI(src) });
    return ` href="${rel(img.srcset[img.srcset.length - 1].split(' ')[0])}"`;
  });
  const left = html.match(/[^"'\s(]*assets\/uploads\/[^"'\s)]*/);
  if (left) {
    throw new Error(`${where} still refers to ${left[0]}. Uploaded photos are never published `
      + 'as uploaded; put photos in a post with the photo fields or the Image button.');
  }
  return html;
}

module.exports = { resolve, rewriteHtml, externalLoad, UPLOADS, OUT };

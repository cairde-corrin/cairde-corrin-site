// Photos uploaded through the news editor land in site/assets/uploads/ exactly as the
// phone produced them, often 5 to 12 MB and carrying GPS position in their EXIF. They are
// never published as uploaded. Each one is re-encoded here, at build time, into WebP at
// 700, 1100 and 1800 px wide, plus one 1200 px JPEG for social media previews.
//
// Re-encoding is the privacy fix: the output keeps no EXIF or XMP, so the GPS position,
// the time, the phone model and the rest stay in the repository and never reach a
// visitor. The one block kept is the ICC colour profile (eleventy-img always keeps it, so
// wide-gamut phone photos keep their colours); it holds no position, time or serial.
// fixOrientation bakes the camera's rotation into the pixels first, because the
// orientation tag is dropped along with everything else.
//
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

async function resolve(img) {
  if (!img || typeof img.src !== 'string' || !img.src.startsWith(UPLOADS)) return img;
  const file = path.join(SITE, img.src);
  const webp = (await Image(file, { ...OUT, widths: WIDTHS, formats: ['webp'] })).webp;
  const og = (await Image(file, { ...OUT, widths: [1200], formats: ['jpeg'] })).jpeg[0];
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

module.exports = { resolve, UPLOADS };

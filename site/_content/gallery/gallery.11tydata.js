// Every photo in this folder is one entry on the Gallery page: front matter carries image,
// alt, caption and, optionally, taken (the date the photo was taken). The entries make
// no pages of their own; site/gallery/index.njk lists them.
const images = require('../../_includes/images.js');
const blocks = require('../../_includes/blocks.js');

module.exports = {
  permalink: false,
  eleventyComputed: {
    // Re-encoded like every news photo: no GPS or other metadata, original never published
    photo: (data) => {
      if (typeof data.image !== 'string' || !data.image.startsWith(images.UPLOADS)) {
        throw new Error(`${data.page.inputPath}: the photo must be one uploaded through the news editor (${images.UPLOADS}...).`);
      }
      // described for people who cannot see it, as the editor requires on saving
      if (!String(data.alt || '').trim()) {
        const file = data.page.inputPath.replace(/^\.\//, ''), name = String(data.caption || data.page.fileSlug);
        const why = 'It has nothing in "Describe the photo for people who cannot see it". Say what is in the photo, in one sentence.';
        blocks.report({ page: name, section: 'Gallery', subject: `the gallery photo "${name}"`, problems: [why], file: `(${file})` });
        throw new Error(`The website was not updated, because of the gallery photo "${name}":\n  - ${why}\n(${file})`);
      }
      return images.resolve({ src: data.image, alt: data.alt });
    },
  },
};

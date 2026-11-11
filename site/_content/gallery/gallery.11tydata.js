// Every photo in this folder is one entry on the Gallery page: front matter carries image,
// alt, caption and, optionally, taken (the date the photo was taken). The entries make
// no pages of their own; site/gallery/index.njk lists them.
const images = require('../../_includes/images.js');

module.exports = {
  permalink: false,
  eleventyComputed: {
    // Re-encoded like every news photo: no GPS or other metadata, original never published
    photo: (data) => {
      if (typeof data.image !== 'string' || !data.image.startsWith(images.UPLOADS)) {
        throw new Error(`${data.page.inputPath}: the photo must be one uploaded through the news editor (${images.UPLOADS}...).`);
      }
      return images.resolve({ src: data.image, alt: data.alt });
    },
  },
};

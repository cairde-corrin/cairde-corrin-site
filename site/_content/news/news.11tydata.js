// Every post in this folder: front matter carries title, date, author, summary and,
// optionally, hero, gallery and youtube. The Markdown below the front matter is the body.
const ld = require('../../_includes/ld.js');
const images = require('../../_includes/images.js');
const youtube = require('../../_includes/youtube.js');
const checks = require('../../admin/checks.js');
const blocks = require('../../_includes/blocks.js');

module.exports = {
  layout: 'post.njk',
  ogType: 'article',
  permalink: (data) => `news/${data.page.fileSlug}/index.html`,
  eleventyComputed: {
    description: (data) => {
      // a photo with no description is refused here as on saving (checks.js), so a post
      // edited outside the editor cannot publish one either
      const found = checks.newsProblems(data, data.page.rawInput);
      if (found.length) {
        const page = `the news post "${data.title}"`, file = data.page.inputPath.replace(/^\.\//, '');
        blocks.report({ page: data.title, section: 'News', subject: `the news post "${data.title}"`, problems: found, file: `(${file})` });
        throw new Error(`The website was not updated, because of ${page}:\n${found.map((x) => `  - ${x}`).join('\n')}\n(${file})`);
      }
      return data.summary;
    },
    // Uploaded photos are swapped for their re-encoded, metadata-free sizes (see images.js)
    hero: (data) => images.resolve(data.hero),
    gallery: (data) => (Array.isArray(data.gallery) ? Promise.all(data.gallery.map(images.resolve)) : data.gallery),
    // A click-to-load player: the ID and a self-hosted still (see youtube.js)
    video: (data) => youtube.resolve(data.youtube, data.page.inputPath),
    ld: (data) => ld.article(data),
  },
};

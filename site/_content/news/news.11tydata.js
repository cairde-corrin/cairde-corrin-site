// Every post in this folder: front matter carries title, date, author, summary and,
// optionally, hero, gallery and youtube. The Markdown below the front matter is the body.
// The youtube field is carried but not rendered yet.
const ld = require('../../_includes/ld.js');

module.exports = {
  layout: 'post.njk',
  ogType: 'article',
  permalink: (data) => `news/${data.page.fileSlug}/index.html`,
  eleventyComputed: {
    description: (data) => data.summary,
    ld: (data) => ld.article(data),
  },
};

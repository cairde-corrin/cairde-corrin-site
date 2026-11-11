// The News listing: the same JSON-LD shape as every other section page.
const ld = require('../_includes/ld.js');

module.exports = {
  eleventyComputed: {
    ld: () => ld.page([['Home', '/'], ['News']]),
  },
};

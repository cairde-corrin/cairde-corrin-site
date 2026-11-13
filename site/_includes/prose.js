// Renders the page text editors write (site/_data/pages/*.json) into a page. Markdown,
// inline only and with raw HTML switched off, so editors get *italic*, **bold** and links
// and nothing else. Figures are ordinary words in that text; the consistency check
// (_includes/figurecheck.js) warns when two pages give the same figure differently.
const md = require('markdown-it')({ html: false });

function prose(text) {
  return md.renderInline(String(text == null ? '' : text))
    .replace(/<em>/g, '<em class="hy">')  // the site's italic for place names
    .replace(/&quot;/g, '"');
}

module.exports = { prose };

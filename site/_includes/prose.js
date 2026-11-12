// Renders the page text editors write (site/_data/pages/*.json) into a page. Markdown,
// inline only and with raw HTML switched off, so editors get *italic*, **bold** and links
// and nothing else. Measured figures are not typed into that text: it carries tokens
// such as {catchment.area_ha}, filled in here from site/_data/figures.json, which the
// editor cannot reach. An editor can reword a sentence but cannot change a figure, and
// a token that names no figure stops the build.
const md = require('markdown-it')({ html: false });
const figures = require('../_data/figures.json');

function prose(text) {
  let out = md.renderInline(String(text == null ? '' : text))
    .replace(/<em>/g, '<em class="hy">')  // the site's italic for place names
    .replace(/&quot;/g, '"');
  return out.replace(/\{([A-Za-z0-9_.]+)\}/g, (m, key) => {
    const value = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), figures);
    if (typeof value !== 'string') throw new Error(`Page text refers to {${key}}, which is not a figure in site/_data/figures.json.`);
    return value;
  });
}

module.exports = { prose };

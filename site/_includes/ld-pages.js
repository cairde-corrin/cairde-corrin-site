// Structured data added to every generated page at build time, as a second JSON-LD block
// after the page's own: a WebPage node for every page, tied to the site and, where the
// page is about one thing (the loop, a stop, the species list, the stories), to that
// thing as mainEntity. The main entity is the first node in the page's own JSON-LD whose
// @id belongs to the page (https://www.cairdecorrin.ie/trails/#glenabo-loop on /trails/).
// The species and story lists themselves are built from the same blocks that draw the
// page (_includes/blocks.js, ldItems), so the structured data cannot say something the
// page does not.
const SITE = 'https://www.cairdecorrin.ie';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (s) => (s || '').replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
    : ENTITIES[e] ?? m))
  .replace(/\s+/g, ' ').trim();
const first = (re, s) => { const m = s.match(re); return m ? m[1] : undefined; };

function addLd(html, url) {
  const own = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!own || !html.includes('</head>')) return html;
  const nodes = [];
  const graph = JSON.parse(own[1])['@graph'] || [];
  const here = `${SITE}${url}#`;
  const main = (graph.find((n) => (n['@id'] || '').startsWith(here)
    && !/#(organisation|website)$/.test(n['@id'])) || {})['@id'];
  nodes.unshift({ '@type': 'WebPage', '@id': `${SITE}${url}`, url: `${SITE}${url}`,
    name: text(first(/<title>([\s\S]*?)<\/title>/, html)), inLanguage: 'en-IE',
    isPartOf: { '@id': `${SITE}/#website` }, ...(main && { mainEntity: { '@id': main } }) });
  const block = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }, null, 1)}\n</script>\n`;
  return html.replace('</head>', `${block}</head>`);
}

module.exports = { addLd };

// Structured data added to every generated page at build time, as a second JSON-LD block
// after the page's own. It does two things:
//
// 1. A WebPage node for every page, tied to the site and, where the page is about one
//    thing (the loop, a stop, the species list, the stories), to that thing as mainEntity.
//    The main entity is the first node in the page's own JSON-LD whose @id belongs to the
//    page (https://www.cairdecorrin.ie/trails/#glenabo-loop on /trails/), or the list
//    below.
// 2. The species and folklore lists, read from the page's own visible markup, so the
//    structured data can never say something the page does not.
const SITE = 'https://www.cairdecorrin.ie';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (s) => (s || '').replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
    : ENTITIES[e] ?? m))
  .replace(/\s+/g, ' ').trim();
const first = (re, s) => { const m = s.match(re); return m ? m[1] : undefined; };

// /species/: one <li class="sp"> per species
function species(html, url) {
  const items = html.split(/<li class="sp[ "]/).slice(1).map((block) => {
    const common = text(first(/<h2 class="sp-name">([\s\S]*?)<\/h2>/, block));
    const sci = first(/<span class="sp-sci[^"]*">([\s\S]*?)<\/span>/, block) || '';
    const cite = first(/<p class="sp-cite"><a href="([^"]+)"/, block);
    const recs = [...block.matchAll(/<span class="sp-trail">([\s\S]*?)<\/span><span class="sp-date">([\s\S]*?)<\/span>/g)]
      .map(([, t, d]) => [text(t), text(d)].filter(Boolean).join(', '));
    const family = /^Family /.test(text(sci));
    const taxon = family
      ? { '@type': 'Taxon', name: common, parentTaxon: { '@type': 'Taxon', name: text(first(/<em>(.*?)<\/em>/, sci)), taxonRank: 'family' } }
      : { '@type': 'Taxon', name: text(first(/<em>(.*?)<\/em>/, sci)), alternateName: common, taxonRank: 'species' };
    if (cite) taxon.sameAs = cite;
    if (recs.length) taxon.description = `Recorded on the ${recs.join('; ')}.`;
    return taxon;
  });
  return { '@type': 'ItemList', '@id': `${SITE}${url}#species`, name: 'Species recorded on the trails',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) };
}

// /folklore/: one story per <h2 class="as-h3" id="...">, its source line, summary and dúchas.ie link
function folklore(html, url) {
  const items = html.split(/<h2 class="as-h3" id="/).slice(1).map((block) => {
    const id = block.slice(0, block.indexOf('"'));
    const story = { '@type': 'CreativeWork', '@id': `${SITE}${url}#${id}`,
      name: text(first(/^[^>]*>([\s\S]*?)<\/h2>/, block)),
      abstract: text(first(/<p>([\s\S]*?)<\/p>/, block)) };
    const src = first(/<p class="story-src">([\s\S]*?)<\/p>/, block);
    const link = first(/href="(https:\/\/www\.duchas\.ie[^"]+)"/, block);
    if (src || link) story.isBasedOn = { '@type': 'CreativeWork', ...(src && { description: text(src) }), ...(link && { url: link }) };
    const place = first(/<p class="story-place">([\s\S]*?)<\/p>/, block);
    if (place) story.description = text(place);
    return story;
  });
  return { '@type': 'ItemList', '@id': `${SITE}${url}#stories`, name: 'Stories from the National Folklore Collection',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) };
}

const LISTS = { '/species/': species, '/folklore/': folklore };

function addLd(html, url) {
  const own = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!own || !html.includes('</head>')) return html;
  const nodes = [];
  const list = LISTS[url] && LISTS[url](html, url);
  if (list) nodes.push(list);
  const graph = JSON.parse(own[1])['@graph'] || [];
  const here = `${SITE}${url}#`;
  const main = list ? list['@id'] : (graph.find((n) => (n['@id'] || '').startsWith(here)
    && !/#(organisation|website)$/.test(n['@id'])) || {})['@id'];
  nodes.unshift({ '@type': 'WebPage', '@id': `${SITE}${url}`, url: `${SITE}${url}`,
    name: text(first(/<title>([\s\S]*?)<\/title>/, html)), inLanguage: 'en-IE',
    isPartOf: { '@id': `${SITE}/#website` }, ...(main && { mainEntity: { '@id': main } }) });
  const block = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }, null, 1)}\n</script>\n`;
  return html.replace('</head>', `${block}</head>`);
}

module.exports = { addLd, species, folklore };

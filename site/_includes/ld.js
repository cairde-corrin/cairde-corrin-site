// JSON-LD for News pages, in the same shape and order as every hand-written page:
// the organisation, the website, a breadcrumb trail, and for a post an Article.
const SITE = 'https://www.cairdecorrin.ie';

const ORGANISATION = {
  '@type': 'NGO',
  '@id': SITE + '/#organisation',
  name: 'Cáirde Corrin',
  url: SITE + '/',
  logo: { '@type': 'ImageObject', url: SITE + '/assets/img/logo.webp', width: 400, height: 144 },
  areaServed: {
    '@type': 'Place',
    name: 'Fermoy, County Cork, Ireland',
    address: { '@type': 'PostalAddress', addressLocality: 'Fermoy', addressRegion: 'County Cork',
      addressCountry: 'IE' },
  },
};
const WEBSITE = {
  '@type': 'WebSite', '@id': SITE + '/#website', name: 'Cáirde Corrin', url: SITE + '/',
  inLanguage: 'en-IE', publisher: { '@id': SITE + '/#organisation' },
};

// crumbs: [[name, path], ...]; the last one is the current page and carries no link
function breadcrumbs(crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, path], i) => Object.assign(
      { '@type': 'ListItem', position: i + 1, name },
      i < crumbs.length - 1 ? { item: SITE + path } : {})),
  };
}

const iso = (d) => new Date(d).toISOString().slice(0, 10);

module.exports = {
  page(crumbs) {
    return { '@context': 'https://schema.org', '@graph': [ORGANISATION, WEBSITE, breadcrumbs(crumbs)] };
  },
  article(data) {
    const url = SITE + data.page.url;
    const article = {
      '@type': 'Article',
      '@id': url + '#article',
      headline: data.title,
      description: data.summary,
      datePublished: iso(data.page.date),
      dateModified: iso(data.updated || data.page.date),
      author: { '@type': data.author === 'Cáirde Corrin' ? 'Organization' : 'Person', name: data.author },
      publisher: { '@id': SITE + '/#organisation' },
      mainEntityOfPage: url,
      image: SITE + (data.hero && data.hero.og ? data.hero.og.src
        : data.hero && data.hero.src ? data.hero.src : '/assets/img/og-default.jpg'),
      inLanguage: 'en-IE',
    };
    const graph = module.exports.page([['Home', '/'], ['News', '/news/'], [data.title]])['@graph'];
    return { '@context': 'https://schema.org', '@graph': graph.concat(article) };
  },
};

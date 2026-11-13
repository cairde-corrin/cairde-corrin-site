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

// ---------- the editable pages ----------
// Each page's structured data, assembled from three places and never inferred from where
// its blocks sit: the page's own "About this page" fields (its title, and what it is
// about), the things its blocks list (species, stories, recordings), and the survey data
// (figures.json and the stops' positions). Deleting or moving a block cannot change what
// the page says it is.
const blocks = require('./blocks.js');
const images = require('./images.js');
const CRUMBS = {
  home: [], about: ['About'], links: ['Links'], new_spaces: ['New spaces'], water: ['Water and ecosystems'],
  credits: ['Credits and sources'], species: ['Species'], folklore: ['Folklore'], recordings: ['Recordings'], trails: ['Trails'],
};
const num = (v) => +v;
const prop = (name, value, unitCode, unitText) => ({ '@type': 'PropertyValue', name, value: num(value), unitCode, unitText });
const CATCHMENT = SITE + '/#glenabo-catchment';
const LOOP = SITE + '/trails/#glenabo-loop';
const stopUrl = (n) => `${SITE}/stops/stop-${n}.html`;

function catchment(pages, f, full) {
  const s = (pages.home && pages.home.page && pages.home.page.subject) || {};
  return Object.assign({ '@type': 'Place', '@id': CATCHMENT, name: s.name, description: s.description,
    geo: { '@type': 'GeoCoordinates', latitude: num(f.catchment.outlet_lat), longitude: num(f.catchment.outlet_lon) } },
  full ? { additionalProperty: [prop('Area', f.catchment.area_ha, 'HAR', 'ha'), prop('Highest point', f.catchment.elev_max_m, 'MTR', 'm'),
    prop('Outlet', f.catchment.outlet_m, 'MTR', 'm OD')] } : {},
  { containedInPlace: { '@type': 'Place', name: 'Fermoy, County Cork, Ireland' } },
  full ? { hasMap: SITE + '/trails/' } : {});
}

// key: the page's file in site/_data/pages; url: its address. Returns the JSON-LD text.
async function forPage(key, pages, url, figures) {
  const d = pages[key];
  const title = d.page.title;
  const stop = /^stop_(\d+)$/.exec(key);
  const crumbs = [['Home', '/']];
  if (stop) crumbs.push(['Trails', '/trails/'], [`Stop ${stop[1].padStart(2, '0')}`]);
  else if (key === 'corrin_moor' || key === 'corrin_wetlands') crumbs.push(['New spaces', '/new-spaces/'], [title]);
  else if (CRUMBS[key]) crumbs.push(...CRUMBS[key].map((n) => [n]));
  else crumbs.push([title]);
  if (key === 'home') crumbs[0] = ['Home'];
  const graph = module.exports.page(crumbs)['@graph'];
  if (key === 'home') graph.push(catchment(pages, figures, false));
  if (stop && d.hero && d.hero.title) {
    const p = blocks.stopPlace(d.hero, title);
    const geo = { '@type': 'GeoCoordinates', latitude: num(p.lat), longitude: num(p.lon) };
    // an uploaded photo is published under its re-encoded name, not the upload's
    const photo = d.hero.photo.startsWith(images.UPLOADS) ? (await images.resolve({ src: decodeURI(d.hero.photo) })).src : d.hero.photo;
    graph.push({ '@type': 'TouristAttraction', '@id': `${stopUrl(stop[1])}#place`, name: `Stop ${stop[1].padStart(2, '0')} - ${title}`,
      url: stopUrl(stop[1]), geo: { ...geo, elevation: num(p.elevation) },
      photo: { '@type': 'ImageObject', url: SITE + photo, contentLocation: { '@type': 'Place', geo } },
      containedInPlace: [{ '@id': CATCHMENT }, { '@id': LOOP }] });
  }
  if (key === 'trails') {
    const s = d.page.subject || {};
    const f = figures;
    const stops = blocks.stopList(pages).filter((x) => x.recorded);
    const first = stops[0];
    graph.push({ '@type': 'TouristAttraction', '@id': LOOP, name: s.name, description: s.description, url: SITE + '/trails/',
      ...(first && { geo: { '@type': 'GeoCoordinates', latitude: num(first.lat), longitude: num(first.lon), elevation: num(first.elevation) } }),
      additionalProperty: [prop('Length', f.loop.length_km, 'KMT', 'km'), prop('Total ascent', f.loop.ascent_m, 'MTR', 'm'),
        prop('Lowest point', f.loop.min_m, 'MTR', 'm'), prop('Highest point', f.loop.max_m, 'MTR', 'm')],
      containsPlace: stops.map((x) => ({ '@id': `${stopUrl(x.n)}#place` })),
      containedInPlace: { '@id': CATCHMENT }, hasMap: SITE + '/trails/',
      subjectOf: { '@type': 'DataDownload', name: 'GPS track of the Glenabo loop', contentUrl: SITE + '/assets/data/glenabo-loop.gpx', encodingFormat: 'application/gpx+xml' } });
    graph.push(catchment(pages, f, true));
    graph.push({ '@type': 'Place', '@id': SITE + '/trails/#action-area', name: 'Proposed area for action',
      description: `A drawn proposal of about ${f.action_area.ha} ha: the Glenabo catchment with Glenabo Wood, Corrin Hill and Knockananig Reservoir added. Offered for discussion, not a designation.`,
      additionalProperty: [prop('Area', f.action_area.ha, 'HAR', 'ha')], containsPlace: { '@id': CATCHMENT }, hasMap: SITE + '/trails/' });
  }
  graph.push(...blocks.ldItems(d, url));
  // "<" written as <, so no text an editor types can close the script element
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c');
}

module.exports = {
  forPage,
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

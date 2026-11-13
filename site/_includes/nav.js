// The site navigation, defined once. Every page's header and footer is built from this.
//
// The header shows five entries (four while News is empty): two direct links and three
// groups that open a short list. A new page joins a group, so the header row stays the same width whether the
// site has ten pages or twelve. Groups open on click (site.js); below the menu
// breakpoint the whole list folds behind the Menu button, groups and all.
//
// News, the Gallery and Articles are sections that fill up over time, and each follows
// one rule: it appears in the header and the footer once it has a published entry. While
// it is empty its page is still built, so an old link still works, but it shows only its
// empty-state message, is marked noindex (base.njk) and is left out of sitemap.xml.
const NAV = [
  { href: 'trails/', label: 'Trails' },
  { id: 'explore', label: 'Explore', items: [
    { href: 'species/', label: 'Species' },
    { href: 'folklore/', label: 'Folklore' },
    { href: 'recordings/', label: 'Recordings' },
    { href: 'gallery/', label: 'Gallery', section: 'gallery' },
    { href: 'articles/', label: 'Articles', section: 'articles' },
  ] },
  { id: 'work', label: 'Our work', items: [
    { href: 'new-spaces/', label: 'New spaces' },
    { href: 'water/', label: 'Water & ecosystems' },
  ] },
  { href: 'news/', label: 'News', section: 'news' },
  { id: 'about', label: 'About', items: [
    { href: 'about/', label: 'About the group' },
    { href: 'links/', label: 'Links' },
  ] },
];

// url: the page being built, e.g. /new-spaces/corrin-moor.html. counts: how many published
// entries each section has, { news, gallery, articles }; a section's link appears only
// when it has some.
function nav(url, counts = {}) {
  const shown = (i) => !i.section || counts[i.section] > 0;
  const here = (i) => url.startsWith('/' + i.href);
  return NAV.filter(shown).map((g) => {
    if (!g.items) return { ...g, current: here(g) };
    const items = g.items.filter(shown).map((i) => ({ ...i, current: here(i) }));
    return { ...g, items, current: items.some((i) => i.current) };
  });
}

module.exports = { nav };

// The site navigation, defined once. Every page's header and footer is built from this.
//
// The header shows five entries: two direct links and three groups that open a short
// list. A new page joins a group, so the header row stays the same width whether the
// site has ten pages or twelve. Groups open on click (site.js); below the menu
// breakpoint the whole list folds behind the Menu button, groups and all.
//
// The Gallery and Articles links appear only once there is something in them.
const NAV = [
  { href: 'trails/', label: 'Trails' },
  { id: 'explore', label: 'Explore', items: [
    { href: 'species/', label: 'Species' },
    { href: 'folklore/', label: 'Folklore' },
    { href: 'recordings/', label: 'Recordings' },
    { href: 'gallery/', label: 'Gallery' },
    { href: 'articles/', label: 'Articles' },
  ] },
  { id: 'work', label: 'Our work', items: [
    { href: 'new-spaces/', label: 'New spaces' },
    { href: 'water/', label: 'Water & ecosystems' },
  ] },
  { href: 'news/', label: 'News' },
  { id: 'about', label: 'About', items: [
    { href: 'about/', label: 'About the group' },
    { href: 'links/', label: 'Links' },
  ] },
];

// url: the page being built, e.g. /new-spaces/corrin-moor.html. galleryCount and
// articleCount: entries in those collections; their links appear only when there are some.
function nav(url, galleryCount, articleCount) {
  const shown = (i) => (i.href !== 'gallery/' || galleryCount > 0) && (i.href !== 'articles/' || articleCount > 0);
  const here = (i) => url.startsWith('/' + i.href);
  return NAV.filter(shown).map((g) => {
    if (!g.items) return { ...g, current: here(g) };
    const items = g.items.filter(shown).map((i) => ({ ...i, current: here(i) }));
    return { ...g, items, current: items.some((i) => i.current) };
  });
}

module.exports = { nav };

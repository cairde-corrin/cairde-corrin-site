// The site navigation, defined once. Every page's header and footer is built from this.
//
// The header shows five entries: two direct links and three groups that open a short
// list. A new page joins a group, so the header row stays the same width whether the
// site has ten pages or twelve. Groups open on click (site.js); below the menu
// breakpoint the whole list folds behind the Menu button, groups and all.
//
// The Gallery link appears only once the gallery has a photo.
const NAV = [
  { href: 'trails/', label: 'Trails' },
  { id: 'explore', label: 'Explore', items: [
    { href: 'species/', label: 'Species' },
    { href: 'folklore/', label: 'Folklore' },
    { href: 'recordings/', label: 'Recordings' },
    { href: 'gallery/', label: 'Gallery' },
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

// url: the page being built, e.g. /new-spaces/corrin-moor.html. galleryCount: photos in the gallery.
function nav(url, galleryCount) {
  const shown = (i) => i.href !== 'gallery/' || galleryCount > 0;
  const here = (i) => url.startsWith('/' + i.href);
  return NAV.filter(shown).map((g) => {
    if (!g.items) return { ...g, current: here(g) };
    const items = g.items.filter(shown).map((i) => ({ ...i, current: here(i) }));
    return { ...g, items, current: items.some((i) => i.current) };
  });
}

module.exports = { nav };

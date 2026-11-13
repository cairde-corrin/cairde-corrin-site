// Every file already in site/ is published byte for byte: it is copied, never rendered.
// The only templates are the .njk pages, the .md entries in _content/ and the layouts in
// _includes/. Every page is a .njk file so that its header and footer can be built from
// one definition (_includes/nav.js); apart from those two includes, a hand-written page
// is written out exactly as it is. The copy filter keeps those
// sources out of the output, and no other file format is a template, so nothing else is
// parsed or rewritten. _data/ holds data the editor changes, such as the home page's
// social posts. _instagram/ holds the saved Instagram posts; _includes/instagram.js
// publishes their pictures under assets/img/instagram/.
// assets/uploads/ holds the editor's uploads (already stripped in the browser). They are never copied:
// _includes/images.js publishes re-encoded sizes under assets/img/news/ instead.
const fs = require('node:fs');
const path = require('node:path');
const SOURCES = ['!**/*.njk', '!**/*.md', '!**/*.11tydata.js', '!_includes', '!_includes/**',
  '!_content', '!_content/**', '!_data', '!_data/**', '!assets/uploads', '!assets/uploads/**', '!_instagram', '!_instagram/**'];
const images = require('./site/_includes/images.js');
const social = require('./site/_includes/social.js');
const { nav } = require('./site/_includes/nav.js');
const ldPages = require('./site/_includes/ld-pages.js');
const csp = require('./site/_includes/csp.js');
const { prose } = require('./site/_includes/prose.js');
const figurecheck = require('./site/_includes/figurecheck.js');
const blocks = require('./site/_includes/blocks.js');
const ld = require('./site/_includes/ld.js');
// Relative prefix back to the site root: /news/x/ -> ../../, /stops/stop-1.html -> ../
const root = (url) => '../'.repeat(url.replace(/[^/]*$/, '').split('/').filter(Boolean).length);

// When a page stops the build, the last thing in the build log is a plain explanation for
// the editor who published it: the build's own error, with its stack trace, comes above it.
// The same explanation is written to .cache/build-failure.json, which exists only when a
// page's content stopped the build: the build check on GitHub opens an issue from it
// (.github/workflows/build-check.yml), and any other kind of failure leaves no such file.
process.once('exit', (code) => {
  const p = blocks.lastProblem();
  if (!code || !p) return;
  const summary = 'THE WEBSITE WAS NOT UPDATED. The live website has not changed.\n\n'
    + `The page "${p.page}" in the editor needs fixing:\n${p.problems.map((x) => `  - ${x}`).join('\n')}\n\n`
    + `To fix it: in the editor, open Contents, then Pages, then "${p.page}". Put the block right and\n`
    + 'publish again. If you are not sure what to do, ask whoever looks after the website.\n'
    + `(For whoever looks after the website: ${p.file.slice(1, -1)}.)`;
  const line = '='.repeat(72);
  console.error(`\n${line}\n${summary}\n${line}`);
  try {
    fs.mkdirSync(path.join(__dirname, '.cache'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '.cache', 'build-failure.json'),
      JSON.stringify({ page: p.page, problems: p.problems, file: p.file.slice(1, -1), summary }, null, 1));
  } catch (e) { /* the log above still says it */ }
});
// A build that gets as far as starting clears any record of an earlier failure
try { fs.rmSync(path.join(__dirname, '.cache', 'build-failure.json'), { force: true }); } catch (e) { /* none */ }

module.exports = function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(['njk', 'md']);
  // Markdown is written by editors, so it may not carry raw HTML: a <script> or an onerror
  // attribute in a post would otherwise run on the public site. Tags are shown as text.
  eleventyConfig.amendLibrary('md', (md) => md.set({ html: false }));
  eleventyConfig.addPassthroughCopy({ site: '/' }, { filter: ['**', ...SOURCES] });
  // A post, photo or article an editor has taken off the website ("Take this off the
  // website", hidden: true in its front matter) is left out of the build entirely: no
  // page, no place in any list or the sitemap, its photos not encoded. The file stays in
  // the repository so the editor can untick it and publish it again.
  for (const dir of ['news', 'gallery', 'articles']) {
    const folder = path.join(__dirname, 'site', '_content', dir);
    for (const f of fs.readdirSync(folder).filter((n) => n.endsWith('.md'))) {
      const front = fs.readFileSync(path.join(folder, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (front && /^hidden:\s*true\s*$/m.test(front[1])) eleventyConfig.ignores.add(`site/_content/${dir}/${f}`);
    }
  }
  // Each page keeps the address it had as a hand-written file: trails/index.njk ->
  // trails/index.html, stops/stop-1.njk -> stops/stop-1.html. Front matter or a
  // directory data file (News, the sitemap) overrides this.
  eleventyConfig.addGlobalData('permalink', () => (data) => `${data.page.filePathStem.slice(1)}.html`);
  eleventyConfig.addFilter('navItems', nav);
  // The editable pages: their blocks (_includes/blocks.js) and their structured data
  // (_includes/ld.js), both from site/_data/pages/<key>.json. A broken block stops the build.
  eleventyConfig.addAsyncFilter('blocks', (pages, key, url, gallery, instagram, socialData, figures) =>
    blocks.render(key, pages[key], { url, pages, gallery, instagram, social: social.posts(socialData), figures,
      film: key === 'home' ? fs.readFileSync(path.join(__dirname, 'site', '_includes', 'film.html'), 'utf8').trim() : '' }));
  eleventyConfig.addAsyncFilter('pageLd', (pages, key, url, figures) => ld.forPage(key, pages, url, figures));
  eleventyConfig.addFilter('sitePhotos', (pages) => JSON.stringify(blocks.sitePhotos(pages), null, 1));
  // The stops whose page has content, for the sitemap; what the map draws besides the survey data
  eleventyConfig.addFilter('recordedStops', (pages) => blocks.stopList(pages).filter((s) => s.recorded));
  // The terms page's count of stops not yet surveyed, from the stops' own pages, as the
  // trails page counts them: " Seven of the ten stops have not been surveyed at all.", or
  // nothing once every stop has been surveyed
  eleventyConfig.addFilter('unsurveyedSentence', blocks.unsurveyedSentence);
  eleventyConfig.addAsyncFilter('mapLayers', async (pages) => {
    const { version, ...data } = await blocks.mapLayers(pages);
    return JSON.stringify(data);
  });
  // Page text from the editor (_includes/prose.js)
  eleventyConfig.addFilter('prose', prose);
  // The editor's Help page (admin/help.njk) is docs/EDITOR-GUIDE.md itself, rendered here
  eleventyConfig.addFilter('guide', (file) => require('markdown-it')({ html: false })
    .render(require('node:fs').readFileSync(require('node:path').join(__dirname, file), 'utf8')));
  eleventyConfig.addWatchTarget('./docs/EDITOR-GUIDE.md');
  // The address shown under each link on the Links page; editors type the full address
  eleventyConfig.addFilter('domain', (url) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error(`Links page: ${url} is not an https:// address.`);
    return u.hostname.replace(/^www\./, '');
  });

  // Photos placed in a post's body come out of Markdown as <img src="/assets/uploads/...">.
  // This sends them through the same re-encoding as the hero and gallery, and stops the
  // build if a generated page (News, the gallery, the home page) would load anything from
  // another website. Templates only: copied files never pass through a transform.
  eleventyConfig.addTransform('uploads', function (content) {
    const out = this.page.outputPath;
    return typeof out === 'string' && out.endsWith('.html')
      ? images.rewriteHtml(content, root(this.page.url), this.page.inputPath) : content;
  });
  // A WebPage node for every page, and the species and folklore lists read from the
  // pages' own markup (_includes/ld-pages.js).
  eleventyConfig.addTransform('ld', function (content) {
    const out = this.page.outputPath;
    return typeof out === 'string' && out.endsWith('.html') ? ldPages.addLd(content, this.page.url) : content;
  });
  // HTML comments in the sources are notes for whoever edits them; visitors' copies do not need them
  eleventyConfig.addTransform('comments', function (content) {
    const out = this.page.outputPath;
    return typeof out === 'string' && out.endsWith('.html') ? content.replace(/[ \t]*<!--[\s\S]*?-->\n?/g, '') : content;
  });
  // The Content Security Policy, as a <meta> tag on every page (_includes/csp.js)
  eleventyConfig.addTransform('csp', function (content) {
    const out = this.page.outputPath;
    return typeof out === 'string' && out.endsWith('.html') ? csp.addCsp(content, this.page.inputPath) : content;
  });
  // The figure consistency check (_includes/figurecheck.js) reads every finished page once
  // the build is done, and warns when two pages give the same figure differently. It
  // only warns: nothing it finds, and no fault in it, can stop a build.
  let built = [];
  eleventyConfig.on('eleventy.before', () => { built = []; });
  eleventyConfig.addTransform('figures', function (content) {
    const out = this.page.outputPath;
    if (typeof out === 'string' && out.endsWith('.html') && !this.page.url.startsWith('/admin/')) built.push({ url: this.page.url, html: content });
    return content;
  });
  eleventyConfig.on('eleventy.after', () => {
    try {
      const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
      const reference = read(path.join(__dirname, 'site', '_data', 'figures.json'));
      // how many species, recordings, stories, recorded stops ... the website actually has
      const dir = path.join(__dirname, 'site', '_data', 'pages');
      const pages = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), read(path.join(dir, f))]));
      reference.counts = blocks.counts(pages);
      for (const w of figurecheck.check(built, reference)) console.warn(`[figures] ${w}`);
    } catch (e) {
      console.warn(`[figures] the figure check could not run (${e.message}); the build is unaffected.`);
    }
  });

  eleventyConfig.addCollection('news', (api) =>
    api.getFilteredByGlob('site/_content/news/*.md').sort((a, b) => b.date - a.date));
  // Newest photo first by the date it was taken; undated photos after, newest added first
  const taken = (item) => (item.data.taken ? +new Date(item.data.taken) : -Infinity);
  eleventyConfig.addCollection('gallery', (api) =>
    api.getFilteredByGlob('site/_content/gallery/*.md')
      .sort((a, b) => (taken(b) - taken(a)) || b.inputPath.localeCompare(a.inputPath)));
  eleventyConfig.addFilter('socialPosts', social.posts);
  eleventyConfig.addCollection('articles', (api) =>
    api.getFilteredByGlob('site/_content/articles/*.md').sort((a, b) => b.date - a.date));
  // Where "Edit this page" leads in the editor, for pages an editor can change; '' for the rest
  const EDIT = { '/': 'pages/entries/home', '/about/': 'pages/entries/about', '/links/': 'pages/entries/links',
    '/new-spaces/': 'pages/entries/new_spaces', '/new-spaces/corrin-moor.html': 'pages/entries/corrin_moor',
    '/new-spaces/corrin-wetlands.html': 'pages/entries/corrin_wetlands', '/stops/stop-1.html': 'pages/entries/stop_1',
    '/stops/stop-2.html': 'pages/entries/stop_2', '/stops/stop-3.html': 'pages/entries/stop_3',
    '/water/': 'pages/entries/water', '/credits/': 'pages/entries/credits', '/species/': 'pages/entries/species',
    '/folklore/': 'pages/entries/folklore', '/recordings/': 'pages/entries/recordings', '/trails/': 'pages/entries/trails',
    '/news/': 'news', '/gallery/': 'gallery', '/articles/': 'articles' };
  eleventyConfig.addFilter('editLink', (page) => {
    if (/\/_content\/news\/[^/]+\.md$/.test(page.inputPath)) return `collections/news/entries/${page.inputPath.split('/').pop().slice(0, -3)}`;
    return EDIT[page.url] ? `collections/${EDIT[page.url]}` : '';
  });

  // Relative root for a page URL, as every existing page writes its links: /news/ -> ../
  eleventyConfig.addFilter('root', root);
  // A root-absolute asset path from front matter, written relative like the rest of the page
  eleventyConfig.addFilter('rel', (src, root) => (src.startsWith('/') ? root + src.slice(1) : src));
  eleventyConfig.addFilter('isoDate', (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter('longDate', (d) => new Date(d).toLocaleDateString('en-IE',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));

  return {
    dir: { input: 'site', output: '_site', includes: '_includes' },
    markdownTemplateEngine: false,
    htmlTemplateEngine: false,
  };
};

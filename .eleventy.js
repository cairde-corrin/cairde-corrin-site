// Every file already in site/ is published byte for byte: it is copied, never rendered.
// The only templates are the .njk pages, the .md entries in _content/ and the layouts in
// _includes/. Every page is a .njk file so that its header and footer can be built from
// one definition (_includes/nav.js); apart from those two includes, a hand-written page
// is written out exactly as it is. The copy filter keeps those
// sources out of the output, and no other file format is a template, so nothing else is
// parsed or rewritten. _data/ holds data the editor changes, such as the home page's
// social posts.
// assets/uploads/ holds the editor's uploads (already stripped in the browser). They are never copied:
// _includes/images.js publishes re-encoded sizes under assets/img/news/ instead.
const SOURCES = ['!**/*.njk', '!**/*.md', '!**/*.11tydata.js', '!_includes', '!_includes/**',
  '!_content', '!_content/**', '!_data', '!_data/**', '!assets/uploads', '!assets/uploads/**'];
const images = require('./site/_includes/images.js');
const social = require('./site/_includes/social.js');
const { nav } = require('./site/_includes/nav.js');
const ldPages = require('./site/_includes/ld-pages.js');
const csp = require('./site/_includes/csp.js');
// Relative prefix back to the site root: /news/x/ -> ../../, /stops/stop-1.html -> ../
const root = (url) => '../'.repeat(url.replace(/[^/]*$/, '').split('/').filter(Boolean).length);

module.exports = function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(['njk', 'md']);
  // Markdown is written by editors, so it may not carry raw HTML: a <script> or an onerror
  // attribute in a post would otherwise run on the public site. Tags are shown as text.
  eleventyConfig.amendLibrary('md', (md) => md.set({ html: false }));
  eleventyConfig.addPassthroughCopy({ site: '/' }, { filter: ['**', ...SOURCES] });
  // Each page keeps the address it had as a hand-written file: trails/index.njk ->
  // trails/index.html, stops/stop-1.njk -> stops/stop-1.html. Front matter or a
  // directory data file (News, the sitemap) overrides this.
  eleventyConfig.addGlobalData('permalink', () => (data) => `${data.page.filePathStem.slice(1)}.html`);
  eleventyConfig.addFilter('navItems', nav);

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

  eleventyConfig.addCollection('news', (api) =>
    api.getFilteredByGlob('site/_content/news/*.md').sort((a, b) => b.date - a.date));
  // Newest photo first by the date it was taken; undated photos after, newest added first
  const taken = (item) => (item.data.taken ? +new Date(item.data.taken) : -Infinity);
  eleventyConfig.addCollection('gallery', (api) =>
    api.getFilteredByGlob('site/_content/gallery/*.md')
      .sort((a, b) => (taken(b) - taken(a)) || b.inputPath.localeCompare(a.inputPath)));
  eleventyConfig.addFilter('socialPosts', social.posts);

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

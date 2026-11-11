// Every file already in site/ is published byte for byte: it is copied, never rendered.
// The only templates are the News sources: .njk pages, .md posts in _content/news/, and
// the layouts in _includes/. The copy filter keeps those sources out of the output, and
// no other file format is a template, so nothing else is parsed or rewritten.
// assets/uploads/ holds news photos exactly as uploaded, GPS and all. They are never copied:
// _includes/images.js publishes re-encoded sizes under assets/img/news/ instead.
const SOURCES = ['!**/*.njk', '!**/*.md', '!**/*.11tydata.js', '!_includes', '!_includes/**',
  '!_content', '!_content/**', '!assets/uploads', '!assets/uploads/**'];
const images = require('./site/_includes/images.js');
const root = (url) => '../'.repeat(url.split('/').filter(Boolean).length);

module.exports = function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(['njk', 'md']);
  eleventyConfig.addPassthroughCopy({ site: '/' }, { filter: ['**', ...SOURCES] });

  // Photos placed in a post's body come out of Markdown as <img src="/assets/uploads/...">.
  // This sends them through the same re-encoding as the hero and gallery. Templates only:
  // copied files never pass through a transform.
  eleventyConfig.addTransform('uploads', function (content) {
    const out = this.page.outputPath;
    return typeof out === 'string' && out.endsWith('.html')
      ? images.rewriteHtml(content, root(this.page.url), this.page.inputPath) : content;
  });

  eleventyConfig.addCollection('news', (api) =>
    api.getFilteredByGlob('site/_content/news/*.md').sort((a, b) => b.date - a.date));

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

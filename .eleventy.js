// Passthrough only. Every file under site/ is copied to _site/ byte for byte, and no
// file is a template: templateFormats is empty, so Eleventy parses, renders and
// rewrites nothing. The published output is identical to site/.
module.exports = function (eleventyConfig) {
  eleventyConfig.setTemplateFormats([]);
  eleventyConfig.addPassthroughCopy({ site: '/' });
  return { dir: { input: 'site', output: '_site' } };
};

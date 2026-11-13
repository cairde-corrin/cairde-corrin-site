// Reports, for the built site, which pages can be reached from the home page, which are in
// sitemap.xml, and every page that is built but reached by no link, listed but missing, or
// reachable and indexable but not listed. Deliberate exceptions, with their reasons, are in
// site/_includes/reach.js (ALLOW).
//
//     npm run build && node tools/reachcheck.js
//
// Exits 1 if there is any finding.
const fs = require('node:fs');
const path = require('node:path');
const { check } = require('../site/_includes/reach.js');

// Every HTML page in a built site, as { url, html }
function fromSite(dir) {
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push({ url: '/' + path.relative(dir, p).split(path.sep).join('/'), html: fs.readFileSync(p, 'utf8') });
    }
  })(dir);
  const map = path.join(dir, 'sitemap.xml');
  return { pages, sitemap: fs.existsSync(map) ? fs.readFileSync(map, 'utf8') : '' };
}

module.exports = { fromSite };

if (require.main === module) {
  const dir = path.join(__dirname, '..', '_site');
  if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error('No _site/ yet: run `npm run build` first.'); process.exit(2); }
  const { pages, sitemap } = fromSite(dir);
  const r = check(pages, sitemap);
  console.log(`${r.built.size} pages built, ${r.listed.size} in sitemap.xml, ${r.reached.size} reached from the home page`);
  if (r.excused.length) {
    console.log('\nNot reached, on purpose:');
    for (const x of r.excused) console.log(`  ${x.url}\n      ${x.reason}`);
  }
  console.log(r.findings.length ? `\n${r.findings.length} finding(s):` : '\nNo findings: every page is reachable, and sitemap.xml lists exactly the reachable, indexable pages.');
  for (const f of r.findings) console.log(`  ${f}`);
  process.exit(r.findings.length ? 1 : 0);
}

// Can every page be reached? linkcheck.py proves that the links the pages carry lead
// somewhere; this proves the opposite direction, that every page is led to. It walks the
// built site from the home page, following every link, and compares three sets: the pages
// built, the pages in sitemap.xml, and the pages reached. Every disagreement is a finding,
// unless it is in ALLOW below with the reason it is meant to be that way.
//
// Used after every build (.eleventy.js, which only warns), by tools/reachcheck.js for a
// full report, and by tools/selftest.js, which fails on any finding.
const HOSTS = new Set(['www.cairdecorrin.ie', 'cairdecorrin.ie', 'cairde-corrin.netlify.app']);

// Pages that are meant not to be reached from the home page. when: 'noindex' means the
// exception holds only while the page is kept out of search engines.
const ALLOW = [
  { url: /^\/admin\/$/, reason: 'the editor: editors go to its address directly; nothing on the site links to it' },
  { url: /^\/admin\/help\/$/, reason: "the editor's Help page: opened by the Help button inside the editor" },
  { url: /^\/admin\/emails\//, reason: 'the Netlify Identity email templates: read by Netlify, never visited' },
  { url: /^\/stops\/stop-\d+\.html$/, when: 'noindex', reason: 'a stop not yet surveyed: listed on the trails page but not linked, out of search engines and the sitemap until its page has content; the sign code /s/N leads to it' },
  { url: /^\/(news|gallery|articles)\/$/, when: 'noindex', reason: 'a section with nothing in it yet: built so that old links work, out of the navigation, search engines and the sitemap until its first entry (_includes/nav.js)' },
];

// /about/index.html and /about/ are the same page
const norm = (p) => p.replace(/\/index\.html$/, '/');
const noindex = (html) => /<meta name="robots" content="[^"]*noindex/i.test(html);

function linksOf(html, url) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*"([^"]*)"[^>]*>/gi)) {
    // a hidden link ("Edit this page", shown only to logged-in editors) is no way in for a visitor
    if (/\shidden(?=[\s>=])/i.test(m[0])) continue;
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, '&'), `https://www.cairdecorrin.ie${url}`); } catch (e) { continue; }
    if (!/^https?:$/.test(u.protocol) || !HOSTS.has(u.hostname)) continue;
    out.add(norm(decodeURI(u.pathname)));
  }
  return out;
}

// pages: [{ url, html }], every page built; sitemap: the text of sitemap.xml
function check(pages, sitemap) {
  const byUrl = new Map(pages.map((p) => [norm(p.url), p]));
  const built = new Set(byUrl.keys());
  const listed = new Set([...String(sitemap || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => { try { return norm(new URL(m[1]).pathname); } catch (e) { return m[1]; } }));
  const reached = new Set(['/']);
  const queue = ['/'];
  while (queue.length) {
    const p = byUrl.get(queue.shift());
    if (!p) continue;
    for (const l of linksOf(p.html, p.url)) if (built.has(l) && !reached.has(l)) { reached.add(l); queue.push(l); }
  }
  const allowed = (u) => ALLOW.find((a) => a.url.test(u) && (a.when !== 'noindex' || noindex(byUrl.get(u).html)));
  const findings = [], excused = [];
  for (const u of [...built].sort()) {
    const p = byUrl.get(u);
    if (!reached.has(u)) {
      const a = allowed(u);
      if (a) excused.push({ url: u, reason: a.reason });
      else findings.push(`${u} is built but no link leads to it from the home page.`);
    }
    if (listed.has(u) && noindex(p.html)) findings.push(`${u} is in sitemap.xml but is marked noindex.`);
    if (!listed.has(u) && reached.has(u) && !noindex(p.html)) findings.push(`${u} can be reached and indexed but is not in sitemap.xml.`);
  }
  for (const u of [...listed].sort()) if (!built.has(u)) findings.push(`${u} is in sitemap.xml but no such page is built.`);
  return { built, listed, reached, findings, excused };
}

module.exports = { check, ALLOW, linksOf };

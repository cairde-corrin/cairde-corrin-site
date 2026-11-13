// A photograph an editor chose from Wikimedia Commons by its file page address, made ready
// for the site: its author and licence read from Commons (the rules are in
// site/admin/commons.js, shared with the editor), the photo downloaded and re-encoded like
// every other photo (WebP at 700, 1100 and 1800 px, no metadata), served from this site
// under /assets/img/commons/, never hotlinked, and its credit written beneath it wherever it
// appears and listed on the credits page (_includes/blocks.js).
//
// Each photo's credit is saved in site/_commons/<name>.json beside its sizes in
// site/assets/img/commons/, so a build with them in the repository needs no network. A
// build that fetches one leaves the new files there for a developer to commit, as with the
// YouTube stills. A photo Commons will not credit clearly is refused (CommonsRefusal), and
// stops the build with the reason; a photo whose details cannot be fetched at all stops the
// build too, without blaming the page (CommonsUnreachable): an uncredited photo is never
// published.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Image = require('@11ty/eleventy-img').default;
const rules = require('../admin/commons.js');

const SITE_DIR = path.join(__dirname, '..');
const META = path.join(SITE_DIR, '_commons');
const IMG = path.join(SITE_DIR, 'assets', 'img', 'commons');
const OUT = path.join(SITE_DIR, '..', '_site', 'assets', 'img', 'commons');
const UA = 'CairdeCorrinWebsite/1.0 (https://www.cairdecorrin.ie/)';
const TIMEOUT = 20000;

class CommonsRefusal extends Error {}
class CommonsUnreachable extends Error {}

// A stable file name for the photo: readable, and unique to its Commons title
function key(url) {
  const t = rules.title(url);
  const words = t.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `${words || 'photo'}-${crypto.createHash('sha1').update(t).digest('hex').slice(0, 8)}`;
}
const base = (url) => `/assets/img/commons/${key(url)}`;

function saved(k) {
  try { return JSON.parse(fs.readFileSync(path.join(META, `${k}.json`), 'utf8')); } catch (e) { return null; }
}
const sizes = (k) => (fs.existsSync(IMG) ? fs.readdirSync(IMG).filter((f) => f.startsWith(`${k}-`) && /-\d+\.webp$/.test(f)) : []);

async function get(url, as) {
  let r;
  try { r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) }); } catch (e) {
    throw new CommonsUnreachable(`Wikimedia Commons could not be reached (${e.message})`);
  }
  if (!r.ok) throw new CommonsUnreachable(`Wikimedia Commons answered ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
}

const pending = new Map();
// Make sure the photo at this Commons address is checked, saved and copied into the build.
// Returns its saved credit: { url, title, author, licence, licence_url, file_url }.
function ensure(url) {
  const k = key(url);
  if (!pending.has(k)) pending.set(k, (async () => {
    let meta = saved(k);
    if (!(meta && sizes(k).length)) {
      const verdict = rules.decide(await get(rules.apiUrl(url), 'json'));
      if (!verdict.ok) {
        const why = verdict.why.replace(/\.$/, '');
        throw Object.assign(new CommonsRefusal(`The photo from Wikimedia Commons (${rules.title(url)}) cannot be used, because ${why}`), { title: rules.title(url), why });
      }
      const body = await get(verdict.image);
      fs.mkdirSync(IMG, { recursive: true });
      await Image(body, { widths: [700, 1100, 1800], formats: ['webp'], outputDir: IMG, useCache: false,
        filenameFormat: (hash, src, width, format) => `${k}-${width}.${format}` });
      meta = { url: rules.normal(url), title: rules.title(url), author: verdict.author, licence: verdict.licence,
        licence_url: verdict.licence_url, file_url: verdict.file_url, fetched: new Date().toISOString().slice(0, 10) };
      fs.mkdirSync(META, { recursive: true });
      fs.writeFileSync(path.join(META, `${k}.json`), `${JSON.stringify(meta, null, 1)}\n`);
      console.log(`[commons] fetched ${meta.title} (${meta.author}, ${meta.licence}) into site/assets/img/commons/ and site/_commons/; commit them.`);
    }
    // copy into _site too: the build's own copy of site/ may already have run
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of sizes(k)) fs.copyFileSync(path.join(IMG, f), path.join(OUT, f));
    return meta;
  })());
  return pending.get(k);
}

// The saved credit of a Commons photo, by its address or by its file under /assets/img/commons/
function creditOf(photo) {
  const v = String(photo || '').trim();
  const k = rules.isCommons(v) ? key(v) : (/^\/assets\/img\/commons\/(.+?)(?:-\d+\.webp)?$/.exec(v) || [])[1];
  const m = k && saved(k);
  return m ? { by: m.author, licence: m.licence, licence_url: m.licence_url, file: m.title.replace(/^File:/, ''), file_url: m.file_url, subject: '' } : null;
}

// The largest saved size of a Commons photo, as a path the rest of the site handles like
// any of its own prepared photographs
function sitePath(url) {
  const k = key(url);
  const ws = sizes(k).map((f) => +/-(\d+)\.webp$/.exec(f)[1]).sort((a, b) => a - b);
  return ws.length ? `/assets/img/commons/${k}-${ws[ws.length - 1]}.webp` : '';
}

module.exports = { ensure, creditOf, sitePath, base, key, isCommons: rules.isCommons, CommonsRefusal, CommonsUnreachable };

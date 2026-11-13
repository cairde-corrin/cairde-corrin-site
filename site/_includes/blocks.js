// Every editable page is an ordered list of blocks (site/_data/pages/*.json, written in the
// editor). This turns that list into the page's HTML, in the site's existing design: each
// block type is a section that already existed on the hand-written pages.
//
// A page with a broken or incomplete block stops the build, with the page and the block
// named, so the live site keeps its previous version rather than publishing a broken page.
//
// Credits a licence requires are bound to what they credit (site/_data/credits.json): a
// photograph from another source carries its photographer and licence wherever it is shown,
// and the credits page lists every credited thing that is on the website, whether or not an
// editor has kept its entry there.
const fs = require('node:fs');
const path = require('node:path');
const { prose } = require('./prose.js');
const images = require('./images.js');
const youtube = require('./youtube.js');
const gpx = require('./gpx.js');
const commons = require('./commons.js');
const crypto = require('node:crypto');

const SITE_DIR = path.join(__dirname, '..');
const SITE = 'https://www.cairdecorrin.ie';
const CREDITS = require('../_data/credits.json');

// What editors see each block called, which blocks a page can hold only one of, and which
// belong to one page only: shared with the editor's own checks (site/admin/checks.js)
const checks = require('../admin/checks.js');
const { LABELS, ONLY_ON } = checks;
const SINGULAR = new Set(Object.keys(checks.SINGULAR));

class BlockError extends Error {}
// The last page that stopped the build, for the plain summary at the end of the build log
let lastProblem = null;
const fail = (msg) => { throw new BlockError(msg); };

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const str = (v) => (v == null ? '' : String(v)).trim();
// A heading: inline Markdown, a new line where the editor pressed Enter
const heading = (t) => str(t).split(/\r?\n/).map((l) => prose(l.trim())).join('<br>');
// Paragraphs: separated by an empty line
const paras = (t) => str(t).split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);

function root(url) { return '../'.repeat(url.replace(/[^/]*$/, '').split('/').filter(Boolean).length); }

// A link an editor typed: a page on this site (/trails/), a web address, or an email address
function href(u, r, need) {
  const v = str(u);
  if (!v) { if (need) fail(need); return ''; }
  if (v.startsWith('/')) return (r + v.slice(1)) || './';
  if (/^(https:\/\/|mailto:)/.test(v)) return v;
  if (v.startsWith('#')) return v;
  fail(`has the link "${v}", which is neither a page on this site (starting with /) nor a full https:// web address`);
}

// ---------- photographs ----------

// Width and height of a WebP file, read from its header
function webpSize(file) {
  const b = Buffer.alloc(30);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, b, 0, 30, 0); } finally { fs.closeSync(fd); }
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file} is not a WebP image`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 }; }
  throw new Error(`${file}: unknown WebP layout`);
}

// The site's own prepared photographs: name-700.avif, name-700.webp, name-1100.webp ...
// photo is any one of them, as the editor's field holds it.
function photoSet(photo) {
  const m = /^\/assets\/img\/((?:[\w-]+\/)*)([\w-]+?)-(\d+)\.(?:webp|avif)$/.exec(photo);
  if (!m) return null;
  const dir = path.join(SITE_DIR, 'assets', 'img', m[1]);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const re = new RegExp(`^${m[2]}-(\\d+)\\.(avif|webp)$`);
  const set = { base: `/assets/img/${m[1]}${m[2]}`, avif: [], webp: [] };
  for (const f of files) { const x = re.exec(f); if (x) set[x[2]].push(+x[1]); }
  set.avif.sort((a, b) => a - b); set.webp.sort((a, b) => a - b);
  if (!set.webp.length) return null;
  set.url = (w, f = 'webp') => `${set.base}-${w}.${f}`;
  set.size = (w) => webpSize(path.join(SITE_DIR, set.url(w).slice(1)));
  return set;
}

// How each kind of block has always written its photographs
const FRAMES = {
  pair: { sizes: '(min-width:840px) 46vw, calc(100vw - 44px)', fallback: 1100, dims: 'largest' },
  stophero: { sizes: '(min-width:1200px) 1100px, (min-width:901px) calc(100vw - 64px), calc(100vw - 44px)', fallback: 1100, dims: 'largest', eager: true },
  carousel: { sizes: '(min-width:900px) 400px, 74vw', fallback: 'smallest', dims: 'fallback' },
  grid: { sizes: '(min-width:900px) 30vw, calc(100vw - 44px)', fallback: 'smallest', dims: 'fallback' },
  card: { sizes: '(min-width:1100px) 300px, (min-width:640px) 40vw, calc(100vw - 88px)', fallback: 'smallest', dims: 'fallback' },
  species: { sizes: '(min-width:700px) 150px, 300px', fallback: 'smallest', dims: 'fallback' },
  wide: { sizes: '(min-width:1200px) 1136px, (min-width:901px) calc(100vw - 64px), calc(100vw - 44px)', img: true },
  column: { sizes: '(min-width:900px) 760px, calc(100vw - 64px)', img: true },
};

// <picture> (or <img>) for a photo field, relative to the page
async function picture(photo, alt, frame, r) {
  // a Commons photo is served from this site, from the sizes saved for it (commons.ensure)
  const p = commons.isCommons(str(photo)) ? commons.sitePath(str(photo)) : str(photo);
  if (!p) fail('has no photo');
  if (alt == null || !str(alt)) fail(`has a photo (${p}) with no description for people who cannot see it`);
  const f = FRAMES[frame];
  const lazy = f.eager ? '' : ' loading="lazy"';
  const rel = (u) => r + u.slice(1);
  if (p.startsWith(images.UPLOADS)) {
    if (!fs.existsSync(path.join(SITE_DIR, decodeURI(p).slice(1)))) fail(`has the photo ${p}, which is not in the repository`);
    const img = await images.resolve({ src: decodeURI(p) });
    return `<img src="${rel(img.src)}" srcset="${img.srcset.map(rel).join(', ')}" sizes="${f.sizes}" width="${img.width}" height="${img.height}"${lazy} decoding="async" alt="${esc(alt)}">`;
  }
  const set = photoSet(p);
  if (!set) fail(`has the photo "${p}", which is not a photograph on this website. Upload the photo instead`);
  const largest = set.webp[set.webp.length - 1];
  if (f.img) {
    const d = set.size(largest);
    return `<img src="${rel(set.url(largest))}" srcset="${set.webp.map((w) => `${rel(set.url(w))} ${w}w`).join(', ')}" sizes="${f.sizes}" width="${d.width}" height="${d.height}"${lazy} decoding="async" alt="${esc(alt)}">`;
  }
  const fb = f.fallback === 'smallest' ? set.webp[0] : (set.webp.find((w) => w >= f.fallback) || largest);
  const d = set.size(f.dims === 'largest' ? largest : fb);
  const source = (fmt) => (set[fmt].length ? `<source type="image/${fmt}" srcset="${set[fmt].map((w) => `${rel(set.url(w, fmt))} ${w}w`).join(', ')}" sizes="${f.sizes}">` : '');
  return `<picture>${source('avif')}${source('webp')}<img src="${rel(set.url(fb))}" width="${d.width}" height="${d.height}"${lazy} decoding="async" alt="${esc(alt)}"></picture>`;
}

// The registered credit for a photograph from another source, or null
function creditFor(photo) {
  const set = photoSet(str(photo));
  if (set && CREDITS.photos[set.base]) return CREDITS.photos[set.base];
  return commons.creditOf(photo);  // a photo from Wikimedia Commons, credited from Commons itself
}
const creditLine = (c) => `<a href="${esc(c.file_url)}">${esc(c.by)}</a>, <a href="${esc(c.licence_url)}">${esc(c.licence)}</a>`;
// The line beneath a photo saying whose it is: a photo from another source always carries
// its registered credit; one the group did not take carries "Photo:" and who took it
// (the editor's "Who took this photo" field); the group's own carry nothing, as the
// footer says photography is by Cáirde Corrin
const GROUP = 'Cáirde Corrin';
function photoCredit(p) {
  const registered = creditFor(p.photo);
  if (registered) return creditLine(registered);
  const by = str(p.by);
  return by && by !== GROUP ? `Photo: ${esc(by)}` : '';
}

// ---------- the blocks ----------

const items = (b, min, what) => {
  const list = Array.isArray(b.items) ? b.items : [];
  if (list.length < min) fail(`needs at least ${min} ${what}; it has ${list.length}`);
  return list;
};

const R = {};

R.text = (b, c) => {
  const rv = c.rv;
  const gap = { small: 36, medium: 58, large: 64 }[b.gap];
  const at = gap && !c.home ? ` style="margin-top:${gap}px"` : '';
  const out = [];
  if (!str(b.eyebrow) && !str(b.heading) && !str(b.text)) fail('is empty');
  if (str(b.eyebrow)) out.push(`<p class="eyebrow${rv}"${at}>${esc(b.eyebrow)}</p>`);
  if (str(b.heading)) out.push(`<h2${str(b.eyebrow) ? '' : at} class="${c.home ? rv.trim() : `${rv.trim()} as-h3`.trim()}">${heading(b.heading)}</h2>`);
  const style = { small: ' src-note', label: ' devlabel' }[b.style] || '';
  const cls = `${rv.trim()}${style}`.trim();
  paras(b.text).forEach((p, i) => out.push(`<p${cls ? ` class="${cls}"` : ''}${!out.length && i === 0 ? at : ''}>${prose(p)}</p>`));
  return out.join('\n');
};

R.figures = (b, c) => {
  const list = items(b, 1, 'figures');
  const cls = ['figs', ...(c.dark ? [] : ['light']), ...(c.inside ? [] : [c.rv.trim()])].filter(Boolean).join(' ');
  return `<dl class="${cls}">\n${list.map((f, i) => {
    if (!str(f.label) || !str(f.value)) fail(`figure ${i + 1} needs both a label and a value`);
    return `  <div class="fig"><dt>${esc(f.label)}</dt><dd>${f.about ? '<small>about</small>' : ''}${esc(f.value)}${str(f.unit) ? `<small>${esc(f.unit)}</small>` : ''}</dd></div>`;
  }).join('\n')}\n</dl>`;
};

async function figure(b, c, cls, frame) {
  const cap = [str(b.caption) && prose(b.caption), photoCredit(b)].filter(Boolean).join(' ');
  return `<figure class="${cls}">${await picture(b.photo, b.alt, frame, c.r)}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
}

R.image = (b, c) => figure(b, c, `mapfig${c.rv}`, c.home ? 'wide' : 'column');

R.pair = async (b, c) => {
  const list = Array.isArray(b.items) ? b.items : [];
  if (list.length !== 2) fail(`needs exactly two photos; it has ${list.length}`);
  c.extra.add('compare');
  const one = async (p) => {
    const credit = photoCredit(p);
    return `<figure class="pair-item${c.rv}">${await picture(p.photo, p.alt, 'pair', c.r)}<figcaption>`
      + `${str(p.meta) ? `<span class="pair-meta">${esc(p.meta)}</span>` : ''}${str(p.caption) ? `<span class="pair-line">${prose(p.caption)}</span>` : ''}`
      + `${credit ? `<span class="pair-line">${credit}</span>` : ''}</figcaption></figure>`;
  };
  return `<div class="pair">\n${(await Promise.all(list.map(one))).join('\n')}\n</div>`;
};

R.carousel = async (b, c) => {
  const list = items(b, 1, 'photos');
  c.extra.add('gallery');
  const label = str(b.label) || 'Photographs';
  const lis = await Promise.all(list.map(async (p) => {
    const cap = [str(p.caption) && `<span class="car-meta">${esc(p.caption)}</span>`, photoCredit(p)].filter(Boolean).join(' ');
    return `<li class="car-item"><figure>${await picture(p.photo, p.alt, 'carousel', c.r)}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure></li>`;
  }));
  const html = `<div class="carousel${c.rv}">\n<div class="car-head">\n<button class="car-btn car-prev" type="button" aria-label="Scroll photographs left">←</button>\n`
    + `<button class="car-btn car-next" type="button" aria-label="Scroll photographs right">→</button>\n</div>\n`
    + `<div class="car-scroll" tabindex="0" role="region" aria-label="${esc(label)}, scrollable">\n<ul class="car-track">\n${lis.join('\n')}\n</ul>\n</div>\n</div>`;
  const link = b.gallery_link && c.gallery
    ? `<div class="wrap" style="margin-top:36px"><a class="cta${c.rv}" href="${c.r}gallery/">See all photographs</a></div>` : '';
  return { bleed: html, after: link };
};

R.grid = async (b, c) => {
  const list = items(b, 1, 'photos');
  const figs = await Promise.all(list.map(async (p) => {
    const cap = [str(p.caption) && esc(p.caption), photoCredit(p)].filter(Boolean).join(' ');
    return `<figure>${await picture(p.photo, p.alt, 'grid', c.r)}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  }));
  return `<div class="watershots${c.rv}">\n${figs.join('\n')}\n</div>`;
};

R.steps = (b, c) => {
  const list = items(b, 1, 'points');
  return `<div class="strands">\n${list.map((s, i) => {
    if (!str(s.heading)) fail(`point ${i + 1} has no heading`);
    const link = str(s.link_text) ? `\n<a href="${href(s.link, c.r, `point ${i + 1} has link words but no link`)}">${esc(s.link_text)}</a>` : '';
    return `<div class="strand${c.rv}"><div class="strand-n">${esc(s.label)}</div><div><h3${c.home ? '' : ' class="as-h4"'}>${heading(s.heading)}</h3>\n${paras(s.text).map((p) => `<p>${prose(p)}</p>`).join('\n')}${link}</div></div>`;
  }).join('\n')}\n</div>`;
};

R.cards = async (b, c) => {
  const list = items(b, 1, 'cards');
  // a card's title sits one level below the heading above the cards, if there is one
  const tag = c.prev && c.prev.type === 'text' && str(c.prev.heading) ? ['h3', 'as-h4'] : ['h2', 'as-h3'];
  const cards = await Promise.all(list.map(async (k, i) => {
    if (!str(k.title)) fail(`card ${i + 1} has no title`);
    const fig = str(k.photo) ? await figure(k, c, 'card-fig', 'card') : '';
    const link = str(k.link_text) ? `\n<p><a class="card-link" href="${href(k.link, c.r, `card ${i + 1} has link words but no link`)}">${esc(k.link_text)}</a></p>` : '';
    return `<div class="card${c.rv}">${str(k.kicker) ? `<p class="k">${esc(k.kicker)}</p>` : ''}${fig}<${tag[0]} class="${tag[1]}">${heading(k.title)}</${tag[0]}>${paras(k.text).map((p) => `<p>${prose(p)}</p>`).join('')}${link}</div>`;
  }));
  return `<div class="cards">\n${cards.join('\n')}\n</div>`;
};

R.links = (b, c) => {
  const list = items(b, 1, 'links');
  return `<div class="linklist${c.rv}">${list.map((l, i) => {
    const u = str(l.url);
    if (!str(l.name)) fail(`link ${i + 1} has no name`);
    if (!/^https:\/\//.test(u)) fail(`link ${i + 1} (${l.name}) needs a full https:// web address`);
    return `\n<a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(l.name)}</span><span class="u">${esc(new URL(u).hostname.replace(/^www\./, ''))}</span></a>`;
  }).join('')}\n</div>`;
};

R.note = (b, c) => {
  const body = paras(b.text).map((p) => `<p>${prose(p)}</p>`);
  if (!body.length) fail('has no text');
  const link = str(b.link_text) ? `<p><a class="story-link" href="${href(b.link, c.r, 'has link words but no link')}">${esc(b.link_text)}</a></p>` : '';
  if (b.folded) {
    if (!str(b.heading)) fail('opens when tapped, so it needs a heading to tap');
    return `<details class="photonote${c.rv}">\n<summary>${esc(b.heading)}</summary>\n${body.join('\n')}${link}\n</details>`;
  }
  const head = str(b.heading) ? `<h2 class="as-h4">${heading(b.heading)}</h2>` : '';
  return `<div class="note${head ? ' folknote' : ''}"${c.inside ? ' style="margin-top:0"' : ''}>${head}${body.join('')}${link}</div>`;
};

R.quote = (b, c) => {
  if (!str(b.text)) fail('has no quotation');
  return `<blockquote class="quote${c.rv}"><p>“${prose(b.text)}”</p>${str(b.source) ? `<footer>${esc(b.source)}</footer>` : ''}</blockquote>`;
};

R.button = (b, c) => {
  if (!str(b.text)) fail('has no words on the button');
  return `<a class="cta${c.rv}" href="${href(b.url, c.r, 'has no link')}">${esc(b.text)}</a>`;
};

// A sound or video file on this site: added by whoever maintains the site, who removes the
// location and phone details first (docs/CONTRIBUTING.md), so editors choose an existing one
function mediaFile(f, kind) {
  const v = str(f);
  if (!new RegExp(`^/assets/${kind}/[\\w./-]+$`).test(v) || !fs.existsSync(path.join(SITE_DIR, v.slice(1)))) {
    fail(`refers to the ${kind === 'audio' ? 'recording' : 'film'} "${v}", which is not a file on this website`);
  }
  return v;
}

R.audio = (b, c) => {
  const file = c.r + mediaFile(b.file, 'audio').slice(1);
  return `<div class="audio">\n<h2 class="as-h4">${esc(str(b.heading) || 'Listen')}</h2>\n`
    + `${str(b.text) ? `<p class="audio-meta">${prose(b.text)}</p>\n` : ''}`
    + `<audio aria-label="${esc(str(b.label) || 'Recording')}" controls preload="none" src="${file}">\n<a href="${file}">Download the recording</a>\n</audio>\n</div>`;
};

const span = (start, end) => `${str(start)}${str(end) ? ` - ${str(end)}` : ''}`;
R.recordings = (b, c) => {
  const list = items(b, 1, 'recordings');
  return `<ol class="reclist">\n${list.map((x, i) => {
    const file = c.r + mediaFile(x.file, 'audio').slice(1);
    if (!str(x.start)) fail(`recording ${i + 1} has no start time`);
    const n = String(i + 1).padStart(2, '0');
    const when = span(x.start, x.end);
    return `<li class="rec${c.rv}">\n<div class="rec-head">\n<span class="rec-n">${n}</span>\n<span class="rec-time">${esc(when)}</span>\n`
      + `<span class="rec-dur">${esc(x.duration)}</span>${str(x.note) ? ` <span class="rec-flag">${esc(x.note)}</span>` : ''}\n</div>\n`
      + `<audio aria-label="Recording ${n}, ${esc(str(x.start))}${str(x.end) ? ` to ${esc(str(x.end))}` : ''}" controls preload="none" src="${file}">\n`
      + `<a href="${file}">Download this recording</a>\n</audio>\n</li>`;
  }).join('\n')}\n</ol>`;
};

const longDate = (d) => new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const isoDay = (d, what) => {
  const t = new Date(d);
  if (!str(d) || Number.isNaN(+t)) fail(`${what} has no date`);
  return t.toISOString().slice(0, 10);
};
// Width and height of an MP4 film, read from its video track header (tkhd), turned if the
// track is stored rotated: nobody types pixel sizes into a form
function mp4Size(file) {
  const b = fs.readFileSync(file);
  let found = null;
  for (let i = b.indexOf('tkhd'); i >= 4; i = b.indexOf('tkhd', i + 1)) {
    const o = i - 4, v1 = b[i + 4] === 1;
    const w = b.readUInt32BE(o + (v1 ? 96 : 84)) / 65536, h = b.readUInt32BE(o + (v1 ? 100 : 88)) / 65536;
    const turned = Math.abs(b.readInt32BE(o + (v1 ? 60 : 48))) < 0x100;  // matrix a = 0: a quarter turn
    if (w > 0 && h > 0) found = { width: Math.round(turned ? h : w), height: Math.round(turned ? w : h) };
  }
  if (!found) throw new Error(`${file}: no video track size found`);
  return found;
}

// A YouTube video as a news post shows one: a self-hosted still with a play button, and
// nothing loaded from YouTube until it is pressed (_includes/youtube.js, post.njk)
async function youtubeFacade(url, title, c) {
  let v;
  try { v = await youtube.resolve(str(url), c.where); } catch (e) { fail(`has a YouTube address that cannot be read: ${e.message}`); }
  const rel = (u) => c.r + u.slice(1);
  const img = v.src ? `<img src="${rel(v.src)}" srcset="${v.srcset.map(rel).join(', ')}" sizes="(min-width:900px) 760px, calc(100vw - 64px)" width="${v.width}" height="${v.height}" alt="" loading="lazy" decoding="async">` : '';
  return `<figure class="mapfig yt${c.rv}"><a class="yt-play" href="https://www.youtube.com/watch?v=${v.id}" data-yt="${v.id}" data-title="${esc(title)}" aria-label="Play the video: ${esc(title)}">${img}<span class="yt-btn" aria-hidden="true"></span></a>`
    + `<figcaption>Plays from YouTube. Nothing is loaded from YouTube until you press play. <a href="${c.r}privacy/">Privacy</a></figcaption></figure>`;
}

R.films = async (b, c) => {
  const list = items(b, 1, 'films');
  const lis = await Promise.all(list.map(async (x, i) => {
    const when = longDate(isoDay(x.date, `film ${i + 1}`));
    const head = `<div class="rec-head">\n<span class="rec-time">${when}</span>\n<span class="rec-dur">${esc(x.duration)}</span>\n</div>`;
    if (str(x.youtube)) return `<li class="rec rec-film">\n${head}\n${await youtubeFacade(x.youtube, str(x.title) || `Film, ${when}`, c)}\n</li>`;
    const file = mediaFile(x.file, 'video');
    const d = mp4Size(path.join(SITE_DIR, file.slice(1)));
    const poster = str(x.poster) ? c.r + str(x.poster).slice(1) : '';
    return `<li class="rec rec-film">\n${head}\n<video controls preload="none" playsinline width="${d.width}" height="${d.height}"${poster ? `\n poster="${poster}"` : ''}>\n`
      + `<source src="${c.r + file.slice(1)}" type="video/mp4">\n</video>\n</li>`;
  }));
  return `<ul class="reclist${c.rv}">\n${lis.join('\n')}\n</ul>`;
};

R.video = (b, c) => {
  if (!str(b.url)) fail('has no YouTube address');
  if (!str(b.title)) fail('has no title');
  return youtubeFacade(b.url, str(b.title), c);
};

const slug = (s) => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// The story's source in the National Folklore Collection, required by its licence
function storySource(b) {
  for (const [k, what] of [['volume', 'volume number'], ['page', 'page number'], ['school', 'place where it was collected']]) {
    if (!str(b[k])) fail(`(${str(b.title) || 'untitled'}) has no ${what}. The licence the story is used under requires its source`);
  }
  if (!/^https:\/\/www\.duchas\.ie\//.test(str(b.link))) fail(`(${str(b.title)}) needs the link to the story on dúchas.ie, which its licence requires`);
}
R.story = (b, c) => {
  if (!str(b.title)) fail('has no title');
  storySource(b);
  const summary = paras(b.summary);
  if (!summary.length) fail(`(${b.title}) has no summary`);
  const id = str(b.anchor) || slug(b.title);
  return `<article class="story${c.rv}">\n<h2 class="as-h3" id="${esc(id)}">${heading(b.title)}</h2>\n`
    + `<p class="story-src">The Schools’ Collection, Volume ${esc(b.volume)}, Page ${esc(b.page)} - collected at ${esc(b.school)}, ${esc(str(b.county) || 'Co. Cork')}${str(b.collector) ? ` by ${esc(b.collector)}` : ''}</p>\n`
    + `${summary.map((p) => `<p>${prose(p)}</p>`).join('\n')}\n${str(b.place) ? `<p class="story-place">${prose(b.place)}</p>\n` : ''}`
    + `<p><a class="story-link" href="${esc(b.link)}" rel="noopener">Read it on dúchas.ie →</a></p>\n</article>`;
};

R.species = async (b, c) => {
  const list = items(b, 1, 'species');
  const lis = await Promise.all(list.map(async (s, i) => {
    if (!str(s.name)) fail(`species ${i + 1} has no common name`);
    if (!str(s.scientific)) fail(`species ${i + 1} (${s.name}) has no scientific name`);
    const fig = str(s.photo) ? await figure(s, c, 'sp-fig', 'species') : '';
    const sci = s.family
      ? `<span class="sp-sci sp-none">Family <em>${esc(s.scientific)}</em></span>`
      : `<span class="sp-sci"><em>${esc(s.scientific)}</em>${str(s.authority) ? ` ${esc(s.authority)}` : ''}${str(s.flag) ? ` <span class="sp-flag">${esc(s.flag)}</span>` : ''}</span>`;
    const recs = (Array.isArray(s.records) ? s.records : []).map((x) => `<li><span class="sp-trail">${esc(x.trail)}</span><span class="sp-date">${esc(x.date)}</span></li>`);
    if (!recs.length) fail(`species ${i + 1} (${s.name}) has no record of where it was found`);
    return `<li class="sp${fig ? '' : ' sp-nofig'}">\n${fig}<h2 class="sp-name">${esc(s.name)}</h2>\n${sci}\n`
      + `${str(s.description) ? `<p class="sp-desc">${prose(s.description)}</p>` : ''}${str(s.atlas) ? `<p class="sp-cite"><a href="${esc(href(s.atlas, c.r))}" rel="noopener">BSBI Plant Atlas 2020</a></p>` : ''}\n`
      + `<ul class="sp-recs">\n${recs.join('\n')}\n</ul>\n</li>`;
  }));
  return `<ul class="splist${c.rv}">\n${lis.join('\n')}\n</ul>`;
};

// Credits: the editor's own entries, and the entries a licence requires in the place the
// editor put them. Any required entry left out is added at the end of the credits page.
function requiredEntry(key, c) {
  const g = CREDITS.groups[key];
  if (!g) fail(`asks for the credits "${key}", which do not exist`);
  c.placed.add(key);
  if (!c.use.groups.has(key)) return '';
  const lines = c.use.lines(key);
  return `<dt>${esc(g.heading)}</dt>\n${g.entries.map((e) => `<dd>${e}</dd>`).join('\n')}`
    + `${lines.length ? `\n<dd class="cred-list">\n${lines.map((l) => `<span>${l}</span>`).join('\n')}\n</dd>` : ''}`;
}
R.credits = (b, c) => {
  const list = Array.isArray(b.items) ? b.items : [];
  const parts = list.map((x, i) => {
    if (x.type === 'required') return requiredEntry(x.group, c);
    if (!str(x.heading)) fail(`entry ${i + 1} has no heading`);
    const dds = paras(x.text);
    if (!dds.length) fail(`entry ${i + 1} (${x.heading}) has no text`);
    return `<dt>${esc(x.heading)}</dt>\n${dds.map((d) => `<dd>${prose(d)}</dd>`).join('\n')}`;
  }).filter(Boolean);
  return `<dl class="credits${c.rv}">\n${parts.join('\n')}\n</dl>`;
};

R.map = async (b, c) => {
  const f = c.figures;
  const layers = await mapLayers(c.pages);
  const routes = layers.routes.length;
  return `<div class="maprig${c.rv}">\n<div class="mapshell">\n`
    + `<svg id="map" role="img" tabindex="0" data-layers="/assets/data/layers.json?v=${layers.version}" aria-label="Interactive map of the Glenabo catchment showing relief, boundary, drainage, the walked loop${routes ? ', other walked routes' : ''} and recorded stops. Arrow keys move the map, plus and minus zoom, zero resets it."></svg>\n`
    + '<button class="maplayers-toggle" id="mlt" aria-expanded="false" aria-controls="maplayers">Layers</button>\n<div class="maplayers" id="maplayers">\n'
    + `<label><input type="checkbox" id="L-terr" checked> Relief <i>${f.catchment.outlet_m}-${f.catchment.elev_max_m} m</i></label>\n`
    + `<label><input type="checkbox" id="L-action" checked> Action area <i>about ${f.action_area.ha} ha</i></label>\n`
    + `<label><input type="checkbox" id="L-catch" checked> Catchment <i>about ${f.catchment.area_ha} ha</i></label>\n`
    + '<label><input type="checkbox" id="L-chan" checked> Drainage <i>modelled</i></label>\n'
    + `<label><input type="checkbox" id="L-trail" checked> Walked loop <i>about ${f.loop.length_km} km</i></label>\n`
    + (routes ? `<label><input type="checkbox" id="L-routes" checked> Other routes <i>${routes} walked</i></label>\n` : '')
    + `<label><input type="checkbox" id="L-stops" checked> Stops <i>${c.stops.filter((s) => s.recorded).length} recorded</i></label>\n</div>\n`
    + '<div class="mapctl">\n<button id="mz-in" title="Zoom in" aria-label="Zoom in">+</button>\n<button id="mz-out" title="Zoom out" aria-label="Zoom out">−</button>\n'
    + '<button id="mz-fit" title="Reset view" aria-label="Reset view">⤢</button>\n<button id="mz-loc" title="Show my position" aria-label="Show my position">◎</button>\n</div>\n'
    + '<div class="mapscale"><div class="bar" id="scbar"></div><span id="sctxt">500 m</span></div>\n<div class="mapread" id="mapread">Glenabo catchment</div>\n'
    + '<div class="mapinfo" id="mapinfo" hidden>\n<button class="mapclose" id="mapclose" aria-label="Close">×</button>\n<div id="mapinfobody"></div>\n</div>\n</div>\n'
    + `<p class="loc-note">${esc(str(b.note) || 'Drag to pan with a mouse, or use two fingers on a touchscreen. Scroll or pinch to zoom.')}</p>\n</div>`;
};

R.stops = (b, c) => {
  const list = c.stops.map((s) => (s.recorded
    ? `<a class="stopitem" href="${c.r}stops/stop-${s.n}.html"><span class="sn">${s.no}</span>\n<span><span class="st">${esc(s.name)}</span><span class="sd">${s.lat}°N ${s.lonAbs}°W</span></span><span class="se">about ${s.elevation} m</span></a>`
    : `<div class="stopitem pending"><span class="sn">${s.no}</span><span><span class="st">To be surveyed</span></span><span class="se">-</span></div>`));
  const side = [str(b.note) && R.note({ text: b.note }, Object.assign(Object.create(c), { inside: true })),
    Array.isArray(b.figures) && b.figures.length && R.figures({ items: b.figures }, Object.assign(Object.create(c), { inside: true }))].filter(Boolean);
  return `<div class="trailgrid">\n<div>\n<h2 class="as-h3">${heading(str(b.heading) || 'The stops')}</h2>\n<div class="stoplist">\n${list.join('\n')}\n</div>\n</div>\n`
    + `<div>\n${side.join('\n')}\n</div>\n</div>`;
};

// The walked loop's section: written by tools/trail.py from the checked track, never by hand
R.walked = () => fs.readFileSync(path.join(__dirname, 'walked-loop.html'), 'utf8').trim();

// A route an editor added by uploading its GPS track: cleaned and stripped (_includes/gpx.js),
// drawn on the map, with its own elevation profile and a clean GPX download
const ROUTES_OUT = path.join(SITE_DIR, '..', '_site', 'assets', 'data', 'routes');
const GPX_NOTE = 'A record of one walk through unwaymarked woodland, published by Cáirde Corrin. It is not a surveyed '
  + 'or waymarked route, and not for navigation. Access is not guaranteed, and tracks may be closed, felled or unsafe. '
  + 'Read https://www.cairdecorrin.ie/terms/ before you go.';
const prepared = new Map();
function route(b, stops) {
  const name = str(b.name);
  if (!name) fail('has no name');
  const file = str(b.track);
  if (!file) fail(`(${name}) has no GPS track. Upload the walk's GPX file in "The GPS track"`);
  const at = path.join(SITE_DIR, decodeURI(file).slice(1));
  if (!file.startsWith(images.UPLOADS) || !/\.gpx$/i.test(file) || !fs.existsSync(at)) fail(`(${name}) has the track "${file}", which is not an uploaded GPX file`);
  const xml = fs.readFileSync(at, 'utf8');
  const key = crypto.createHash('sha1').update(xml).update(name).update(JSON.stringify(stops)).digest('hex');
  if (!prepared.has(key)) {
    try { prepared.set(key, gpx.prepare(xml, name, stops)); } catch (e) {
      if (e instanceof gpx.TrackError) fail(`(${name}): the GPS track cannot be used, because ${e.message}`);
      throw e;
    }
  }
  return { name, slug: slug(name), version: key.slice(0, 10), ...prepared.get(key) };
}
const recordedStops = (c) => c.stops.filter((s) => s.recorded).map((s) => ({ n: s.n, lat: +s.lat, lon: +s.lon }));
R.route = (b, c) => {
  const r = route(b, recordedStops(c));
  const id = `route-${r.slug}`;
  const file = toFile(r);
  const kb = Math.max(1, Math.round(Buffer.byteLength(file) / 1024));
  return `<section class="walked" aria-labelledby="${id}-h">\n<h2 class="as-h3" id="${id}-h">${heading(r.name)}</h2>\n`
    + `${paras(b.text).map((p) => `<p>${prose(p)}</p>`).join('\n')}\n<figure class="profile">\n${r.svg(id)}\n`
    + `<figcaption>Elevation along the route, from the walked track's own GPS: about ${5 * Math.round(r.emin / 5)} to ${5 * Math.round(r.emax / 5)} m, `
    + `with about ${r.climb5} m of climbing, over about ${(r.length / 1000).toFixed(1)} km. Like every elevation on this site, given to the nearest five metres.</figcaption>\n</figure>\n`
    + `<p><a href="${c.r}assets/data/routes/${r.slug}.gpx?v=${r.version}" download>Download ${esc(r.name)} as GPX</a> (${kb} KB). It is a record of one walk through `
    + `unwaymarked woodland, not a surveyed route and not for navigation: read the <a href="${c.r}terms/">terms</a> before you go.</p>\n</section>`;
};
// the published GPX, written once per build
function toFile(r) {
  const text = gpx.toGpx(r.segments, r.name, GPX_NOTE);
  fs.mkdirSync(ROUTES_OUT, { recursive: true });
  fs.writeFileSync(path.join(ROUTES_OUT, `${r.slug}.gpx`), text);
  return text;
}

// What the interactive map draws besides its survey data: every stop that has a page with
// content, and every uploaded route. Published as /assets/data/layers.json.
async function mapLayers(pages) {
  const stops = await Promise.all(stopList(pages).filter((s) => s.recorded).map(async (s) => {
    const h = pages[`stop_${s.n}`].hero;
    let photo = '';
    const set = photoSet(str(h.photo));
    if (set) photo = set.url(set.webp.find((w) => w >= 1100) || set.webp[set.webp.length - 1]);
    else if (str(h.photo).startsWith(images.UPLOADS)) photo = (await images.resolve({ src: decodeURI(h.photo) })).src;
    return { n: s.n, name: `Stop ${s.no} - ${s.name}`, lat: +s.lat, lon: +s.lon, elevation: +s.elevation, facing: str(h.facing) ? +h.facing : null, photo };
  }));
  const trails = (pages.trails && pages.trails.blocks) || [];
  const marks = stops.map((s) => ({ n: s.n, lat: s.lat, lon: s.lon }));
  const routes = trails.filter((b) => b && b.type === 'route').map((b) => {
    try {
      const r = route(b, marks);
      return { name: r.name, slug: r.slug, lines: r.segments.map((seg) => seg.map(([lat, lon]) => [lon, lat])) };
    } catch (e) { return null; }  // the trails page itself reports a track it cannot use
  }).filter(Boolean);
  const data = { stops, routes };
  const version = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 10);
  return { ...data, version };
}

R.social = (b, c) => {
  const eyebrow = esc(str(b.eyebrow) || 'Elsewhere');
  const h = heading(str(b.heading) || 'Recent posts\nfrom the group.');
  const ig = c.instagram || { posts: [] };
  if (ig.posts.length) {
    const lis = ig.posts.map((p) => `<li class="car-item"><a class="ig-post" href="${esc(p.permalink)}">\n<figure>\n`
      + `<picture><img src="${c.r}${p.src.slice(1)}" srcset="${p.srcset.split(', ').map((s) => c.r + s.slice(1)).join(', ')}" sizes="(min-width:900px) 400px, 74vw" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" alt=""></picture>\n`
      + `<figcaption><span class="car-meta">Instagram - ${longDate(p.date)}</span>${p.caption ? ` <span class="ig-cap">${esc(p.caption)}</span>` : ''}</figcaption>\n</figure>\n</a></li>`);
    return { section: `<section class="plain gallery">\n<div class="wrap">\n<p class="eyebrow rv">${eyebrow}</p>\n<h2 class="rv">${h}</h2>\n</div>\n`
      + '<div class="carousel ig rv">\n<div class="car-head">\n<button class="car-btn car-prev" type="button" aria-label="Scroll Instagram posts left">←</button>\n'
      + '<button class="car-btn car-next" type="button" aria-label="Scroll Instagram posts right">→</button>\n</div>\n'
      + `<div class="car-scroll" tabindex="0" role="region" aria-label="Recent Instagram posts from Cáirde Corrin, scrollable">\n<ul class="car-track">\n${lis.join('\n')}\n</ul>\n</div>\n</div>\n`
      + `${ig.username ? `<div class="wrap" style="margin-top:36px"><a class="cta rv" href="https://www.instagram.com/${esc(ig.username)}/">Follow @${esc(ig.username)} on Instagram</a></div>\n` : ''}</section>` };
  }
  const posts = c.social || [];
  if (!posts.length) return { section: '' };
  return { section: `<section class="plain">\n<div class="wrap">\n<p class="eyebrow rv">${eyebrow}</p>\n<h2 class="rv">${h}</h2>\n<div class="cards">\n`
    + `${posts.map((p) => `<article class="card rv"><p class="k">${esc(p.platform)}</p><p>${esc(p.caption)}</p><a class="card-link" href="${esc(p.url)}" aria-label="View on ${esc(p.platform)}: ${esc(p.caption)}">View on ${esc(p.platform)}</a></article>`).join('\n')}\n`
    + '</div>\n</div>\n</section>' };
};

// ---------- the top of the page ----------

async function hero(h, c) {
  if (!h || typeof h !== 'object') fail('The top of the page is missing');
  if (!str(h.title)) fail('The top of the page has no title');
  if (c.home) {
    const line = (t) => (str(t) ? prose(t) : '');
    return `<section class="filmstrip on-dark" id="filmstrip">\n<div class="filmstrip-stage">\n${c.film}\n<div class="film-panels">\n`
      + `<div class="film-panel" data-at="0.10">\n<p class="film-strap">${esc(h.strap)}</p>\n<h1>${esc(h.title)}${str(h.title_second) ? `<br><em>${esc(h.title_second)}</em>` : ''}</h1>\n<p class="film-sub">${line(h.intro)}</p>\n</div>\n`
      + `<div class="film-panel" data-at="0.40">\n<p class="film-line">${line(h.line2)}</p>\n</div>\n<div class="film-panel" data-at="0.75">\n<p class="film-line">${line(h.line3)}</p>\n</div>\n</div>\n</div>\n</section>`;
  }
  const rv = c.rv;
  const parts = [`<p class="eyebrow${rv}">${esc(h.eyebrow)}</p>`, `<h1 class="${`${rv.trim()} page-title`.trim()}">${heading(h.title)}</h1>`];
  if (c.stop) {
    parts.push(`<div class="stophero">${await picture(h.photo, h.alt, 'stophero', c.r)}</div>`);
    const s = c.stop;
    parts.push(`<div class="stopmeta">\n<div><span>Position</span>${s.lat}°N ${s.lonAbs}°W</div>\n<div><span>Elevation</span>about ${s.elevation} m OD</div>\n`
      + `<div><span>Facing</span>${esc(h.facing)}°</div>\n<div><span>Recorded</span>${esc(h.recorded)}</div>\n`
      + `${photoCredit(h) ? `<div><span>Photo</span>${photoCredit(h).replace(/^Photo: /, '')}</div>\n` : ''}</div>`);
  }
  if (str(h.intro)) parts.push(`<p class="lede${rv}">${prose(h.intro)}</p>`);
  return parts.join('\n');
}

// A stop not yet surveyed: its page waits, out of search engines and the sitemap, until the
// top of its page is filled in
function reserved(n, c) {
  const no = String(n).padStart(2, '0');
  return `<p class="eyebrow">Stop ${no} - cairdecorrin.ie/s/${+n}</p>\n<h1 class="page-title">Not yet surveyed.</h1>\n<a class="cta" href="${c.r}trails/">Back to the trail</a>`;
}
// Previous and next recorded stops, or back to the trail at either end
function stopNav(n, c) {
  const rec = c.stops.filter((s) => s.recorded);
  const i = rec.findIndex((s) => s.n === n);
  const prev = rec[i - 1], next = rec[i + 1];
  return `<div class="stopnav">${prev ? `<a href="stop-${prev.n}.html">← Stop ${prev.no}</a>` : `<a href="${c.r}trails/">← All stops</a>`}`
    + `${next ? `<a href="stop-${next.n}.html">Stop ${next.no} →</a>` : `<a href="${c.r}trails/">All stops →</a>`}</div>`;
}

// A stop's position and elevation, checked, as the trails page and structured data use them
function stopPlace(h, label) {
  const lat = +h.latitude, lon = +h.longitude, elev = +h.elevation;
  if (!(lat > 51 && lat < 53) || !(lon > -9.5 && lon < -7)) fail(`${label}: the position (${h.latitude}, ${h.longitude}) is not near Fermoy. Give it as two numbers, such as 52.12752 and -8.29878`);
  if (!(elev >= 0 && elev < 400)) fail(`${label}: the elevation "${h.elevation}" is not a height in metres`);
  return { lat: str(h.latitude), lon: str(h.longitude), lonAbs: str(h.longitude).replace(/^-/, ''), elevation: str(h.elevation) };
}

// Every stop, 1 to 10, as the trails page lists it: recorded once its page has content
function stopList(pages) {
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1, d = pages[`stop_${n}`];
    const s = { n, no: String(n).padStart(2, '0'), recorded: false };
    if (d && d.hero && str(d.hero.title)) Object.assign(s, { recorded: true, name: str(d.page && d.page.title) }, stopPlace(d.hero, `Stop ${s.no}`));
    return s;
  });
}

// What the pages put on the website that a licence requires credit for
function usage(pages) {
  const photos = new Map(), stories = [], types = new Set();
  const scan = (b) => {
    if (!b || typeof b !== 'object') return;
    if (b.type) types.add(b.type);
    if (b.type === 'story') stories.push(b);
    if (typeof b.photo === 'string') {
      const s = photoSet(b.photo);
      if (s) photos.set(s.base, true);
      else if (commons.isCommons(b.photo)) photos.set(commons.base(b.photo), true);
    }
    for (const v of Object.values(b)) if (Array.isArray(v)) v.forEach(scan);
  };
  for (const d of Object.values(pages)) { if (d && typeof d === 'object') { scan(d.hero || {}); (d.blocks || []).forEach(scan); } }
  const groups = new Set();
  for (const [key, g] of Object.entries(CREDITS.groups)) {
    const byPhoto = Object.entries(CREDITS.photos).some(([base, p]) => p.group === key && photos.has(base));
    const fromCommons = key === 'commons-photos' && [...photos.keys()].some((b) => b.startsWith('/assets/img/commons/') && commons.creditOf(b));
    if (byPhoto || fromCommons || (g.for_photos || []).some((b) => photos.has(b)) || (g.for_blocks || []).some((t) => types.has(t))) groups.add(key);
  }
  const lines = (key) => {
    if (key === 'folklore') {
      return stories.map((s) => `${esc(s.title)} - Volume ${esc(s.volume)}, ${/-/.test(s.page) ? 'Pages' : 'Page'} ${esc(s.page)}, ${esc(s.school)}${str(s.collector) ? `, collected by ${esc(s.collector)}` : ''}`);
    }
    if (key === 'commons-photos') {
      return [...photos.keys()].filter((b) => b.startsWith('/assets/img/commons/')).map((b) => commons.creditOf(b)).filter(Boolean)
        .sort((a, b) => a.file.localeCompare(b.file, 'en'))
        .map((p) => `${esc(p.by)}, <a href="${esc(p.licence_url)}" rel="noopener">${esc(p.licence)}</a>, <a href="${esc(p.file_url)}" rel="noopener">${esc(p.file)}</a>`);
    }
    return Object.entries(CREDITS.photos).filter(([base, p]) => p.group === key && photos.has(base))
      .sort((a, b) => a[1].subject.localeCompare(b[1].subject, 'en'))
      .map(([, p]) => `${p.subject} - ${esc(p.by)}, <a href="${esc(p.licence_url)}" rel="noopener">${esc(p.licence)}</a>, <a href="${esc(p.file_url)}" rel="noopener">${esc(p.file)}</a>`);
  };
  return { photos, groups, lines, stories };
}

// ---------- a whole page ----------

// key: the page's file in site/_data/pages; data: its content; ctx: { url, pages, figures,
// gallery, instagram, social, film }. Returns the page's main content.
// Every Commons photo anywhere on the site, fetched once before any page is drawn, so the
// credits page lists them whichever page happens to be built first. Failures are left for
// the page that uses the photo to report.
const prefetched = new WeakMap();
function prefetchCommons(pages) {
  if (!prefetched.has(pages)) {
    const urls = new Set();
    const scan = (x) => {
      if (!x || typeof x !== 'object') return;
      if (commons.isCommons(x.photo)) urls.add(str(x.photo));
      for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === 'object') scan(v);
    };
    Object.values(pages).forEach(scan);
    prefetched.set(pages, Promise.all([...urls].map((u) => commons.ensure(u).catch(() => null))));
  }
  return prefetched.get(pages);
}

async function render(key, data, ctx) {
  await prefetchCommons(ctx.pages);
  const where = `the page "${checks.PAGES[key] || key}" in the editor`;
  const file = `(site/_data/pages/${key}.json)`;
  const home = key === 'home';
  const stopN = /^stop_(\d+)$/.exec(key);
  const c = { key, where, home, r: root(ctx.url), rv: stopN ? '' : ' rv', figures: ctx.figures, gallery: ctx.gallery,
    instagram: ctx.instagram, social: ctx.social, film: ctx.film, stops: stopList(ctx.pages), use: usage(ctx.pages), placed: new Set(), pages: ctx.pages };
  try {
    if (!data || typeof data !== 'object') fail('The page has no content.');
    // everything an editor can fix, all at once, in the editor's words (also checked on saving)
    const found = checks.problems(key, data);
    if (found.length) {
      lastProblem = { page: checks.PAGES[key] || key, problems: found, file };
      throw new Error(`The website was not updated, because of ${where}:\n${found.map((x) => `  - ${x}`).join('\n')}\n${file}`);
    }
    if (stopN && !(data.hero && str(data.hero.title))) return reserved(stopN[1], c);
    if (!data.page || !str(data.page.title)) fail(stopN ? 'has no name for the stop (under "About this page")' : 'has no page title (under "About this page")');
    if (!str(data.page.description)) fail('has no summary for search results (under "About this page")');
    if (stopN) c.stop = stopPlace(data.hero || {}, 'The top of the page');
    await commonsPhotos(data.hero, 'The top of the page');
    const top = await hero(data.hero, c);
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    const seen = new Set();
    const out = [];
    let background = 'light';  // the home page's current section
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const label = `block ${i + 1} (${LABELS[b && b.type] || (b && b.type) || 'no type'})`;
      try {
        if (!b || !R[b.type]) fail('is not a kind of block the website knows');
        if (ONLY_ON[b.type] && ONLY_ON[b.type] !== key) fail('belongs on another page and cannot be used here');
        if (SINGULAR.has(b.type)) {
          if (seen.has(b.type)) fail('appears twice; a page can have only one');
          seen.add(b.type);
        }
        await commonsPhotos(b, '');
        if (home && b.type === 'text') background = b.background || 'light';
        const bc = Object.assign(Object.create(c), { prev: blocks[i - 1], extra: new Set(), dark: home && background === 'dark' });
        out.push({ b, bc, html: await R[b.type](b, bc) });
      } catch (e) {
        if (e instanceof BlockError) fail(`${label} ${e.message}`);
        throw e;
      }
    }
    // on the credits page, every required credit is there: placed by the editor, or added at the end
    if (key === 'credits') {
      const missing = [...c.use.groups].filter((g) => !c.placed.has(g));
      if (missing.length) out.push({ b: { type: 'credits' }, bc: { extra: new Set() }, html: `<dl class="credits rv">\n${missing.map((g) => requiredEntry(g, c)).join('\n')}\n</dl>` });
    }
    if (home) return homeLayout(top, out);
    if (stopN) out.push({ html: stopNav(+stopN[1], c) });
    return [top, ...out.map((o) => (typeof o.html === 'object' ? [o.html.bleed, o.html.after, o.html.section].filter(Boolean).join('\n') : o.html))]
      .filter(Boolean).join('\n');
  } catch (e) {
    if (e instanceof BlockError) {
      const said = e.message.replace(/^block (\d+)/, 'Block $1');
      lastProblem = { page: checks.PAGES[key] || key, problems: [`${said}.`], file };
      throw new Error(`The website was not updated, because of ${where}:\n  - ${said}.\n${file}`);
    }
    throw e;
  }
}

// Every photo from Wikimedia Commons in a block (or the top of a page), fetched, checked
// and saved before the block is drawn. Refused: the page stops, saying why. Unreachable: the
// build stops without blaming the page, since nothing is wrong with what the editor did.
async function commonsPhotos(b, where) {
  const urls = [];
  const scan = (x) => {
    if (!x || typeof x !== 'object') return;
    if (commons.isCommons(x.photo)) urls.push(str(x.photo));
    for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(scan);
  };
  scan(b);
  for (const u of urls) {
    try { await commons.ensure(u); } catch (e) {
      if (e instanceof commons.CommonsRefusal) fail(`${where ? `${where} ` : ''}has a photo from Wikimedia Commons (${e.title}) that cannot be used, because ${e.why}`);
      throw new Error(`[commons] ${e.message}, so the photo ${u} could not be checked. This is not a problem with the page; build again later.`);
    }
  }
}

// The home page is a run of full-width sections. A text block starts a new one, in the
// background it asks for; every other block joins the section above it.
const BACKGROUND = { dark: ['band'], light: ['plain'], tint: ['plain', 'tint'] };
function homeLayout(top, out) {
  const sections = [];
  let s = null;
  for (const o of out) {
    if (o.html && typeof o.html === 'object' && 'section' in o.html) { if (o.html.section) sections.push({ raw: o.html.section }); s = null; continue; }
    if (o.b.type === 'text' || !s) {
      s = { classes: [...(BACKGROUND[o.b.background] || BACKGROUND.light)], extra: new Set(), parts: [] };
      sections.push(s);
    }
    o.bc.extra.forEach((x) => s.extra.add(x));
    s.parts.push(o.html);
  }
  let first = true;
  const html = sections.map((x) => {
    if (x.raw) return x.raw;
    let body = '', wrap = [];
    const flush = () => { if (wrap.length) body += `<div class="wrap">\n${wrap.join('\n')}\n</div>\n`; wrap = []; };
    if (first) { wrap.push('<p class="scroll-hint rv"><i></i> This page runs downhill</p>'); first = false; }
    for (const p of x.parts) {
      if (p && typeof p === 'object') { flush(); body += `${p.bleed}\n${p.after ? `${p.after}\n` : ''}`; } else if (p) wrap.push(p);
    }
    flush();
    return `<section class="${[...x.classes, ...x.extra].join(' ')}">\n${body}</section>`;
  });
  return [top, ...html].join('\n\n');
}

// ---------- structured data from the blocks ----------

const duration = (t) => {
  const m = /^(?:(\d+):)?(\d+):(\d{2})$/.exec(str(t));
  if (!m) return undefined;
  const [h, mi, s] = [+(m[1] || 0), +m[2], +m[3]];
  return `PT${h ? `${h}H` : ''}${mi ? `${mi}M` : ''}${s || (!h && !mi) ? `${s}S` : ''}`;
};
const text = (s) => str(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"');
const plain = (s) => text(prose(s));

// The things a page's blocks describe, as schema.org nodes: the species list, the stories,
// the recordings and films. Named by the page's own "what this page is about" field.
function ldItems(data, url) {
  const blocks = (data && data.blocks) || [];
  const of = (t) => blocks.filter((b) => b && b.type === t);
  const nodes = [];
  const subject = (data.page && data.page.subject) || {};
  const species = of('species').flatMap((b) => b.items || []);
  if (species.length) {
    const item = (s) => {
      const t = s.family
        ? { '@type': 'Taxon', name: str(s.name), parentTaxon: { '@type': 'Taxon', name: str(s.scientific), taxonRank: 'family' } }
        : { '@type': 'Taxon', name: str(s.scientific), alternateName: str(s.name), taxonRank: 'species' };
      if (str(s.atlas)) t.sameAs = str(s.atlas);
      const recs = (s.records || []).map((x) => [str(x.trail), str(x.date)].filter(Boolean).join(', '));
      if (recs.length) t.description = `Recorded on the ${recs.join('; ')}.`;
      return t;
    };
    nodes.push({ '@type': 'ItemList', '@id': `${SITE}${url}#species`, name: str(subject.name) || str(data.page.title),
      numberOfItems: species.length, itemListElement: species.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: item(s) })) });
  }
  const stories = of('story');
  if (stories.length) {
    const item = (b) => {
      const n = { '@type': 'CreativeWork', '@id': `${SITE}${url}#${str(b.anchor) || slug(b.title)}`, name: plain(b.title), abstract: plain(paras(b.summary)[0]) };
      n.isBasedOn = { '@type': 'CreativeWork', description: `The Schools’ Collection, Volume ${str(b.volume)}, Page ${str(b.page)} - collected at ${str(b.school)}, ${str(b.county) || 'Co. Cork'}${str(b.collector) ? ` by ${str(b.collector)}` : ''}`, url: str(b.link) };
      if (str(b.place)) n.description = plain(b.place);
      return n;
    };
    nodes.push({ '@type': 'ItemList', '@id': `${SITE}${url}#stories`, name: str(subject.name) || str(data.page.title),
      numberOfItems: stories.length, itemListElement: stories.map((b, i) => ({ '@type': 'ListItem', position: i + 1, item: item(b) })) });
  }
  for (const b of of('recordings')) {
    (b.items || []).forEach((x, i) => nodes.push({ '@type': 'AudioObject', name: `Field recording ${String(i + 1).padStart(2, '0')}, ${str(x.start).slice(0, 5)}`,
      duration: duration(x.duration), uploadDate: str(b.date) || undefined, contentUrl: SITE + str(x.file), encodingFormat: 'audio/mpeg', isPartOf: { '@id': `${SITE}/#website` } }));
  }
  for (const b of of('films')) {
    (b.items || []).forEach((x) => {
      if (str(x.youtube)) {
        let id = '';
        try { id = youtube.youtubeId(str(x.youtube)); } catch (e) { return; }
        const still = youtube.cached(id).pop();
        nodes.push({ '@type': 'VideoObject', name: str(x.title) || `Film, ${str(x.date)}`, duration: duration(x.duration), uploadDate: str(x.date),
          ...(still && { thumbnailUrl: `${SITE}/assets/img/video/${still.file}` }), embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, isPartOf: { '@id': `${SITE}/#website` } });
        return;
      }
      nodes.push({ '@type': 'VideoObject', name: `Film, ${str(x.date)}`, duration: duration(x.duration), uploadDate: str(x.date),
        ...(str(x.poster) && { thumbnailUrl: SITE + str(x.poster) }), contentUrl: SITE + str(x.file), encodingFormat: 'video/mp4', isPartOf: { '@id': `${SITE}/#website` } });
    });
  }
  return JSON.parse(JSON.stringify(nodes));  // drops fields left undefined
}

// How many of each thing the pages actually hold, for the figure check's counts ("13
// species", "Nineteen recordings"): what the prose says is compared with these.
function counts(pages) {
  const all = Object.values(pages).filter((d) => d && typeof d === 'object').flatMap((d) => d.blocks || []);
  const itemsOf = (t) => all.filter((b) => b && b.type === t).flatMap((b) => b.items || []);
  const use = usage(pages);
  const stops = stopList(pages);
  const photos = (g) => Object.entries(CREDITS.photos).filter(([base, p]) => p.group === g && use.photos.has(base)).length;
  return {
    species: itemsOf('species').length,
    recordings: itemsOf('recordings').length,
    films: itemsOf('films').length,
    stories: all.filter((b) => b && b.type === 'story').length,
    strands: itemsOf('steps').filter((s) => /^Strand\b/i.test(str(s.label))).length,
    phases: itemsOf('steps').filter((s) => /^Phase\b/i.test(str(s.label))).length,
    projects: itemsOf('cards').filter((k) => /^\/new-spaces\/./.test(str(k.link))).length,
    species_photos: photos('species-photos'),
    invasive_photos: photos('invasive-photos'),
    stops_recorded: stops.filter((s) => s.recorded).length,
    stops_unsurveyed: stops.filter((s) => !s.recorded).length,
  };
}

// The photographs already on the website, for the editor's "Choose a photo already on the
// website" picker (site/admin/editor.js): each prepared set once, with a small copy to show,
// the description it already has where the pages use it, and its credit if it is someone
// else's. Published as /admin/site-photos.json; the picker only reads it.
const NOT_PHOTOS = /^(logo|favicon|apple-touch|og-|terrain|hero-poster)/;
function sitePhotos(pages) {
  const alts = new Map();
  const scan = (b) => {
    if (!b || typeof b !== 'object') return;
    if (typeof b.photo === 'string' && str(b.alt)) { const s = photoSet(b.photo); if (s && !alts.has(s.base)) alts.set(s.base, str(b.alt)); }
    for (const v of Object.values(b)) if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === 'object') scan(v);
  };
  Object.values(pages).forEach(scan);
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(SITE_DIR, 'assets', 'img', dir), { withFileTypes: true })) {
      if (e.isDirectory()) { if (!/^(video|instagram|news)$/.test(e.name)) walk(dir + e.name + '/'); continue; }
      const m = /^(.+)-(\d+)\.webp$/.exec(e.name);
      if (!m || NOT_PHOTOS.test(m[1])) continue;
      const set = photoSet(`/assets/img/${dir}${e.name}`);
      if (!set || out.some((x) => x.base === set.base)) continue;
      const largest = set.webp[set.webp.length - 1];
      const credit = CREDITS.photos[set.base] || commons.creditOf(set.base);
      out.push({ base: set.base, path: set.url(largest), thumb: set.url(set.webp[0]), alt: alts.get(set.base) || '',
        ...(credit && { credit: `${credit.by}, ${credit.licence}` }) });
    }
  })('');
  return out.map(({ base, ...x }) => x).sort((a, b) => a.path.localeCompare(b.path));
}

// The terms page's sentence on the stops not yet surveyed, counted as the trails page counts
// them: " Seven of the ten stops have not been surveyed at all.", or nothing once all have
function unsurveyedSentence(pages) {
  const n = stopList(pages).filter((s) => !s.recorded).length;
  const word = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n];
  return n === 0 ? '' : ` ${word} of the ten stops ${n === 1 ? 'has' : 'have'} not been surveyed at all.`;
}

module.exports = { mp4Size, render, ldItems, counts, unsurveyedSentence, mapLayers, sitePhotos, lastProblem: () => lastProblem, stopList, stopPlace, usage, photoSet, webpSize, creditFor, LABELS, SINGULAR, root, BlockError };

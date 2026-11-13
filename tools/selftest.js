// Checks for the build code that parses what an editor types or what a page contains.
// No network, no build needed:   node tools/selftest.js
const assert = require('node:assert/strict');
const { youtubeId } = require('../site/_includes/youtube.js');
const social = require('../site/_includes/social.js');
const { externalLoad } = require('../site/_includes/images.js');

// YouTube: an ID or any common form of address gives the same ID; anything else is refused
const ID = 'aqz-KE-bpKQ';
for (const s of [ID, ` ${ID} `, `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=42s`,
  `https://m.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`]) {
  assert.equal(youtubeId(s), ID, s);
}
for (const s of ['abc', 'https://vimeo.com/123456789', `https://example.com/watch?v=${ID}`, 'https://www.youtube.com/@cairdecorrin']) {
  assert.throws(() => youtubeId(s), /not a YouTube/, s);
}

// Social: Instagram and Facebook post addresses only, sharer identifiers removed, at most three
const out = social.posts({ posts: [
  { url: 'https://www.instagram.com/p/C0abc123/?igsh=MTIzNDU2', caption: ' Spring survey ' },
  { url: 'https://m.facebook.com/cairdecorrin/posts/pfbid02x?mibextid=abc&__cft__[0]=x', caption: 'Clean-up' },
] });
assert.deepEqual(out, [
  { url: 'https://www.instagram.com/p/C0abc123/', caption: 'Spring survey', platform: 'Instagram' },
  { url: 'https://m.facebook.com/cairdecorrin/posts/pfbid02x', caption: 'Clean-up', platform: 'Facebook' },
]);
assert.deepEqual(social.posts({ posts: [] }), []);
assert.deepEqual(social.posts(undefined), []);
for (const p of [{ url: 'http://www.instagram.com/p/x/', caption: 'a' }, { url: 'https://evil-instagram.com/p/x/', caption: 'a' },
  { url: 'https://www.instagram.com/', caption: 'a' }, { url: 'https://www.instagram.com/p/x/', caption: ' ' }, { url: 'nonsense', caption: 'a' }]) {
  assert.throws(() => social.posts({ posts: [p] }), undefined, JSON.stringify(p));
}
assert.throws(() => social.posts({ posts: Array(4).fill({ url: 'https://www.instagram.com/p/x/', caption: 'a' }) }), /at most 3/);

// External loads: anything the browser would fetch from another site by itself is found
for (const h of ['<img src="https://x.com/a.jpg">', '<img src=//x.com/a.jpg>', "<img src='http://x.com/a.jpg'>",
  '<img src="a.webp" srcset="a.webp 700w, https://x.com/b.webp 1100w">', '<video poster="https://x.com/p.jpg"></video>',
  '<iframe src="https://www.youtube.com/embed/x"></iframe>', '<script src="https://cdn.example/x.js"></script>',
  '<link rel="stylesheet" href="https://fonts.example/x.css">', '<link rel="preload" as="image" href="//x.com/a.jpg">',
  '<object data="https://x.com/a.svg"></object>', '<div style="background:url(https://x.com/a.jpg)">']) {
  assert.ok(externalLoad(h), h);
}
for (const h of ['<a href="https://www.instagram.com/p/x/">x</a>', '<link rel="canonical" href="https://www.cairdecorrin.ie/">',
  '<img src="../assets/img/a.webp" srcset="../a.webp 700w, ../b.webp 1100w">', '<a class="yt-play" href="https://www.youtube.com/watch?v=x" data-yt="x"><img src="a.webp"></a>',
  '<meta property="og:image" content="https://www.cairdecorrin.ie/a.jpg">', '<script type="application/ld+json">{"url":"https://x.com/"}</script>']) {
  assert.equal(externalLoad(h), null, h);
}

// Navigation: the Gallery and Articles only once each has an entry, each on its own; News
// always, empty or not; the page's own link and its group are marked
const { nav } = require('../site/_includes/nav.js');
const links = (n) => n.flatMap((g) => g.items || [g]).map((i) => i.href);
const all = { news: 1, gallery: 1, articles: 1 };
for (const s of ['gallery', 'articles']) {
  assert.ok(!links(nav('/', { ...all, [s]: 0 })).includes(`${s}/`), `${s} hidden while empty`);
  assert.ok(links(nav('/', { ...all, [s]: 3 })).includes(`${s}/`), `${s} shown once it has an entry`);
}
assert.ok(links(nav('/', all)).indexOf('articles/') === links(nav('/', all)).indexOf('gallery/') + 1, 'Articles beside Gallery');
assert.equal(nav('/', all).length, 5, 'five header entries');
assert.equal(nav('/', {}).length, 5, 'News stays in the header while it is empty');
assert.ok(links(nav('/', {})).includes('news/'));
const moor = nav('/new-spaces/corrin-moor.html', {});
assert.ok(moor.find((g) => g.id === 'work').current);
assert.ok(moor.find((g) => g.id === 'work').items.find((i) => i.href === 'new-spaces/').current);
assert.ok(!moor.find((g) => g.id === 'explore').current);
assert.ok(nav('/news/some-post/', all).find((g) => g.href === 'news/').current);
assert.ok(nav('/', all).every((g) => !g.current));

// Page text: figures are ordinary words, raw HTML never renders, italics keep the site's class
const { prose } = require('../site/_includes/prose.js');
const figs = require('../site/_data/figures.json');
assert.equal(prose('About 360 hectares'), 'About 360 hectares');
assert.equal(prose('About {catchment.area_ha} hectares'), 'About {catchment.area_ha} hectares');  // no tokens any more
assert.equal(prose('the *Munster Blackwater*'), 'the <em class="hy">Munster Blackwater</em>');
assert.ok(!prose('<script>alert(1)</script>').includes('<script>'), 'raw HTML must not render');

// The figure consistency check: the same quantity in different forms is found as one,
// a disagreement between pages is reported naming both, and it never throws
const fc = require('../site/_includes/figurecheck.js');
const pg = (url, body) => ({ url, html: `<html><head><title>T</title></head><body><main>${body}</main></body></html>` });
const ids = (body) => fc.mentions(fc.textOf(pg('/', body).html)).map((m) => `${m.id}=${m.value}`);
assert.equal(fc.wordsToNumber('three hundred and sixty'), 360);
assert.equal(fc.wordsToNumber('One hundred and thirty-six'), 136);
assert.deepEqual(ids('<dl><dt>Catchment area</dt><dd><small>about</small>3.6<small>km²</small></dd><dt>Or, in hectares</dt><dd>about 360 ha</dd></dl>'),
  ['catchment.area=360', 'catchment.area=360']);
assert.deepEqual(ids('<p>About three hundred and sixty hectares drain through a single confluence.</p>'), ['catchment.area=360']);
assert.deepEqual(ids('<p>About 370 hectares. One outlet. A catchment small enough to change.</p>'), ['catchment.area=370']);
assert.deepEqual(ids('<p>Both sit inside the action area of about 990 hectares.</p>'), ['action.area=990']);
assert.deepEqual(ids('<p>Everything that falls on about 320 hectares upstream of here passes this spot.</p>'), ['stop1.upstream=320']);
assert.deepEqual(ids('<dt>Elevation range</dt><dd>21-213<small>m OD</small></dd>'), ['catchment.outlet=21', 'catchment.top=213']);
assert.deepEqual(ids('<p>Elevation along the loop: 60-115 m, with about 65 m of climbing.</p>'), ['loop.low=60', 'loop.high=115', 'loop.climb=65']);
assert.deepEqual(ids('<h1>Three stops recorded, seven to survey.</h1><p>Seven of the ten stops have not been surveyed. Stop 01 Stop 03</p>'),
  ['stops.recorded=3', 'stops.unsurveyed=7', 'stops.unsurveyed=7']);
// counts of things that exist, in digits or words, compared with how many there are
assert.deepEqual(ids('<h1>13 species, recorded on the trails.</h1><p>13 plant species recorded.</p>'), ['count.species=13', 'count.species=13']);
assert.deepEqual(ids('<p>Nineteen field recordings, and three short films.</p><h1>Five stories.</h1>'), ['count.recordings=19', 'count.films=3', 'count.stories=5']);
assert.deepEqual(ids('<dt>Species reference photographs</dt><dd>Twelve photographs from Commons.</dd><dt>Invasive species photographs</dt><dd>Six photographs from Commons.</dd>'),
  ['count.species_photos=12', 'count.invasive_photos=6']);
const counted = { counts: { species: 14, recordings: 19 } };
assert.match(fc.check([pg('/species/', '<h1>13 species, recorded.</h1>')], counted)[0], /says 13 \(\/species\/\), but the website has 14 species in the species list/);
assert.deepEqual(fc.check([pg('/r/', '<p>Nineteen recordings.</p>')], counted), []);
assert.match(fc.check([pg('/a/', '<p>Ten species.</p>'), pg('/b/', '<p>Eleven species.</p>')], counted)[0], /^Number of species is given differently/);
assert.deepEqual(ids('<p>Other delineations of the same catchment give c. 3.7 km².</p>'), []);  // someone else's figure
assert.deepEqual(ids('<p>Photographed at about 80 m OD on 11 April 2026.</p>'), []);  // no label, not watched
const ref = { catchment: { area_ha: '360' } };
assert.deepEqual(fc.check([pg('/', '<p>The catchment is about 360 ha.</p>'), pg('/x/', '<p>The catchment, 3.58 km².</p>')], ref), []);
const two = fc.check([pg('/', '<p>The catchment is about 370 hectares.</p>'), pg('/about/', '<p>The catchment is about 330 ha.</p>')], ref);
assert.equal(two.length, 1);
assert.match(two[0], /^Catchment area is given differently.*370 ha on \/ .*330 ha on \/about\//);
assert.match(fc.check([pg('/', '<p>The catchment is about 370 ha.</p>')], ref)[0], /every page that gives it says 370 ha.*measured value.*is 360 ha/);
assert.doesNotThrow(() => fc.check([{ url: '/', html: '' }, { url: '/b/', html: '<p>unclosed <b' }], {}));
// every quantity watched has its measured value in figures.json, apart from the counts
for (const q of fc.WATCH.filter((w) => !w.ref.startsWith('counts.'))) {
  assert.equal(typeof q.ref.split('.').reduce((o, k) => o && o[k], figs), 'string', `figures.json has no ${q.ref}`);
}

// The editor's photo step: strip() must leave no EXIF, XMP or comment in what it uploads
const photos = { exports: {} };
new Function('module', 'window', require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'site', 'admin', 'photos.js'), 'utf8'))(photos, undefined);
const { strip, exif } = photos.exports;
const seg = (marker, text) => { const body = Buffer.from(text, 'latin1'); const n = body.length + 2; return Buffer.concat([Buffer.from([0xFF, marker, n >> 8, n & 255]), body]); };
const scan = Buffer.from([0xFF, 0xDA, 0, 2, 1, 2, 3, 0xFF, 0xD9]);  // start of scan, data, end of image
const jpeg = Buffer.concat([Buffer.from([0xFF, 0xD8]), seg(0xE0, 'JFIF\0\x01\x01'), seg(0xE1, 'Exif\0\0GPS 52.12 N Pixel 8a'),
  seg(0xE2, 'ICC_PROFILE\0'), seg(0xED, 'Photoshop 3.0\0'), seg(0xE1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>'), seg(0xFE, 'a comment'),
  seg(0xDB, 'quant'), scan]);
const chunk = (id, text) => { const body = Buffer.from(text, 'latin1'); const n = body.length; const pad = n & 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(id, 'latin1'), Buffer.from([n & 255, (n >> 8) & 255, 0, 0]), body, pad]); };
const vp8x = chunk('VP8X', '\x0C\0\0\0\0\0\0\0\0\0');  // flags: has EXIF, has XMP
const webpBody = Buffer.concat([vp8x, chunk('VP8 ', 'pixels!'), chunk('EXIF', 'GPS 52.12 N'), chunk('XMP ', '<x:xmpmeta/>')]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([(webpBody.length + 4) & 255, (webpBody.length + 4) >> 8, 0, 0]), Buffer.from('WEBP'), webpBody]);
(async () => {
  const j = Buffer.from(await strip(new Uint8Array(jpeg), 'image/jpeg').arrayBuffer());
  for (const gone of ['Exif', 'GPS', 'Pixel', 'Photoshop', 'xmpmeta', 'a comment']) assert.ok(!j.includes(gone), `JPEG still holds ${gone}`);
  for (const kept of ['JFIF', 'ICC_PROFILE', 'quant']) assert.ok(j.includes(kept), `JPEG lost ${kept}`);
  assert.ok(j.subarray(0, 2).equals(Buffer.from([0xFF, 0xD8])) && j.subarray(-scan.length).equals(scan), 'JPEG start or image data damaged');
  const w = Buffer.from(await strip(new Uint8Array(webp), 'image/webp').arrayBuffer());
  assert.ok(!w.includes('EXIF') && !w.includes('GPS') && !w.includes('xmpmeta'), 'WebP still holds EXIF or XMP');
  assert.ok(w.includes('VP8 ') && w.includes('pixels!'), 'WebP lost its image data');
  assert.equal(w.readUInt32LE(4), w.length - 8, 'WebP RIFF size wrong after stripping');
  assert.equal(w[20] & 0x0C, 0, 'WebP still flags EXIF or XMP');

  // Instagram: Behold's feed is checked, pictures re-encoded and saved, and a failed refresh
  // falls back to the saved posts without ever throwing
  const ig = require('../site/_includes/instagram.js');
  const fsp = require('node:fs'), pth = require('node:path'), osm = require('node:os');
  const good = (n) => ({ id: `1789${n}`, timestamp: '2026-11-01T10:00:00+0000', permalink: `https://www.instagram.com/p/Abc${n}/?img_index=1`,
    prunedCaption: `Clean-up on the Corrin \u2014 thanks all ${n}`, sizes: { full: { mediaUrl: `https://cdn.behold.pictures/${n}.webp` } } });
  assert.deepEqual(ig.readFeed({ username: 'cairdecorrin', posts: [good(1)] }).posts[0],
    { id: '17891', permalink: 'https://www.instagram.com/p/Abc1/', date: '2026-11-01T10:00:00.000Z',
      caption: 'Clean-up on the Corrin - thanks all 1', picture: 'https://cdn.behold.pictures/1.webp' });
  for (const bad of [{ ...good(1), id: '../x' }, { ...good(1), permalink: 'https://evil.example/p/x/' },
    { ...good(1), sizes: { full: { mediaUrl: 'http://x/a.jpg' } } }, { ...good(1), timestamp: 'never' }]) {
    assert.throws(() => ig.readFeed({ posts: [bad] }), undefined, JSON.stringify(bad));
  }
  assert.ok(ig.shorten('word '.repeat(60)).endsWith('…') && ig.shorten('word '.repeat(60)).length <= 161);
  const photo = fsp.readFileSync(pth.join(__dirname, '..', 'site', 'assets', 'img', 'white-flowers-700.webp'));
  const fakeFetch = (feed) => async (url) => {
    if (url.startsWith('https://feeds.behold.so/')) return new Response(JSON.stringify(feed), { headers: { 'content-type': 'application/json' } });
    return new Response(photo, { headers: { 'content-type': 'image/webp' } });
  };
  const down = async () => { throw new Error('getaddrinfo ENOTFOUND feeds.behold.so'); };
  const quiet = { log() {}, warn() {} };
  const tmp = fsp.mkdtempSync(pth.join(osm.tmpdir(), 'igtest-'));
  const opts = { feedId: 'TESTFEED', dir: pth.join(tmp, 'cache'), out: pth.join(tmp, 'out'), log: quiet };
  const first = await ig.load({ ...opts, fetch: fakeFetch({ username: 'cairdecorrin', posts: [good(1), good(2)] }) });
  assert.equal(first.posts.length, 2);
  assert.equal(first.username, 'cairdecorrin');
  assert.match(first.posts[0].srcset, /^\/assets\/img\/instagram\/17891-700x\d+\.webp 700w$/);
  assert.ok(fsp.existsSync(pth.join(opts.out, first.posts[0].src.split('/').pop())), 'picture not published');
  assert.deepEqual(await ig.load({ ...opts, fetch: down }), first, 'Behold down: the saved posts must be used');
  assert.deepEqual(await ig.load({ ...opts, fetch: fakeFetch({ posts: 'nonsense' }) }), first, 'a bad feed must not replace the saved posts');
  assert.deepEqual((await ig.load({ ...opts, feedId: 'OTHER', fetch: down })).posts, [], 'posts from another feed must not show');
  const pruned = await ig.load({ ...opts, fetch: fakeFetch({ username: 'cairdecorrin', posts: [good(2)] }) });
  assert.equal(pruned.posts.length, 1);
  assert.ok(!fsp.readdirSync(opts.dir).some((f) => f.startsWith('17891-')), 'a post gone from the feed keeps its picture');
  assert.deepEqual(await ig.load({ ...opts, feedId: '' }), { username: '', posts: [] });
  fsp.rmSync(tmp, { recursive: true, force: true });

  // Blocks: every page as published renders, and a broken or incomplete block stops the
  // build with the page and the block named
  const blocks = require('../site/_includes/blocks.js');
  const pdir = pth.join(__dirname, '..', 'site', '_data', 'pages');
  const real = Object.fromEntries(fsp.readdirSync(pdir).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(fsp.readFileSync(pth.join(pdir, f), 'utf8'))]));
  const ctx = (url, pages = real) => ({ url, pages, figures: figs, gallery: 0, instagram: { posts: [] }, social: [], film: '' });
  const URLS = { home: '/', stop_1: '/stops/stop-1.html', stop_2: '/stops/stop-2.html', stop_3: '/stops/stop-3.html', corrin_moor: '/new-spaces/corrin-moor.html', corrin_wetlands: '/new-spaces/corrin-wetlands.html', new_spaces: '/new-spaces/' };
  for (const key of Object.keys(real)) await blocks.render(key, real[key], ctx(URLS[key] || `/${key}/`));
  const page = (...list) => ({ page: { title: 'Test page', description: 'A test.' }, hero: { eyebrow: 'E', title: 'T' }, blocks: list });
  const broken = async (data, re, key = 'about') => assert.rejects(blocks.render(key, data, ctx('/about/')), re);
  await broken({ ...page(), page: { description: 'x' } }, /not updated, because of the page "About" in the editor:\n  - About this page: "Page title" is empty\.\n\(site\/_data\/pages\/about\.json\)/);
  await broken(page({ type: 'nonsense' }), /Block 1 \(unknown\) is not a kind of block the website knows/);
  await broken(page({ type: 'text', heading: 'Fine' }, { type: 'pair', items: [{ photo: '/assets/img/stream-1800.webp', alt: 'x' }] }), /Block 2 \(Two photos side by side\) needs exactly two photos, and it has 1\. Add or remove a photo/);
  await broken(page({ type: 'image', photo: '/assets/img/stream-1800.webp' }), /Block 1 \(Single image\) has a photo with nothing in "What the photo shows"/);
  await broken(page({ type: 'image', photo: 'https://example.org/x.jpg', alt: 'x' }), /Block 1 \(Single image\) has a photo that is not on this website/);
  await broken(page({ type: 'image', photo: '/assets/img/nothing-1100.webp', alt: 'x' }), /Block 1 \(Single image\) has the photo .* which is not a photograph on this website/);
  await broken(page({ type: 'map' }), /Block 1 \(Interactive map\) belongs on the Trails page and cannot be used here/);
  await broken(page({ type: 'map' }, { type: 'map' }), /Block 2 \(Interactive map\) is a second Interactive map; a page can have only one/, 'trails');
  await broken(page({ type: 'story', title: 'S', summary: 'x', volume: '1', page: '2', link: 'https://www.duchas.ie/x' }), /Block 1 \(Folklore story\) \("S"\) has nothing in "Where it was collected"\. The licence/);
  await broken(page({ type: 'story', title: 'S', summary: 'x', volume: '1', page: '2', school: 'A', link: 'https://example.org/' }), /needs "The story on dúchas\.ie"/);
  await broken(page({ type: 'button', text: 'Go', url: 'trails' }), /Block 1 \(Button link\) has "trails" in "Link to"\. Write a page on this site/);
  await broken(page({ type: 'audio', file: '/assets/audio/nothing.mp3' }), /Block 1 \(Recording\) refers to the recording .* not a file on this website/);
  await broken({ ...real.stop_1, hero: { ...real.stop_1.hero, latitude: '' } }, /"Latitude" and "Longitude" are not a position near Fermoy/, 'stop_1');
  await broken(page({ type: 'route', name: 'R', track: '/assets/uploads/none.gpx' }), /Block 1 \(Walked route\) \(R\) has the track .* not an uploaded GPX file/, 'trails');
  assert.match(require('../site/admin/checks.js').problems('trails', page({ type: 'route', name: 'A path', track: '/assets/uploads/a.gpx' }, { type: 'route', name: 'a  path', track: '/assets/uploads/b.gpx' })).join(' '), /Block 2 \(Walked route\) has the same name as another route/);
  // the editor's checks are the build's: every published page passes, and a stop not yet surveyed is not checked
  const checks = require('../site/admin/checks.js');
  for (const [k, d] of Object.entries(real)) assert.deepEqual(checks.problems(k, d), [], `${k} fails the checks`);
  assert.deepEqual(checks.problems('stop_4', { page: { title: '', description: '' }, hero: { eyebrow: 'Stop 04', title: '' }, blocks: [] }), []);
  assert.match(checks.problems('stop_4', { page: { title: 'X', description: 'Y' }, hero: { title: 'T' }, blocks: [] }).join(' '), /no photo.*Latitude.*Facing.*Recorded/);
  assert.match((await blocks.render('stop_4', real.stop_4, ctx('/stops/stop-4.html'))), /Not yet surveyed/);

  // Uploaded routes: the walked loop survives the same cleaning unchanged; a stretch walked
  // out and back is kept once; times and names never reach the published file
  const gpx = require('../site/_includes/gpx.js');
  const loopGpx = fsp.readFileSync(pth.join(__dirname, '..', 'site', 'assets', 'data', 'glenabo-loop.gpx'), 'utf8');
  const lp = gpx.prepare(loopGpx, 'Loop', [{ n: 1, lat: 52.12752, lon: -8.29878 }]);
  assert.equal(lp.segments.length, 1);
  assert.equal(+(lp.length / 1000).toFixed(2), 2.27);
  assert.equal(lp.climb5, 65);
  assert.deepEqual(lp.marks.map((m) => m.n), [1]);
  const pts = [];
  for (let i = 0; i < 60; i++) pts.push([52.12 + i * 0.00009, -8.3, 60 + i / 2]);
  for (let i = 59; i >= 0; i--) pts.push([52.12 + i * 0.00009, -8.29994, 60 + i / 2]);
  const track = `<gpx creator="App"><metadata><author><name>A Walker</name></author></metadata><trk><name>Walk</name><trkseg>${
    pts.map((q, i) => `<trkpt lat="${q[0]}" lon="${q[1]}"><ele>${q[2]}</ele><time>2026-01-01T10:${String(i % 60).padStart(2, '0')}:00Z</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const ob = gpx.prepare(track, 'Out and back');
  assert.ok(ob.length > 550 && ob.length < 650, `out and back kept once: ${ob.length}`);
  const pub = gpx.toGpx(ob.segments, 'Out and back', 'note');
  assert.ok(!/<time|A Walker|creator="App"|<name>Walk</.test(pub), 'no times or names published');
  for (const [bad, re] of [['not a track', /not a GPS track/], ['<gpx></gpx>', /no points/],
    [track.replace(/<ele>[^<]*<\/ele>/g, ''), /no heights/], [track.replace(/lat="52/g, 'lat="53'), /not near Fermoy/]]) {
    assert.throws(() => gpx.prepare(bad, 'x'), re);
  }
  // a photograph from another source carries its registered credit wherever it is used
  const sp = await blocks.render('about', page({ type: 'image', photo: '/assets/img/species/bilberry-760.webp', alt: 'Bilberry' }), ctx('/about/'));
  assert.match(sp, /<figcaption><a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Vaccinium[^"]*">Lalakmus<\/a>, <a href="[^"]*by-sa\/4\.0">CC BY-SA 4\.0<\/a><\/figcaption>/);
  // a required credit the editor removed from the credits page is put back at the end
  const noFolk = { ...real.credits, blocks: [{ type: 'credits', items: real.credits.blocks[0].items.filter((i) => i.group !== 'folklore') }] };
  const cp = await blocks.render('credits', noFolk, ctx('/credits/'));
  assert.match(cp, /<dt>Folklore<\/dt>[\s\S]*The Story of Corrin - Volume 0378, Page 148/);
  // the terms page's count of stops still to survey follows the stops' pages
  assert.equal(blocks.unsurveyedSentence(real), ' Seven of the ten stops have not been surveyed at all.');
  const live = (n) => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`stop_${i + 1}`, i < n ? real.stop_1 : real.stop_4]));
  assert.equal(blocks.unsurveyedSentence(live(4)), ' Six of the ten stops have not been surveyed at all.');
  assert.equal(blocks.unsurveyedSentence(live(9)), ' One of the ten stops has not been surveyed at all.');
  assert.equal(blocks.unsurveyedSentence(live(10)), '');
  // counts: what the website actually holds
  const n = blocks.counts(real);
  assert.equal(n.species, real.species.blocks.find((b) => b.type === 'species').items.length);
  assert.equal(n.stops_recorded + n.stops_unsurveyed, 10);
  // Reachability: a page no link leads to, a sitemap entry with no page, a reachable page
  // missing from the sitemap, are all found; a deliberate exception is not a finding
  const reach = require('../site/_includes/reach.js');
  const hp = (url, links, extra = '') => ({ url, html: `<html><head>${extra}</head><body>${links.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>` });
  const map = (...u) => u.map((x) => `<url><loc>https://www.cairdecorrin.ie${x}</loc></url>`).join('');
  const NOIDX = '<meta name="robots" content="noindex, follow">';
  let rr = reach.check([hp('/', ['about/', 'https://www.cairdecorrin.ie/trails/', 'https://example.org/']), hp('/about/', ['../']), hp('/trails/', []), hp('/lost/', [])],
    map('/', '/about/', '/trails/', '/gone/'));
  assert.deepEqual(rr.findings, ['/lost/ is built but no link leads to it from the home page.', '/gone/ is in sitemap.xml but no such page is built.']);
  rr = reach.check([hp('/', ['about/']), hp('/about/', [])], map('/'));
  assert.deepEqual(rr.findings, ['/about/ can be reached and indexed but is not in sitemap.xml.']);
  rr = reach.check([hp('/', []), hp('/gallery/', [], NOIDX), hp('/stops/stop-7.html', [], NOIDX), hp('/admin/', [])], map('/'));
  assert.deepEqual(rr.findings, []);
  assert.equal(rr.excused.length, 3);
  rr = reach.check([hp('/', []), hp('/gallery/', [])], map('/'));
  assert.match(rr.findings[0], /^\/gallery\/ is built but no link/, 'an empty section is excused only while it is noindexed');
  rr = reach.check([hp('/', ['admin/']), hp('/x/', [], NOIDX)], map('/', '/x/'));
  assert.ok(rr.findings.includes('/x/ is in sitemap.xml but is marked noindex.'));
  assert.ok(!reach.linksOf('<a class="editlink" href="admin/" hidden>Edit</a>', '/').size, 'a hidden link is no way in');
  // ...and the site as last built has no findings (build first: npm run build)
  const site = pth.join(__dirname, '..', '_site');
  if (fsp.existsSync(pth.join(site, 'sitemap.xml'))) {
    const { fromSite } = require('./reachcheck.js');
    const s = fromSite(site);
    const found = reach.check(s.pages, s.sitemap).findings;
    assert.deepEqual(found, [], `the built site has pages that cannot be reached, or a sitemap that disagrees (run npm run build first if you have changed pages since): ${found.join(' ')}`);
  } else {
    console.log('selftest: no _site/ yet, so the built site was not checked for reachability (npm run build)');
  }
  // Photographs from Wikimedia Commons: credited only with a clear author and a licence the
  // site can honour; anything else refused, with the reason (no network: sample answers)
  const cm = require('../site/admin/commons.js');
  const answer = (meta, extra = {}) => ({ query: { pages: { 1: { imageinfo: [{ mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg', thumburl: 'https://upload.wikimedia.org/x.jpg',
    extmetadata: Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, { value: v }])), ...extra }] } } } });
  const ok = cm.decide(answer({ Artist: '<a href="//commons.wikimedia.org/wiki/User:Lalakmus">Lalakmus</a>', LicenseShortName: 'CC BY-SA 4.0', LicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' }));
  assert.deepEqual([ok.ok, ok.author, ok.licence, ok.licence_url], [true, 'Lalakmus', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0']);
  for (const [lic, want] of [['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'], ['CC BY-SA 3.0 de', 'https://creativecommons.org/licenses/by-sa/3.0/'], ['CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'], ['Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/']]) {
    assert.equal(cm.decide(answer({ Artist: 'A. Person', LicenseShortName: lic })).licence_url, want, lic);
  }
  for (const [meta, extra, re] of [
    [{ Artist: '', LicenseShortName: 'CC BY 4.0' }, {}, /who made it/],
    [{ Artist: 'Unknown author', LicenseShortName: 'Public domain' }, {}, /who made it/],
    [{ Artist: 'A. Person', LicenseShortName: 'GFDL' }, {}, /licence \("GFDL"\) is not one/],
    [{ Artist: 'A. Person', LicenseShortName: 'CC BY-NC-SA 2.0' }, {}, /not one this website can credit/],
    [{ Artist: 'A. Person', LicenseShortName: 'Attribution' }, {}, /not one this website can credit/],
    [{ Artist: 'A. Person' }, {}, /licence is not stated/],
    [{ Artist: 'A. Person', LicenseShortName: 'CC BY 4.0', Restrictions: 'personality' }, {}, /restrictions/],
    [{ Artist: 'A. Person', LicenseShortName: 'CC BY 4.0' }, { mime: 'image/svg+xml' }, /not a photograph/],
  ]) assert.match(cm.decide(answer(meta, extra)).why, re);
  assert.match(cm.decide({ query: { pages: { '-1': { missing: '' } } } }).why, /no file at that address/);
  assert.equal(cm.title('https://commons.wikimedia.org/wiki/File:Reuzenbalsemien_(Impatiens_glandulifera)_01.JPG'), 'File:Reuzenbalsemien (Impatiens glandulifera) 01.JPG');
  assert.ok(!cm.isCommons('https://example.org/x.jpg') && !cm.isCommons('https://upload.wikimedia.org/x.jpg'));
  const checksC = require('../site/admin/checks.js');
  assert.deepEqual(checksC.problems('about', page({ type: 'image', photo: 'https://commons.wikimedia.org/wiki/File:X.jpg', alt: 'x' })), []);

  // Films: a YouTube address, as a news post takes one, or a film kept on the site, whose
  // size is read from the file; nobody types pixel sizes
  assert.deepEqual(checksC.problems('recordings', page({ type: 'films', items: [{ date: '2026-11-01', youtube: 'https://youtu.be/aqz-KE-bpKQ' }] })), []);
  assert.match(checksC.problems('recordings', page({ type: 'films', items: [{ date: '2026-11-01', youtube: 'not a video' }] })).join(' '), /is not one\. On YouTube, press Share/);
  assert.match(checksC.problems('recordings', page({ type: 'films', items: [{ date: '2026-11-01' }] })).join(' '), /nothing in "YouTube address"/);
  assert.deepEqual(blocks.mp4Size(pth.join(__dirname, '..', 'site', 'assets', 'video', 'film', 'corrin-walk.mp4')), { width: 720, height: 1280 });
  const films = await blocks.render('recordings', real.recordings, ctx('/recordings/'));
  assert.ok(films.includes('width="1280" height="720"') && films.includes('width="478" height="850"'));

  // Who took a photo: nothing for the group's own, "Photo:" and the name for anyone else's
  const own = await blocks.render('about', page({ type: 'image', photo: '/assets/img/stream-1800.webp', alt: 'A stream' }), ctx('/about/'));
  assert.ok(!/Photo:/.test(own));
  const theirs = await blocks.render('about', page({ type: 'image', photo: '/assets/img/stream-1800.webp', alt: 'A stream', by: 'A. Neighbour' }), ctx('/about/'));
  assert.match(theirs, /<figcaption>Photo: A\. Neighbour<\/figcaption>/);

  // The photo's position, direction and time, read before they are stripped (photos.js):
  // a little-endian TIFF block as Android writes, with an Exif and a GPS directory
  {
    const T = [];
    const u16 = (v) => [v & 255, v >> 8], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24];
    const entry = (tag, type, count, val) => [...u16(tag), ...u16(type), ...u32(count), ...u32(val)];
    const ascii = (s) => [...Buffer.from(`${s}\0`, 'latin1')];
    // header 8, IFD0 at 8 (2 entries: 2+24+4=30) -> Exif IFD at 38 (1 entry: 18) -> GPS IFD at 56 (6 entries: 78) -> data at 134
    const D = 134, when = ascii('2026:04:11 07:54:12');
    const rats = (...pairs) => pairs.flatMap(([n, d]) => [...u32(n), ...u32(d)]);
    const lat = rats([52, 1], [7, 1], [39072, 1000]), lon = rats([8, 1], [17, 1], [55608, 1000]), dir = rats([1594, 10]);
    T.push(0x49, 0x49, 42, 0, ...u32(8));
    T.push(...u16(2), ...entry(0x8769, 4, 1, 38), ...entry(0x8825, 4, 1, 56), ...u32(0));
    T.push(...u16(1), ...entry(0x9003, 2, when.length, D), ...u32(0));
    T.push(...u16(6), ...entry(1, 2, 2, 0x4E), ...entry(2, 5, 3, D + 20), ...entry(3, 2, 2, 0x57), ...entry(4, 5, 3, D + 44),
      ...entry(16, 2, 2, 0x54), ...entry(17, 5, 1, D + 68), ...u32(0));
    assert.equal(T.length, D);
    T.push(...when, 0, ...lat, ...lon, ...dir);
    const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(T)]);
    const geo = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, (app1.length + 2) >> 8, (app1.length + 2) & 255]), app1, scan]);
    assert.deepEqual(exif(new Uint8Array(geo)), { taken: '2026-04-11 07:54', lat: 52.12752, lon: -8.29878, facing: 159 });
    assert.equal(exif(new Uint8Array(jpeg)), null, 'Exif without a TIFF block reads as nothing');
    assert.equal(exif(new Uint8Array(webp)), null);
    // and the copy that is uploaded keeps none of it
    assert.ok(!Buffer.from(await strip(new Uint8Array(geo), 'image/jpeg').arrayBuffer()).includes('Exif'));
  }

  // A stop's sign line comes from its number, not from a field
  const s5 = await blocks.render('stop_1', { ...real.stop_1 }, ctx('/stops/stop-1.html'));
  assert.match(s5, /<p class="eyebrow">Stop 01 - cairdecorrin\.ie\/s\/1<\/p>/);

  // A stop's height from the elevation grid at its position, to the nearest 5 m; stops 1 to
  // 3 keep the heights checked against the walked GPS track
  const dem = require('../site/admin/dem.js');
  const dd = pth.join(__dirname, '..', 'site', 'admin', 'dem');
  const grid = dem.grid(JSON.parse(fsp.readFileSync(pth.join(dd, 'copernicus-od.json'), 'utf8')), fsp.readFileSync(pth.join(dd, 'copernicus-od.bin')));
  for (const [la, lo, m] of [[52.12752, -8.29878, 66.7], [52.12240, -8.30604, 112.4], [52.12344, -8.30538, 107.0]]) {
    assert.ok(Math.abs(grid.height(la, lo) - m) < 0.2, `grid height at ${la}, ${lo}: ${grid.height(la, lo)}`);
  }
  assert.equal(grid.height(51.9, -8.47), null, 'outside the grid there is no height');
  assert.equal(dem.nearest5(66.7), 65);
  assert.equal(blocks.stopPlace({ latitude: '52.12752', longitude: '-8.29878' }, 'x').elevation, '65');
  assert.equal(blocks.stopPlace({ latitude: '52.12752', longitude: '-8.29878', elevation: '60' }, 'x').elevation, '60');
  assert.throws(() => blocks.stopPlace({ latitude: '52.30', longitude: '-8.10' }, 'x'), /outside the area the website has heights for/);

  // Recordings: cleaned without re-encoding, length read from the file, other formats refused
  {
    const au = require('../site/admin/audio.js');
    const mp3 = fsp.readFileSync(pth.join(__dirname, '..', 'site', 'assets', 'audio', 'clip-0721.mp3'));
    const frame = (id, text) => { const body = Buffer.from(`\0${text}`, 'latin1'); return Buffer.concat([Buffer.from(id), Buffer.from([0, 0, 0, body.length, 0, 0]), body]); };
    const frames = Buffer.concat([frame('TXXX', 'com.android.version\x0013'), frame('TSSE', 'Lavf63.1.101')]);
    const n = frames.length, id3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0, 0, 0, n >> 7, n & 127]), frames]);
    const v1 = Buffer.concat([Buffer.from('TAG'), Buffer.alloc(125, 0x41)]);
    const r = au.clean(Buffer.concat([id3, mp3, v1]), 'a.mp3');
    assert.ok(r.ok && Buffer.from(r.bytes).equals(mp3), 'the MP3 frames come out byte for byte');
    assert.deepEqual(r.removed, ['ID3v2 tag (TXXX, TSSE)', 'ID3v1 tag']);
    assert.deepEqual(au.clean(mp3, 'a.mp3').removed, [], 'the published recordings carry no tags');
    assert.equal(au.length(r.seconds), '8:05');
    const box = (type, ...parts) => { const body = Buffer.concat(parts); const h = Buffer.alloc(8); h.writeUInt32BE(body.length + 8); h.write(type, 4, 'latin1'); return Buffer.concat([h, body]); };
    const mvhd = Buffer.alloc(100); mvhd.writeUInt32BE(3786825600, 4); mvhd.writeUInt32BE(3786825601, 8); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(65500, 16);
    const m4a = Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0', 'latin1')), box('moov', box('mvhd', mvhd), box('udta', box('\xA9xyz', Buffer.from('+52.1275-008.2988/', 'latin1')))), box('mdat', Buffer.from('sound'))]);
    const r4 = au.clean(m4a, 'a.m4a');
    assert.ok(r4.ok && r4.bytes.length === m4a.length && !Buffer.from(r4.bytes).includes('+52.1275') && Buffer.from(r4.bytes).includes('sound'));
    assert.deepEqual(r4.removed, ['mvhd times', 'udta box']);
    assert.equal(au.length(r4.seconds), '1:06');
    const chunkLE = (id, body) => { const h = Buffer.alloc(8); h.write(id, 0, 'latin1'); h.writeUInt32LE(body.length, 4); return Buffer.concat([h, body, body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]); };
    const fmt = Buffer.alloc(16); fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(1, 2); fmt.writeUInt32LE(8000, 4); fmt.writeUInt32LE(16000, 8); fmt.writeUInt16LE(2, 12); fmt.writeUInt16LE(16, 14);
    const wbody = Buffer.concat([Buffer.from('WAVE'), chunkLE('fmt ', fmt), chunkLE('LIST', Buffer.from('INFOIART\x06\0\0\0Pixel\0', 'latin1')), chunkLE('data', Buffer.alloc(32000))]);
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([wbody.length & 255, (wbody.length >> 8) & 255, wbody.length >> 16, 0]), wbody]);
    const rw = au.clean(wav, 'a.wav');
    assert.ok(rw.ok && !Buffer.from(rw.bytes).includes('Pixel') && rw.seconds === 2 && Buffer.from(rw.bytes).readUInt32LE(4) === rw.bytes.length - 8);
    assert.deepEqual(rw.removed, ['LIST chunk']);
    for (const [bytes, name, re] of [[Buffer.from('OggS\0\2xxxxxxxx'), 'a.opus', /Ogg or Opus format/], [Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0]), 'a.webm', /WebM format/],
      [Buffer.from([0x30, 0x26, 0xB2, 0x75, 0, 0, 0, 0]), 'a.wma', /WMA format/]]) {
      const x = au.clean(bytes, name);
      assert.ok(!x.ok && re.test(x.why) && /as MP3 or M4A/.test(x.why), name);
    }
    // the recordings list takes each length and end time from its file
    const recs = await blocks.render('recordings', real.recordings, ctx('/recordings/'));
    assert.ok(recs.includes('8:05') && /07:21:\d\d/.test(recs), 'derived length and end time');
  }

  // A news post's photos are all described: the main photo, the extra ones, any in the text
  assert.deepEqual(checksC.newsProblems({ hero: { src: '/assets/uploads/a.webp', alt: 'A stream' }, gallery: [{ src: '/x.webp', alt: 'x' }] }, 'Text ![A wall](/y.webp)'), []);
  assert.deepEqual(checksC.newsProblems({ hero: {} }, 'Text only'), [], 'a post with no photo needs no description');
  const np = checksC.newsProblems({ hero: { src: '/assets/uploads/a.webp' }, gallery: [{ src: '/x.webp', alt: ' ' }] }, '![](/y.webp) and ![ ](/z.webp)');
  assert.equal(np.length, 3);
  assert.match(np.join(' '), /main photo.*More photos, photo 1.*2 photos in the text/);

  // A YouTube video's title comes from YouTube when none is typed
  assert.deepEqual(checksC.problems('about', page({ type: 'video', url: 'https://youtu.be/aqz-KE-bpKQ' })), []);

  console.log('selftest: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

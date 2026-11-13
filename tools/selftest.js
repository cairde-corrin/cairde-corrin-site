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

// Navigation: Gallery only once it has a photo; the page's own link and its group are marked
const { nav } = require('../site/_includes/nav.js');
const links = (n) => n.flatMap((g) => g.items || [g]).map((i) => i.href);
assert.ok(!links(nav('/', 0)).includes('gallery/'));
assert.ok(links(nav('/', 3)).includes('gallery/'));
assert.equal(nav('/', 0).length, 5, 'five header entries');
const moor = nav('/new-spaces/corrin-moor.html', 0);
assert.ok(moor.find((g) => g.id === 'work').current);
assert.ok(moor.find((g) => g.id === 'work').items.find((i) => i.href === 'new-spaces/').current);
assert.ok(!moor.find((g) => g.id === 'explore').current);
assert.ok(nav('/news/some-post/', 0).find((g) => g.href === 'news/').current);
assert.ok(nav('/', 0).every((g) => !g.current));

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
const { strip } = photos.exports;
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
  assert.match(checks.problems('stop_4', { page: { title: 'X', description: 'Y' }, hero: { title: 'T' }, blocks: [] }).join(' '), /no photo.*Latitude.*Height in metres.*Facing.*Recorded/);
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
  // counts: what the website actually holds
  const n = blocks.counts(real);
  assert.equal(n.species, real.species.blocks.find((b) => b.type === 'species').items.length);
  assert.equal(n.stops_recorded + n.stops_unsurveyed, 10);
  console.log('selftest: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

// Checks for the three pieces of build code that parse what an editor types or what a
// page contains. No network, no build needed:   node tools/selftest.js
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

// Page text: figures come only from figures.json, raw HTML never renders, italics keep the site's class
const { prose } = require('../site/_includes/prose.js');
const figs = require('../site/_data/figures.json');
assert.equal(prose('About {catchment.area_ha} hectares'), `About ${figs.catchment.area_ha} hectares`);
assert.equal(prose('the *Munster Blackwater*'), 'the <em class="hy">Munster Blackwater</em>');
assert.ok(!prose('<script>alert(1)</script>').includes('<script>'), 'raw HTML must not render');
assert.throws(() => prose('{catchment.nonsense} ha'), /not a figure/);
assert.throws(() => prose('{catchment} ha'), /not a figure/);  // a whole group is not a figure

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
  console.log('selftest: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

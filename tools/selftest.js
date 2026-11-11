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

console.log('selftest: all checks passed');

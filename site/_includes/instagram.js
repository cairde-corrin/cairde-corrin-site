// The home page's carousel of the group's latest Instagram posts.
//
// Behold (behold.so) holds a read-only connection to the group's Instagram account and
// publishes its latest posts as a JSON feed. The build fetches that feed, downloads each
// post's picture and re-encodes it like every other photo on the site (WebP at 700 and
// 1100 px, no EXIF or other metadata), and the page serves those copies itself. Visitors'
// browsers never contact Behold, Instagram or Meta; each card is an ordinary link.
//
// The posts and their re-encoded pictures are kept in the repository, in site/_instagram/,
// so a build never depends on Behold. Each build tries to refresh them. If Behold cannot
// be reached, or sends anything unexpected, the build carries on with the posts already
// saved there and the log says so: publishing a news post is never held back by Behold.
// A local build that refreshes them leaves new files there for a developer to commit
// (docs/CONTRIBUTING.md), as with video stills.
//
// The feed to use. Configuration, not content: the editor cannot see or change it, and
// the editor-content check refuses any editor change to this file. Find the ID in Behold
// (the feed -> its JSON feed address, https://feeds.behold.so/<ID>). Empty: no carousel,
// and the home page shows the editor's own social cards instead (site/_data/social.json).
const FEED_ID = '';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Image = require('@11ty/eleventy-img').default;

const CACHE = path.join(__dirname, '..', '_instagram');
const OUT = path.join(__dirname, '..', '..', '_site', 'assets', 'img', 'instagram');
const URL_PATH = '/assets/img/instagram/';
const MAX = 6;            // Behold's free plan sends six
const TIMEOUT = 15000;    // per request, so a slow Behold cannot stall a build
const MAX_BYTES = 20e6;
const CAPTION = 160;

const POST_URL = /^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/;
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

function shorten(text) {
  // Captions are the group's own words; dashes become hyphens to match the rest of the site
  const s = String(text || '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  if (s.length <= CAPTION) return s;
  const cut = s.slice(0, CAPTION);
  const end = cut.lastIndexOf(' ') > 100 ? cut.lastIndexOf(' ') : CAPTION;
  return cut.slice(0, end).replace(/[\s.,;:!?-]+$/, '') + '…';
}

// Behold's feed, reduced to what the page shows. Throws on anything unexpected.
function readFeed(feed) {
  if (!feed || !Array.isArray(feed.posts)) throw new Error('the feed has no list of posts');
  const username = USERNAME.test(feed.username || '') ? feed.username : '';
  const posts = feed.posts.slice(0, MAX).map((p) => {
    const id = String(p.id || '');
    if (!/^[A-Za-z0-9_]{1,40}$/.test(id)) throw new Error(`a post has an unexpected id: ${id.slice(0, 40)}`);
    const permalink = String(p.permalink || '').split('?')[0];
    if (!POST_URL.test(permalink)) throw new Error(`post ${id} does not link to an Instagram post`);
    const date = new Date(p.timestamp);
    if (Number.isNaN(+date)) throw new Error(`post ${id} has no date`);
    const sizes = p.sizes || {};
    const picture = (sizes.full || sizes.large || sizes.medium || {}).mediaUrl || '';
    if (!/^https:\/\//.test(picture)) throw new Error(`post ${id} has no picture address`);
    return { id, permalink, date: date.toISOString(), caption: shorten(p.prunedCaption ?? p.caption), picture };
  });
  return { username, posts };
}

async function get(fetchFn, url) {
  const r = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT), redirect: 'follow' });
  if (!r.ok) throw new Error(`${url.split('?')[0]} answered ${r.status}`);
  return r;
}

// One post's picture, re-encoded into dir as <id>-<w>x<h>.webp
async function picture(fetchFn, post, dir) {
  const r = await get(fetchFn, post.picture);
  if (!/^image\//.test(r.headers.get('content-type') || '')) throw new Error(`post ${post.id}: the picture is not an image`);
  const body = Buffer.from(await r.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`post ${post.id}: the picture is too large`);
  const webp = (await Image(body, {
    widths: [700, 1100], formats: ['webp'], outputDir: dir, urlPath: URL_PATH,
    useCache: false,  // two posts with the same picture must each get their own files
    filenameFormat: (hash, src, width, format) => `${post.id}-${width}w.${format}`,
  })).webp;
  return webp.map((s) => {
    const file = `${post.id}-${s.width}x${s.height}.webp`;
    fs.renameSync(s.outputPath, path.join(dir, file));
    return { file, width: s.width, height: s.height };
  });
}

function saved(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'feed.json'), 'utf8')); } catch (e) { return null; }
}

// Fetch the feed and any new pictures; replace what is saved only once all of it arrived
async function refresh(feedId, fetchFn, dir) {
  const feed = readFeed(await (await get(fetchFn, `https://feeds.behold.so/${encodeURIComponent(feedId)}`)).json());
  const last = saved(dir);
  const before = new Map((last && last.feed === feedId && Array.isArray(last.posts) ? last.posts : []).map((p) => [p.id, p]));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'instagram-'));
  try {
    const posts = [];
    for (const { picture: _, ...p } of feed.posts) {
      const old = before.get(p.id);
      const kept = old && Array.isArray(old.images) && old.images.every((i) => fs.existsSync(path.join(dir, i.file)));
      posts.push({ ...p, images: kept ? old.images : await picture(fetchFn, { ...p, picture: _ }, tmp), fresh: !kept });
    }
    fs.mkdirSync(dir, { recursive: true });
    for (const p of posts.filter((x) => x.fresh)) {
      for (const i of p.images) fs.copyFileSync(path.join(tmp, i.file), path.join(dir, i.file));
    }
    const record = { feed: feedId, fetched: new Date().toISOString(), username: feed.username,
      posts: posts.map(({ fresh, ...p }) => p) };
    fs.writeFileSync(path.join(dir, 'feed.json'), JSON.stringify(record, null, 2) + '\n');
    // pictures of posts no longer in the feed (deleted on Instagram, or pushed out) go too
    const keep = new Set(['feed.json', ...record.posts.flatMap((p) => p.images.map((i) => i.file))]);
    fs.readdirSync(dir).filter((f) => !keep.has(f)).forEach((f) => fs.rmSync(path.join(dir, f)));
    return posts.filter((x) => x.fresh).length;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// What the home page shows: { username, posts: [{ permalink, date, caption, src, srcset, width, height }] }.
// Never throws: any failure leaves the last saved posts, or none.
async function load({ feedId = FEED_ID, fetch: fetchFn = globalThis.fetch, dir = CACHE, out = OUT, log = console } = {}) {
  if (!feedId) return { username: '', posts: [] };
  try {
    const added = await refresh(feedId, fetchFn, dir);
    if (added) log.log(`[instagram] ${added} new post(s) from Behold saved in site/_instagram/; commit them.`);
  } catch (e) {
    const last = saved(dir);
    log.warn(`[instagram] could not refresh the posts from Behold (${e.message}). `
      + (last && Array.isArray(last.posts) ? `Using the ${last.posts.length} saved on ${String(last.fetched).slice(0, 10)}.`
        : 'No saved posts, so the home page shows none.'));
  }
  try {
    const record = saved(dir);
    // posts saved from a different feed are not shown
    if (!record || record.feed !== feedId || !Array.isArray(record.posts)) return { username: '', posts: [] };
    fs.mkdirSync(out, { recursive: true });
    const posts = record.posts.filter((p) => Array.isArray(p.images) && p.images.length
      && p.images.every((i) => fs.existsSync(path.join(dir, i.file)))).map((p) => {
      p.images.forEach((i) => fs.copyFileSync(path.join(dir, i.file), path.join(out, i.file)));
      const main = p.images[p.images.length - 1];
      return { permalink: p.permalink, date: p.date, caption: p.caption, src: URL_PATH + p.images[0].file,
        srcset: p.images.map((i) => `${URL_PATH}${i.file} ${i.width}w`).join(', '), width: main.width, height: main.height };
    });
    return { username: record.username || '', posts };
  } catch (e) {
    log.warn(`[instagram] the saved posts in site/_instagram/ could not be read (${e.message}); the home page shows none.`);
    return { username: '', posts: [] };
  }
}

module.exports = { load, readFeed, shorten, FEED_ID };

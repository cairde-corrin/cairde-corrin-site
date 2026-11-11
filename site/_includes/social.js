// The home page's social block: up to three Instagram or Facebook posts, each with a
// caption the editor types. They are rendered as plain links. Nothing is embedded and
// nothing is fetched from Meta, at build time or in the browser.
const MAX = 3;
const HOSTS = { 'instagram.com': 'Instagram', 'facebook.com': 'Facebook' };
// Share links carry identifiers for whoever copied them (igsh, mibextid and the like)
const TRACKING = /^(?:igsh|igshid|mibextid|rdid|share_url|fbclid|utm_.*|__cft__.*|__tn__)$/i;

function posts(data) {
  const list = (data && data.posts) || [];
  if (list.length > MAX) throw new Error(`site/_data/social.json lists ${list.length} posts; the home page shows at most ${MAX}.`);
  return list.map((p) => {
    let u = null;
    try { u = new URL(String(p.url).trim()); } catch (e) { /* reported below */ }
    const platform = u && u.protocol === 'https:' && HOSTS[u.hostname.replace(/^(?:www|m|web)\./, '')];
    if (!platform || u.pathname.length < 2) {
      throw new Error(`site/_data/social.json: "${p.url}" is not the address of an Instagram or Facebook post.`);
    }
    const caption = String(p.caption || '').trim();
    if (!caption) throw new Error(`site/_data/social.json: the post ${p.url} has no caption.`);
    [...u.searchParams.keys()].filter((k) => TRACKING.test(k)).forEach((k) => u.searchParams.delete(k));
    u.hash = '';
    return { url: u.toString(), caption, platform };
  });
}

module.exports = { posts, MAX };

// The Content Security Policy for every generated page, added as a <meta> tag at build time.
// The editor at /admin/ has its own, looser policy in site/admin/index.html.
//
// Scripts may come only from this site, plus the two short inline scripts the pages carry
// on purpose: the line in _includes/nav.njk that marks JavaScript as available, and the
// home page's invite forwarder in index.njk. Those are allowed by their SHA-256 hash, read
// here from the source files, so editing either updates the policy by itself. Any other
// inline script in a page stops the build: nothing written in the editor can reach the
// page as a script, and this makes sure nothing else does either.
//
// Visitors' browsers then refuse to run injected script even if some future change let
// one through. Styles allow inline attributes (the pages use them); YouTube is the one
// outside frame allowed, and only once a visitor presses play.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const INLINE = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
const hash = (body) => `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;

const SOURCES = ['nav.njk', path.join('..', 'index.njk')].map((f) => path.join(__dirname, f));
const ALLOWED = new Map();
for (const file of SOURCES) {
  for (const [, body] of fs.readFileSync(file, 'utf8').matchAll(INLINE)) ALLOWED.set(body, hash(body));
}

function policy(scriptHashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "media-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function addCsp(html, where) {
  if (!html.includes('<meta charset="utf-8">')) return html;
  const hashes = new Set();
  for (const [, body] of html.matchAll(INLINE)) {
    if (!ALLOWED.has(body)) {
      throw new Error(`${where} carries an inline script the site does not allow: ${body.trim().slice(0, 80)}`);
    }
    hashes.add(ALLOWED.get(body));
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy([...hashes])}">`;
  return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${meta}`);
}

module.exports = { addCsp, policy };

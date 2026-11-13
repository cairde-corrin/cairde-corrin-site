// Photographs from Wikimedia Commons, by their file page address. One copy of the rules,
// used in the editor (site/admin/editor.js, when an address is pasted) and in the build
// (site/_includes/commons.js, which fetches, checks and self-hosts the photo).
//
// The credit comes from Commons itself: the author ("Artist") and the licence in the file's
// metadata. If either is not clear, the photo is refused and the reason given. A wrong or
// missing attribution would break the licence the photo is used under; a missing photo is
// only an inconvenience. Never publish an uncredited one.
//
// Accepted: Creative Commons Attribution (CC BY) and Attribution-ShareAlike (CC BY-SA), any
// version 1.0 to 4.0, including national ports; CC0; public domain. Each is credited with
// the author, the licence linked, and the file page linked.
// Refused: anything else, including GFDL and the Free Art Licence (they require the full
// licence text to travel with the photo), plain "Attribution" templates and other bespoke
// terms, any NonCommercial or NoDerivatives licence (cropping and resizing are changes),
// a file Commons marks with restrictions (personality rights, trademarks, insignia), and a
// file whose author is missing, unknown or anonymous.
(function () {
  var FILE = /^https:\/\/commons\.(?:m\.)?wikimedia\.org\/wiki\/(File:[^?#]+)$/i;

  function isCommons(v) { return FILE.test(String(v || '').trim()); }
  // "File:Vaccinium myrtillus.jpg" from the address
  function title(url) {
    var m = FILE.exec(String(url || '').trim());
    if (!m) return '';
    var t = m[1];
    try { t = decodeURIComponent(t); } catch (e) { /* keep as typed */ }
    return t.replace(/_/g, ' ');
  }
  // the address a pasted link should be stored as
  function normal(url) {
    var t = title(url);
    return t ? 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')).replace(/%3A/i, ':').replace(/%2F/gi, '/') : '';
  }
  function text(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
  }

  // The API's answer for one file -> { ok, author, licence, licence_url, file_url, image, width, height } or { ok: false, why }
  function decide(api) {
    var pages = api && api.query && api.query.pages ? Object.keys(api.query.pages).map(function (k) { return api.query.pages[k]; }) : [];
    var page = pages[0];
    if (!page || page.missing !== undefined || !page.imageinfo || !page.imageinfo.length) {
      return { ok: false, why: 'Wikimedia Commons has no file at that address. Copy the address of the file\'s own page on Commons (it starts with https://commons.wikimedia.org/wiki/File:).' };
    }
    var info = page.imageinfo[0], meta = info.extmetadata || {};
    var get = function (k) { return meta[k] && meta[k].value != null ? String(meta[k].value) : ''; };
    if (!/^image\/(jpeg|png|webp|tiff)$/.test(info.mime || '')) return { ok: false, why: 'it is not a photograph (Commons says it is ' + (info.mime || 'an unknown kind of file') + ').' };
    var restrictions = text(get('Restrictions'));
    if (restrictions) return { ok: false, why: 'Commons notes restrictions on how it may be used (' + restrictions + '), so the website does not use it.' };
    var author = text(get('Artist'));
    if (!author || /^(unknown|anonymous|author unknown|not known)\b/i.test(author) || author.length > 200) {
      return { ok: false, why: 'Commons does not say clearly who made it, so it cannot be credited. Choose another photo.' };
    }
    var short = text(get('LicenseShortName')), url = text(get('LicenseUrl')).replace(/^http:/, 'https:');
    var licence, licenceUrl;
    var cc = /^CC BY(-SA)? ([1-4]\.\d)( [A-Za-z]{2,}(-[A-Za-z]{2,})?)?$/.exec(short);
    if (cc) {
      licence = short;
      licenceUrl = url || ('https://creativecommons.org/licenses/' + (cc[1] ? 'by-sa' : 'by') + '/' + cc[2] + '/');
    } else if (/^CC0( 1\.0)?$/i.test(short)) {
      licence = 'CC0'; licenceUrl = url || 'https://creativecommons.org/publicdomain/zero/1.0/';
    } else if (/^public domain$/i.test(short)) {
      licence = 'Public domain'; licenceUrl = url || 'https://creativecommons.org/publicdomain/mark/1.0/';
    } else {
      return { ok: false, why: 'its licence' + (short ? ' ("' + short + '")' : ' is not stated, and it') + ' is not one this website can credit correctly. Only photos under CC BY, CC BY-SA, CC0 or in the public domain are used.' };
    }
    return { ok: true, author: author, licence: licence, licence_url: licenceUrl, file_url: info.descriptionurl,
      image: info.thumburl || info.url, width: info.thumbwidth || info.width, height: info.thumbheight || info.height };
  }

  // The API address for one file: its author, licence and a copy up to 1800 px wide.
  // origin=* lets the editor's browser ask directly.
  function apiUrl(url) {
    return 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo'
      + '&iiprop=url|mime|size|extmetadata&iiurlwidth=1800&titles=' + encodeURIComponent(title(url));
  }

  var api = { isCommons: isCommons, title: title, normal: normal, decide: decide, apiUrl: apiUrl, text: text };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CairdeCommons = api;
})();

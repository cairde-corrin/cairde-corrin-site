// The checks a page must pass before it can be published, in the same plain words as the
// editor's field labels. One copy, used twice:
//
// - in the editor (site/admin/editor.js), when a page is saved: a page that fails is not
//   saved, and the editor is told what to fix, there and then;
// - in the build (site/_includes/blocks.js): anything that reaches the repository another
//   way still cannot be published broken. The build stops and the live site stays as it was.
//
// Checks that need the website's files (does that photo exist, can that GPS track be read)
// are made by the build only.
(function () {
  var PAGES = {
    home: 'Home page', about: 'About', links: 'Links', new_spaces: 'New spaces',
    corrin_moor: 'New spaces: Corrin moorland', corrin_wetlands: 'New spaces: Corrin wetlands',
    water: 'Water and ecosystems', recordings: 'Recordings', species: 'Species', folklore: 'Folklore',
    trails: 'Trails', credits: 'Credits',
  };
  for (var n = 1; n <= 10; n++) PAGES['stop_' + n] = 'Stop ' + (n < 10 ? '0' : '') + n;
  var LABELS = {
    text: 'Text', figures: 'Figure box', image: 'Single image', pair: 'Two photos side by side',
    carousel: 'Photo carousel', grid: 'Photo grid', steps: 'Numbered points', cards: 'Cards',
    links: 'List of links', note: 'Note box', quote: 'Pull quote', button: 'Button link',
    audio: 'Recording', recordings: 'List of recordings', films: 'Films', video: 'YouTube video',
    story: 'Folklore story', species: 'Species list', credits: 'Credits list', map: 'Interactive map',
    stops: 'List of stops', walked: 'The walked loop', route: 'Walked route', social: 'Posts from the group',
  };
  // a page can hold only one of these
  var SINGULAR = { map: 1, stops: 1, walked: 1, social: 1 };
  // these belong to one page only
  var ONLY_ON = { map: 'trails', stops: 'trails', walked: 'trails', route: 'trails', social: 'home', credits: 'credits' };
  var GROUPS = { elevation: 1, 'species-records': 1, 'species-photos': 1, 'invasive-photos': 1, folklore: 1, 'commons-photos': 1 };

  function str(v) { return v == null ? '' : String(v).trim(); }
  // the same test as a news post's YouTube field (site/admin/config.yml)
  var YOUTUBE = /^\s*([A-Za-z0-9_-]{11}|https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/\S+)\s*$/;
  var YOUTUBE_HOW = 'On YouTube, press Share under the video, copy the address and paste it here.';
  function list(b) { return Array.isArray(b && b.items) ? b.items : []; }
  function nth(i) { return String(i + 1); }
  var LINK = 'Write a page on this site starting with / (such as /trails/), or a full web address starting with https://';
  function badLink(v) { v = str(v); return v && !/^(\/|https:\/\/|mailto:|#)/.test(v); }
  // a photograph on this site (/assets/img/...) or one uploaded in the editor (/assets/uploads/...)
  // or a photograph on Wikimedia Commons, by its file page (site/admin/commons.js)
  function badPhoto(v) { v = str(v); return v && !/^\/assets\/(img|uploads)\//.test(v) && !/^https:\/\/commons\.(m\.)?wikimedia\.org\/wiki\/File:/i.test(v); }

  function photo(p, where, out, required) {
    if (!str(p.photo)) { if (required) out.push(where + ' has no photo. Choose one or upload one.'); return; }
    if (badPhoto(p.photo)) out.push(where + ' has a photo that is not on this website. Choose one already on the website, upload it, or for a photo from Wikimedia Commons use "Use a photo from Wikimedia Commons".');
    if (!str(p.alt)) out.push(where + ' has a photo with nothing in "What the photo shows". Say what is in the photo, in one sentence.');
  }
  function link(words, to, where, out) {
    if (str(words) && !str(to)) out.push(where + ' has "Link words" but nothing in "Link to". Add where it should lead, or remove the link words.');
    else if (badLink(to)) out.push(where + ' has "' + str(to) + '" in "Link to". ' + LINK + '.');
  }
  function atLeast(b, min, what, where, out) {
    if (list(b).length < min) { out.push(where + ' has no ' + what + '. Add at least one, or remove the block.'); return false; }
    return true;
  }

  var CHECK = {
    text: function (b, w, o) { if (!str(b.eyebrow) && !str(b.heading) && !str(b.text)) o.push(w + ' is empty. Write something in it, or remove the block.'); },
    figures: function (b, w, o) {
      if (atLeast(b, 1, 'figures', w, o)) list(b).forEach(function (f, i) {
        if (!str(f.label) || !str(f.value)) o.push(w + ', figure ' + nth(i) + ', needs both "What it is" and "The figure".');
      });
    },
    image: function (b, w, o) { photo(b, w, o, true); },
    pair: function (b, w, o) {
      var n = list(b).length;
      if (n !== 2) o.push(w + ' needs exactly two photos, and it has ' + n + '. Add or remove a photo, or use a different block.');
      list(b).forEach(function (p, i) { photo(p, w + ', photo ' + nth(i) + ',', o, true); });
    },
    carousel: function (b, w, o) { if (atLeast(b, 1, 'photos', w, o)) list(b).forEach(function (p, i) { photo(p, w + ', photo ' + nth(i) + ',', o, true); }); },
    grid: function (b, w, o) { CHECK.carousel(b, w, o); },
    steps: function (b, w, o) {
      if (atLeast(b, 1, 'points', w, o)) list(b).forEach(function (s, i) {
        if (!str(s.heading)) o.push(w + ', point ' + nth(i) + ', has no heading.');
        link(s.link_text, s.link, w + ', point ' + nth(i) + ',', o);
      });
    },
    cards: function (b, w, o) {
      if (atLeast(b, 1, 'cards', w, o)) list(b).forEach(function (k, i) {
        var at = w + ', card ' + nth(i) + ',';
        if (!str(k.title)) o.push(at + ' has no title.');
        photo(k, at, o, false);
        link(k.link_text, k.link, at, o);
      });
    },
    links: function (b, w, o) {
      if (atLeast(b, 1, 'links', w, o)) list(b).forEach(function (l, i) {
        var at = w + ', link ' + nth(i) + ',';
        if (!str(l.name)) o.push(at + ' has no name.');
        if (!/^https:\/\//.test(str(l.url))) o.push(at + ' needs the full web address, starting with https://');
      });
    },
    note: function (b, w, o) {
      if (!str(b.text)) o.push(w + ' has no text.');
      if (b.folded && !str(b.heading)) o.push(w + ' is folded away until someone taps its heading, so it needs a heading.');
      link(b.link_text, b.link, w, o);
    },
    quote: function (b, w, o) { if (!str(b.text)) o.push(w + ' has nothing in "The quotation".'); },
    button: function (b, w, o) {
      if (!str(b.text)) o.push(w + ' has nothing in "Words on the button".');
      if (!str(b.url)) o.push(w + ' has nothing in "Link to". Add where the button should lead.');
      else if (badLink(b.url)) o.push(w + ' has "' + str(b.url) + '" in "Link to". ' + LINK + ', or mailto: and an email address.');
    },
    audio: function (b, w, o) { if (!/^\/assets\/audio\//.test(str(b.file))) o.push(w + ' needs a recording already on the website, such as /assets/audio/stop-1.mp3.'); },
    recordings: function (b, w, o) {
      if (atLeast(b, 1, 'recordings', w, o)) list(b).forEach(function (x, i) {
        var at = w + ', recording ' + nth(i) + ',';
        if (!str(x.start)) o.push(at + ' has nothing in "Started at".');
        if (!/^\/assets\/audio\//.test(str(x.file))) o.push(at + ' needs a recording already on the website, such as /assets/audio/stop-1.mp3.');
      });
    },
    films: function (b, w, o) {
      if (atLeast(b, 1, 'films', w, o)) list(b).forEach(function (x, i) {
        var at = w + ', film ' + nth(i) + ',';
        if (!str(x.date)) o.push(at + ' has nothing in "Filmed on".');
        if (str(x.youtube)) { if (!YOUTUBE.test(str(x.youtube))) o.push(at + ' has a "YouTube address" that is not one. ' + YOUTUBE_HOW); }
        else if (!/^\/assets\/video\//.test(str(x.file))) o.push(at + ' has nothing in "YouTube address". ' + YOUTUBE_HOW);
      });
    },
    video: function (b, w, o) {
      if (!str(b.url)) o.push(w + ' has nothing in "YouTube address".');
      else if (!YOUTUBE.test(str(b.url))) o.push(w + ' has a "YouTube address" that is not one. ' + YOUTUBE_HOW);
      if (!str(b.title)) o.push(w + ' has nothing in "Title of the video".');
    },
    story: function (b, w, o) {
      var at = w + (str(b.title) ? ' ("' + str(b.title) + '")' : '');
      if (!str(b.title)) o.push(w + ' has no title.');
      if (!str(b.summary)) o.push(at + ' has no summary.');
      var need = [['volume', 'Volume'], ['page', 'Page'], ['school', 'Where it was collected']].filter(function (f) { return !str(b[f[0]]); });
      if (need.length) o.push(at + ' has nothing in ' + need.map(function (f) { return '"' + f[1] + '"'; }).join(' or ') + '. The licence the story is used under requires its source, so it cannot be published without it.');
      if (!/^https:\/\/www\.duchas\.ie\//.test(str(b.link))) o.push(at + ' needs "The story on dúchas.ie": its address there, starting with https://www.duchas.ie/. The licence requires it.');
    },
    species: function (b, w, o) {
      if (atLeast(b, 1, 'species', w, o)) list(b).forEach(function (s, i) {
        var at = w + ', species ' + nth(i) + (str(s.name) ? ' (' + str(s.name) + ')' : '') + ',';
        if (!str(s.name)) o.push(at + ' has no common name.');
        if (!str(s.scientific)) o.push(at + ' has no scientific name.');
        if (!(Array.isArray(s.records) && s.records.length)) o.push(at + ' has nothing in "Where and when it was recorded".');
        photo(s, at, o, false);
      });
    },
    credits: function (b, w, o) {
      list(b).forEach(function (x, i) {
        var at = w + ', entry ' + nth(i) + ',';
        if (x.type === 'required') { if (!GROUPS[x.group]) o.push(at + ' asks for credits that do not exist.'); return; }
        if (!str(x.heading)) o.push(at + ' has no heading.');
        if (!str(x.text)) o.push(at + (str(x.heading) ? ' ("' + str(x.heading) + '")' : '') + ' has no text.');
      });
    },
    route: function (b, w, o) {
      if (!str(b.name)) o.push(w + ' has nothing in "Name of the route".');
      if (!/^\/assets\/uploads\/.+\.gpx$/i.test(str(b.track))) o.push(w + (str(b.name) ? ' ("' + str(b.name) + '")' : '') + ' needs "The GPS track": upload the walk as a GPX file.');
    },
    map: function () {}, stops: function () {}, walked: function () {}, social: function () {},
  };

  function stopProblems(h, out) {
    var lat = +h.latitude, lon = +h.longitude, elev = +h.elevation;
    if (!str(h.photo)) out.push('The top of the page has no photo. Choose one or upload one.');
    else photo(h, 'The top of the page', out, true);
    if (!(lat > 51 && lat < 53) || !(lon > -9.5 && lon < -7)) out.push('The top of the page: "Latitude" and "Longitude" are not a position near Fermoy. Give them as numbers, such as 52.12752 and -8.29878.');
    if (!str(h.elevation) || !(elev >= 0 && elev < 400)) out.push('The top of the page: "Height in metres" needs the height as a number, such as 60.');
    if (!str(h.facing)) out.push('The top of the page has nothing in "Facing".');
    if (!str(h.recorded)) out.push('The top of the page has nothing in "Recorded".');
  }

  // Everything wrong with one page, as sentences an editor can act on; [] if nothing is
  function problems(key, data) {
    var out = [];
    if (!data || typeof data !== 'object') return ['The page has no content.'];
    var stop = /^stop_\d+$/.test(key);
    var h = data.hero || {};
    if (stop && !str(h.title)) return out;  // not yet surveyed: nothing to check
    var page = data.page || {};
    if (!str(page.title)) out.push(stop ? 'About this page: "Name of the stop" is empty.' : 'About this page: "Page title" is empty.');
    if (!str(page.description)) out.push('About this page: "Summary" is empty. Write one or two sentences for search results.');
    if (!str(h.title)) out.push('The top of the page has no title.');
    if (stop) stopProblems(h, out);
    var seen = {};
    (Array.isArray(data.blocks) ? data.blocks : []).forEach(function (b, i) {
      var type = b && b.type;
      var w = 'Block ' + (i + 1) + ' (' + (LABELS[type] || 'unknown') + ')';
      if (!CHECK[type]) { out.push(w + ' is not a kind of block the website knows. Remove it.'); return; }
      if (ONLY_ON[type] && ONLY_ON[type] !== key) { out.push(w + ' belongs on the ' + PAGES[ONLY_ON[type]] + ' page and cannot be used here. Remove it.'); return; }
      if (SINGULAR[type]) {
        if (seen[type]) out.push(w + ' is a second ' + LABELS[type] + '; a page can have only one. Remove one of them.');
        seen[type] = 1;
      }
      CHECK[type](b, w, out);
      if (type === 'route' && str(b.name)) {
        var name = str(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (seen['route:' + name]) out.push(w + ' has the same name as another route on the page. Give each route its own name.');
        seen['route:' + name] = 1;
      }
    });
    return out;
  }

  var api = { problems: problems, PAGES: PAGES, LABELS: LABELS, SINGULAR: SINGULAR, ONLY_ON: ONLY_ON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CairdeChecks = api;
})();

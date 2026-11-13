// Small fixes to the editor's interface, loaded by site/admin/index.html.
(function () {
  // The Image button in the post body offers "Insert from URL", which would make the
  // public page load a photo from another website. The photo fields switch it off with
  // choose_url: false, but Decap does not pass that setting to the body's Image button,
  // and the URL buttons share their style with the upload buttons, so they are hidden by
  // their text. The build also refuses a page that loads anything from another site.
  //
  // "Delete published entry" and "Unpublish" are hidden the same way. Decap carries both
  // out by committing straight to main, not through a pull request, so once main is
  // protected (docs/SECURITY.md) they can only fail. Editors take a post down with its
  // "Take this off the website" tick instead, which is published like any other change.
  var HIDE = /^(Insert from URL|Replace with URL|Delete published entry|Unpublish)$/;
  new MutationObserver(function () {
    Array.prototype.forEach.call(document.querySelectorAll('button, [role="button"], [role="menuitem"]'), function (b) {
      if (HIDE.test(b.textContent.trim())) b.style.display = 'none';
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Copying a block. Decap can add, remove and reorder the blocks of a page but has no copy
  // button, so every block has a "Make a copy of this block when I save" tick: on saving,
  // each ticked block is followed by a copy of itself, and both ticks are cleared.
  function copyTicked(list) {
    return list.flatMap(function (b) {
      if (!b || !b.get || !b.get('copy')) return [b];
      var plain = b.set('copy', false);
      return [plain, plain];
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.CMS || !window.CMS.registerEventListener) return;
    window.CMS.registerEventListener({
      name: 'preSave',
      handler: function (e) {
        var data = e.entry.get('data');
        var blocks = data && data.get && data.get('blocks');
        if (blocks && blocks.some && blocks.some(function (b) { return b && b.get && b.get('copy'); })) data = data.set('blocks', copyTicked(blocks));
        // A page that would stop the website updating is not saved: its editor is told
        // what to fix now, rather than seeing Publish succeed and nothing change.
        // site/admin/checks.js is the same set of checks the build makes.
        var coll = e.entry.get('collection');
        if ((coll === 'pages' || coll === 'news') && window.CairdeChecks) {
          var js = data.toJS();
          var found = coll === 'pages' ? window.CairdeChecks.problems(e.entry.get('slug'), js) : window.CairdeChecks.newsProblems(js, js.body);
          if (found.length) {
            var msg = 'This ' + (coll === 'pages' ? 'page' : 'post') + ' has not been saved, because the website could not publish it as it is:\n\n'
              + found.map(function (x) { return '- ' + x; }).join('\n') + '\n\nFix ' + (found.length === 1 ? 'this' : 'these') + ' and save again. Nothing you typed has been lost.';
            window.alert(msg);
            throw new Error(found.join(' '));
          }
        }
        return data;
      },
    });
  });

  // The photo fields of the pages. Decap's own photo field can only upload, so a photo
  // already on the website would be uploaded again as a duplicate. This field offers both:
  // "Choose a photo already on the website" browses /admin/site-photos.json (built with
  // the site) and only reads it; "Upload a new photo" opens Decap's usual media library
  // inside the entry, with the field's 20 MB cap and the draft workflow, exactly as the
  // standard photo field does. Neither offers "Insert from URL", and the top-bar Media
  // button stays hidden (index.html).
  function sitePhotoWidget() {
    var h = window.h, CMS = window.CMS;
    var list = null;
    function load() {
      if (!list) list = fetch('/admin/site-photos.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }, function () { return []; });
      return list;
    }
    // React wants style as an object; written here as CSS text for readability
    function css(t) {
      var o = {};
      t.split(';').forEach(function (d) {
        var i = d.indexOf(':');
        if (i > 0) o[d.slice(0, i).trim().replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = d.slice(i + 1).trim();
      });
      return o;
    }
    // Where, which way and when an uploaded photo was taken, read before photos.js removed
    // it, offered for the fields beside the photo. Decap gives a field no way to set another,
    // so they are found by their labels within this photo's own part of the form (the part
    // holding its "Who took this photo") and typed into as an editor would.
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function when(t, short) {
      var m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)$/.exec(t || '');
      return m ? +m[3] + ' ' + (short ? MONTHS[+m[2] - 1].slice(0, 3) : MONTHS[+m[2] - 1]) + ' ' + m[1] + ', ' + m[4] : '';
    }
    function labelled(scope, words) {
      var ls = scope ? scope.querySelectorAll('label') : [];
      for (var i = 0; i < ls.length; i++) {
        if (ls[i].textContent.trim().indexOf(words) === 0 && ls[i].htmlFor) return document.getElementById(ls[i].htmlFor);
      }
      return null;
    }
    function ownPart(el) {
      for (var a = el && el.parentElement; a; a = a.parentElement) if (labelled(a, 'Who took this photo')) return a;
      return null;
    }
    function put(input, v) {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var heights = null;
    function heightAt(lat, lon) {
      if (!heights) heights = Promise.all([fetch('/admin/dem/copernicus-od.json').then(function (r) { return r.json(); }),
        fetch('/admin/dem/copernicus-od.bin').then(function (r) { return r.arrayBuffer(); })])
        .then(function (x) { return window.CairdeDem.grid(x[0], x[1]); });
      return heights.then(function (g) { var m = g.height(lat, lon); return m == null ? null : window.CairdeDem.nearest5(m); }, function () { return null; });
    }
    var box = 'border:1px solid #dfe3e8;border-radius:6px;padding:12px;margin-top:8px;background:#fff';
    var btn = 'font:600 14px/1 system-ui,sans-serif;padding:9px 14px;border-radius:5px;border:1px solid #24451A;background:#fff;color:#24451A;cursor:pointer;margin:0 8px 8px 0';
    var Control = window.createClass({
      getInitialState: function () {
        this.controlID = 'sitephoto-' + Math.random().toString(36).slice(2);
        return { open: false, photos: null, q: '', commons: false, address: '', checking: false, found: null };
      },
      componentDidMount: function () { var self = this; load().then(function (photos) { self.setState({ photos: photos }); }); },
      componentDidUpdate: function () {
        var inserted = this.props.mediaPaths && this.props.mediaPaths.get && this.props.mediaPaths.get(this.controlID);
        if (inserted) {
          var p = typeof inserted === 'string' ? inserted : (inserted.path || String(inserted));
          if (p !== this.props.value) this.props.onChange(p);
          this.props.onRemoveInsertedMedia(this.controlID);
          this.setState({ info: (window.CairdePhotoInfo && window.CairdePhotoInfo(p)) || null, filled: '' });
        }
      },
      browse: function () {
        var self = this;
        this.setState({ open: !this.state.open });
        load().then(function (photos) { self.setState({ photos: photos }); });
      },
      pick: function (p) { this.props.onChange(p.path); this.setState({ open: false, info: null }); },
      // the stop's position, direction and time, as its fields take them
      fillStop: function (part) {
        var i = this.state.info, done = [], f;
        var lat = labelled(part, 'Latitude'), lon = labelled(part, 'Longitude');
        if (i.lat != null && lat && lon) { put(lat, i.lat.toFixed(5)); put(lon, i.lon.toFixed(5)); done.push('the position'); }
        if (i.facing != null && (f = labelled(part, 'Facing'))) { put(f, String(i.facing)); done.push('the direction'); }
        if (i.taken && (f = labelled(part, 'Recorded'))) { put(f, when(i.taken, true)); done.push('the time'); }
        this.setState({ filled: done.length ? 'Filled in ' + done.join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Check them before saving.' : 'Nothing could be filled in.' });
      },
      // "about 80 m OD - 11 April 2026, 07:54": the height read from the elevation grid at
      // the photo's position, to the nearest 5 m, and the time the camera gave
      fillLine: function (part) {
        var self = this, i = this.state.info, f = labelled(part, 'Small line under the photo');
        (i.lat != null ? heightAt(i.lat, i.lon) : Promise.resolve(null)).then(function (m) {
          var line = [m == null ? '' : 'about ' + m + ' m OD', when(i.taken)].filter(Boolean).join(' - ');
          if (f && line) put(f, line);
          self.setState({ filled: f && line ? 'Filled in the small line: "' + line + '". Check it before saving.' : 'Nothing could be filled in.' });
        });
      },
      // A photo from Wikimedia Commons: its author and licence are read from Commons now,
      // with the same rules the build applies (site/admin/commons.js). Refused: nothing is
      // put in the field, and the reason is shown. Nothing is uploaded either way.
      fromCommons: function () {
        var self = this, C = window.CairdeCommons, url = this.state.address.trim();
        if (!C || !C.isCommons(url)) {
          this.setState({ found: { ok: false, why: 'That is not the address of a file on Wikimedia Commons. Open the photo\'s own page on Commons and copy its address: it starts with https://commons.wikimedia.org/wiki/File:' } });
          return;
        }
        this.setState({ checking: true, found: null });
        fetch(C.apiUrl(url)).then(function (r) { return r.json(); }).then(function (j) {
          var d = C.decide(j);
          self.setState({ checking: false, found: d });
          if (d.ok) self.props.onChange(C.normal(url));
        }, function () {
          self.setState({ checking: false, found: { ok: false, why: 'Wikimedia Commons could not be reached just now. Try again in a minute.' } });
        });
      },
      upload: function () {
        var f = this.props.field, cfg = f && f.getIn && f.getIn(['media_library', 'config']);
        this.props.onOpenMediaLibrary({ controlID: this.controlID, forImage: true, privateUpload: false, value: this.props.value,
          allowMultiple: false, config: cfg && cfg.toJS ? cfg.toJS() : undefined, field: f });
      },
      render: function () {
        var self = this, v = this.props.value || '', s = this.state;
        var part = s.info ? ownPart(this.el) : null;
        var read = s.info ? [s.info.lat != null ? 'taken at ' + s.info.lat.toFixed(5) + ', ' + s.info.lon.toFixed(5) : '',
          s.info.facing != null ? 'facing ' + s.info.facing + ' degrees' : '', s.info.taken ? 'on ' + when(s.info.taken).replace(', ', ' at ') : ''].filter(Boolean) : [];
        var offer = read.length ? h('div', { role: 'status', style: css(box + ';font:14px/1.45 system-ui,sans-serif') },
          h('p', { style: css('margin:0 0 8px') }, 'Read from the photo before the location was removed: ' + read.join(', ') + '. The copy uploaded to the website carries none of this.'),
          labelled(part, 'Latitude') ? h('button', { type: 'button', style: css(btn), onClick: function () { self.fillStop(part); } }, 'Fill in the stop\'s position, direction and time from the photo') : null,
          labelled(part, 'Small line under the photo') && (s.info.taken || s.info.lat != null) ? h('button', { type: 'button', style: css(btn), onClick: function () { self.fillLine(part); } }, 'Fill in the small line under the photo (height and time)') : null,
          s.filled ? h('p', { style: css('margin:0;color:#24451A') }, s.filled) : null) : null;
        var onSite = /^\/assets\/img\//.test(v);
        var fromC = window.CairdeCommons && window.CairdeCommons.isCommons(v);
        var known = onSite && s.photos ? s.photos.filter(function (p) { return p.path === v; })[0] : null;
        var current = v
          ? h('div', { style: css('display:flex;gap:12px;align-items:center;margin-bottom:8px') },
            onSite ? h('img', { src: v, alt: '', style: css('width:120px;height:80px;object-fit:cover;border-radius:4px') }) : null,
            h('div', { style: css('font:14px/1.4 system-ui,sans-serif') }, h('div', null, onSite ? 'A photo already on the website' : fromC ? 'A photo from Wikimedia Commons: ' + window.CairdeCommons.title(v).replace(/^File:/, '') + ' (its credit is shown beneath it on the website)' : 'A photo you uploaded: ' + v.split('/').pop()),
              known && known.alt ? h('div', { style: css('color:#555') }, 'Its description elsewhere on the site: "' + known.alt + '"') : null))
          : h('div', { style: css('font:14px system-ui,sans-serif;color:#555;margin-bottom:8px') }, 'No photo chosen yet.');
        var q = s.q.toLowerCase();
        var grid = s.open ? h('div', { style: css(box) },
          h('label', { style: css('display:block;font:600 13px system-ui,sans-serif;margin-bottom:6px') }, 'Search the photos',
            h('input', { type: 'search', value: s.q, onChange: function (e) { self.setState({ q: e.target.value }); }, style: css('display:block;width:100%;margin-top:4px;padding:6px 8px;font:14px system-ui,sans-serif;border:1px solid #9aa3ad;border-radius:4px;background:#fff') })),
          s.photos == null ? h('p', null, 'Loading the photos...')
            : h('div', { style: css('display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-height:420px;overflow:auto') },
              s.photos.filter(function (p) { return !q || (p.alt + ' ' + p.path).toLowerCase().indexOf(q) >= 0; }).map(function (p) {
                return h('button', { type: 'button', key: p.path, 'aria-pressed': p.path === v ? 'true' : 'false', onClick: function () { self.pick(p); },
                  style: css('text-align:left;padding:4px;border:2px solid ' + (p.path === v ? '#24451A' : '#dfe3e8') + ';border-radius:5px;background:#fff;cursor:pointer;font:12px/1.35 system-ui,sans-serif') },
                h('img', { src: p.thumb, alt: '', loading: 'lazy', style: css('width:100%;height:96px;object-fit:cover;border-radius:3px;display:block') }),
                h('span', { style: css('display:block;margin-top:4px') }, p.alt || p.path.split('/').pop()),
                p.credit ? h('span', { style: css('display:block;color:#555') }, 'Photo: ' + p.credit + ' (credited automatically)') : null);
              }))) : null;
        return h('div', { id: this.props.forID, ref: function (el) { self.el = el; }, className: this.props.classNameWrapper, style: css('padding:12px') },
          current,
          offer,
          h('button', { type: 'button', style: css(btn), onClick: this.browse, 'aria-expanded': s.open ? 'true' : 'false' }, s.open ? 'Close the list of photos' : 'Choose a photo already on the website'),
          h('button', { type: 'button', style: css(btn), onClick: this.upload }, 'Upload a new photo'),
          h('button', { type: 'button', style: css(btn), 'aria-expanded': s.commons ? 'true' : 'false', onClick: function () { self.setState({ commons: !s.commons, found: null }); } }, 'Use a photo from Wikimedia Commons'),
          s.commons ? h('div', { style: css(box) },
            h('label', { style: css('display:block;font:600 13px system-ui,sans-serif;margin-bottom:6px') }, 'The address of the photo\'s page on Wikimedia Commons',
              h('input', { type: 'url', value: s.address, placeholder: 'https://commons.wikimedia.org/wiki/File:...', onChange: function (e) { self.setState({ address: e.target.value, found: null }); },
                style: css('display:block;width:100%;margin-top:4px;padding:6px 8px;font:14px system-ui,sans-serif;border:1px solid #9aa3ad;border-radius:4px;background:#fff') })),
            h('p', { style: css('font:13px/1.45 system-ui,sans-serif;color:#555;margin:6px 0 8px') }, 'The website reads who took the photo and its licence from Commons, and shows them beneath it. A photo without a clear author and a licence the website can credit is refused.'),
            h('button', { type: 'button', style: css(btn), disabled: s.checking, onClick: this.fromCommons }, s.checking ? 'Checking...' : 'Check and use this photo'),
            s.found ? (s.found.ok
              ? h('div', { role: 'status', style: css('font:14px/1.45 system-ui,sans-serif;color:#24451A') },
                s.found.image ? h('img', { src: s.found.image, alt: '', style: css('display:block;max-width:240px;max-height:160px;margin:6px 0;border-radius:4px') }) : null,
                'Used. Credit: ' + s.found.author + ', ' + s.found.licence + '. Now say in "What the photo shows" what is in it.')
              : h('div', { role: 'alert', style: css('font:14px/1.45 system-ui,sans-serif;color:#9b1c1c') }, 'Not used: ' + s.found.why.replace(/^it /, 'the photo ').replace(/^its /, 'the photo\'s '))) : null) : null,
          v && this.props.field && this.props.field.get && this.props.field.get('required') === false
            ? h('button', { type: 'button', style: css(btn), onClick: function () { self.props.onChange(''); } }, 'Remove the photo') : null,
          grid);
      },
    });
    CMS.registerWidget('sitephoto', Control, window.createClass({
      render: function () { return this.props.value ? h('img', { src: this.props.value, alt: '', style: { maxWidth: '100%' } }) : null; },
    }));
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.CMS && window.CMS.registerWidget && window.createClass && window.h) sitePhotoWidget();
  });

  // The "Link to" fields: a list of the website's pages (/admin/site-pages.json, written by
  // the build from every page open to visitors) to choose from, so nobody types an address
  // wrong. Another website's address and an email address are still typed in full.
  function siteLinkWidget() {
    var h = window.h, CMS = window.CMS, list = null;
    var OTHER = '(another website)', MAIL = '(an email address)', NONE = '';
    var field = 'display:block;width:100%;margin-top:6px;padding:8px;font:14px system-ui,sans-serif;border:1px solid #9aa3ad;border-radius:4px;background:#fff';
    var Control = window.createClass({
      getInitialState: function () { return { pages: null, kind: null }; },
      componentDidMount: function () {
        var self = this;
        if (!list) list = fetch('/admin/site-pages.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }, function () { return []; });
        list.then(function (pages) { self.setState({ pages: pages }); });
      },
      render: function () {
        var self = this, v = String(this.props.value || ''), pages = this.state.pages || [];
        var onSite = pages.some(function (p) { return p.url === v; });
        // a link to a part of a page, such as /folklore/#glenabo, is kept as it is
        var base = v.split('#')[0], within = pages.filter(function (p) { return p.url === base; })[0];
        var kind = this.state.kind || (!v ? NONE : onSite ? v : /^mailto:/.test(v) ? MAIL : /^https?:/.test(v) ? OTHER : v);
        var optional = this.props.field && this.props.field.get && this.props.field.get('required') === false;
        var opts = [h('option', { key: 'none', value: NONE }, optional ? 'No link' : 'Choose where it leads')];
        if (v && !onSite && kind === v) opts.push(h('option', { key: 'kept', value: v }, within ? within.title + ', the part at #' + v.split('#')[1] + ' (' + v + ')' : 'As it is now: ' + v));
        pages.forEach(function (p) { opts.push(h('option', { key: p.url, value: p.url }, p.title + ' (' + p.url + ')')); });
        opts.push(h('option', { key: 'o', value: OTHER }, 'Another website...'), h('option', { key: 'm', value: MAIL }, 'An email address...'));
        return h('div', { className: this.props.classNameWrapper, style: { padding: '12px' } },
          h('select', { id: this.props.forID, value: kind, style: { display: 'block', width: '100%', padding: '8px', font: '14px system-ui,sans-serif', border: '1px solid #9aa3ad', borderRadius: '4px', background: '#fff' },
            onChange: function (e) {
              var k = e.target.value;
              self.setState({ kind: k === OTHER || k === MAIL ? k : null });
              if (k === OTHER) self.props.onChange(/^https?:/.test(v) ? v : 'https://');
              else if (k === MAIL) self.props.onChange(/^mailto:/.test(v) ? v : 'mailto:');
              else self.props.onChange(k);
            } }, opts),
          kind === OTHER ? h('input', { type: 'url', value: v, 'aria-label': 'The address of the other website, starting https://', placeholder: 'https://',
            onChange: function (e) { self.props.onChange(e.target.value.trim()); }, style: css(field) }) : null,
          kind === MAIL ? h('input', { type: 'email', value: v.replace(/^mailto:/, ''), 'aria-label': 'The email address', placeholder: 'name@example.ie',
            onChange: function (e) { self.props.onChange('mailto:' + e.target.value.trim()); }, style: css(field) }) : null,
          this.state.pages && v && !onSite && !within && kind === v && /^\//.test(v) ? h('p', { style: { font: '13px/1.45 system-ui,sans-serif', color: '#9b1c1c', margin: '6px 0 0' } },
            'This address is not one of the website\'s pages. Choose the page it should lead to from the list.') : null);
      },
    });
    function css(t) {
      var o = {};
      t.split(';').forEach(function (d) { var i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = d.slice(i + 1).trim(); });
      return o;
    }
    CMS.registerWidget('sitelink', Control, window.createClass({ render: function () { return h('span', null, this.props.value || ''); } }));
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.CMS && window.CMS.registerWidget && window.createClass && window.h) siteLinkWidget();
  });

  // A Help button on every editor screen, opening the editor guide (admin/help/) in a new tab
  var help = document.createElement('a');
  help.href = '/admin/help/'; help.target = '_blank'; help.rel = 'noopener';
  help.textContent = 'Help'; help.setAttribute('aria-label', 'Help: how to use the editor (opens in a new tab)');
  help.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1000;padding:10px 18px;border-radius:999px;' +
    'background:#24451A;color:#fff;font:600 14px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(help); });
})();

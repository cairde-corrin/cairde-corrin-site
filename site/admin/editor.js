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
        if (e.entry.get('collection') === 'pages' && window.CairdeChecks) {
          var found = window.CairdeChecks.problems(e.entry.get('slug'), data.toJS());
          if (found.length) {
            var msg = 'This page has not been saved, because the website could not publish it as it is:\n\n'
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
    var box = 'border:1px solid #dfe3e8;border-radius:6px;padding:12px;margin-top:8px;background:#fff';
    var btn = 'font:600 14px/1 system-ui,sans-serif;padding:9px 14px;border-radius:5px;border:1px solid #24451A;background:#fff;color:#24451A;cursor:pointer;margin:0 8px 8px 0';
    var Control = window.createClass({
      getInitialState: function () {
        this.controlID = 'sitephoto-' + Math.random().toString(36).slice(2);
        return { open: false, photos: null, q: '' };
      },
      componentDidMount: function () { var self = this; load().then(function (photos) { self.setState({ photos: photos }); }); },
      componentDidUpdate: function () {
        var inserted = this.props.mediaPaths && this.props.mediaPaths.get && this.props.mediaPaths.get(this.controlID);
        if (inserted) {
          var p = typeof inserted === 'string' ? inserted : (inserted.path || String(inserted));
          if (p !== this.props.value) this.props.onChange(p);
          this.props.onRemoveInsertedMedia(this.controlID);
        }
      },
      browse: function () {
        var self = this;
        this.setState({ open: !this.state.open });
        load().then(function (photos) { self.setState({ photos: photos }); });
      },
      pick: function (p) { this.props.onChange(p.path); this.setState({ open: false }); },
      upload: function () {
        var f = this.props.field, cfg = f && f.getIn && f.getIn(['media_library', 'config']);
        this.props.onOpenMediaLibrary({ controlID: this.controlID, forImage: true, privateUpload: false, value: this.props.value,
          allowMultiple: false, config: cfg && cfg.toJS ? cfg.toJS() : undefined, field: f });
      },
      render: function () {
        var self = this, v = this.props.value || '', s = this.state;
        var onSite = /^\/assets\/img\//.test(v);
        var known = onSite && s.photos ? s.photos.filter(function (p) { return p.path === v; })[0] : null;
        var current = v
          ? h('div', { style: css('display:flex;gap:12px;align-items:center;margin-bottom:8px') },
            onSite ? h('img', { src: v, alt: '', style: css('width:120px;height:80px;object-fit:cover;border-radius:4px') }) : null,
            h('div', { style: css('font:14px/1.4 system-ui,sans-serif') }, h('div', null, onSite ? 'A photo already on the website' : 'A photo you uploaded: ' + v.split('/').pop()),
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
        return h('div', { id: this.props.forID, className: this.props.classNameWrapper, style: css('padding:12px') },
          current,
          h('button', { type: 'button', style: css(btn), onClick: this.browse, 'aria-expanded': s.open ? 'true' : 'false' }, s.open ? 'Close the list of photos' : 'Choose a photo already on the website'),
          h('button', { type: 'button', style: css(btn), onClick: this.upload }, 'Upload a new photo'),
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

  // A Help button on every editor screen, opening the editor guide (admin/help/) in a new tab
  var help = document.createElement('a');
  help.href = '/admin/help/'; help.target = '_blank'; help.rel = 'noopener';
  help.textContent = 'Help'; help.setAttribute('aria-label', 'Help: how to use the editor (opens in a new tab)');
  help.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1000;padding:10px 18px;border-radius:999px;' +
    'background:#24451A;color:#fff;font:600 14px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(help); });
})();

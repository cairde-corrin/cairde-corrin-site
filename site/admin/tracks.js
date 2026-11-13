// GPS tracks (GPX), stripped in the editor's own browser before Decap uploads them, as
// photos.js does for photos. A phone's GPX file carries the time of every point, and often
// the walker's name, the app and the phone. The repository is public, so none of that may
// reach it: what is uploaded is the positions and heights only, rounded to 0.1 m. The build
// strips the file again and takes out the stretches walked twice (_includes/gpx.js).
(function () {
  var READ_MSG = 'This file could not be read as a GPS track. Export the walk from the phone app as a GPX file and try again.';
  var DROP_MSG = 'Please use the Upload button to add a GPS track, so the times and names in it can be removed first.';
  function isTrack(f) { return /\.gpx$/i.test(f.name) || /gpx/i.test(f.type); }
  function r(v, n) { return String(+(+v).toFixed(n)); }

  // the text of a GPX file holding only its track's positions and heights
  function strip(text, parse) {
    var doc = parse(text);
    if (!doc || doc.getElementsByTagName('parsererror').length) throw new Error('unreadable');
    var pts = doc.getElementsByTagName('trkpt');
    if (!pts.length) pts = doc.getElementsByTagName('rtept');
    if (!pts.length) throw new Error('no points');
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var lat = pts[i].getAttribute('lat'), lon = pts[i].getAttribute('lon');
      if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) continue;
      var e = pts[i].getElementsByTagName('ele')[0];
      var ele = e && e.textContent.trim() !== '' && isFinite(e.textContent) ? '<ele>' + r(e.textContent, 1) + '</ele>' : '';
      out.push('<trkpt lat="' + r(lat, 6) + '" lon="' + r(lon, 6) + '">' + ele + '</trkpt>');
    }
    if (!out.length) throw new Error('no points');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cáirde Corrin" xmlns="http://www.topografix.com/GPX/1/1">\n'
      + '<trk><trkseg>\n' + out.join('\n') + '\n</trkseg></trk>\n</gpx>\n';
  }

  if (typeof window === 'undefined') { module.exports = { strip: strip }; return; }
  var parse = function (t) { return new DOMParser().parseFromString(t, 'application/xml'); };

  var passing = false;
  addEventListener('change', function (e) {
    var input = e.target;
    if (passing || !input || input.type !== 'file' || !input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    if (!files.some(isTrack)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    Promise.all(files.map(function (f) {
      if (!isTrack(f)) return f;
      return f.text().then(function (t) {
        var name = f.name.replace(/\.gpx$/i, '').replace(/[^\w.-]+/g, '-') + '.gpx';
        return new File([strip(t, parse)], name, { type: 'application/gpx+xml', lastModified: Date.now() });
      });
    })).then(function (out) {
      var dt = new DataTransfer();
      out.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      passing = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      passing = false;
    }, function () {
      input.value = '';
      alert(READ_MSG);
    });
  }, true);
  function refuse(e, files) {
    if (!files || !Array.prototype.some.call(files, isTrack)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    alert(DROP_MSG);
  }
  addEventListener('drop', function (e) { refuse(e, e.dataTransfer && e.dataTransfer.files); }, true);
  addEventListener('paste', function (e) { refuse(e, e.clipboardData && e.clipboardData.files); }, true);
})();

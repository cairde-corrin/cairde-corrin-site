/* Cáirde Corrin - vector map. Loads /assets/data/cairde-corrin.geojson at runtime.
   Paths here are root-absolute: this file is served to /trails/, so relative paths
   would resolve to /trails/assets/… and 404. */
(function () {
  var svg = document.getElementById('map'); if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg', Rm = 20037508.34;
  var W = 0, H = 0, cx = 0, cy = 0, k = 1, G = null, me = null;
  var TB = { w: -8.36823, e: -8.26065, n: 52.14340, s: 52.10163 };  // terrain image bounds
  /* Keys must match the feature names in cairde-corrin.geojson exactly, punctuation included. */
  /* map.js and the GeoJSON change together, so they are versioned together: bump DATA_V
     and the ?v= on this script in trails/index.html whenever either changes. Without it
     a browser can pair a new script with a day-old cached data file, or the reverse. */
  var DATA_V = '2026-11-11';
  var STOPNO = { 'Stop 01 - the stream': 1, 'Stop 02 - closed canopy': 2, 'Stop 03 - the mossy stand': 3 };
  var PHOTO = { 1: 'stream', 2: 'plantation', 3: 'mossy' };

  function MX(lo) { return lo * Rm / 180 }
  function MY(la) { return Math.log(Math.tan((90 + la) * Math.PI / 360)) / (Math.PI / 180) * Rm / 180 }
  function SX(lo) { return W / 2 + (MX(lo) - cx) * k }
  function SY(la) { return H / 2 - (MY(la) - cy) * k }
  function make(t, a, p) { var n = document.createElementNS(NS, t); for (var q in a) n.setAttribute(q, a[q]); (p || svg).appendChild(n); return n }
  function $(id) { return document.getElementById(id) }
  function vis(id) { var c = $(id); return !c || c.checked }

  var el = {};
  el.terrain = make('image', { preserveAspectRatio: 'none', href: '/assets/img/terrain.webp' });
  el.terrain.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '/assets/img/terrain.webp');
  var defs = make('defs', {});
  defs.innerHTML = '<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="8" stroke="#487629" stroke-width="2.4" stroke-opacity=".16"/></pattern>' +
    '<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">' +
    '<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  el.action = make('path', { fill: 'none', stroke: '#6E9B4A', 'stroke-width': 2.6, 'stroke-dasharray': '12 8', 'stroke-linejoin': 'round' });
  el.catchFill = make('path', { fill: 'url(#hatch)', stroke: 'none' });
  el.catch = make('path', { fill: 'none', stroke: '#2F5219', 'stroke-width': 2.8, 'stroke-linejoin': 'round' });
  el.chan = make('path', { fill: 'none', stroke: '#009ADE', 'stroke-width': 2.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#glow)' });
  el.trailCase = make('path', { fill: 'none', stroke: '#fff', 'stroke-width': 5.6, 'stroke-opacity': .9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  el.trail = make('path', { fill: 'none', stroke: '#08304F', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  el.marks = make('g', {}); el.me = make('g', {});

  function ring(c) { var d = '', i; for (i = 0; i < c.length; i++) d += (i ? 'L' : 'M') + SX(c[i][0]).toFixed(1) + ' ' + SY(c[i][1]).toFixed(1); return d + 'Z' }
  function multi(ls) { var d = '', i, j; for (i = 0; i < ls.length; i++) { var L = ls[i]; for (j = 0; j < L.length; j++) d += (j ? 'L' : 'M') + SX(L[j][0]).toFixed(1) + ' ' + SY(L[j][1]).toFixed(1) } return d }

  function draw() {
    if (!G) return;
    if (vis('L-terr')) {
      var tx = SX(TB.w), ty = SY(TB.n);
      el.terrain.setAttribute('x', tx); el.terrain.setAttribute('y', ty);
      el.terrain.setAttribute('width', Math.max(1, SX(TB.e) - tx));
      el.terrain.setAttribute('height', Math.max(1, SY(TB.s) - ty));
      el.terrain.setAttribute('opacity', 1);
    } else el.terrain.setAttribute('opacity', 0);
    el.action.setAttribute('d', vis('L-action') ? ring(G.action) : '');
    var dc = vis('L-catch') ? ring(G.catchment) : '';
    el.catch.setAttribute('d', dc); el.catchFill.setAttribute('d', dc);
    el.chan.setAttribute('d', vis('L-chan') ? multi(G.channels) : '');
    var dt = vis('L-trail') && G.trail ? multi([G.trail]) : '';
    el.trailCase.setAttribute('d', dt); el.trail.setAttribute('d', dt);
    el.marks.textContent = '';
    if (vis('L-stops')) G.points.forEach(function (p) {
      var x = SX(p.c[0]), y = SY(p.c[1]);
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
      var no = STOPNO[p.n], g = make('g', { style: 'cursor:pointer' }, el.marks);
      g.addEventListener('click', function (e) { e.stopPropagation(); info(p, no) });
      if (p.k === 'outlet') {
        make('path', { d: 'M' + (x - 9) + ' ' + (y - 7) + 'h18l-9 15z', fill: '#487629', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
      } else {
        make('circle', { cx: x, cy: y, r: 11, fill: '#009ADE', 'fill-opacity': .2 }, g);
        make('circle', { cx: x, cy: y, r: 6.4, fill: '#009ADE', stroke: '#fff', 'stroke-width': 2.4 }, g);
      }
      if (k > 0.05) {
        var t = make('text', { x: x + 15, y: y + 4, 'font-family': 'IBM Plex Mono,monospace', 'font-size': 11, fill: '#152616', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }, g);
        t.textContent = (p.k === 'outlet' ? 'Outlet' : 'Stop ' + (no || '')) + ' · about ' + p.e + ' m';
      }
    });
    el.me.textContent = '';
    if (me) {
      var mx = SX(me[0]), my = SY(me[1]);
      make('circle', { cx: mx, cy: my, r: 18, fill: '#009ADE', 'fill-opacity': .18 }, el.me);
      make('circle', { cx: mx, cy: my, r: 6, fill: '#00719F', stroke: '#fff', 'stroke-width': 2.4 }, el.me);
    }
    scalebar();
  }
  function scalebar() {
    var mpp = Math.cos(52.13 * Math.PI / 180) / k, target = 92 * mpp;
    var nice = [10, 25, 50, 100, 200, 250, 500, 1000, 2000], d = nice[0];
    for (var i = 0; i < nice.length; i++) if (nice[i] <= target) d = nice[i];
    var bar = $('scbar'), txt = $('sctxt');
    if (bar) bar.style.width = (d / mpp).toFixed(0) + 'px';
    if (txt) txt.textContent = d >= 1000 ? (d / 1000) + ' km' : d + ' m';
  }
  function info(p, no) {
    var box = $('mapinfo'), b = $('mapinfobody');
    if (!box || !b) return;
    var img = no && PHOTO[no] ? '<img src="/assets/img/' + PHOTO[no] + '-1100.webp" alt="">' : '';
    b.innerHTML = img + '<div class="b"><h4>' + p.n + '</h4><dl>' +
      '<dt>Position</dt><dd>' + Math.abs(p.c[1]).toFixed(5) + '°N ' + Math.abs(p.c[0]).toFixed(5) + '°W</dd>' +
      '<dt>Elevation</dt><dd>about ' + p.e + ' m OD</dd>' +
      (p.b != null ? '<dt>Facing</dt><dd>' + p.b + '°</dd>' : '') + '</dl>' +
      (no ? '<a href="/stops/stop-' + no + '.html">Open stop ' + no + ' →</a>' : '') + '</div>';
    box.hidden = false;
  }
  function closeInfo() { var box = $('mapinfo'); if (box) box.hidden = true }
  var closeBtn = $('mapclose');
  if (closeBtn) closeBtn.addEventListener('click', closeInfo);
  svg.addEventListener('click', closeInfo);

  function bounds(c) {
    var b = [1e9, 1e9, -1e9, -1e9];
    c.forEach(function (p) { var x = MX(p[0]), y = MY(p[1]); if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y });
    return b;
  }
  /* The ResizeObserver fires on observe(), which is before the fetch resolves, so
     both entry points have to tolerate G being null. */
  function fit() {
    if (!G) return;
    var b = bounds(G.action); cx = (b[0] + b[2]) / 2; cy = (b[1] + b[3]) / 2;
    k = Math.min(W / (b[2] - b[0]), H / (b[3] - b[1])) * 0.88; draw();
  }
  function size() {
    var r = svg.parentNode.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  function zoom(f, px, py) {
    var nk = Math.max(0.02, Math.min(2.0, k * f));
    var wx = cx + (px - W / 2) / k, wy = cy - (py - H / 2) / k;
    cx = wx - (px - W / 2) / nk; cy = wy + (py - H / 2) / nk; k = nk; draw();
  }
  /* Gesture rules. The shell is touch-action: pan-y, so one finger scrolls the page
     past the map instead of being swallowed by it. Two fingers pan and pinch the map
     together. A mouse or pen still drags with one pointer. */
  var pts = {}, last = null, pd = 0, pc = null, hinted = false;
  function ids() { return Object.keys(pts) }
  function pair() { var v = ids().map(function (i) { return pts[i] }); return v }
  function dist() { var v = pair(); return Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]) }
  function mid() { var v = pair(); return [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2] }

  function hint() {
    if (hinted) return; hinted = true;
    var shell = svg.parentNode; if (!shell) return;
    var d = document.createElement('div');
    d.className = 'maphint'; d.textContent = 'Use two fingers to move the map';
    shell.appendChild(d);
    setTimeout(function () { d.classList.add('out') }, 1800);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d) }, 2400);
  }

  /* Two-finger gestures must not also scroll the page. */
  svg.addEventListener('touchmove', function (e) {
    if (e.touches.length >= 2) e.preventDefault();
  }, { passive: false });

  svg.addEventListener('pointerdown', function (e) {
    svg.setPointerCapture(e.pointerId);
    pts[e.pointerId] = [e.clientX, e.clientY];
    var n = ids().length;
    if (n === 1 && e.pointerType === 'touch') hint();
    if (n === 1 && e.pointerType !== 'touch') { svg.classList.add('drag'); last = [e.clientX, e.clientY] }
    if (n === 2) { pd = dist(); pc = mid(); last = null; svg.classList.add('drag') }
  });
  svg.addEventListener('pointermove', function (e) {
    if (!(e.pointerId in pts)) return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    var n = ids().length;
    if (n === 2) {
      var r = svg.getBoundingClientRect();
      var nd = dist(), nc = mid();
      if (pd > 0) zoom(nd / pd, nc[0] - r.left, nc[1] - r.top);
      if (pc) { cx -= (nc[0] - pc[0]) / k; cy += (nc[1] - pc[1]) / k; draw() }
      pd = nd; pc = nc; return;
    }
    /* One pointer pans only for a mouse or pen; one finger belongs to the page. */
    if (n === 1 && e.pointerType !== 'touch' && last) {
      cx -= (e.clientX - last[0]) / k; cy += (e.clientY - last[1]) / k;
      last = [e.clientX, e.clientY]; draw();
    }
  });
  function up(e) {
    delete pts[e.pointerId];
    if (ids().length < 2) { pd = 0; pc = null }
    if (!ids().length) { last = null; svg.classList.remove('drag') }
  }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', function (e) {
    e.preventDefault(); var r = svg.getBoundingClientRect();
    zoom(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  function bind(id, fn) { var b = $(id); if (b) b.onclick = fn }
  bind('mz-in', function () { zoom(1.5, W / 2, H / 2) });
  bind('mz-out', function () { zoom(1 / 1.5, W / 2, H / 2) });
  bind('mz-fit', function () { fit() });
  bind('mz-loc', function () {
    var r = $('mapread'); if (!r) return;
    if (!navigator.geolocation) { r.textContent = 'This browser cannot report a position'; return }
    if (!G) { r.textContent = 'Map data has not loaded'; return }
    r.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(function (p) {
      me = [p.coords.longitude, p.coords.latitude];
      var b = bounds(G.action);
      var ins = MX(me[0]) > b[0] && MX(me[0]) < b[2] && MY(me[1]) > b[1] && MY(me[1]) < b[3];
      r.textContent = ins ? 'You are in the action area' : 'You are outside the mapped area';
      if (ins) { cx = MX(me[0]); cy = MY(me[1]); k = Math.max(k, 0.45) }
      draw();
    }, function (err) {
      /* Under canopy a timeout is the likely failure, not a refused permission. */
      r.textContent =
        err.code === err.PERMISSION_DENIED ? 'Location permission denied' :
        err.code === err.POSITION_UNAVAILABLE ? 'No position available here' :
        err.code === err.TIMEOUT ? 'Timed out waiting for a fix' :
        'Location unavailable';
    }, { enableHighAccuracy: true, timeout: 9000 });
  });
  ['L-terr', 'L-action', 'L-catch', 'L-chan', 'L-trail', 'L-stops'].forEach(function (id) {
    var c = $(id); if (c) c.addEventListener('change', draw);
  });
  var mlt = $('mlt'), mll = $('maplayers');
  if (mlt && mll) mlt.addEventListener('click', function () {
    var open = mll.classList.toggle('open');
    mlt.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  new ResizeObserver(function () { var o = W; size(); if (!o) fit(); else draw() }).observe(svg.parentNode);

  /* A pill in the corner of an empty grey box is not a legible failure. Say it in
     the middle of the map, and point at the stop list, which carries the same content. */
  function failed() {
    var read = $('mapread'); if (read) read.textContent = 'Map data failed to load';
    var shell = svg.parentNode;
    if (!shell || shell.querySelector('.mapfail')) return;
    var d = document.createElement('div');
    d.className = 'mapfail'; d.setAttribute('role', 'status');
    d.innerHTML = '<b>The map did not load.</b>' +
      '<span>Every recorded stop, with its position and elevation, is listed below.</span>';
    shell.appendChild(d);
  }

  fetch('/assets/data/cairde-corrin.geojson?v=' + DATA_V).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + r.url);
    return r.json();
  }).then(function (fc) {
    function f(n) {
      var x = fc.features.filter(function (x) { return x.properties.name === n })[0];
      if (!x) throw new Error('feature missing from GeoJSON: ' + n);
      return x;
    }
    G = {
      catchment: f('Glenabo hydrological catchment').geometry.coordinates[0],
      action: f('Proposed area for action').geometry.coordinates[0],
      channels: f('Modelled channel network').geometry.coordinates,
      /* optional: a data file without the loop must not take the whole map down */
      trail: (fc.features.filter(function (x) { return x.properties.name === 'Walked loop' })[0] || { geometry: {} }).geometry.coordinates || null,
      points: fc.features.filter(function (x) { return x.geometry.type === 'Point' })
        .map(function (x) { return { n: x.properties.name, k: x.properties.kind, e: x.properties.elevation_m, b: x.properties.bearing_deg, c: x.geometry.coordinates } })
    };
    size(); fit();
  }).catch(function (e) {
    failed();
    console.error('Cáirde Corrin map:', e);
  });
})();

// A route an editor uploads as a GPS track (GPX), made ready for the trails page the same
// way tools/trail.py made the walked loop ready:
//
// - stretches walked twice are taken out, so every stretch appears once: any run of 30 m
//   or more that comes back within 15 m of track already walked (an out-and-back to a
//   dead end, or walking on past the start) is dropped;
// - the line is simplified only below half a pixel at the map's maximum zoom (Douglas-
//   Peucker at 0.25 m), so nothing visible is lost;
// - times, names, the app, the phone and anything else in the file are left behind: what
//   is published is positions and heights only, rounded to 0.1 m.
//
// The editor's browser has already stripped the file the same way before uploading it
// (site/admin/tracks.js), so the repository never holds a raw track; this is the second line.
// A track the build cannot use stops the build, with a message saying what to do.

const RETRACE_M = 15;     // closer than this to track already walked counts as walking it again
const RETRACE_RUN_M = 30; // ...for at least this far
const LAG_M = 60;         // track this recently walked is the same pass, not an earlier one
const TOLERANCE_M = 0.25; // half a pixel at the map's maximum zoom (map.js: 2 px per metre)
const ASCENT_STEP = 2;    // metres; rises smaller than this are GPS noise, not climbing
const AREA = { s: 51.9, n: 52.35, w: -8.6, e: -8.0 };  // around Fermoy

class TrackError extends Error {}
const fail = (m) => { throw new TrackError(m); };

function local(p, lat0 = 52.12) {
  const k = Math.cos(lat0 * Math.PI / 180);
  return [(p[1] + 8.3) * 111195 * k, (p[0] - lat0) * 111195];
}
const dist = (a, b) => { const [x1, y1] = local(a), [x2, y2] = local(b); return Math.hypot(x2 - x1, y2 - y1); };
function segDist(p, a, b) {
  const [px, py] = local(p), [ax, ay] = local(a), [bx, by] = local(b);
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// [[lat, lon, ele], ...] from a GPX file's track points (or route points if it has none)
function parse(xml) {
  const text = String(xml || '');
  if (!/<gpx[\s>]/i.test(text)) fail('the file is not a GPS track (GPX). Export the walk from the phone app as a GPX file and upload that');
  const pts = [];
  const tag = /<trkpt\b/i.test(text) ? 'trkpt' : 'rtept';
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'gi');
  for (const m of text.matchAll(re)) {
    const lat = +(/\blat\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1];
    const lon = +(/\blon\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1];
    const ele = +(/<ele>\s*([^<]+?)\s*<\/ele>/i.exec(m[2] || '') || [])[1];
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push([lat, lon, Number.isFinite(ele) ? ele : null]);
  }
  return pts;
}

// Drop the stretches walked a second time. Returns the kept stretches, each a list of points.
function unretrace(P) {
  const along = [0];
  for (let i = 1; i < P.length; i++) along.push(along[i - 1] + dist(P[i - 1], P[i]));
  // a grid of 20 m cells, so each point only looks at the track near it
  const key = (x, y) => `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
  const grid = new Map();
  const again = new Array(P.length).fill(false);
  let added = 0;  // segments P[j]-P[j+1] for j < added are searchable
  for (let i = 0; i < P.length; i++) {
    // the track walked more than LAG_M before this point is an earlier pass
    while (added + 1 < i && along[i] - along[added + 1] > LAG_M) {
      const [x, y] = local(P[added]);
      const k = key(x, y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(added);
      added++;
    }
    const [x, y] = local(P[i]);
    search: for (let dx = -20; dx <= 20; dx += 20) {
      for (let dy = -20; dy <= 20; dy += 20) {
        for (const j of grid.get(key(x + dx, y + dy)) || []) {
          if (segDist(P[i], P[j], P[j + 1]) < RETRACE_M) { again[i] = true; break search; }
        }
      }
    }
  }
  // only a run long enough to be walking the same way again; a path crossing is kept
  const out = [];
  let cur = [], i = 0;
  while (i < P.length) {
    if (!again[i]) { cur.push(P[i]); i++; continue; }
    let j = i;
    while (j < P.length && again[j]) j++;
    if (along[j - 1] - along[i] >= RETRACE_RUN_M) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    } else cur.push(...P.slice(i, j));
    i = j;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

function simplify(P, tol = TOLERANCE_M) {
  if (P.length < 3) return P.slice();
  const keep = new Array(P.length).fill(false);
  keep[0] = keep[P.length - 1] = true;
  const stack = [[0, P.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let best = 0, idx = -1;
    for (let m = i + 1; m < j; m++) { const d = segDist(P[m], P[i], P[j]); if (d > best) { best = d; idx = m; } }
    if (idx >= 0 && best > tol) { keep[idx] = true; stack.push([i, idx], [idx, j]); }
  }
  return P.filter((_, k) => keep[k]);
}

function ascent(eles, step = ASCENT_STEP) {
  let total = 0, ref = eles[0];
  for (const e of eles.slice(1)) {
    if (e - ref >= step) { total += e - ref; ref = e; } else if (e < ref) ref = e;
  }
  return total;
}

const r5 = (v) => 5 * Math.round(v / 5);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The elevation profile, drawn as the walked loop's is (tools/trail.py, profile_svg)
function profileSvg(P, along, marks, emin, emax, climb5, id, name) {
  const W = 720, H = 240, x0 = 86, x1 = 704, y0 = 34, y1 = 196;
  const L = along[along.length - 1];
  const lo = 20 * Math.floor(emin / 20), hi = Math.max(20 * Math.ceil(emax / 20), lo + 20);
  const X = (d) => x0 + (x1 - x0) * d / L;
  const Y = (e) => y1 - (y1 - y0) * (e - lo) / (hi - lo);
  const line = P.map((p, i) => `${X(along[i]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join(' ');
  const area = `${X(0).toFixed(1)},${y1} ${line} ${X(L).toFixed(1)},${y1}`;
  const g = [];
  for (let e = lo; e <= hi; e += 20) {
    g.push(`<line class="grid" x1="${x0}" x2="${x1}" y1="${Y(e).toFixed(1)}" y2="${Y(e).toFixed(1)}"/><text class="ax" x="${x0 - 8}" y="${(Y(e) + 4).toFixed(1)}" text-anchor="end">${e} m</text>`);
  }
  const stepKm = L > 6000 ? 1 : 0.5;
  for (let km = 0; km <= L / 1000 + 1e-9; km += stepKm) {
    g.push(`<text class="ax" x="${X(km * 1000).toFixed(1)}" y="${y1 + 26}" text-anchor="${km === 0 ? 'start' : 'middle'}">${+km.toFixed(1)} km</text>`);
  }
  const xs = marks.map((m) => X(m.d));
  marks.forEach((m, k) => {
    const nearR = k + 1 < xs.length && xs[k + 1] - xs[k] < 140;
    const nearL = k > 0 && xs[k] - xs[k - 1] < 140;
    const [anchor, dx] = nearR ? ['end', -5] : (nearL || xs[k] - x0 < 40) ? ['start', 5] : ['middle', 0];
    g.push(`<g class="stop"><line x1="${xs[k].toFixed(1)}" x2="${xs[k].toFixed(1)}" y1="${y0 - 4}" y2="${y1}"/><text x="${(xs[k] + dx).toFixed(1)}" y="${y0 - 10}" text-anchor="${anchor}">Stop ${m.n}</text></g>`);
  });
  const which = marks.map((m) => m.n).join(', ').replace(/, (\d+)$/, ' and $1');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">Elevation along ${esc(name)}</title>`
    + `<desc id="${id}-d">The walked track's own elevation runs from about ${r5(emin)} to about ${r5(emax)} metres, with about ${climb5} metres of climbing.`
    + `${marks.length ? ` ${marks.length === 1 ? `Stop ${which} is` : `Stops ${which} are`} marked.` : ''}</desc>`
    + `${g.join('')}<polygon class="area" points="${area}"/><polyline class="line" points="${line}"/></svg>`;
}

// Everything the trails page needs for one uploaded track. stops: [{ n, lat, lon }] to mark
// where the route passes within 40 m of them.
function prepare(xml, name, stops = []) {
  const raw = parse(xml);
  if (raw.length < 10) fail(raw.length ? `the file holds only ${raw.length} points, too few to draw a route. Check it is the whole walk` : 'the file has no points in it. Export the walk again as a GPX file');
  if (raw.some(([lat, lon]) => lat < AREA.s || lat > AREA.n || lon < AREA.w || lon > AREA.e)) {
    fail('part of the track is not near Fermoy. Check it is the right file');
  }
  const withEle = raw.filter((p) => p[2] != null).length;
  if (withEle < raw.length * 0.8) fail('the track has no heights in it, so its elevation profile cannot be drawn. Export it again with elevation (altitude) switched on');
  // fill the odd missing height from its neighbours
  const P = raw.map((p, i) => {
    if (p[2] != null) return p;
    const prev = raw.slice(0, i).reverse().find((q) => q[2] != null), next = raw.slice(i + 1).find((q) => q[2] != null);
    return [p[0], p[1], (prev || next)[2]];
  });
  const segments = unretrace(P).map((s) => simplify(s)).filter((s) => s.length > 1);
  const pts = [], along = [];
  segments.forEach((s) => s.forEach((p, i) => {
    along.push(pts.length ? along[along.length - 1] + (i === 0 ? 0 : dist(s[i - 1], p)) : 0);
    pts.push(p);
  }));
  const length = pts.length ? along[along.length - 1] : 0;
  if (length < 100) fail('after taking out the stretches walked twice, less than 100 metres of track is left. Check it is the whole walk');
  const eles = pts.map((p) => p[2]);
  const emin = Math.min(...eles), emax = Math.max(...eles);
  const climb5 = r5(segments.reduce((t, s) => t + ascent(s.map((p) => p[2])), 0));
  const marks = stops.map((s) => {
    let best = Infinity, d = 0;
    pts.forEach((p, i) => { const x = dist(p, [s.lat, s.lon]); if (x < best) { best = x; d = along[i]; } });
    return best <= 40 ? { n: s.n, d } : null;
  }).filter(Boolean).sort((a, b) => a.d - b.d);
  const round = (v, n) => +v.toFixed(n);
  const clean = segments.map((s) => s.map(([lat, lon, ele]) => [round(lat, 6), round(lon, 6), round(ele, 1)]));
  return { segments: clean, length, emin, emax, climb5, marks,
    svg: (id) => profileSvg(pts, along, marks, emin, emax, climb5, id, name) };
}

// The published file: the route's name, a note on what it is, then positions and heights only
function toGpx(segments, name, note) {
  const segs = segments.map((s) => `   <trkseg>\n${s.map(([lat, lon, ele]) => `    <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`).join('\n')}\n   </trkseg>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cáirde Corrin" xmlns="http://www.topografix.com/GPX/1/1">\n`
    + ` <metadata><name>${esc(name)}</name><desc>${esc(note)}</desc></metadata>\n <trk><name>${esc(name)}</name>\n${segs}\n </trk>\n</gpx>\n`;
}

module.exports = { parse, unretrace, simplify, ascent, prepare, toGpx, TrackError };

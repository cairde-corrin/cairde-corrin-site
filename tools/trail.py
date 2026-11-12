#!/usr/bin/env python3
"""Publish the walked Glenabo loop from the raw GPS track.

    python3 tools/trail.py

Reads   archive/source-data/2026-08-29_glenabo_loop.gpx (raw, timestamped; kept out of the repository)
Writes  site/assets/data/cairde-corrin.geojson   the "Walked loop" feature
        site/assets/data/glenabo-loop.gpx        the download: loop plus the four points
        site/trails/index.njk                    the walked-loop section and its profile,
                                                 between the walked-loop markers

Cleaning. The walk doubled back on itself three times. It turned at the north end
of the west-side path (point 100), went back south and turned again (123), then
walked north past the first turn (146). It also overshot Stop 1 at the end (190)
and came back. The published loop keeps points 0-100 and 146-189 and closes back
to the start, so every stretch appears once. Simplification is Douglas-Peucker at
half a pixel at the map's maximum zoom, so nothing visible is lost. Timestamps are
dropped; elevations are kept.
"""
import html, json, math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'archive', 'source-data', '2026-08-29_glenabo_loop.gpx')
GEOJSON = os.path.join(ROOT, 'site', 'assets', 'data', 'cairde-corrin.geojson')
GPX_OUT = os.path.join(ROOT, 'site', 'assets', 'data', 'glenabo-loop.gpx')
# Carried inside the GPX, because a file opened in a navigation app arrives without the web page
WARN = ('A record of one walk through unwaymarked woodland on land the group does not own: not a '
        'surveyed or waymarked route, and not for navigation. Access is not guaranteed, and tracks may be '
        'closed, felled or unsafe. Read https://www.cairdecorrin.ie/terms/ before you go.')
TRAILS = os.path.join(ROOT, 'site', 'trails', 'index.njk')
WALKED = '2026-08-29'
KEEP = [(0, 100), (146, 189)]  # inclusive index ranges kept from the raw track
MAX_ZOOM_PX_PER_MERC_M = 2.0   # map.js zoom() ceiling
ASCENT_STEP = 2.0              # metres; rises smaller than this are GPS noise, not climbing
STOPS = ['Stop 01 - the stream', 'Stop 02 - closed canopy', 'Stop 03 - the mossy stand']
MARK = ('<!-- walked-loop -->', '<!-- /walked-loop -->')


def local(p, lat0=52.12):
    k = math.cos(math.radians(lat0))
    return ((p[1] + 8.3) * 111195 * k, (p[0] - lat0) * 111195)


def dist(a, b):
    (x1, y1), (x2, y2) = local(a), local(b)
    return math.hypot(x2 - x1, y2 - y1)


def turn(P, i):
    b = lambda a, c: math.degrees(math.atan2(local(c)[0] - local(a)[0], local(c)[1] - local(a)[1]))
    return abs((b(P[i], P[i + 1]) - b(P[i - 1], P[i]) + 180) % 360 - 180)


def seg_dist(p, a, b):
    (px, py), (ax, ay), (bx, by) = local(p), local(a), local(b)
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax - t * dx, py - ay - t * dy), t


def douglas_peucker(P, tol):
    keep = [False] * len(P)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0, None
        for m in range(i + 1, j):
            d = seg_dist(P[m], P[i], P[j])[0]
            if d > best:
                best, idx = d, m
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(P, keep) if k]


def ascent(eles, step=ASCENT_STEP):
    """Total climb, counting a rise only once it is at least `step` above the running low."""
    total, ref = 0.0, eles[0]
    for e in eles[1:]:
        if e - ref >= step:
            total += e - ref
            ref = e
        elif e < ref:
            ref = e
    return total


def profile_svg(P, along, stop_marks, emin, emax, climb5):
    W, H, x0, x1, y0, y1 = 720, 240, 86, 704, 34, 196  # left margin fits "120 m" at the mobile label size
    L = along[-1]
    lo, hi = 20 * math.floor(emin / 20), 20 * math.ceil(emax / 20)
    X = lambda d: x0 + (x1 - x0) * d / L
    Y = lambda e: y1 - (y1 - y0) * (e - lo) / (hi - lo)
    line = ' '.join('%.1f,%.1f' % (X(d), Y(p[2])) for d, p in zip(along, P))
    area = '%.1f,%d %s %.1f,%d' % (X(0), y1, line, X(L), y1)
    g = []
    for e in range(lo, hi + 1, 20):
        g.append('<line class="grid" x1="%d" x2="%d" y1="%.1f" y2="%.1f"/>'
                 '<text class="ax" x="%d" y="%.1f" text-anchor="end">%d m</text>'
                 % (x0, x1, Y(e), Y(e), x0 - 8, Y(e) + 4, e))
    km = 0.0
    while km <= L / 1000 + 1e-9:
        # 0 km starts at the axis, so it cannot run into the lowest height label above it
        g.append('<text class="ax" x="%.1f" y="%d" text-anchor="%s">%s</text>'
                 % (X(km * 1000), y1 + 26, 'start' if km == 0 else 'middle', '%g km' % km))
        km += 0.5
    xs = [X(d) for _, d in stop_marks]
    for k, (no, d) in enumerate(stop_marks):
        # label on the side away from a close neighbour, so adjacent stops never collide
        near_r = k + 1 < len(xs) and xs[k + 1] - xs[k] < 140
        near_l = k > 0 and xs[k] - xs[k - 1] < 140
        anchor, dx = (('end', -5) if near_r else ('start', 5) if near_l or xs[k] - x0 < 40
                      else ('middle', 0))
        g.append('<g class="stop"><line x1="%.1f" x2="%.1f" y1="%d" y2="%d"/>'
                 '<text x="%.1f" y="%d" text-anchor="%s">Stop %d</text></g>'
                 % (xs[k], xs[k], y0 - 4, y1, xs[k] + dx, y0 - 10, anchor, no))
    return ('<svg viewBox="0 0 %d %d" role="img" aria-labelledby="lp-t lp-d">'
            '<title id="lp-t">Elevation along the walked Glenabo loop</title>'
            '<desc id="lp-d">From Stop 1 along the loop and back: the walked track\'s own '
            'elevation runs from about %d to about %d metres, with about %d metres of climbing. '
            'Stops 1, 2 and 3 are marked.</desc>'
            '%s<polygon class="area" points="%s"/><polyline class="line" points="%s"/></svg>'
            % (W, H, 5 * round(emin / 5), 5 * round(emax / 5), climb5, ''.join(g), area, line))


def main():
    raw = open(RAW, encoding='utf-8').read()
    P = [(float(a), float(b), float(c)) for a, b, c in re.findall(
        r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)</ele>', raw)]
    assert len(P) == raw.count('<trkpt') == 193, 'raw track changed: re-check the cuts'
    # the cuts must still be what they were chosen as
    assert turn(P, 100) > 150 and turn(P, 123) > 150 and turn(P, 190) > 140, 'reversals moved'
    assert dist(P[100], P[146]) < 3 and dist(P[189], P[0]) < 15, 'joins too long'

    C = [p for a, b in KEEP for p in P[a:b + 1]] + [P[0]]  # closed loop back to Stop 1
    tol = 0.5 * math.cos(math.radians(52.12)) / MAX_ZOOM_PX_PER_MERC_M  # half a pixel, metres
    S = douglas_peucker(C, tol)
    assert S[0] == S[-1]
    seglen = lambda Q: sum(dist(Q[i], Q[i + 1]) for i in range(len(Q) - 1))
    raw_len, clean_len, simp_len = seglen(P), seglen(C), seglen(S)
    along = [0.0]
    for i in range(len(S) - 1):
        along.append(along[-1] + dist(S[i], S[i + 1]))
    eles = [p[2] for p in S]
    emin, emax, up = min(eles), max(eles), ascent(eles)
    climb5 = 5 * round(up / 5)

    fc = json.load(open(GEOJSON, encoding='utf-8'))
    pts = {f['properties']['name']: f for f in fc['features'] if f['geometry']['type'] == 'Point'}
    marks = []
    print('raw %.0f m, %d points | cleaned %.0f m, %d points | published %.0f m, %d points (tolerance %.2f m)'
          % (raw_len, len(P), clean_len, len(C), simp_len, len(S), tol))
    for no, name in enumerate(STOPS, 1):
        lon, lat = pts[name]['geometry']['coordinates'][:2]
        d, t, i = min(seg_dist((lat, lon), S[i], S[i + 1]) + (i,) for i in range(len(S) - 1))
        marks.append((no, along[i] + t * (along[i + 1] - along[i])))
        print('  %s: %.1f m from the published loop, %.0f m along it' % (name, d, marks[-1][1]))
    print('  elevation %.1f-%.1f m, ascent %.1f m (rises under %.0f m ignored)'
          % (emin, emax, up, ASCENT_STEP))

    feature = {'type': 'Feature', 'properties': {
        'name': 'Walked loop', 'kind': 'trail', 'walked': WALKED,
        'length_km': round(simp_len / 1000, 2), 'elevation_min_m': round(emin, 1),
        'elevation_max_m': round(emax, 1), 'ascent_m': round(up),
        'source': ("the group's own GPS track of the trail, walked %s; stretches walked twice "
                   "removed; elevations are the track's own; tools/trail.py" % WALKED)},
        'geometry': {'type': 'LineString', 'coordinates': [[p[1], p[0], p[2]] for p in S]}}
    fc['features'] = [f for f in fc['features'] if f['properties'].get('name') != 'Walked loop']
    first_point = next(i for i, f in enumerate(fc['features']) if f['geometry']['type'] == 'Point')
    fc['features'].insert(first_point, feature)
    with open(GEOJSON, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(fc, ensure_ascii=False))

    wpts = ''.join(
        '  <wpt lat="%s" lon="%s"><ele>%s</ele><name>%s</name><type>%s</type></wpt>\n'
        % (f['geometry']['coordinates'][1], f['geometry']['coordinates'][0],
           f['properties']['elevation_m'], html.escape(n), f['properties']['kind'])
        for n, f in pts.items())
    trk = ''.join('      <trkpt lat="%s" lon="%s"><ele>%.1f</ele></trkpt>\n' % (p[0], p[1], p[2]) for p in S)
    gpx = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<gpx version="1.1" creator="Cáirde Corrin" xmlns="http://www.topografix.com/GPX/1/1">\n'
           '  <metadata>\n    <name>Glenabo loop</name>\n'
           '    <desc>The Glenabo loop as walked by Cáirde Corrin with a phone GPS on 29 August 2026, '
           'with the stretches where the walk doubled back removed. About %.1f km. Positions are good '
           'to roughly 10-20 m. Track elevations are the walk\'s own GPS elevations; waypoint '
           'elevations are the site\'s published figures, to the nearest 5 m. ' + WARN + '</desc>\n'
           '    <link href="https://www.cairdecorrin.ie/trails/"><text>Cáirde Corrin - Trails</text></link>\n'
           '  </metadata>\n%s  <trk>\n    <name>Glenabo loop</name>\n    <desc>' + WARN + '</desc>\n    <trkseg>\n%s    </trkseg>\n'
           '  </trk>\n</gpx>\n' % (simp_len / 1000, wpts, trk))
    assert '<time' not in gpx and 'time' not in json.dumps(feature)
    open(GPX_OUT, 'w', encoding='utf-8').write(gpx)
    size_kb = math.ceil(len(gpx.encode()) / 1024)

    section = (
        '\n    <section class="walked" aria-labelledby="walked-h">\n'
        '      <h2 class="as-h3" id="walked-h">The walked loop</h2>\n'
        '      <p>The group walked this loop with a GPS on 29 August 2026, from Stop 1 down the east '
        'side of the valley and back up the west side, passing all three recorded stops. It is about '
        '%.1f km round. Where the walk doubled back on itself, the repeat has been taken out.</p>\n'
        '      <figure class="profile">\n        %s\n'
        '        <figcaption>Elevation along the loop from Stop 1, from the walked track\'s own GPS: '
        'about %d to %d m, with about %d m of climbing. Like every elevation on this site, given to '
        'the nearest five metres.</figcaption>\n      </figure>\n'
        '      <p><a href="../assets/data/glenabo-loop.gpx" download>Download the walked loop as GPX</a> '
        '(%d KB). It also carries the three stops and the outlet. It is a record of one walk through '
        'unwaymarked woodland, not a surveyed route and not for navigation: read the '
        '<a href="../terms/">terms</a> before you go.</p>\n    </section>\n    '
        % (simp_len / 1000, profile_svg(S, along, marks, emin, emax, climb5), 5 * round(emin / 5),
           5 * round(emax / 5), climb5, size_kb))
    page = open(TRAILS, encoding='utf-8').read()
    a, b = page.index(MARK[0]) + len(MARK[0]), page.index(MARK[1])
    page = page[:a] + section + page[b:]
    assert '\u2014' not in page and '\u2013' not in page  # no em or en dashes
    open(TRAILS, 'w', encoding='utf-8').write(page)
    print('wrote the Walked loop feature, %s (%d KB) and the trails page section' % (
        os.path.relpath(GPX_OUT, ROOT), size_kb))


if __name__ == '__main__':
    main()

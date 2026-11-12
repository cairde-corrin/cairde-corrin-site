#!/usr/bin/env python3
"""Delineate the Glenabo catchment by flow routing and compare it with the traced polygons.

    python3 tools/catchment.py [--write] [outdir]

Reads FABDEM V1-2 and Copernicus GLO-30 through tools/fetch_dem.py and the published
geometry in site/assets/data/cairde-corrin.geojson. Without --write it changes nothing.
With --write it regenerates the shipped data file: the catchment becomes the Copernicus
routed boundary (FABDEM is a cross-check only and nothing derived from it is written),
and the catchment, outlet and stop figures in that file are recomputed. With an outdir it
also writes the routed boundaries as GeoJSON and a comparison PNG there.

Method, on each model's own grid:
  1. Priority-Flood + epsilon (Barnes et al. 2014): every sink is filled and every flat
     gets a tiny gradient, so every cell drains to the domain edge.
  2. D8: each cell drains to the neighbour with the steepest descent, using true
     metre distances on the ellipsoid.
  3. Accumulation with ellipsoidal cell areas.
  4. The Blackwater is the D8 path from its lowest inflow cell on the west edge. The
     Glenabo is the path down from Stop 1. The confluence is where they meet; the pour
     point is the last Glenabo cell before it, and moves upstream along the main channel
     (the parent with the largest accumulation) in fixed steps.
"""
import heapq, json, math, os, sys

import numpy as np

from fetch_dem import GEOJSON, Mosaic, fetch

A, F = 6378137.0, 1 / 298.257223563
E2 = F * (2 - F)
E = math.sqrt(E2)
OUTLET = (52.1333, -8.3002)
STOP1 = (52.12752, -8.29878)
STEPS = (50, 100, 250, 500, 1000)
EPS = 1e-4  # metres added per cell across a filled flat
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


# ---------- geometry on the ellipsoid ----------

def _q(phi):
    s = math.sin(phi)
    return (1 - E2) * (s / (1 - E2 * s * s) - math.log((1 - E * s) / (1 + E * s)) / (2 * E))


QP = _q(math.pi / 2)
RQ = A * math.sqrt(QP / 2)


def ring_area(ring):
    """Area in m2 of a lon/lat ring on WGS84, via authalic latitude (equal-area sphere)."""
    s = 0.0
    for (lo1, la1), (lo2, la2) in zip(ring, ring[1:] + ring[:1]):
        b1, b2 = (_q(math.radians(la)) / QP for la in (la1, la2))  # sin(authalic lat)
        s += math.radians(lo2 - lo1) * (b1 + b2) / 2
    return abs(s) * RQ * RQ


def cell_dims(lat, dlat, dlon):
    """Metres north-south and east-west of a dlat x dlon (degrees) cell at lat."""
    p = math.radians(lat)
    w = 1 - E2 * math.sin(p) ** 2
    M, N = A * (1 - E2) / w ** 1.5, A / math.sqrt(w)
    return M * math.radians(dlat), N * math.cos(p) * math.radians(dlon)


def metres(lat1, lon1, lat2, lon2):
    dy, dx = cell_dims((lat1 + lat2) / 2, abs(lat2 - lat1), abs(lon2 - lon1))
    return math.hypot(dx, dy)


def in_ring(ring, X, Y):
    ins = np.zeros(X.shape, bool)
    j = len(ring) - 1
    for i in range(len(ring)):
        (xi, yi), (xj, yj) = ring[i][:2], ring[j][:2]
        if yi != yj:
            ins ^= ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)
        j = i
    return ins


# ---------- the grid and flow routing ----------

class Grid:
    def __init__(self, raster, south, north, west, east):
        lons, lats = raster.centres()
        ci = np.where((lons >= west) & (lons <= east))[0]
        ri = np.where((lats >= south) & (lats <= north))[0]
        self.lon, self.lat = lons[ci], lats[ri]
        self.z = raster.a[np.ix_(ri, ci)].astype(np.float64)
        assert (self.z > -1000).all(), 'no-data inside the routing domain'
        self.R, self.C = self.z.shape
        d = [cell_dims(la, raster.dy, raster.dx) for la in self.lat]
        self.dy = np.array([v[0] for v in d])
        self.dx = np.array([v[1] for v in d])
        self.cellarea = np.repeat((self.dx * self.dy)[:, None], self.C, axis=1).ravel()
        self.X, self.Y = np.meshgrid(self.lon, self.lat)

    def cell(self, lat, lon):
        return int(np.abs(self.lat - lat).argmin()) * self.C + int(np.abs(self.lon - lon).argmin())

    def rc(self, i):
        return divmod(int(i), self.C)

    def step(self, a, b):
        (r1, c1), (r2, c2) = self.rc(a), self.rc(b)
        return math.hypot((c2 - c1) * self.dx[r1], (r2 - r1) * self.dy[r1])

    def route(self):
        R, C, z = self.R, self.C, self.z
        zf = z.copy()
        seen = np.zeros((R, C), bool)
        heap = []
        # The west edge is not an outlet: the Blackwater enters there and flows east, and
        # a noisy low water-surface cell on that edge would otherwise drain the whole
        # floodplain west. West-edge cells are filled from inside like any other cell.
        outlet = np.zeros((R, C), bool)
        outlet[0, :] = outlet[-1, :] = outlet[:, -1] = True
        outlet[:, 0] = False
        for r, c in zip(*np.nonzero(outlet)):
            heapq.heappush(heap, (zf[r, c], r, c))
            seen[r, c] = True
        while heap:
            h, r, c = heapq.heappop(heap)
            for dr, dc in NB:
                rr, cc = r + dr, c + dc
                if 0 <= rr < R and 0 <= cc < C and not seen[rr, cc]:
                    seen[rr, cc] = True
                    zf[rr, cc] = max(zf[rr, cc], h + EPS)
                    heapq.heappush(heap, (zf[rr, cc], rr, cc))
        # D8 steepest descent on the filled surface; edge cells drain out of the domain
        best = np.zeros((R, C))
        down = -np.ones((R, C), np.int64)
        idx = np.arange(R * C).reshape(R, C)
        for dr, dc in NB:
            src = (slice(max(0, -dr), R - max(0, dr)), slice(max(0, -dc), C - max(0, dc)))
            dst = (slice(max(0, dr), R - max(0, -dr)), slice(max(0, dc), C - max(0, -dc)))
            dist = np.hypot(dc * self.dx, dr * self.dy)[src[0]][:, None]
            s = (zf[src] - zf[dst]) / dist
            better = s > best[src]
            best[src] = np.where(better, s, best[src])
            down[src] = np.where(better, idx[dst], down[src])
        down[outlet] = -1
        assert (down[~outlet] >= 0).all(), 'a non-outlet cell has no downslope neighbour'
        self.zf, self.down = zf.ravel(), down.ravel()
        self.order = np.argsort(self.zf, kind='stable')  # low to high
        acc = self.cellarea.copy()
        for i in self.order[::-1]:
            d = self.down[i]
            if d >= 0:
                acc[d] += acc[i]
        self.acc = acc

    def path(self, i):
        out = [int(i)]
        while self.down[out[-1]] >= 0:
            out.append(int(self.down[out[-1]]))
        return out

    def watershed(self, p):
        ws = np.zeros(self.R * self.C, bool)
        ws[p] = True
        for i in self.order:  # downstream cells are lower, so they are decided first
            d = self.down[i]
            if d >= 0 and ws[d]:
                ws[i] = True
        return ws

    def parent_max(self, i):
        r, c = self.rc(i)
        best, bi = -1, -1
        for dr, dc in NB:
            rr, cc = r + dr, c + dc
            if 0 <= rr < self.R and 0 <= cc < self.C:
                j = rr * self.C + cc
                if self.down[j] == i and self.acc[j] > best:
                    best, bi = self.acc[j], j
        return bi

    def area_km2(self, mask):
        return float(self.cellarea[mask].sum() / 1e6)

    def components(self, mask):
        m = mask.reshape(self.R, self.C).copy()
        out = []
        for start in zip(*np.nonzero(m)):
            if not m[start]:
                continue
            stack, cells = [start], []
            m[start] = False
            while stack:
                r, c = stack.pop()
                cells.append(r * self.C + c)
                for dr, dc in NB:
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < self.R and 0 <= cc < self.C and m[rr, cc]:
                        m[rr, cc] = False
                        stack.append((rr, cc))
            out.append(np.array(cells))
        return sorted(out, key=lambda cs: -self.cellarea[cs].sum())

    def envelope(self, mask, dist):
        """Mask plus every cell centre within dist metres of it (planar at this scale)."""
        m = mask.reshape(self.R, self.C)
        inner = m.copy()
        inner[1:-1, 1:-1] &= m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
        b = np.nonzero((m & ~inner).ravel())[0]
        X, Y = self.X.ravel(), self.Y.ravel()
        k = math.cos(math.radians(Y[b].mean()))
        mpd = math.radians(1) * 6371000  # metres per degree of latitude
        out = mask.copy()
        cand = np.nonzero((X > X[b].min() - .006) & (X < X[b].max() + .006) &
                          (Y > Y[b].min() - .004) & (Y < Y[b].max() + .004) & ~mask)[0]
        for s in range(0, len(cand), 2000):
            c = cand[s:s + 2000]
            d2 = (((X[c, None] - X[b][None]) * k) ** 2 + (Y[c, None] - Y[b][None]) ** 2).min(1)
            out[c] = np.sqrt(d2) * mpd <= dist
        return out


# ---------- reporting helpers ----------

def compass(lat0, lon0, lat, lon):
    b = math.degrees(math.atan2((lon - lon0) * math.cos(math.radians(lat0)), lat - lat0)) % 360
    return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west',
            'north-west'][int((b + 22.5) // 45) % 8]


def compare(g, a, b, na, nb, centre):
    print('  %-26s %6.3f km2' % (na, g.area_km2(a)))
    print('  %-26s %6.3f km2' % (nb, g.area_km2(b)))
    print('  intersection               %6.3f km2' % g.area_km2(a & b))
    for m, label in ((a & ~b, 'only in ' + na), (b & ~a, 'only in ' + nb)):
        comps = g.components(m)
        print('  %-26s %6.3f km2 in %d pieces; largest:' % (label, g.area_km2(m), len(comps)))
        for cs in comps[:3]:
            la, lo = g.Y.ravel()[cs].mean(), g.X.ravel()[cs].mean()
            print('      %5.3f km2 centred %.4f, %.4f (%s side), ground %3.0f-%3.0f m'
                  % (g.cellarea[cs].sum() / 1e6, la, lo, compass(*centre, la, lo),
                     g.z.ravel()[cs].min(), g.z.ravel()[cs].max()))


def boundary_ring(g, mask):
    """Outer outline of a raster mask as a lon/lat ring, by walking cell edges.
    shortcut: assumes one region without pinch points, fine for a watershed; for
    anything else use a proper polygoniser."""
    m = mask.reshape(g.R, g.C)
    hl, hv = g.lat[1] - g.lat[0], g.lon[1] - g.lon[0]
    edges = {}
    for r, c in zip(*np.nonzero(m)):
        corners = [(r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c)]
        for k, (dr, dc) in enumerate(((-1, 0), (0, 1), (1, 0), (0, -1))):
            rr, cc = r + dr, c + dc
            if not (0 <= rr < g.R and 0 <= cc < g.C and m[rr, cc]):
                edges[corners[k]] = corners[(k + 1) % 4]
    start = min(edges)
    ring, p = [], start
    while True:
        ring.append(p)
        p = edges.pop(p)
        if p == start:
            break
    return [[round(float(g.lon[0] + (c - 0.5) * hv), 6), round(float(g.lat[0] + (r - 0.5) * hl), 6)]
            for r, c in ring]


def tidy(g, mask):
    """Make a D8 watershed traceable as one simple polygon: close diagonal-only contacts
    (which would make the outline touch itself) and fill enclosed holes.
    Returns the new mask, cells added for pinches, cells added for holes."""
    m = mask.reshape(g.R, g.C).copy()
    pinch = 0
    while True:
        a, b, c, d = m[:-1, :-1], m[:-1, 1:], m[1:, :-1], m[1:, 1:]
        p1 = a & d & ~b & ~c  # diagonal one way: fill the cell to the right
        p2 = b & c & ~a & ~d  # diagonal the other way: fill the cell to the left
        if not (p1.any() or p2.any()):
            break
        for (r, cc) in zip(*np.nonzero(p1)):
            m[r, cc + 1] = True
            pinch += 1
        for (r, cc) in zip(*np.nonzero(p2)):
            if not (m[r, cc] or m[r + 1, cc + 1]):
                m[r, cc] = True
                pinch += 1
    outside = np.zeros_like(m)
    stack = [(r, c) for r in range(g.R) for c in (0, g.C - 1) if not m[r, c]] + \
            [(r, c) for c in range(g.C) for r in (0, g.R - 1) if not m[r, c]]
    for s in stack:
        outside[s] = True
    while stack:
        r, c = stack.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r + dr, c + dc
            if 0 <= rr < g.R and 0 <= cc < g.C and not m[rr, cc] and not outside[rr, cc]:
                outside[rr, cc] = True
                stack.append((rr, cc))
    holes = ~m & ~outside
    m |= holes
    return m.ravel(), pinch, int(holes.sum())


def shipped_ring(g, mask):
    """Closed, anticlockwise lon/lat ring of a tidied mask, collinear vertices removed."""
    ring = boundary_ring(g, mask)
    n = len(ring)
    out = [ring[i] for i in range(n)
           if not (ring[i - 1][0] == ring[i][0] == ring[(i + 1) % n][0] or
                   ring[i - 1][1] == ring[i][1] == ring[(i + 1) % n][1])]
    s = sum((x2 - x1) * (y2 + y1) for (x1, y1), (x2, y2) in zip(out, out[1:] + out[:1]))
    if s > 0:  # clockwise; GeoJSON (RFC 7946) exteriors are anticlockwise, as the file has
        out.reverse()
    return out + [out[0]]


def channel_network(g, ws, thresh_m2):
    ch = ws & (g.acc >= thresh_m2)
    idx = np.nonzero(ch)[0]
    length, parents = 0.0, np.zeros(g.R * g.C, int)
    for i in idx:
        d = g.down[i]
        if d >= 0 and ch[d]:
            length += g.step(i, d)
            parents[d] += 1
    heads = int(((parents == 0) & ch).sum())
    joins = int(((parents >= 2) & ch).sum())
    return length / 1000, heads + joins


def line_length_inside(g, lines, mask):
    m = mask.reshape(g.R, g.C)
    total = inside = 0.0
    segs_in = 0
    for ln in lines:
        seg_in = False
        for (lo1, la1), (lo2, la2) in zip(ln, ln[1:]):
            d = metres(la1, lo1, la2, lo2)
            n = max(1, int(d / 2))
            for k in range(n):
                t = (k + 0.5) / n
                r = np.abs(g.lat - (la1 + (la2 - la1) * t)).argmin()
                c = np.abs(g.lon - (lo1 + (lo2 - lo1) * t)).argmin()
                total += d / n
                if m[r, c]:
                    inside += d / n
                    seg_in = True
        segs_in += seg_in
    return total / 1000, inside / 1000, segs_in


def longest_flow_path(g, ws, p):
    dist = np.full(g.R * g.C, -1.0)
    dist[p] = 0.0
    for i in g.order:
        if ws[i] and i != p:
            dist[i] = dist[g.down[i]] + g.step(i, g.down[i])
    return dist.max() / 1000


# ---------- writing the shipped data file ----------

# Low end of the catchment: river level at the confluence. Model heights on open water are
# unreliable, so this comes from OPW station 18124 Fermoy U/S Rowing, 1.4 km downstream:
# gauge zero 21.187 m above Malin Head OD (OSGM15); 7 Oct-11 Nov 2026 levels 20.64-22.11.
OUTLET_OD = 21
# Stop elevations, m OD, rounded to 5 m: the walk's own GPX (archive/source-data/) and Copernicus
# GLO-30 agree to within 4-8 m at each stop (tools/dem_report.py). The original EXIF
# altitudes were ellipsoidal heights, about 57 m above OD.
STOP_OD = {'Stop 01 - the stream': 60, 'Stop 02 - closed canopy': 110,
           'Stop 03 - the mossy stand': 105}
STOP_SOURCE = ('position, bearing and time: photo EXIF, Pixel 8a; elevation: walk GPX and '
               'Copernicus GLO-30, rounded to 5 m')
CATCHMENT_SOURCE = ('Copernicus GLO-30 DEM, flow-routed (Priority-Flood fill, D8) to the '
                    'Glenabo-Blackwater confluence; tools/catchment.py')
STATED_AREA_KM2 = 3.6  # published as "about 3.6 km2 / about 360 ha", matching the boundary
ACTION_NOTE = ('A drawn proposal: the Glenabo catchment with Glenabo Wood, Corrin Hill and '
               'Knockananig Reservoir added. Offered for discussion, not a designation.')


def clip_lines(lines, ring):
    """Keep the parts of each line inside the ring, ending each part on the boundary.
    shortcut: a segment with both ends outside that cuts across a corner of the ring is
    dropped rather than split; at this network's 2-15 m vertex spacing that loses nothing."""
    X = lambda pts: in_ring(ring, np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))

    def crossing(a, b):
        best = None
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            d = (b[0] - a[0]) * (y2 - y1) - (b[1] - a[1]) * (x2 - x1)
            if d == 0:
                continue
            t = ((x1 - a[0]) * (y2 - y1) - (y1 - a[1]) * (x2 - x1)) / d
            u = ((x1 - a[0]) * (b[1] - a[1]) - (y1 - a[1]) * (b[0] - a[0])) / d
            if 0 <= t <= 1 and 0 <= u <= 1 and (best is None or t < best):
                best = t
        t = best if best is not None else 0.5
        return [round(a[0] + (b[0] - a[0]) * t, 6), round(a[1] + (b[1] - a[1]) * t, 6)]

    out = []
    for ln in lines:
        ins = X(ln)
        cur = [ln[0]] if ins[0] else []
        for i in range(1, len(ln)):
            a, b = ln[i - 1], ln[i]
            if ins[i - 1] and ins[i]:
                cur.append(b)
            elif ins[i - 1]:
                cur.append(crossing(a, b))
                out.append(cur)
                cur = []
            elif ins[i]:
                cur = [crossing(b, a), b]
        if len(cur) > 1:
            out.append(cur)
    return [ln for ln in out if len(ln) > 1]


def line_metres(lines):
    return sum(metres(a[1], a[0], b[1], b[0]) for ln in lines for a, b in zip(ln, ln[1:]))


def write_geojson(g, ws, pour, egm, osg):
    shipped, pinch, holes = tidy(g, ws)
    ring = shipped_ring(g, shipped)
    area = ring_area(ring[:-1]) / 1e6
    zod = g.z.ravel() + np.array([egm.sample(y, x) - osg.sample(y, x)
                                  for x, y in zip(g.X.ravel(), g.Y.ravel())])
    top = int(np.argmax(np.where(shipped, zod, -np.inf)))
    lfp = longest_flow_path(g, ws, pour)

    fc = json.load(open(GEOJSON))
    for f in fc['features']:
        p, kind = f['properties'], f['geometry']['type']
        if p.get('name') == 'Glenabo hydrological catchment':
            f['geometry']['coordinates'] = [ring]
            p.update(area_km2=round(area, 2), area_ha=round(area * 100, 1),
                     source=CATCHMENT_SOURCE, stated_area_km2=STATED_AREA_KM2,
                     elevation_min_m=OUTLET_OD, elevation_max_m=int(round(zod[top])),
                     longest_flow_path_km=round(lfp, 1))
        elif p.get('name') == 'Modelled channel network':
            p.pop('segments', None)          # figure withdrawn, not corrected
            p.pop('total_length_km', None)
            before = f['geometry']['coordinates']
            after = clip_lines(before, ring)
            f['geometry']['coordinates'] = after
            print('channel network clipped to the boundary: %.0f m -> %.0f m, %d -> %d lines'
                  % (line_metres(before), line_metres(after), len(before), len(after)))
        elif p.get('name') == 'Proposed area for action':
            a = ring_area(f['geometry']['coordinates'][0][:-1]) / 1e6
            p.update(area_km2=round(a, 3), area_ha=round(a * 100, 1), note=ACTION_NOTE)
        elif p.get('kind') == 'outlet':
            p['elevation_m'] = OUTLET_OD
        elif p.get('kind') == 'stop':
            p['elevation_m'] = STOP_OD[p['name']]
            p['source'] = STOP_SOURCE
            # the camera wrote local Irish summer time; the old 'Z' claimed UTC
            if p.get('recorded', '').endswith('Z'):
                p['recorded'] = p['recorded'][:-1] + '+01:00'
    fc['generated'] = __import__('datetime').date.today().isoformat()
    with open(GEOJSON, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(fc, ensure_ascii=False))  # single line, as the file has always been

    print('\n== Written %s' % os.path.relpath(GEOJSON))
    print('tidy: %d cells added to close diagonal contacts, %d hole cells filled (%.4f km2)'
          % (pinch, holes, g.area_km2(shipped & ~ws)))
    print('shipped catchment: %d vertices, %.3f km2 (%.1f ha) on the ellipsoid'
          % (len(ring), area, area * 100))
    print('highest ground inside: %.1f m OD at %.5f, %.5f (Copernicus surface)'
          % (zod[top], g.Y.ravel()[top], g.X.ravel()[top]))
    print('longest flow path (D8) %.2f km; low end %d m OD from OPW 18124' % (lfp, OUTLET_OD))
    # checks against the ring as written
    for f in fc['features']:
        if f['properties'].get('kind') == 'stop':
            lon, lat = f['geometry']['coordinates'][:2]
            ok = in_ring(ring, np.array([lon]), np.array([lat]))[0]
            print('  %-28s inside: %s' % (f['properties']['name'], ok))
    net = next(f for f in fc['features'] if f['geometry']['type'] == 'MultiLineString')
    pts = [(x, y) for ln in net['geometry']['coordinates'] for x, y in ln]
    ins = in_ring(ring, np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
    print('  channel network vertices inside: %d of %d' % (ins.sum(), len(ins)))
    for (x, y), ok in zip(pts, ins):
        if not ok:
            print('    outside: %.6f, %.6f' % (y, x))
    return shipped


# ---------- main ----------

def main(outdir=None, write=False):
    got = fetch()
    feats = json.load(open(GEOJSON))['features']
    poly = lambda key: next(f for f in feats if key in f['properties'].get('name', '').lower()
                            and f['geometry']['type'] == 'Polygon')
    traced_f, action_f = poly('catchment'), poly('action')
    traced, action = traced_f['geometry']['coordinates'][0], action_f['geometry']['coordinates'][0]
    net = next(f for f in feats if f['geometry']['type'] == 'MultiLineString')

    # self-check: a 1 x 1 degree cell at 52-53 N on WGS84 is 7,577 km2 (spheroidal zone formula)
    cell = ring_area([[0, 52], [1, 52], [1, 53], [0, 53]]) / 1e6
    exact = 2 * math.pi * RQ ** 2 * (_q(math.radians(53)) - _q(math.radians(52))) / QP / 360 / 1e6
    assert abs(cell - exact) < 1e-6 * exact, (cell, exact)

    xs = [p[0] for p in action] + [p[0] for p in traced]
    ys = [p[1] for p in action] + [p[1] for p in traced]
    south, north, west, east = min(ys) - .0075, max(ys) + .0075, min(xs) - .012, max(xs) + .012

    print('== Published polygons (vector area on the WGS84 ellipsoid)')
    print('shipped catchment  %.3f km2 (properties say %s)'
          % (ring_area(traced) / 1e6, traced_f['properties'].get('area_km2')))
    print('action area        %.3f km2 (properties say %s)'
          % (ring_area(action) / 1e6, action_f['properties'].get('area_km2')))

    results = {}
    for name, paths in (('FABDEM', got['fabdem']), ('Copernicus', got['dem'])):
        g = Grid(Mosaic(paths).tiles[0], south, north, west, east)
        g.route()
        # Blackwater: lowest cell on the west edge within 1.5 km of the outlet latitude
        west_edge = [r * g.C for r in range(g.R) if abs(g.lat[r] - OUTLET[0]) < 0.014]
        bwp = g.path(min(west_edge, key=lambda i: g.z.ravel()[i]))
        bw = set(bwp)
        glen = g.path(g.cell(*STOP1))
        k = next(n for n, i in enumerate(glen) if i in bw)
        conf, pour = glen[k], glen[k - 1]
        (pr, pc), (cr, cc), (er, ec) = g.rc(pour), g.rc(conf), g.rc(bwp[-1])
        print('\n== %s (%d x %d cells, %.0f x %.0f m)' % (name, g.R, g.C, g.dy.mean(), g.dx.mean()))
        print('Blackwater path leaves the domain at %.4f, %.4f (should be the east edge, %.4f)'
              % (g.lat[er], g.lon[ec], east))
        print('confluence cell %.5f, %.5f; pour point %.5f, %.5f, %.0f m from the published outlet'
              % (g.lat[cr], g.lon[cc], g.lat[pr], g.lon[pc], metres(g.lat[pr], g.lon[pc], *OUTLET)))
        ws = g.watershed(pour)
        wsr = ws.reshape(g.R, g.C)
        assert not (wsr[0].any() or wsr[-1].any() or wsr[:, 0].any() or wsr[:, -1].any()), \
            'watershed touches the domain edge: enlarge the domain'
        print('routed catchment at the confluence: %.3f km2' % g.area_km2(ws))
        print('pour point moved upstream along the main channel:')
        i, walked, targets = pour, 0.0, list(STEPS)
        while targets:
            j = g.parent_max(i)
            if j < 0:
                break
            walked += g.step(j, i)
            i = j
            if walked >= targets[0]:
                r, c = g.rc(i)
                print('  %4d m up (%4.0f m walked): %.3f km2  at %.5f, %.5f'
                      % (targets.pop(0), walked, g.area_km2(g.watershed(i)), g.lat[r], g.lon[c]))
        print('one cell downstream is the Blackwater: a pour point there drains %.0f km2 of this'
              ' domain alone' % g.area_km2(g.watershed(conf)))
        print('longest flow path %.2f km; ground %.1f-%.1f m (EGM2008, this model)'
              % (longest_flow_path(g, ws, pour), g.z.ravel()[ws].min(), g.z.ravel()[ws].max()))
        s1 = g.cell(*STOP1)
        r1, c1 = g.rc(s1)
        near = [rr * g.C + cc for rr in range(r1 - 2, r1 + 3) for cc in range(c1 - 2, c1 + 3)]
        ch = max(near, key=lambda i: g.acc[i])  # the stream cell beside Stop 1
        print('upstream of the stream at Stop 1: %.3f km2' % g.area_km2(g.watershed(ch)))
        results[name] = (g, ws, pour)

    g, ws, pour = results['FABDEM']
    tr = in_ring(traced, g.X, g.Y).ravel()
    ac = in_ring(action, g.X, g.Y).ravel()
    centre = (float(g.Y.ravel()[ws].mean()), float(g.X.ravel()[ws].mean()))
    print('\n== 5. Routed (FABDEM) against the traced catchment, on the FABDEM grid')
    print('  raster area of traced polygon %.3f km2 vs vector %.3f: grid error %+.1f%%'
          % (g.area_km2(tr), ring_area(traced) / 1e6,
             100 * (g.area_km2(tr) / (ring_area(traced) / 1e6) - 1)))
    compare(g, ws, tr, 'routed (FABDEM)', 'traced', centre)
    gc, wsc, _ = results['Copernicus']
    ri = np.abs(gc.lat[None, :] - g.lat[:, None]).argmin(1)
    ci = np.abs(gc.lon[None, :] - g.lon[:, None]).argmin(1)
    cop = wsc.reshape(gc.R, gc.C)[np.ix_(ri, ci)].ravel()
    print('  routed FABDEM vs routed Copernicus: both %.3f km2, FABDEM only %.3f, Copernicus only %.3f'
          % (g.area_km2(ws & cop), g.area_km2(ws & ~cop), g.area_km2(cop & ~ws)))

    print('\n== 6. Action area')
    env_r, env_t = g.envelope(ws, 330.0), g.envelope(tr, 330.0)
    print('  action polygon on the grid %.3f km2' % g.area_km2(ac))
    print('  routed catchment outside the action area: %.3f km2 (%.1f%%)'
          % (g.area_km2(ws & ~ac), 100 * g.area_km2(ws & ~ac) / g.area_km2(ws)))
    print('  traced catchment outside the action area: %.3f km2' % g.area_km2(tr & ~ac))
    print('  330 m envelope: of traced %.3f km2, of routed %.3f km2'
          % (g.area_km2(env_t), g.area_km2(env_r)))
    compare(g, env_r, ac, '330 m around routed', 'action polygon', centre)

    print('\n== 7. Channel network')
    lines = net['geometry']['coordinates']
    tot, inside, segs = line_length_inside(g, lines, ws)
    _, inside_t, segs_t = line_length_inside(g, lines, tr)
    print('  published network: %.2f km in %d segments (properties: %s km, %s)'
          % (tot, len(lines), net['properties'].get('total_length_km'),
             net['properties'].get('segments')))
    print('  inside routed: %.2f km, %d segments touch it; inside traced: %.2f km, %d segments'
          % (inside, segs, inside_t, segs_t))
    for ha in (1, 2, 5, 10, 25):
        km, n = channel_network(g, ws, ha * 1e4)
        print('  FABDEM network, cells draining >= %2d ha: %.2f km in %d segments' % (ha, km, n))

    if write:
        gc, wsc, pourc = results['Copernicus']
        rasters = Mosaic([got['egm2008']]).tiles[0], Mosaic([got['osgm15']]).tiles[0]
        write_geojson(gc, wsc, pourc, *rasters)

    if outdir:
        os.makedirs(outdir, exist_ok=True)
        fc = {'type': 'FeatureCollection', 'features': [
            {'type': 'Feature',
             'properties': {'name': 'Glenabo catchment, routed on ' + n, 'area_km2': round(gg.area_km2(w), 3)},
             'geometry': {'type': 'Polygon', 'coordinates': [boundary_ring(gg, w)]}}
            for n, (gg, w, _) in results.items()]}
        json.dump(fc, open(os.path.join(outdir, 'routed_catchments.geojson'), 'w'))
        from PIL import Image
        zz = g.z
        shade = ((zz - zz.min()) / (zz.max() - zz.min()) * 120 + 60).astype(np.uint8)
        img = np.repeat(shade[..., None], 3, axis=2)
        W, T, CC, Ac = (m.reshape(g.R, g.C) for m in (ws, tr, cop, ac))
        img[W & T] = (90, 160, 90)      # both: green
        img[W & ~T] = (40, 90, 220)     # routed only: blue
        img[T & ~W] = (220, 70, 50)     # traced only: red
        outline = lambda M: M ^ np.roll(M, 1, 0) | M ^ np.roll(M, 1, 1)
        img[outline(Ac)] = (250, 220, 60)  # action area: yellow
        img[outline(CC)] = (255, 255, 255)  # Copernicus routed: white
        h = int(g.R * 4 * g.dy.mean() / g.dx.mean())
        Image.fromarray(img).resize((g.C * 4, h), Image.NEAREST).save(
            os.path.join(outdir, 'catchment_compare.png'))
        print('\nwrote', outdir)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--write']
    main(args[0] if args else None, write='--write' in sys.argv)

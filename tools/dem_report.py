#!/usr/bin/env python3
"""Check the published elevations against Copernicus GLO-30 and the geoid models.

    python3 tools/dem_report.py ["/path/to/stop photographs"]

Reads site/assets/data/cairde-corrin.geojson and source-data/*.gpx, changes
nothing. With a photograph folder (needs exiftool) it also uses the unrounded
EXIF altitudes; without one it uses the published stop elevations.
Data comes from tools/fetch_dem.py. Heights are reported in three systems:
  DEM      Copernicus surface heights, EGM2008 (top of canopy under trees)
  OD       Malin Head OD, = DEM + N(EGM2008) - N(OSGM15)
  N        ellipsoid minus geoid, from the grid named
"""
import json, math, re, subprocess, sys
from datetime import datetime

import numpy as np

from fetch_dem import GEOJSON, GPX, Mosaic, Raster, fetch


def stats(xs):
    a = np.asarray(xs, dtype=float)
    return 'mean %+7.2f  median %+7.2f  sd %6.2f  (n=%d, sd with n-1)' % (
        a.mean(), np.median(a), a.std(ddof=1) if len(a) > 1 else float('nan'), len(a))


def metres(lat1, lon1, lat2, lon2):
    k = math.cos(math.radians((lat1 + lat2) / 2))
    return 6371000 * math.hypot(math.radians(lat2 - lat1), math.radians(lon2 - lon1) * k)


def exif_alts(folder, stops):
    """EXIF altitude per stop, from the photograph whose local capture time matches."""
    out = subprocess.run(['exiftool', '-q', '-n', '-T', '-filename', '-DateTimeOriginal',
                          '-GPSDateTime', '-GPSLatitude', '-GPSLongitude', '-GPSAltitude',
                          '-GPSAltitudeRef', folder], capture_output=True, text=True,
                         check=True).stdout
    rows = [r.split('\t') for r in out.splitlines() if r.count('\t') == 6]
    found = {}
    for name, (lat, lon, pub, rec) in stops.items():
        # 'recorded' carries a Z but equals the camera's local DateTimeOriginal
        want = rec.replace('-', ':').replace('T', ' ').rstrip('Z')
        hit = [r for r in rows if r[1] == want]
        if hit:
            r = hit[0]
            found[name] = dict(file=r[0], gps_utc=r[2], lat=float(r[3]), lon=float(r[4]),
                               alt=float(r[5]), ref=r[6])
    allfix = {}
    for r in rows:  # one entry per distinct GPS fix
        if r[5] != '-':
            allfix[(r[2], r[3], r[4])] = (float(r[3]), float(r[4]), float(r[5]))
    return found, list(allfix.values())


def inside_mask(ring, lons, lats):
    """Vectorised ray casting of pixel centres against one polygon ring."""
    X, Y = np.meshgrid(lons, lats)
    ins = np.zeros(X.shape, bool)
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi, xj, yj = xs[i], ys[i], xs[j], ys[j]
        if yi != yj:
            cross = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)
            ins ^= cross
        j = i
    return ins


def main(photo_dir=None):
    g = fetch()
    dem, egm, osg = Mosaic(g['dem']), Raster(g['egm2008']), Raster(g['osgm15'])
    to_od = lambda lat, lon: egm.sample(lat, lon) - osg.sample(lat, lon)
    feats = json.load(open(GEOJSON))['features']

    # self-check: the published EGM2008 undulation at 0,0 is +17.23 m
    assert abs(egm.sample(0, 0) - 17.23) < 0.05, 'EGM2008 grid misread'

    print('== Sources')
    print('DEM     Copernicus GLO-30 Public (DSM), 1" x 1.5" (~31 x 29 m here), EGM2008 heights')
    print('Geoid   EGM2008 2.5\' grid (us_nga_egm08_25) and OSGM15 Malin (uk_os_OSGM15_Malin)')

    stops = {}
    for f in feats:
        p = f['properties']
        if p.get('kind') == 'stop':
            lon, lat = f['geometry']['coordinates'][:2]
            stops[p['name']] = (lat, lon, p['elevation_m'], p['recorded'])

    print('\n== 2. Stops: published vs DEM at the published coordinates')
    print('%-28s %7s %7s %7s %8s %7s %7s %13s' % ('stop', 'publ', 'DEM', 'DEM-OD', 'publ-DEM',
                                                 'N08', 'N15', 'DEM 3x3 range'))
    d_pub, d_exif, n08 = [], [], []
    for name, (lat, lon, pub, _) in stops.items():
        h = dem.sample(lat, lon)
        t = next(t for t in dem.tiles if t.contains(lat, lon))
        x, y = int(round((lon - t.lon0) / t.dx)), int(round((t.lat0 - lat) / t.dy))
        nb = t.a[y - 1:y + 2, x - 1:x + 2]
        N, N15 = egm.sample(lat, lon), osg.sample(lat, lon)
        d_pub.append(pub - h); n08.append(N)
        print('%-28s %7.1f %7.1f %7.1f %+8.1f %7.2f %7.2f %6.1f-%6.1f' % (
            name, pub, h, h + N - N15, pub - h, N, N15, nb.min(), nb.max()))
    print('publ - DEM            ', stats(d_pub))
    print('EGM2008 N at the stops', stats(n08))

    if photo_dir:
        found, fixes = exif_alts(photo_dir, stops)
        print('\n== 3b. Stops: EXIF altitude - DEM (EXIF position)')
        for name, e in found.items():
            h = dem.sample(e['lat'], e['lon'])
            N = egm.sample(e['lat'], e['lon'])
            d_exif.append(e['alt'] - h)
            print('%-28s %-26s alt %7.2f ref %s  DEM %6.1f  EXIF-DEM %+6.1f  EXIF-N-DEM %+6.1f'
                  % (name, e['file'], e['alt'], e['ref'], h, e['alt'] - h, e['alt'] - N - h))
        print('EXIF - DEM (stops)    ', stats(d_exif))
        r = [a - dem.sample(la, lo) for la, lo, a in fixes]
        rn = [a - egm.sample(la, lo) - dem.sample(la, lo) for la, lo, a in fixes]
        print('EXIF - DEM, every distinct fix in the folder      ', stats(r))
        print('EXIF - N - DEM, same fixes (EXIF as ellipsoidal)  ', stats(rn))

    print('\n== 3a. GPX: elevation - DEM along every trackpoint')
    txt = open(GPX).read()
    pts = [(float(a), float(b), float(c), datetime.fromisoformat(d.replace('Z', '+00:00')))
           for a, b, c, d in re.findall(
               r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)</ele>\s*'
               r'<time>([^<]+)</time>', txt)]
    assert len(pts) == txt.count('<trkpt'), 'GPX parse missed trackpoints'
    lat, lon, ele = (np.array([p[i] for p in pts]) for i in range(3))
    t = np.array([(p[3] - pts[0][3]).total_seconds() for p in pts])
    h = np.array([dem.sample(a, b) for a, b in zip(lat, lon)])
    res = ele - h
    N = np.array([egm.sample(a, b) for a, b in zip(lat, lon)])
    od = h + N - np.array([osg.sample(a, b) for a, b in zip(lat, lon)])
    print('GPX - DEM             ', stats(res))
    print('GPX - DEM (as OD)     ', stats(ele - od))
    print('GPX - (DEM + N)       ', stats(ele - h - N), ' <- if GPX were ellipsoidal')

    print('\n== 6. GPX elevation channel')
    dt = np.diff(t)
    step = np.array([metres(lat[i], lon[i], lat[i + 1], lon[i + 1]) for i in range(len(lat) - 1)])
    print('points %d over %.0f min; interval median %.0f s, max %.0f s; step median %.0f m'
          % (len(pts), t[-1] / 60, np.median(dt), dt.max(), np.median(step)))
    print('ele range %.1f-%.1f m; DEM range along track %.1f-%.1f m'
          % (ele.min(), ele.max(), h.min(), h.max()))
    print('corr(GPX, DEM) %.3f' % np.corrcoef(ele, h)[0, 1])
    # a loop that ends where it started shows the channel's drift over the walk
    print('loop closure: end %.0f m from start, %.0f min later, ele %+.1f m (DEM %+.1f m)'
          % (metres(lat[0], lon[0], lat[-1], lon[-1]), t[-1] / 60, ele[-1] - ele[0],
             h[-1] - h[0]))
    slope = np.polyfit(t / 3600, res, 1)[0]
    print('residual drift vs time %+.2f m/h' % slope)
    d2 = np.diff(ele, 2)
    print('second difference of ele: rms %.2f m; of DEM: rms %.2f m' %
          (np.sqrt(np.mean(d2 ** 2)), np.sqrt(np.mean(np.diff(h, 2) ** 2))))
    close = [(i, j) for i in range(len(pts)) for j in range(i + 1, len(pts))
             if t[j] - t[i] > 600 and metres(lat[i], lon[i], lat[j], lon[j]) < 10]
    if close:
        de = np.array([ele[j] - ele[i] for i, j in close])
        dh = np.array([h[j] - h[i] for i, j in close])
        dtt = np.array([(t[j] - t[i]) / 60 for i, j in close])
        print('revisits (<10 m apart, >10 min later): %d pairs; |dEle| median %.1f m, max %.1f m;'
              ' |dDEM| median %.1f m; gap %.0f-%.0f min'
              % (len(close), np.median(abs(de)), abs(de).max(), np.median(abs(dh)),
                 dtt.min(), dtt.max()))
    stat = [i for i in range(len(step)) if step[i] < 3]
    if stat:
        print('near-stationary consecutive points (<3 m): %d; ele change there median %.2f m,'
              ' max %.2f m' % (len(stat), np.median([abs(ele[i + 1] - ele[i]) for i in stat]),
                               max(abs(ele[i + 1] - ele[i]) for i in stat)))
    print('fraction of ele values ending in .0: %.2f' % np.mean(np.round(ele * 10) % 10 == 0))

    print('\n== 5. Catchment elevation range from the DEM')
    ring = next(f for f in feats if 'catchment' in f['properties'].get('name', '').lower()
                and f['geometry']['type'] == 'Polygon')['geometry']['coordinates'][0]
    rx, ry = [p[0] for p in ring], [p[1] for p in ring]
    for tile in dem.tiles:
        lons, lats = tile.centres()
        ci = np.where((lons >= min(rx)) & (lons <= max(rx)))[0]
        ri = np.where((lats >= min(ry)) & (lats <= max(ry)))[0]
        if not len(ci) or not len(ri):
            continue
        m = inside_mask(ring, lons[ci], lats[ri])
        sub = tile.a[np.ix_(ri, ci)]
        v = sub[m]
        lo_i, hi_i = np.unravel_index(np.where(m, sub, np.inf).argmin(), m.shape), \
            np.unravel_index(np.where(m, sub, -np.inf).argmax(), m.shape)
        for label, (r_, c_) in (('min', lo_i), ('max', hi_i)):
            la, lo = lats[ri][r_], lons[ci][c_]
            hv = sub[r_, c_]
            print('%s  DEM %6.1f m  OD %6.1f m  at %.5f, %.5f' % (label, hv, hv + to_od(la, lo),
                                                                  la, lo))
        print('pixels inside %d; percentiles 0.5/99.5: %.1f / %.1f m (DEM)'
              % (m.sum(), *np.percentile(v, [0.5, 99.5])))
    outlet = next(f for f in feats if f['properties'].get('kind') == 'outlet')
    olon, olat = outlet['geometry']['coordinates'][:2]
    oh = dem.sample(olat, olon)
    print('outlet point: published %s m, DEM %.1f m, OD %.1f m'
          % (outlet['properties']['elevation_m'], oh, oh + to_od(olat, olon)))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)

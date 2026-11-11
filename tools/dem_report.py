#!/usr/bin/env python3
"""Check the published elevations against two elevation models and the geoid.

    python3 tools/dem_report.py ["/path/to/photographs" ...]

Reads site/assets/data/cairde-corrin.geojson and source-data/*.gpx, changes
nothing. With a photograph folder (needs exiftool) it also uses the unrounded
EXIF altitudes. Data comes from tools/fetch_dem.py.

  COP      Copernicus GLO-30, a surface model (top of canopy under trees)
  FAB      FABDEM V1-2, the same data with forest and buildings removed
  OD       Malin Head OD = model height (EGM2008) + N(EGM2008) - N(OSGM15)
  N        ellipsoid minus geoid, from the grid named
"""
import csv, io, json, math, os, re, subprocess, sys, urllib.request
from datetime import datetime

import numpy as np
from PIL import Image

from fetch_dem import CACHE, GEOJSON, GPX, Mosaic, Raster, download, fetch

TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
OPW_CSV = 'https://waterlevel.ie/data/month/{s}_OD.csv'


def stats(xs):
    a = np.asarray(xs, dtype=float)
    return 'mean %+7.2f  median %+7.2f  sd %6.2f  (n=%d, sd with n-1)' % (
        a.mean(), np.median(a), a.std(ddof=1) if len(a) > 1 else float('nan'), len(a))


def metres(lat1, lon1, lat2, lon2):
    k = math.cos(math.radians((lat1 + lat2) / 2))
    return 6371000 * math.hypot(math.radians(lat2 - lat1), math.radians(lon2 - lon1) * k)


def exif_rows(folder):
    """filename, local time, GPS time, lat, lon, altitude, altitude ref, camera model"""
    out = subprocess.run(['exiftool', '-q', '-r', '-n', '-T', '-filename', '-DateTimeOriginal',
                          '-GPSDateTime', '-GPSLatitude', '-GPSLongitude', '-GPSAltitude',
                          '-GPSAltitudeRef', '-Model', folder], capture_output=True, text=True,
                         check=True).stdout
    return [r.split('\t') for r in out.splitlines() if r.count('\t') == 7]


def inside_mask(ring, lons, lats):
    """Vectorised ray casting of grid points against one polygon ring."""
    X, Y = np.meshgrid(lons, lats) if np.ndim(lons) == 1 else (lons, lats)
    ins = np.zeros(X.shape, bool)
    j = len(ring) - 1
    for i in range(len(ring)):
        (xi, yi), (xj, yj) = ring[i][:2], ring[j][:2]
        if yi != yj:
            ins ^= ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)
        j = i
    return ins


def in_ring(raster, ring):
    """Pixel-centre lon, lat and values of a raster inside the ring."""
    lons, lats = raster.centres()
    rx, ry = [p[0] for p in ring], [p[1] for p in ring]
    ci = np.where((lons >= min(rx)) & (lons <= max(rx)))[0]
    ri = np.where((lats >= min(ry)) & (lats <= max(ry)))[0]
    X, Y = np.meshgrid(lons[ci], lats[ri])
    m = inside_mask(ring, X, Y)
    return X[m], Y[m], raster.a[np.ix_(ri, ci)][m]


def terrarium_in_ring(ring, z=13):
    """AWS Terrain Tiles (Terrarium PNG) pixel centres inside the ring: lon, lat, h."""
    n = 2 ** z
    tx = lambda lon: (lon + 180) / 360 * n
    ty = lambda lat: (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    rx, ry = [p[0] for p in ring], [p[1] for p in ring]
    L, Lo, H = [], [], []
    for x in range(int(tx(min(rx))), int(tx(max(rx))) + 1):
        for y in range(int(ty(max(ry))), int(ty(min(ry))) + 1):
            p = download(TERRARIUM.format(z=z, x=x, y=y),
                         os.path.join(CACHE, 'terrarium_%d_%d_%d.png' % (z, x, y)))
            a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
            h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            px = (x * 256 + np.arange(256) + 0.5) / (256 * n)
            py = (y * 256 + np.arange(256) + 0.5) / (256 * n)
            lon = px * 360 - 180
            lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * py))))
            X, Y = np.meshgrid(lon, lat)
            m = inside_mask(ring, X, Y)
            L.append(X[m]); Lo.append(Y[m]); H.append(h[m])
    return np.concatenate(L), np.concatenate(Lo), np.concatenate(H)


def main(photo_dirs=()):
    g = fetch()
    cop, fab = Mosaic(g['dem']), Mosaic(g['fabdem'])
    egm, osg = Raster(g['egm2008']), Raster(g['osgm15'])
    dod = lambda lat, lon: egm.sample(lat, lon) - osg.sample(lat, lon)  # EGM2008 -> OD
    feats = json.load(open(GEOJSON))['features']
    assert abs(egm.sample(0, 0) - 17.23) < 0.05, 'EGM2008 grid misread'

    txt = open(GPX).read()
    pts = [(float(a), float(b), float(c), datetime.fromisoformat(d.replace('Z', '+00:00')))
           for a, b, c, d in re.findall(
               r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)</ele>\s*'
               r'<time>([^<]+)</time>', txt)]
    assert len(pts) == txt.count('<trkpt'), 'GPX parse missed trackpoints'
    glat, glon, gele = (np.array([p[i] for p in pts]) for i in range(3))
    gt = np.array([(p[3] - pts[0][3]).total_seconds() for p in pts])

    stops = {}
    for f in feats:
        p = f['properties']
        if p.get('kind') == 'stop':
            lon, lat = f['geometry']['coordinates'][:2]
            stops[p['name']] = (lat, lon, p['elevation_m'], p['recorded'])
    rows = [r for d in photo_dirs for r in exif_rows(d)]

    print('== Stops, all in m OD (Malin Head)')
    print('%-26s %5s %8s %7s %7s %7s %13s %6s %9s' % (
        'stop', 'publ', 'EXIF-N15', 'COP', 'FAB', 'COP-FAB', 'GPX nearest', 'spread',
        'FAB 3x3'))
    canopy_stops = []
    for name, (lat, lon, pub, rec) in stops.items():
        k = dod(lat, lon)
        c, fb = cop.sample(lat, lon) + k, fab.sample(lat, lon) + k
        want = rec[:19].replace('-', ':').replace('T', ' ')  # local time, whatever the suffix
        hit = [r for r in rows if r[1] == want]
        ex = float(hit[0][5]) - osg.sample(lat, lon) if hit else float('nan')
        d = [metres(lat, lon, a, b) for a, b in zip(glat, glon)]
        i = int(np.argmin(d))
        gp = '%5.1f @%3.0fm' % (gele[i], d[i])
        est = [v for v in (ex, c, fb) if not math.isnan(v)]
        t = next(t for t in fab.tiles if t.contains(lat, lon))
        x, y = int(round((lon - t.lon0) / t.dx)), int(round((t.lat0 - lat) / t.dy))
        nb = t.a[y - 1:y + 2, x - 1:x + 2] + k
        canopy_stops.append(c - fb)
        print('%-26s %5.0f %8.1f %7.1f %7.1f %+7.1f %13s %6.1f %4.0f-%3.0f' % (
            name, pub, ex, c, fb, c - fb, gp, max(est) - min(est), nb.min(), nb.max()))
    print('(GPX ele is shown as recorded; section 3 shows it is already on a sea-level datum)')
    if rows:
        fixes = {(r[2], r[3], r[4]): tuple(map(float, r[3:6])) for r in rows
                 if r[5] != '-' and 'Pixel' in r[7]}
        rn = [a - egm.sample(la, lo) - fab.sample(la, lo) for la, lo, a in fixes.values()]
        print('every distinct photo fix, EXIF - N08 - FAB (zero if EXIF is ellipsoidal):',
              stats(rn))

    print('\n== 3. GPX (all %d trackpoints) against each model, model in its own EGM2008 heights'
          % len(pts))
    hc = np.array([cop.sample(a, b) for a, b in zip(glat, glon)])
    hf = np.array([fab.sample(a, b) for a, b in zip(glat, glon)])
    print('GPX - COP   ', stats(gele - hc))
    print('GPX - FAB   ', stats(gele - hf))
    r = gele - hf
    print('GPX - FAB   p5 %+.2f  p95 %+.2f  |r|<1 m: %.0f%%  |r|<2 m: %.0f%%'
          % (*np.percentile(r, [5, 95]), 100 * np.mean(abs(r) < 1), 100 * np.mean(abs(r) < 2)))
    print('corr(GPX, COP) %.4f  corr(GPX, FAB) %.4f' % (np.corrcoef(gele, hc)[0, 1],
                                                         np.corrcoef(gele, hf)[0, 1]))
    de, df = np.diff(gele), np.diff(hf)
    print('point-to-point change: corr(dGPX, dFAB) %.3f; rms dGPX %.2f m, rms dFAB %.2f m'
          % (np.corrcoef(de, df)[0, 1], np.sqrt(np.mean(de ** 2)), np.sqrt(np.mean(df ** 2))))
    slope, icpt = np.polyfit(gt / 3600, r, 1)
    print('GPX - FAB against time: %+.2f m/h; loop closure %+.1f m in %.0f min (FAB %+.1f m)'
          % (slope, gele[-1] - gele[0], gt[-1] / 60, hf[-1] - hf[0]))
    print('canopy along the track (COP - FAB): ', stats(hc - hf))
    print('corr(GPX - COP, COP - FAB) %.2f' % np.corrcoef(gele - hc, hc - hf)[0, 1])

    print('\n== 5. Canopy inflation, COP - FAB')
    ring = next(f for f in feats if 'catchment' in f['properties'].get('name', '').lower()
                and f['geometry']['type'] == 'Polygon')['geometry']['coordinates'][0]
    fx, fy, fv = in_ring(fab.tiles[0], ring)
    assert (fv > -1000).all(), 'FABDEM no-data inside the catchment'
    cv = np.array([cop.sample(b, a) for a, b in zip(fx, fy)])
    inf = cv - fv
    print('catchment (%d FAB pixels)' % len(fv), stats(inf))
    print('  p5 %+.1f  p95 %+.1f  max %+.1f; share > 5 m: %.0f%%, > 10 m: %.0f%%'
          % (*np.percentile(inf, [5, 95]), inf.max(), 100 * np.mean(inf > 5),
             100 * np.mean(inf > 10)))
    print('three stops', stats(canopy_stops))

    print('\n== 6. Catchment elevation range, m OD')
    for label, (xs, ys, vs) in (('COP', in_ring(cop.tiles[0], ring)), ('FAB', (fx, fy, fv))):
        lo, hi = int(np.argmin(vs)), int(np.argmax(vs))
        print('%s  min %6.1f at %.5f,%.5f   max %6.1f at %.5f,%.5f   p0.5-p99.5 %.1f-%.1f'
              % (label, vs[lo] + dod(ys[lo], xs[lo]), ys[lo], xs[lo],
                 vs[hi] + dod(ys[hi], xs[hi]), ys[hi], xs[hi],
                 *(np.percentile(vs, [0.5, 99.5]) + dod(ys[lo], xs[lo]))))
    outlet = next(f for f in feats if f['properties'].get('kind') == 'outlet')
    olon, olat = outlet['geometry']['coordinates'][:2]
    print('outlet point (published %s m): COP %.1f  FAB %.1f m OD'
          % (outlet['properties']['elevation_m'], cop.sample(olat, olon) + dod(olat, olon),
             fab.sample(olat, olon) + dod(olat, olon)))

    print('\n== 7. Source of the withdrawn 34-228 m range (the original map)')
    tx, ty, tv = terrarium_in_ring(ring)
    lo, hi = int(np.argmin(tv)), int(np.argmax(tv))
    print('AWS Terrain Tiles z13 inside the polygon: min %.1f at %.5f,%.5f   max %.1f at %.5f,%.5f'
          % (tv[lo], ty[lo], tx[lo], tv[hi], ty[hi], tx[hi]))
    print('  same points: FAB %.1f / %.1f m OD' % (fab.sample(ty[lo], tx[lo]) + dod(ty[lo], tx[lo]),
                                                 fab.sample(ty[hi], tx[hi]) + dod(ty[hi], tx[hi])))
    try:
        raw = urllib.request.urlopen(OPW_CSV.format(s='18124'), timeout=60).read().decode()
        v = [(r['datetime'], float(r['value'])) for r in csv.DictReader(io.StringIO(raw))
             if r.get('value')]
        vals = np.array([x for _, x in v])
        print('OPW 18124 Fermoy U/S Rowing, 1.4 km downstream of the outlet, Malin Head OSGM15:')
        print('  %s to %s: water level %.2f-%.2f m OD, median %.2f (n=%d)'
              % (v[0][0], v[-1][0], vals.min(), vals.max(), np.median(vals), len(vals)))
    except Exception as e:  # the report stands without it; say so rather than hide it
        print('OPW 18124 data not available:', e)

    if not rows:
        return
    print('\n== Recording and photograph elevations printed on the site, re-derived')
    iph = [(float(r[3]), float(r[4]), float(r[5])) for r in rows
           if 'iPhone' in r[7] and r[5] != '-' and 52.10 < float(r[3]) < 52.14]
    if iph:
        d = [a - cop.sample(la, lo) - dod(la, lo) for la, lo, a in iph]
        print('iPhone fixes in the catchment, EXIF - COP(OD): median %+.1f m (n=%d); '
              'near 0 means the iPhone already reports height above sea level' % (np.median(d), len(d)))
    pages = ['site/index.njk', 'site/water/index.njk']
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seen = {}
    for page in pages:
        txt = open(os.path.join(root, page)).read()
        for pub, day, hm in re.findall(r'(\d+) m OD - (\d+) April 2026, (\d\d:\d\d)', txt):
            key = (int(day), hm)
            want = '2026:04:%02d %s' % key
            hit = sorted((r for r in rows if r[1].startswith(want) and r[5] != '-'),
                         key=lambda r: abs(float(r[5]) - int(pub)))
            if not hit:
                print('%-22s %4s m OD  %2s Apr %s  no photograph found' % (page, pub, day, hm))
                continue
            r = hit[0]
            la, lo, alt = float(r[3]), float(r[4]), float(r[5])
            k = dod(la, lo)
            c, fb = cop.sample(la, lo) + k, fab.sample(la, lo) + k
            dist = [metres(la, lo, a, b) for a, b in zip(glat, glon)]
            i = int(np.argmin(dist))
            gp = gele[i] if dist[i] <= 25 else None
            est = (c + gp) / 2 if gp is not None else c
            seen[key] = est
            print('%-22s %4s m OD  %2s Apr %s  %-26s %-17s EXIF %6.1f  COP %5.1f  FAB %5.1f  '
                  'GPX %s  -> about %d m'
                  % (page, pub, day, hm, r[0], r[7], alt, c, fb,
                     '%5.1f@%2.0fm' % (gp, dist[i]) if gp is not None else '   none  ',
                     5 * round(est / 5)))
    a, b = seen.get((11, '07:54')), seen.get((11, '08:07'))
    if a is not None and b is not None:
        print('the home page photograph pair (07:54, 08:07): estimates differ by %.1f m'
              % abs(a - b))
    la, lo = 52.11222, -8.32292
    print('at the highest Copernicus cell (%.5f, %.5f): COP - FAB %+.1f m' % (
        la, lo, cop.sample(la, lo) - fab.sample(la, lo)))


if __name__ == '__main__':
    main(sys.argv[1:])

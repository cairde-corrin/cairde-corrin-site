#!/usr/bin/env python3
"""Fetch the elevation model and geoid grids that cover the Glenabo catchment.

    python3 tools/fetch_dem.py

Downloads into ~/.cache/cairde-corrin-dem (or $DEM_CACHE), outside the repository.
Raster data is never committed. Needs Pillow and numpy only.

Sources
  Copernicus DEM GLO-30 Public, 1x1 degree COG tiles from the AWS open data bucket.
    Resolution  1 arcsecond in latitude, 1.5 arcseconds in longitude between 50 and
                60 N: about 31 m x 29 m at 52 N.
    Horizontal  WGS84 (EPSG:4326). Vertical: EGM2008 geoid heights (EPSG:3855).
                The file carries no vertical geokey; the datum is from the product
                specification.
    It is a surface model: heights are the top of the canopy and buildings, not the
    ground. Under trees it reads high.
    Licence     free to use and redistribute with attribution: "(c) DLR e.V.
                2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018 provided
                under COPERNICUS by the European Union and ESA; all rights reserved".
  EGM2008 geoid undulation, 2.5 arcminute grid, us_nga_egm08_25.tif from cdn.proj.org
    (NGA, public domain). Ellipsoid height = EGM2008 height + N.
  OSGM15 for Ireland, uk_os_OSGM15_Malin.tif from cdn.proj.org (Ordnance Survey /
    OSi / LPS, open licence). ETRS89 ellipsoid height = Malin Head OD + N.
"""
import json, math, os, re, sys, urllib.request

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the global geoid grid is 37 Mpx; trusted source
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('DEM_CACHE', os.path.expanduser('~/.cache/cairde-corrin-dem'))
GEOJSON = os.path.join(ROOT, 'site', 'assets', 'data', 'cairde-corrin.geojson')
GPX = os.path.join(ROOT, 'source-data', '2026-08-29_glenabo_loop.gpx')

COP = 'https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif'
GEOIDS = {'egm2008': 'https://cdn.proj.org/us_nga_egm08_25.tif',
          'osgm15': 'https://cdn.proj.org/uk_os_OSGM15_Malin.tif'}


def tile_name(lat, lon):
    la, lo = math.floor(lat), math.floor(lon)
    return 'Copernicus_DSM_COG_10_%s%02d_00_%s%03d_00_DEM' % (
        'N' if la >= 0 else 'S', abs(la), 'E' if lo >= 0 else 'W', abs(lo))


def area_points():
    """Every coordinate in the GeoJSON and the GPX, as (lat, lon)."""
    pts = []
    def walk(c):
        if isinstance(c[0], (int, float)):
            pts.append((c[1], c[0]))
        else:
            for x in c:
                walk(x)
    for f in json.load(open(GEOJSON))['features']:
        walk(f['geometry']['coordinates'])
    if os.path.exists(GPX):
        pts += [(float(a), float(b)) for a, b in
                re.findall(r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)"', open(GPX).read())]
    return pts


def download(url, path):
    if os.path.exists(path):
        return path
    os.makedirs(CACHE, exist_ok=True)
    print('fetching', url, file=sys.stderr)
    tmp = path + '.part'
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, path)  # no half-written file left in the cache if it fails
    return path


def fetch():
    """Download whatever is missing. Returns {'dem': [paths], 'egm2008': p, 'osgm15': p}."""
    names = sorted({tile_name(la, lo) for la, lo in area_points()})
    out = {'dem': [download(COP.format(n=n), os.path.join(CACHE, n + '.tif')) for n in names]}
    for k, url in GEOIDS.items():
        out[k] = download(url, os.path.join(CACHE, url.rsplit('/', 1)[1]))
    return out


class Raster:
    """A north-up geographic GeoTIFF read with Pillow, sampled bilinearly."""

    def __init__(self, path):
        im = Image.open(path)
        t = im.tag_v2
        self.a = np.asarray(im, dtype=np.float64)
        self.dx, self.dy = t[33550][0], t[33550][1]
        i, j, _, lon0, lat0, _ = t[33922][:6]
        keys = t.get(34735) or ()
        geo = {keys[k]: keys[k + 3] for k in range(4, len(keys), 4)}
        # GTRasterTypeGeoKey 2 = PixelIsPoint: the tie point is a pixel centre.
        half = 0.0 if geo.get(1025) == 2 else 0.5
        self.lon0 = lon0 + (half - i) * self.dx  # centre of pixel column 0
        self.lat0 = lat0 - (half - j) * self.dy  # centre of pixel row 0

    def contains(self, lat, lon):
        x, y = self._xy(lat, lon)
        return 0 <= x <= self.a.shape[1] - 1 and 0 <= y <= self.a.shape[0] - 1

    def _xy(self, lat, lon):
        x = (lon - self.lon0) / self.dx
        if self.a.shape[1] * self.dx >= 359.9:  # global grid: wrap longitude
            x %= self.a.shape[1]
        return x, (self.lat0 - lat) / self.dy

    def sample(self, lat, lon):
        x, y = self._xy(lat, lon)
        x0, y0 = int(math.floor(x)), int(math.floor(y))
        x1, y1 = min(x0 + 1, self.a.shape[1] - 1), min(y0 + 1, self.a.shape[0] - 1)
        fx, fy = x - x0, y - y0
        a = self.a
        return ((a[y0, x0] * (1 - fx) + a[y0, x1] * fx) * (1 - fy) +
                (a[y1, x0] * (1 - fx) + a[y1, x1] * fx) * fy)

    def centres(self):
        """Longitude and latitude of every pixel centre, as 1-D arrays."""
        return (self.lon0 + np.arange(self.a.shape[1]) * self.dx,
                self.lat0 - np.arange(self.a.shape[0]) * self.dy)


class Mosaic:
    def __init__(self, paths):
        self.tiles = [Raster(p) for p in paths]

    def sample(self, lat, lon):
        for t in self.tiles:
            if t.contains(lat, lon):
                return t.sample(lat, lon)
        raise ValueError('no DEM tile covers %.5f, %.5f' % (lat, lon))


if __name__ == '__main__':
    got = fetch()
    for k, v in got.items():
        for p in (v if isinstance(v, list) else [v]):
            print('%-8s %6.1f MB  %s' % (k, os.path.getsize(p) / 1e6, p))

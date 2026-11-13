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
  FABDEM V1-2 (Neal and Hawker, University of Bristol): Copernicus GLO-30 with forest
    and building heights removed, a modelled bare-earth surface. Same 1" grid and
    EGM2008 heights as Copernicus. Licence CC BY-NC-SA 4.0, non-commercial only;
    commercial use is licensed separately by Fathom. Distributed only as 10x10 degree
    zips (the one for Ireland is 949 MB), so the single 1x1 degree tile is read out of
    the zip with HTTP range requests.
    Citation: Jeffrey Neal, Laurence Hawker (2023): FABDEM V1-2.
    https://doi.org/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn
  EGM2008 geoid undulation, 2.5 arcminute grid, us_nga_egm08_25.tif from cdn.proj.org
    (NGA, public domain). Ellipsoid height = EGM2008 height + N.
  OSGM15 for Ireland, uk_os_OSGM15_Malin.tif from cdn.proj.org (Ordnance Survey /
    OSi / LPS, open licence). ETRS89 ellipsoid height = Malin Head OD + N.
"""
import io, json, math, os, re, sys, urllib.request, zipfile

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the global geoid grid is 37 Mpx; trusted source
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('DEM_CACHE', os.path.expanduser('~/.cache/cairde-corrin-dem'))
GEOJSON = os.path.join(ROOT, 'site', 'assets', 'data', 'cairde-corrin.geojson')
GPX = os.path.join(ROOT, 'archive', 'source-data', '2026-08-29_glenabo_loop.gpx')

COP = 'https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif'
FABDEM = 'https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/'
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


class _HttpFile(io.RawIOBase):
    """A remote file that zipfile can seek in, read with HTTP Range requests."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        req = urllib.request.Request(url, method='HEAD')
        self.size = int(urllib.request.urlopen(req, timeout=60).headers['Content-Length'])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def readinto(self, b):
        if self.pos >= self.size:
            return 0
        end = min(self.pos + len(b), self.size) - 1
        req = urllib.request.Request(self.url, headers={'Range': 'bytes=%d-%d' % (self.pos, end)})
        data = urllib.request.urlopen(req, timeout=120).read()
        b[:len(data)] = data
        self.pos += len(data)
        return len(data)


def fabdem_tile(lat, lon):
    """Extract one FABDEM 1x1 degree tile from its 10x10 degree zip, by range requests."""
    la, lo = math.floor(lat), math.floor(lon)
    tile = '%s%02d%s%03d' % ('N' if la >= 0 else 'S', abs(la), 'E' if lo >= 0 else 'W', abs(lo))
    path = os.path.join(CACHE, tile + '_FABDEM_V1-2.tif')
    if os.path.exists(path):
        return path
    l10, o10 = la // 10 * 10, lo // 10 * 10
    corner = lambda a, o: '%s%02d%s%03d' % ('N' if a >= 0 else 'S', abs(a),
                                            'E' if o >= 0 else 'W', abs(o))
    url = FABDEM + '%s-%s_FABDEM_V1-2.zip' % (corner(l10, o10), corner(l10 + 10, o10 + 10))
    print('reading', tile, 'from', url, file=sys.stderr)
    with zipfile.ZipFile(io.BufferedReader(_HttpFile(url), 1 << 20)) as z:
        member = next(n for n in z.namelist() if n.endswith(tile + '_FABDEM_V1-2.tif'))
        os.makedirs(CACHE, exist_ok=True)
        with z.open(member) as src, open(path + '.part', 'wb') as dst:
            dst.write(src.read())  # zipfile checks the CRC on read
    os.replace(path + '.part', path)
    return path


def fetch():
    """Download whatever is missing.
    Returns {'dem': [paths], 'fabdem': [paths], 'egm2008': p, 'osgm15': p}."""
    corners = {(math.floor(la), math.floor(lo)) for la, lo in area_points()}
    names = sorted({tile_name(la, lo) for la, lo in corners})
    out = {'dem': [download(COP.format(n=n), os.path.join(CACHE, n + '.tif')) for n in names],
           'fabdem': [fabdem_tile(la, lo) for la, lo in sorted(corners)]}
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

#!/usr/bin/env python3
"""Cut the elevation grid the build and the editor use to give a height for a position.

    python3 tools/fetch_dem.py && python3 tools/dem_clip.py

Reads the Copernicus GLO-30 tile and the EGM2008 and OSGM15 geoid grids that
fetch_dem.py keeps in its cache, cuts the model to the proposed action area plus about
500 m, converts every cell to metres above Malin Head OD (EGM2008 height + N(EGM2008) -
N(OSGM15), as dem_report.py does), and writes

    site/admin/dem/copernicus-od.bin    little-endian int16, decimetres, row by row from the north
    site/admin/dem/copernicus-od.json   its grid, source, method and licence

This small cut is the one piece of raster data kept in the repository: the build reads it
to give a new stop its height (site/_includes/blocks.js), and the editor reads it to put
a height in a photo's caption (site/admin/editor.js). The full tiles stay in the cache.
Copernicus GLO-30 may be redistributed with its attribution, which the credits page
carries; FABDEM, whose licence does not suit a public repository, is not used.

It is a surface model: under trees it reads a few metres high (dem_report.py measures
+2.5 m at the three recorded stops), which is why its heights are given to the nearest
5 m. Rerun only if the action area grows past the grid; check the stops it prints.
"""
import json, os, struct, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_dem import GEOJSON, Mosaic, Raster, fetch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site', 'admin', 'dem')
MARGIN = 0.005  # degrees, about 550 m north-south and 340 m east-west


def main():
    g = fetch()
    cop = Mosaic(g['dem'])
    egm, osg = Raster(g['egm2008']), Raster(g['osgm15'])
    feats = json.load(open(GEOJSON, encoding='utf-8'))['features']
    area = next(f for f in feats if f['properties']['name'] == 'Proposed area for action')
    ring = area['geometry']['coordinates'][0]
    w, e = min(p[0] for p in ring) - MARGIN, max(p[0] for p in ring) + MARGIN
    s, n = min(p[1] for p in ring) - MARGIN, max(p[1] for p in ring) + MARGIN
    t = cop.tiles[0]
    dx, dy = t.dx, t.dy
    # on the model's own cell centres, so the grid holds its values, not a resampling of them
    w = t.lon0 + np.floor((w - t.lon0) / dx) * dx
    n = t.lat0 - np.floor((t.lat0 - n) / dy) * dy
    cols, rows = int(round((e - w) / dx)) + 1, int(round((n - s) / dy)) + 1
    lons = w + np.arange(cols) * dx
    lats = n - np.arange(rows) * dy
    grid = np.empty((rows, cols), dtype=np.int16)
    for r, lat in enumerate(lats):
        for c, lon in enumerate(lons):
            od = cop.sample(lat, lon) + egm.sample(lat, lon) - osg.sample(lat, lon)
            grid[r, c] = int(round(od * 10))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'copernicus-od.bin'), 'wb') as fh:
        fh.write(grid.astype('<i2').tobytes())
    meta = {
        'west': float(w), 'north': float(n), 'dx': dx, 'dy': dy, 'cols': cols, 'rows': rows, 'scale': 0.1,
        'units': 'metres above Malin Head OD (OSGM15)',
        'source': 'Copernicus DEM GLO-30, converted from EGM2008 heights with the EGM2008 and OSGM15 geoid grids (tools/dem_clip.py)',
        'attribution': '(c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
        'method': 'Copernicus GLO-30 at the position, bilinear, in metres above Malin Head OD, rounded to the nearest 5 m. A surface model: under trees it reads a few metres high.',
    }
    json.dump(meta, open(os.path.join(OUT, 'copernicus-od.json'), 'w', encoding='utf-8'), indent=1)
    print('wrote %d x %d cells (%.1f KB), %.5f..%.5f N, %.5f..%.5f E' % (cols, rows, grid.nbytes / 1024, s, n, w, e))
    for f in feats:
        p = f['properties']
        if p.get('kind') == 'stop':
            lon, lat = f['geometry']['coordinates'][:2]
            print('  %-28s published %s m, grid %.1f m OD' % (p['name'], p['elevation_m'],
                  cop.sample(lat, lon) + egm.sample(lat, lon) - osg.sample(lat, lon)))


if __name__ == '__main__':
    main()

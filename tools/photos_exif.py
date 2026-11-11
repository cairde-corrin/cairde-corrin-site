#!/usr/bin/env python3
"""Report which archive photographs fall inside the catchment.

    python3 tools/photos_exif.py "/path/to/CairdeCorrin" "/path/to/CairdeCorrin 2"

Needs exiftool. This is how stops 1-3 were placed: positions and elevations
come out of the photograph EXIF, never from estimation.
"""
import json, math, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOJSON = os.path.join(ROOT, 'site', 'assets', 'data', 'cairde-corrin.geojson')

def rings():
    out = {}
    for f in json.load(open(GEOJSON))['features']:
        if f['geometry']['type'] != 'Polygon':
            continue
        name = (f['properties'].get('name') or '') + ' ' + (f['properties'].get('kind') or '')
        if 'atchment' in name:
            out['catchment'] = f['geometry']['coordinates'][0]
        elif 'ction' in name:
            out['action'] = f['geometry']['coordinates'][0]
    return out

def inside(ring, lon, lat):
    """Ray casting. Good enough at this scale; the rings have 500-1500 points."""
    n, ins, j = len(ring), False, len(ring) - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            ins = not ins
        j = i
    return ins

def main(dirs):
    r = rings()
    fmt = '$directory/$filename|$gpslatitude|$gpslongitude|$gpsaltitude|$createdate|$imagewidth|$imageheight'
    raw = subprocess.run(['exiftool', '-q', '-r', '-n', '-if', '$gpslatitude', '-p', fmt, *dirs],
                         capture_output=True, text=True).stdout
    counts = {'catchment': 0, 'action': 0, 'outside': 0}
    rows = []
    for line in raw.splitlines():
        path, lat, lon, alt, dt, w, h = line.split('|')
        lat, lon = float(lat), float(lon)
        where = ('catchment' if inside(r['catchment'], lon, lat)
                 else 'action' if inside(r.get('action', []), lon, lat) else 'outside')
        counts[where] += 1
        rows.append((dt, where, float(alt) if alt else 0.0, f'{w}x{h}', os.path.basename(path)))
    for dt, where, alt, size, name in sorted(rows):
        print(f'{dt}  {where:9} {alt:7.1f} m  {size:11} {name}')
    print('\n' + '  '.join(f'{k}: {v}' for k, v in counts.items()))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])

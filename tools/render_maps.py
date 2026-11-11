#!/usr/bin/env python3
"""Render the two static maps on the home page from the shipped data.

    python3 tools/render_maps.py

Writes site/assets/img/map-catchment-{1800,1000}.webp and map-action-{1800,1000}.webp.
Each map is laid out as an HTML page and photographed by headless Chrome at the size
the page already reserves for it, so nothing on the site shifts.

Sources, all credited in each map's footer:
  boundary, action area, channel network, outlet  site/assets/data/cairde-corrin.geojson
  shaded relief and tint                          Copernicus GLO-30, via tools/fetch_dem.py
  woodland, water, roads, place names             OpenStreetMap, via Overpass, cached in
                                                  ~/.cache/cairde-corrin-dem
Figures in the title box are read from the data file's properties, not typed here.
"""
import html, json, math, os, subprocess, tempfile

import numpy as np
from PIL import Image

from fetch_dem import CACHE, GEOJSON, Raster, fetch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'site', 'assets', 'img')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OVERPASS = 'https://overpass-api.de/api/interpreter'
OSM_BBOX = (52.085, -8.38, 52.16, -8.22)  # south, west, north, east
R = 6378137.0
FRAME = (74, 213, 1652, 1233)  # x, y, width, height of the map frame in an 1800 px canvas
SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'

# Labels where OpenStreetMap carries no usable name or point. Positions read off the
# group's original action-area map; they place text, they are not data.
FALLBACK = {'Corrin Hill': (52.1149, -8.2822), 'Knockananig Reservoir': (52.1192, -8.3373),
            'Glenabo Wood': (52.1300, -8.2905), 'Fermoy': (52.1386, -8.2766)}

COPERNICUS = ('Elevation data © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH '
              '2014-2018, provided under COPERNICUS by the European Union and ESA')
CHANNELS = ('Channel network modelled for the group\'s original map from AWS Terrain Tiles '
            '(EU-DEM, produced using Copernicus data and information funded by the European '
            'Union), clipped to the boundary, not walked')
OSM = 'Woodland, open water, roads and settlement © OpenStreetMap contributors (ODbL)'


def osm():
    path = os.path.join(CACHE, 'osm_glenabo.json')
    if not os.path.exists(path):
        s, w, n, e = OSM_BBOX
        b = '(%s,%s,%s,%s)' % (s, w, n, e)
        q = ('[out:json][timeout:90];(' +
             ''.join('%s["%s"~"%s"]%s;' % (t, k, v, b) for t in ('way', 'relation')
                     for k, v in (('landuse', '^forest$'), ('natural', '^(wood|water)$'),
                                  ('landuse', '^reservoir$'))) +
             'way["waterway"~"^(river|stream|ditch|drain|canal)$"]%s;' % b +
             'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|'
             'residential|motorway_link|trunk_link)$"]%s;' % b +
             'way["railway"="rail"]%s;node["place"~"^(town|village)$"]%s;'
             'node["natural"="peak"]%s;);out geom;' % (b, b, b))
        # curl rather than urllib: the system Python's TLS cannot handshake with Overpass
        os.makedirs(CACHE, exist_ok=True)
        subprocess.run(['curl', '-sS', '--fail', '-m', '180', '-A', 'map-render-script/1.0',
                        '--data-urlencode', 'data=' + q, '-o', path + '.part', OVERPASS], check=True)
        json.load(open(path + '.part'))  # refuse to cache an error page
        os.replace(path + '.part', path)
    return json.load(open(path))['elements']


class Proj:
    """Web Mercator into frame pixels, centred on (lat, lon) at px_per_m on the ground."""

    def __init__(self, lat, lon, px_per_m):
        self.lat, self.lon = lat, lon
        self.m = px_per_m * math.cos(math.radians(lat))  # px per Mercator metre
        self.y0 = self.merc(lat)

    @staticmethod
    def merc(lat):
        return R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

    def xy(self, lat, lon):
        return (FRAME[2] / 2 + self.m * R * math.radians(lon - self.lon),
                FRAME[3] / 2 - self.m * (self.merc(lat) - self.y0))

    def lonlat_grid(self):
        xs = np.arange(FRAME[2]) + 0.5 - FRAME[2] / 2
        ys = FRAME[3] / 2 - (np.arange(FRAME[3]) + 0.5)
        lon = self.lon + np.degrees(xs / (self.m * R))
        lat = np.degrees(2 * np.arctan(np.exp((self.y0 + ys / self.m) / R)) - math.pi / 2)
        return lon, lat

    def path(self, coords, close=False):
        pts = ['%.1f,%.1f' % self.xy(c[1], c[0]) for c in coords]
        return 'M' + 'L'.join(pts) + ('Z' if close else '')


def relief(proj, cop):
    """Shaded, tinted relief for the frame, as an RGB array."""
    lons, lats = cop.centres()
    lon, lat = proj.lonlat_grid()
    ci = np.where((lons >= lon.min() - .01) & (lons <= lon.max() + .01))[0]
    ri = np.where((lats >= lat.min() - .01) & (lats <= lat.max() + .01))[0]
    z = cop.a[np.ix_(ri, ci)]
    dy = math.radians(cop.dy) * 6371000
    dx = math.radians(cop.dx) * 6371000 * math.cos(math.radians(proj.lat))
    gy, gx = np.gradient(z * 1.6, dy, dx)  # 1.6x vertical exaggeration for gentle ground
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(45)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    # resample to the frame (separable: Mercator rows depend only on lat, columns on lon)
    fr = np.interp(lat, lats[ri][::-1], np.arange(len(ri))[::-1])
    fc = np.interp(lon, lons[ci], np.arange(len(ci)))
    r0, c0 = np.floor(fr).astype(int), np.floor(fc).astype(int)
    r1, c1 = np.minimum(r0 + 1, len(ri) - 1), np.minimum(c0 + 1, len(ci) - 1)
    wr, wc = (fr - r0)[:, None], (fc - c0)[None, :]
    bil = lambda a: ((a[np.ix_(r0, c0)] * (1 - wc) + a[np.ix_(r0, c1)] * wc) * (1 - wr) +
                     (a[np.ix_(r1, c0)] * (1 - wc) + a[np.ix_(r1, c1)] * wc) * wr)
    h, s = bil(z), bil(shade)
    stops = [(0, (205, 226, 196)), (60, (220, 232, 200)), (110, (236, 230, 196)),
             (160, (232, 212, 168)), (230, (214, 182, 138))]
    rgb = np.zeros(h.shape + (3,))
    for k in range(3):
        rgb[..., k] = np.interp(h, [p for p, _ in stops], [c[k] for _, c in stops])
    rgb *= np.clip(0.62 + 0.55 * s, 0.45, 1.12)[..., None]
    return np.clip(rgb, 0, 255).astype(np.uint8)


def stitch(parts):
    """Join multipolygon member ways that share end nodes into closed rings.
    Rings that cannot be closed are dropped: filling them would draw false chords."""
    parts, rings = [list(p) for p in parts], []
    while parts:
        ring = parts.pop(0)
        while ring[0] != ring[-1]:
            for i, p in enumerate(parts):
                if p[0] == ring[-1]:
                    ring += p[1:]
                elif p[-1] == ring[-1]:
                    ring += p[::-1][1:]
                else:
                    continue
                parts.pop(i)
                break
            else:
                break
        if ring[0] == ring[-1] and len(ring) > 3:
            rings.append(ring)
    return rings


def osm_svg(proj, els, layer):
    out = []
    for e in els:
        t = e.get('tags', {})
        geoms = []
        if e['type'] == 'way' and 'geometry' in e:
            geoms = [[(g['lon'], g['lat']) for g in e['geometry']]]
        elif e['type'] == 'relation':
            geoms = [[(g['lon'], g['lat']) for g in m['geometry']]
                     for m in e.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
        area = layer in ('wood', 'water')
        if area:  # polygons: closed ways as they are, relation members stitched into rings
            geoms = (stitch(geoms) if e['type'] == 'relation'
                     else [g for g in geoms if g[0] == g[-1] and len(g) > 3])
        for g in geoms:
            if layer == 'wood' and (t.get('landuse') == 'forest' or t.get('natural') == 'wood'):
                out.append('<path d="%s" fill="#6f9f6a" fill-opacity=".42" stroke="#5f8c5a" '
                           'stroke-opacity=".55" stroke-width="1"/>' % proj.path(g, True))
            elif layer == 'water' and (t.get('natural') == 'water' or t.get('landuse') == 'reservoir'):
                out.append('<path d="%s" fill="#2f6d9e" stroke="#21557f" stroke-width="1.2"/>'
                           % proj.path(g, True))
            elif layer == 'roads' and 'highway' in t:
                hw = t['highway']
                w, c = ((4.5, '#9a9282') if hw.startswith(('motorway', 'trunk')) else
                        (2.4, '#a29c8e') if hw in ('primary', 'secondary') else (1.3, '#aaa598'))
                out.append('<path d="%s" fill="none" stroke="%s" stroke-width="%s" '
                           'stroke-linecap="round" stroke-opacity=".85"/>' % (proj.path(g), c, w))
            elif layer == 'rail' and t.get('railway') == 'rail':
                out.append('<path d="%s" fill="none" stroke="#8d8a84" stroke-width="2" '
                           'stroke-dasharray="7 5"/>' % proj.path(g))
            elif layer == 'streams' and t.get('waterway') in ('stream', 'ditch', 'drain', 'canal'):
                out.append('<path d="%s" fill="none" stroke="#7aa6d6" stroke-width="1.6" '
                           'stroke-opacity=".9"/>' % proj.path(g))
            elif layer == 'river' and t.get('waterway') == 'river':
                out.append('<path d="%s" fill="none" stroke="#2e6496" stroke-width="6" '
                           'stroke-linecap="round"/>' % proj.path(g))
    return '\n'.join(out)


def find(els, test, key):
    """A named OSM point or polygon centroid as (lat, lon, 'OSM'), else the fallback."""
    for e in els:
        if test(e.get('tags', {})):
            if e['type'] == 'node':
                return e['lat'], e['lon'], 'OSM'
            g = e.get('geometry') or [p for m in e.get('members', []) for p in m.get('geometry', [])]
            if g:
                return (sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g), 'OSM')
    return FALLBACK[key] + ('fallback',)


def label(proj, lat, lon, text, size=26, weight=400, italic=False, color='#1b2a44', dy=0):
    x, y = proj.xy(lat, lon)
    return ('<text x="%.1f" y="%.1f" font-family=\'%s\' font-size="%d" font-weight="%d" '
            'font-style="%s" fill="%s" text-anchor="middle" stroke="#fff" stroke-width="5" '
            'stroke-opacity=".85" paint-order="stroke">%s</text>'
            % (x, y + dy, SANS, size, weight, 'italic' if italic else 'normal', color,
               html.escape(text)))


def scalebar(proj, km, step):
    px = proj.m / math.cos(math.radians(proj.lat)) * 1000  # px per ground km
    x0, y0 = 90, FRAME[3] - 70
    parts = ['<rect x="%d" y="%d" width="%.1f" height="12" fill="#fff" stroke="#222" '
             'stroke-width="1.5"/>' % (x0, y0, km * px)]
    n = int(round(km / step))
    for i in range(0, n, 2):
        parts.append('<rect x="%.1f" y="%d" width="%.1f" height="12" fill="#222"/>'
                     % (x0 + i * step * px, y0, step * px))
    for i in range(n + 1):
        parts.append('<text x="%.1f" y="%d" font-family=\'%s\' font-size="20" '
                     'text-anchor="middle" fill="#222">%s</text>'
                     % (x0 + i * step * px, y0 - 10, SANS, ('%g' % (i * step)) + (' km' if i == n else '')))
    return '\n'.join(parts)


def north():
    return ('<g transform="translate(60,250)"><rect x="-32" y="-30" width="64" height="104" '
            'rx="4" fill="#fff" fill-opacity=".9" stroke="#ccc"/><text x="0" y="-38" '
            'font-family=\'%s\' font-size="26" font-weight="700" text-anchor="middle">N</text>'
            '<path d="M0,-12 L0,62" stroke="#222" stroke-width="4"/><path d="M-9,4 L0,-16 L9,4Z" '
            'fill="#222"/></g>' % SANS)


def legend(rows, x, y, w):
    h = 22 + 36 * len(rows)
    out = ['<g transform="translate(%d,%d)"><rect width="%d" height="%d" rx="6" fill="#fff" '
           'fill-opacity=".94" stroke="#bbb"/>' % (x, y, w, h)]
    for i, (sym, text) in enumerate(rows):
        yy = 30 + 36 * i
        out.append('<g transform="translate(18,%d)">%s</g><text x="76" y="%d" font-family=\'%s\' '
                   'font-size="21" fill="#1b2a44" dominant-baseline="middle">%s</text>'
                   % (yy, sym, yy, SANS, html.escape(text)))
    out.append('</g>')
    return '\n'.join(out)


SYM = {
    'catch': '<path d="M0,0 L44,0" stroke="#8b1a1a" stroke-width="5"/>',
    'catch_thin': '<path d="M0,0 L44,0" stroke="#8b1a1a" stroke-width="3"/>',
    'action': '<path d="M0,0 L44,0" stroke="#1f4d2b" stroke-width="5" stroke-dasharray="11 6"/>',
    'chan': '<path d="M0,0 L44,0" stroke="#2a5f99" stroke-width="3"/>',
    'water_line': '<path d="M0,0 L44,0" stroke="#2e6496" stroke-width="4"/>',
    'outlet': '<path d="M14,-10 L30,-10 L22,8Z" fill="#f2b84b" stroke="#7a1b12" stroke-width="2"/>',
    'wood': '<rect x="2" y="-10" width="40" height="20" fill="#6f9f6a" fill-opacity=".6" stroke="#5f8c5a"/>',
    'water': '<rect x="2" y="-10" width="40" height="20" fill="#2f6d9e" stroke="#21557f"/>',
}


def page(canvas_h, title, subtitle, box, svg, footer):
    fx, fy, fw, fh = FRAME
    boxhtml = ''
    if box:
        rows = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (html.escape(k), html.escape(v))
                       for k, v in box)
        boxhtml = '<table class="box">%s</table>' % rows
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1800px;height:{canvas_h}px;background:#fff;overflow:hidden}}
body{{font-family:{SANS};color:#1b2a44;position:relative}}
h1{{position:absolute;left:{fx}px;top:34px;margin:0;font-size:42px;font-weight:700;letter-spacing:-.2px}}
.sub{{position:absolute;left:{fx}px;top:100px;font-size:23px;color:#444}}
.box{{position:absolute;right:{1800 - fx - fw}px;top:24px;border:2px solid #c9ccc1;border-radius:10px;
  background:#f4f5ef;font-family:Menlo,monospace;font-size:17px;border-spacing:14px 3px;padding:6px 4px}}
.box td:first-child{{text-align:right;color:#333}}
.frame{{position:absolute;left:{fx}px;top:{fy}px;width:{fw}px;height:{fh}px;border:2px solid #444;
  box-sizing:content-box;overflow:hidden}}
.frame img,.frame svg{{position:absolute;left:0;top:0;width:{fw}px;height:{fh}px}}
.foot{{position:absolute;left:{fx}px;top:{fy + fh + 14}px;width:{fw}px;font-size:14px;line-height:1.38;color:#555}}
</style></head><body>
<h1>{html.escape(title)}</h1><div class="sub">{html.escape(subtitle)}</div>{boxhtml}
<div class="frame"><img src="relief.png" alt=""><svg viewBox="0 0 {fw} {fh}" xmlns="http://www.w3.org/2000/svg">{svg}</svg></div>
<div class="foot">{html.escape(footer)}</div></body></html>'''


def shoot(html_text, relief_rgb, canvas_h, name):
    d = tempfile.mkdtemp(dir=CACHE)
    Image.fromarray(relief_rgb).save(os.path.join(d, 'relief.png'))
    p = os.path.join(d, 'map.html')
    open(p, 'w', encoding='utf-8').write(html_text)
    png = os.path.join(d, 'shot.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--window-size=1800,%d' % canvas_h,
                    '--screenshot=' + png, 'file://' + p], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png).convert('RGB')
    assert im.size == (1800, canvas_h), im.size
    im.save(os.path.join(IMG, name + '-1800.webp'), 'WEBP', quality=82, method=6)
    small = im.resize((1000, round(canvas_h * 1000 / 1800)), Image.LANCZOS)
    small.save(os.path.join(IMG, name + '-1000.webp'), 'WEBP', quality=82, method=6)
    print('wrote %s-1800.webp %s and -1000.webp %s  (%s)' % (name, im.size, small.size, d))


def main():
    g = fetch()
    cop = Raster(g['dem'][0])
    F = {f['properties']['name']: f for f in json.load(open(GEOJSON))['features']}
    catch_f, action_f = F['Glenabo hydrological catchment'], F['Proposed area for action']
    catch, action = catch_f['geometry']['coordinates'][0], action_f['geometry']['coordinates'][0]
    chans = F['Modelled channel network']['geometry']['coordinates']
    olon, olat = F['Catchment outlet']['geometry']['coordinates'][:2]
    els = osm()
    cp = catch_f['properties']
    km2, ha = cp['stated_area_km2'], int(round(cp['stated_area_km2'] * 100))
    elev = '%d-%d m OD' % (cp['elevation_min_m'], cp['elevation_max_m'])
    flow = 'about %d km' % round(cp['longest_flow_path_km'])
    act_km2 = action_f['properties']['stated_area_km2']

    res = find(els, lambda t: 'knockananig' in t.get('name', '').lower(), 'Knockananig Reservoir')
    corrin = find(els, lambda t: t.get('natural') == 'peak' and 'corrin' in t.get('name', '').lower(),
                  'Corrin Hill')
    wood = find(els, lambda t: 'glenabo' in t.get('name', '').lower() and
                (t.get('natural') == 'wood' or t.get('landuse') == 'forest'), 'Glenabo Wood')
    fermoy = find(els, lambda t: t.get('name') == 'Fermoy' and t.get('place'), 'Fermoy')
    print('label sources: reservoir %s, Corrin Hill %s, Glenabo Wood %s, Fermoy %s'
          % (res[2], corrin[2], wood[2], fermoy[2]))
    res, corrin, wood, fermoy = res[:2], corrin[:2], wood[:2], fermoy[:2]

    def base(proj):
        return '\n'.join(osm_svg(proj, els, k) for k in ('wood', 'roads', 'rail', 'streams', 'water', 'river'))

    fw, fh = FRAME[2], FRAME[3]
    foot_tail = '%s. %s. %s. Web Mercator projection.' % (COPERNICUS, CHANNELS, OSM)

    # ---- catchment map ----
    proj = Proj(52.1255, -8.3075, 0.31)
    outside = 'M0,0H%dV%dH0Z ' % (fw, fh) + proj.path(catch, True)
    svg = [base(proj),
           '<path d="%s" fill="#fff" fill-opacity=".38" fill-rule="evenodd"/>' % outside,
           ''.join('<path d="%s" fill="none" stroke="#2a5f99" stroke-width="2.4" '
                   'stroke-linejoin="round"/>' % proj.path(c) for c in chans),
           '<path d="%s" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>'
           % proj.path(catch, True),
           '<path d="%s" fill="none" stroke="#8b1a1a" stroke-width="5" stroke-linejoin="round"/>'
           % proj.path(catch, True)]
    ox, oy = proj.xy(olat, olon)
    svg += ['<path d="M%.1f,%.1f l-13,-22 h26Z" fill="#f2b84b" stroke="#7a1b12" stroke-width="2.5"/>'
            % (ox, oy + 8),
            '<path d="M%.1f,%.1f L%.1f,%.1f" stroke="#333" stroke-width="2"/>'
            % (ox + 8, oy - 10, ox + 170, oy - 120),
            '<text font-family=\'%s\' font-size="24" fill="#1b2a44" stroke="#fff" stroke-width="5" '
            'paint-order="stroke"><tspan x="%.1f" y="%.1f">Outlet - confluence with</tspan>'
            '<tspan x="%.1f" dy="28">the Munster Blackwater</tspan></text>'
            % (SANS, ox + 175, oy - 150, ox + 175),
            label(proj, 52.1442, -8.3135, 'Munster Blackwater', 26, italic=True, color='#1d4f7a'),
            label(proj, *wood, 'Glenabo Wood', 25, italic=True, color='#2b4a2b'),
            label(proj, *res, 'Knockananig Reservoir', 22, color='#1d4f7a', dy=50),
            label(proj, *fermoy, 'FERMOY', 32, 700),
            north(), scalebar(proj, 1, 0.5),
            legend([(SYM['catch'], 'Catchment boundary - about %d ha' % ha),
                    (SYM['chan'], 'Channel network (modelled)'),
                    (SYM['outlet'], 'Catchment outlet'),
                    (SYM['wood'], 'Woodland / forestry'), (SYM['water'], 'Open water')],
                   fw - 470, fh - 222, 450)]
    box = [('Catchment area', 'about %.1f km² (about %d ha)' % (km2, ha)),
           ('Elevation range', elev), ('Longest flow path', flow),
           ('Outlet', '%.4f°N %.4f°W' % (olat, abs(olon))),
           ('Receiving water', cp['receiving_water'])]
    foot = ('Catchment boundary flow-routed on the Copernicus GLO-30 elevation model (1 arc-second, '
            'about 30 m) from the Glenabo\'s confluence with the Munster Blackwater, by priority-flood '
            'depression filling and D8 flow routing; shaded relief from the same model. ' + foot_tail +
            ' Indicative boundary - for planning and discussion, not a substitute for field survey.')
    shoot(page(1547, 'Glenabo (Glenaboy) River - hydrological catchment',
               'Fermoy, Co. Cork  ·  the surface-water area draining to the Munster Blackwater',
               box, '\n'.join(svg), foot), relief(proj, cop), 1547, 'map-catchment')

    # ---- action-area map ----
    proj = Proj(52.1212, -8.2965, 0.212)
    svg = [base(proj),
           ''.join('<path d="%s" fill="none" stroke="#2a5f99" stroke-width="1.6"/>'
                   % proj.path(c) for c in chans),
           '<path d="%s" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-width="10" '
           'stroke-linejoin="round"/>' % proj.path(action, True),
           '<path d="%s" fill="none" stroke="#1f4d2b" stroke-width="5" stroke-dasharray="16 9" '
           'stroke-linejoin="round"/>' % proj.path(action, True),
           '<path d="%s" fill="none" stroke="#8b1a1a" stroke-width="3" stroke-linejoin="round"/>'
           % proj.path(catch, True)]
    ox, oy = proj.xy(olat, olon)
    cx, cy = proj.xy(*corrin)
    svg += ['<path d="M%.1f,%.1f l-11,-19 h22Z" fill="#f2b84b" stroke="#7a1b12" stroke-width="2.2"/>'
            % (ox, oy + 7),
            '<path d="M%.1f,%.1f l-7,12 h14Z" fill="#222"/>' % (cx, cy - 6),
            label(proj, 52.1445, -8.3135, 'Munster Blackwater', 24, italic=True, color='#1d4f7a'),
            label(proj, 52.1205, -8.3050, 'Glenabo', 24, 700, color='#8b1a1a', dy=-14),
            label(proj, 52.1205, -8.3050, 'catchment', 24, 700, color='#8b1a1a', dy=14),
            label(proj, *wood, 'Glenabo Wood', 21, italic=True, color='#2b4a2b'),
            label(proj, *res, 'Knockananig Reservoir', 21, color='#1d4f7a', dy=44),
            label(proj, *corrin, 'Corrin Hill & Corrin Wood', 22, dy=-26),
            label(proj, *fermoy, 'FERMOY', 30, 700),
            north(), scalebar(proj, 2, 1),
            legend([(SYM['action'], 'Proposed area for action - %g km² (about %d ha)'
                     % (act_km2, round(act_km2 * 100, -1))),
                    (SYM['catch_thin'], 'Glenabo catchment - about %d ha' % ha),
                    (SYM['water_line'], 'Watercourse'), (SYM['wood'], 'Woodland / forestry'),
                    (SYM['water'], 'Open water'), (SYM['outlet'], 'Glenabo outlet to the Blackwater')],
                   fw - 560, fh - 252, 540)]
    foot = ('The action area is a drawn proposal: the Glenabo catchment with Glenabo Wood, Corrin Hill '
            'and Knockananig Reservoir added - offered for discussion, not a designation. Corrin Wood is '
            'Coillte property whose outline is not held as mapped geometry in OpenStreetMap. Catchment '
            'boundary flow-routed on Copernicus GLO-30; shaded relief from the same model. ' + foot_tail)
    shoot(page(1549, 'Glenabo - Corrin - Knockananig: proposed area for action',
               'Fermoy, Co. Cork  ·  catchment, woodland and recreational amenity within one working boundary',
               None, '\n'.join(svg), foot), relief(proj, cop), 1549, 'map-action')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Find a licensed Wikimedia Commons photograph for each binomial.

    python3 tools/commons_fetch.py            # report candidates, change nothing
    python3 tools/commons_fetch.py --write    # write site/assets/img/species/

Only CC BY, CC BY-SA, CC0 and public domain files are considered, only JPEG,
only 1400x900 or larger, and only files whose own title carries the binomial,
so the photograph can be checked against the name it is published under.

It does NOT choose for you. A human looks at the shortlist and picks, because
"in the category for Salix cinerea" is not the same as "is a good photograph of
Salix cinerea". The chosen files, their photographers and their licences are
recorded on site/credits/index.njk.
"""
import html, json, os, re, sys, urllib.parse, urllib.request

UA = 'CairdeCorrinSiteBuild/1.0 (+https://www.cairdecorrin.ie/)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LICENCE = re.compile(r'^(CC BY(-SA)?|CC0|Public domain)', re.I)

SPECIES = {
    'bilberry': 'Vaccinium myrtillus',        'common-figwort': 'Scrophularia nodosa',
    'devils-bit-scabious': 'Succisa pratensis', 'grey-willow': 'Salix cinerea',
    'heather': 'Calluna vulgaris',            'herb-robert': 'Geranium robertianum',
    'marsh-thistle': 'Cirsium palustre',      'purple-moor-grass': 'Molinia caerulea',
    'rowan': 'Sorbus aucuparia',              'sessile-oak': 'Quercus petraea',
    'tormentil': 'Potentilla erecta',         'water-figwort': 'Scrophularia auriculata',
}
# Autumn hawkbit is recorded to family only. With no binomial there is nothing to
# check a photograph against, so it gets none.

def api(**params):
    params.update(action='query', format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=45))

def text(v):
    return html.unescape(re.sub(r'<[^>]+>', '', v or '')).strip()

def candidates(binomial, limit=150):
    d = api(list='categorymembers', cmtitle='Category:' + binomial, cmtype='file', cmlimit=str(limit))
    files = [m['title'] for m in d.get('query', {}).get('categorymembers', [])]
    out = []
    for i in range(0, min(len(files), 60), 20):
        d = api(prop='imageinfo', iiprop='url|extmetadata|size|mime', iiurlwidth='400',
                titles='|'.join(files[i:i + 20]))
        for pg in d.get('query', {}).get('pages', []):
            if 'imageinfo' not in pg:
                continue
            ii = pg['imageinfo'][0]
            em = ii.get('extmetadata', {})
            g = lambda k: text(em.get(k, {}).get('value', ''))
            if ii['mime'] != 'image/jpeg' or ii['width'] < 1400 or ii['height'] < 900:
                continue
            if not OK_LICENCE.match(g('LicenseShortName')) or g('Restrictions'):
                continue
            if binomial.lower() not in pg['title'].lower():
                continue
            out.append(dict(title=pg['title'], width=ii['width'], height=ii['height'],
                            url=ii['url'], page=ii['descriptionurl'], artist=g('Artist'),
                            licence=g('LicenseShortName'),
                            licence_url=em.get('LicenseUrl', {}).get('value', '')))
    return out

def write(slug, url, out_dir):
    from PIL import Image, ImageOps
    import io
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=180).read()
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    w, h = im.size                                    # centre crop to 3:2
    nw, nh = (int(h * 1.5), h) if w / h > 1.5 else (w, int(w / 1.5))
    im = im.crop(((w - nw) // 2, (h - nh) // 2, (w - nw) // 2 + nw, (h - nh) // 2 + nh))
    for width in (760, 380):
        r = im.resize((width, round(width * 2 / 3)), Image.LANCZOS)
        r.save(f'{out_dir}/{slug}-{width}.webp', 'WEBP', quality=62, method=6)
        r.save(f'{out_dir}/{slug}-{width}.avif', quality=45, speed=4)

def main():
    doing = '--write' in sys.argv
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           'site', 'assets', 'img', 'species')
    for slug, binomial in SPECIES.items():
        cs = candidates(binomial)
        print(f'\n{slug}  ({binomial})  {len(cs)} usable')
        for c in cs[:5]:
            print(f"  {c['licence']:14} {c['width']}x{c['height']:<5} {c['artist'][:28]:30} {c['title']}")
        if doing and cs:
            os.makedirs(out_dir, exist_ok=True)
            write(slug, cs[0]['url'], out_dir)
            print(f'  wrote {slug}-760/380.webp/avif  <- REVIEW: this took the first candidate')

if __name__ == '__main__':
    main()

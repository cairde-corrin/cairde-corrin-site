#!/usr/bin/env python3
"""Walk every page of the built site, _site/, and report dead links and missing assets.

    npm run build && python3 tools/linkcheck.py   # internal only
    python3 tools/linkcheck.py --external # also fetch every external URL
    python3 tools/linkcheck.py --reveal   # also measure scroll-reveal block heights

Internal checking is filesystem-based, so it needs no server running. --reveal does:
it starts serve.py on a spare port and drives headless Chrome through cdp.mjs, so it
needs Node and Chrome. Neither is needed to build or deploy the site.
"""
import os, re, sys, html, json, socket, subprocess, tempfile, time
import urllib.parse, urllib.request, collections

# The built output, not site/: News pages and sitemap.xml exist only after `npm run build`.
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_site')
if not os.path.isdir(ROOT):
    sys.exit('No _site/ yet: run `npm run build` first.')
# href and src hold ONE url which may itself contain commas (Commons file names do).
# srcset holds several, comma separated. content is prose except on the og/twitter
# image and url tags, so it is matched separately rather than scanned wholesale.
SINGLE = re.compile(r'\b(?:href|src)\s*=\s*"([^"]+)"', re.I)
SETS   = re.compile(r'\bsrcset\s*=\s*"([^"]+)"', re.I)
METAURL = re.compile(r'<meta[^>]*?(?:property|name)="(?:og:(?:image|url)|twitter:image)"[^>]*?content="([^"]+)"', re.I)
UA = 'CairdeCorrinLinkCheck/1.0 (+https://www.cairdecorrin.ie/)'

TOOLS = os.path.dirname(os.path.abspath(__file__))
REVEAL_CLASS = 'rv'      # site.js fades these in on scroll
REVEAL_VIEWPORT = 700    # a common laptop viewport once browser chrome is taken off
REVEAL_MAX_VIEWPORTS = 8 # taller than this and the reveal is fragile - see below

def pages():
    for dirpath, _, files in os.walk(ROOT):
        for f in files:
            if f.endswith(('.html', '.xml')):
                yield os.path.join(dirpath, f)

def urls_in(text):
    """Every URL a page actually requests or points at."""
    for m in SINGLE.finditer(text):
        yield html.unescape(m.group(1).strip())
    for m in METAURL.finditer(text):
        yield html.unescape(m.group(1).strip())
    for m in SETS.finditer(text):
        for part in m.group(1).split(','):
            u = part.strip().split(' ')[0]
            if u:
                yield html.unescape(u)

def resolve(page, url):
    """Map a site-relative or root-relative URL to a path on disk."""
    p = urllib.parse.urlparse(url)
    path = p.path
    if not path:
        return None
    base = ROOT if path.startswith('/') else os.path.dirname(page)
    target = os.path.normpath(os.path.join(base, path.lstrip('/')))
    if os.path.isdir(target):
        target = os.path.join(target, 'index.html')
    return target

def page_urls():
    """Every HTML page as the URL a browser would ask for."""
    out = []
    for p in sorted(pages()):
        if not p.endswith('.html'):
            continue
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        out.append('/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel))
    return out

REVEAL_JS = """
import { launch, newPage } from '%(cdp)s';
const PAGES = %(pages)s, VH = %(vh)d;
const b = await launch({ port: %(port)d + 1000, headless: true });
const p = await newPage(%(port)d + 1000);
await p.viewport(1280, VH);
const out = [];
for (const path of PAGES) {
  await p.goto('http://127.0.0.1:%(port)d' + path, 2200);
  const r = await p.evaluate(`
    document.documentElement.style.scrollBehavior='auto';
    const h=document.documentElement.scrollHeight;
    for(let y=0;y<h;y+=600){ scrollTo(0,y); await new Promise(r=>setTimeout(r,25)); }
    scrollTo(0,0); await new Promise(r=>setTimeout(r,250));
    return [...document.querySelectorAll('.%(cls)s')].map(e=>({
      el: e.tagName.toLowerCase() +
          (typeof e.className==='string'
             ? (e.className.split(' ').filter(c=>c && c!=='in').map(c=>'.'+c).join('')) : ''),
      h: Math.round(e.getBoundingClientRect().height),
      media: e.querySelectorAll('audio,video').length }));`);
  out.push([path, r]);
}
console.log(JSON.stringify(out));
b.proc.kill();
await new Promise(r => setTimeout(r, 250));
process.exit(0);
"""

def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def reveal_check():
    """Flag reveal blocks tall enough that fading them in can fail silently.

    site.js reveals with an IntersectionObserver. Its threshold is a fraction of the
    TARGET element's own area, not of the viewport, so a block much taller than the
    window can never reach a non-zero threshold however far you scroll, and would sit
    at opacity 0 for good. The threshold is 0 today, which is safe at any height, but
    a block this tall is one edit away from disappearing, and it fades in as one slab
    besides. The recordings list did exactly this at 7191 px against a 0.1 threshold.
    """
    limit = REVEAL_VIEWPORT * REVEAL_MAX_VIEWPORTS
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(TOOLS, 'serve.py'), ROOT, str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1); break
            except Exception:
                time.sleep(0.1)
        else:
            print('  could not start serve.py'); return 1

        js = REVEAL_JS % {'cdp': os.path.join(TOOLS, 'cdp.mjs'),
                          'pages': json.dumps(page_urls()), 'port': port,
                          'vh': REVEAL_VIEWPORT, 'cls': REVEAL_CLASS}
        with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as f:
            f.write(js); tmp = f.name
        try:
            res = subprocess.run(['node', tmp], capture_output=True, text=True, timeout=600)
        except FileNotFoundError:
            print('  --reveal needs Node on PATH'); return 1
        finally:
            os.unlink(tmp)
        if res.returncode != 0:
            print('  reveal check failed:\n' + (res.stderr or '').strip()[:600]); return 1
        data = json.loads(res.stdout.strip().splitlines()[-1])
    finally:
        srv.terminate()
        # node kills its own browser, but not if it died first
        subprocess.run(['pkill', '-f', f'remote-debugging-port={port + 1000}'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    total = sum(len(r) for _, r in data)
    over = [(path, e) for path, r in data for e in r if e['h'] > limit]
    tallest = max((e['h'] for _, r in data for e in r), default=0)
    print(f'\n{total} .{REVEAL_CLASS} blocks across {len(data)} pages, measured at '
          f'1280x{REVEAL_VIEWPORT}')
    print(f'  limit {limit} px ({REVEAL_MAX_VIEWPORTS} viewports); tallest found {tallest} px')
    if over:
        print(f'\n{len(over)} OVER THE LIMIT:')
        for path, e in sorted(over, key=lambda x: -x[1]['h']):
            media = f", holds {e['media']} audio/video" if e['media'] else ''
            print(f"  {path}  {e['el']}  {e['h']} px "
                  f"({e['h'] / REVEAL_VIEWPORT:.1f} viewports){media}")
        print('\n  Split the block, or drop the reveal class from the container and put '
              'it on the\n  children, so no single element has to be seen to fade in.')
    else:
        print('  none over the limit')
    return 1 if over else 0

def main():
    external = collections.defaultdict(list)
    dead, checked = [], 0
    redirects = set()
    rf = os.path.join(ROOT, '_redirects')
    if os.path.exists(rf):
        for line in open(rf, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#'):
                redirects.add(line.split()[0])

    for page in sorted(pages()):
        rel = os.path.relpath(page, ROOT)
        text = open(page, encoding='utf-8').read()
        for url in urls_in(text):
            if url.startswith(('mailto:', 'tel:', 'data:', '#')):
                continue
            if url.startswith(('http://', 'https://')):
                if 'cairdecorrin.ie' not in url:
                    external[url].append(rel)
                continue
            if url.split('#')[0].split('?')[0] in redirects:
                continue
            checked += 1
            t = resolve(page, url.split('#')[0].split('?')[0])
            if t and not os.path.exists(t):
                dead.append((rel, url))

    print(f'{checked} internal references across {len(list(pages()))} pages')
    if dead:
        print(f'\n{len(dead)} DEAD:')
        for rel, url in dead:
            print(f'  {rel}: {url}')
    else:
        print('  all resolve')

    print(f'\n{len(external)} distinct external URLs')
    if '--external' in sys.argv:
        bad = []
        for url in sorted(external):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                code = urllib.request.urlopen(req, timeout=30).getcode()
            except Exception as e:
                code = getattr(e, 'code', repr(e)[:40])
            ok = code == 200
            if not ok:
                bad.append((url, code, external[url]))
            print(f'  {code}  {url}')
        if bad:
            print(f'\n{len(bad)} external URLs did not return 200:')
            for url, code, where in bad:
                print(f'  {code}  {url}  <- {", ".join(sorted(set(where)))}')

    reveal_bad = reveal_check() if '--reveal' in sys.argv else 0
    return 1 if (dead or reveal_bad) else 0

if __name__ == '__main__':
    sys.exit(main())

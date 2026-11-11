# Static server that mimics Netlify closely enough for Lighthouse: gzip for text
# types, and the Cache-Control rules from the site's own _headers file.
import gzip, io, os, sys, mimetypes, posixpath, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = sys.argv[1]
PORT = int(sys.argv[2])
GZIP = {'text/html', 'text/css', 'application/javascript', 'text/javascript',
        'application/json', 'image/svg+xml', 'application/xml', 'text/xml',
        'text/plain', 'application/geo+json'}

def load_headers():
    """Read the site's own _headers file so local responses match production.

    Netlify's format: a path pattern on a bare line, then indented "Name: value"
    lines. Only * at the end of a pattern is supported, which is all the site
    uses. Later matches win, so rules are kept in file order.
    """
    rules, pattern = [], None
    f = os.path.join(ROOT, '_headers')
    if not os.path.exists(f):
        return rules
    for line in open(f, encoding='utf-8'):
        raw = line.rstrip('\n')
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        if not raw[0].isspace():
            pattern = raw.strip()
        elif pattern and ':' in raw:
            name, _, value = raw.strip().partition(':')
            rules.append((pattern, name.strip(), value.strip()))
    return rules

RULES = load_headers()

def headers_for(path):
    """Every rule whose pattern matches, in file order."""
    out = {}
    for pattern, name, value in RULES:
        if pattern.endswith('*'):
            hit = path.startswith(pattern[:-1])
        elif pattern.startswith('/*'):
            hit = path.endswith(pattern[2:])
        else:
            hit = path == pattern
        if hit:
            out[name] = value
    return out

class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass

    def do_GET(self, head=False):
        p = urllib.parse.urlparse(self.path).path
        fs = os.path.join(ROOT, p.lstrip('/'))
        if os.path.isdir(fs): fs = os.path.join(fs, 'index.html')
        if not os.path.isfile(fs):
            body = b'not found'
            self.send_response(404); self.send_header('Content-Length', str(len(body)))
            self.send_header('Content-Type', 'text/plain'); self.end_headers()
            if not head: self.wfile.write(body)
            return
        ctype = mimetypes.guess_type(fs)[0] or 'application/octet-stream'
        if fs.endswith('.geojson'): ctype = 'application/geo+json'
        if fs.endswith('.webp'): ctype = 'image/webp'
        if fs.endswith('.avif'): ctype = 'image/avif'
        if fs.endswith('.woff2'): ctype = 'font/woff2'
        data = open(fs, 'rb').read()
        enc = None
        if ctype.split(';')[0] in GZIP and 'gzip' in self.headers.get('Accept-Encoding', ''):
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6, mtime=0) as g:
                g.write(data)
            data = buf.getvalue(); enc = 'gzip'
        # Range support: media elements refuse to seek without it.
        rng = self.headers.get('Range')
        if rng and enc is None:
            import re as _re
            m = _re.match(r'bytes=(\d*)-(\d*)', rng)
            if m:
                total = len(data)
                s = int(m.group(1)) if m.group(1) else None
                e = int(m.group(2)) if m.group(2) else None
                if s is None:
                    s = max(0, total - (e or 0)); e = total - 1
                elif e is None or e >= total:
                    e = total - 1
                if s <= e < total:
                    chunk = data[s:e+1]
                    self.send_response(206)
                    self.send_header('Content-Type', ctype)
                    self.send_header('Content-Range', f'bytes {s}-{e}/{total}')
                    self.send_header('Content-Length', str(len(chunk)))
                    self.send_header('Accept-Ranges', 'bytes')
                    for _n, _v in headers_for(p).items(): self.send_header(_n, _v)
                    self.end_headers()
                    if not head: self.wfile.write(chunk)
                    return
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Accept-Ranges', 'bytes')
        for _n, _v in headers_for(p).items(): self.send_header(_n, _v)
        if enc: self.send_header('Content-Encoding', enc); self.send_header('Vary', 'Accept-Encoding')
        self.end_headers()
        if not head: self.wfile.write(data)


    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n)
        with open('/tmp/reports.jsonl', 'ab') as f:
            f.write(body + b'\n')
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_HEAD(self): self.do_GET(head=True)

ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()

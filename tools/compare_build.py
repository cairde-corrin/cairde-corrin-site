#!/usr/bin/env python3
"""Check that every file the build copies is byte-identical to its source in site/.

    npm run build && python3 tools/compare_build.py

Expected files are the git-tracked files under site/, which is exactly what a
fresh checkout (and Netlify) builds from, minus the template sources (.njk, .md,
*.11tydata.js, _includes/, _content/) and the uploaded news photos (assets/uploads/),
which must never be published. Every copied
file is compared twice: by SHA-256 and by a full byte-by-byte read. Files the
templates generate (every page and sitemap.xml) are listed, not compared. Exits
non-zero on any difference, any missing file, or any leaked template source.
"""
import filecmp, hashlib, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'site'), os.path.join(ROOT, '_site')


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def main():
    tracked = subprocess.run(['git', 'ls-files', '-z', 'site'], cwd=ROOT, capture_output=True,
                             check=True).stdout.decode().split('\0')
    rels = {os.path.relpath(f, 'site') for f in tracked if f}
    source = lambda p: (p.endswith(('.njk', '.md', '.11tydata.js'))
                        or p.split(os.sep)[0] in ('_includes', '_content', '_data', '_instagram', '_commons', '_youtube')
                        or p.startswith(os.path.join('assets', 'uploads') + os.sep))
    expected = {p for p in rels if not source(p)}
    built = {os.path.relpath(os.path.join(d, f), OUT) for d, _, fs in os.walk(OUT) for f in fs}
    clutter = {p for p in built - expected if os.path.basename(p) == '.DS_Store'}
    missing = sorted(expected - built)
    leaked = sorted(p for p in built if source(p))
    generated = sorted(built - expected - clutter - set(leaked))
    differ = []
    for rel in sorted(expected & built):
        a, b = os.path.join(SRC, rel), os.path.join(OUT, rel)
        if sha(a) != sha(b) or not filecmp.cmp(a, b, shallow=False):
            differ.append(rel)
    total = sum(os.path.getsize(os.path.join(SRC, r)) for r in expected)
    print('compared %d copied files, %.1f MB: %d identical, %d differ, %d missing from _site, '
          '%d template sources leaked; %d generated'
          % (len(expected), total / 1e6, len(expected & built) - len(differ), len(differ),
             len(missing), len(leaked), len(generated)))
    if clutter:
        print('ignored %d untracked .DS_Store files copied from the local site/' % len(clutter))
    for label, items in (('DIFFERS', differ), ('MISSING', missing), ('LEAKED', leaked),
                         ('generated', generated)):
        for rel in items:
            print('  %s %s' % (label, rel))
    for name in ('_redirects', '_headers'):
        a, b = os.path.join(SRC, name), os.path.join(OUT, name)
        print('%-11s site %s  _site %s' % (name, sha(a), sha(b) if os.path.exists(b) else 'MISSING'))
    sys.exit(1 if differ or missing or leaked else 0)


if __name__ == '__main__':
    main()

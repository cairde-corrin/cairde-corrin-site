#!/usr/bin/env python3
"""Draws docs/how-it-works.svg, the flow diagram in docs/DEVELOPER-GUIDE.md.

    python3 tools/diagram.py

Boxes and arrows in the manner of an n8n or Zapier canvas, generated so it can be redrawn
when the system changes rather than edited by hand. Each box carries its own solid fill
and dark text, so it reads on a light or a dark page; the canvas, arrows and arrow labels
use mid-tones and switch with prefers-color-scheme where the viewer supports it.
"""
import html, os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'how-it-works.svg')
W, H, BW, BH = 1240, 760, 230, 92
KIND = {  # fill, stripe
    'person': ('#FFF4D6', '#C98A00'), 'edit': ('#E7F1FF', '#2F6FD1'), 'netlify': ('#DFF5F2', '#00897B'),
    'github': ('#EEEAF7', '#5B45A8'), 'build': ('#E8F3E0', '#487629'), 'outside': ('#F4E9E9', '#A23B3B'),
}
# id: (x, y, kind, title, detail lines)
NODES = {
    'editor':   (30, 40, 'person', 'Committee editor', ['phone or computer', 'logs in at /admin/']),
    'photos':   (30, 190, 'edit', 'photos.js', ['shrinks to 2000 px and strips', 'location before upload']),
    'decap':    (330, 40, 'edit', 'Decap CMS  /admin/', ['news, gallery, page text,', 'articles, social posts']),
    'identity': (330, 190, 'netlify', 'Netlify Identity', ['invite-only logins,', 'one-hour tokens']),
    'gateway':  (630, 40, 'netlify', 'Netlify Git Gateway', ['writes to GitHub with', "a member's token"]),
    'repo':     (930, 40, 'github', 'GitHub repository', ['cms/... branch and pull', 'request for each draft']),
    'check':    (930, 190, 'github', 'Editor content only', ['check fails any editor change', 'outside content files']),
    'main':     (930, 340, 'github', 'main branch', ['Publish merges the pull', 'request into main']),
    'dev':      (30, 490, 'person', 'Developer', ['works on the build branch,', 'releases by pull request']),
    'preview':  (330, 490, 'netlify', 'Branch preview', ['build--cairde-corrin', '.netlify.app']),
    'build':    (630, 340, 'build', 'Netlify build: Eleventy', ['templates + figures.json, page', 'text, photos re-encoded, CSP']),
    'youtube':  (630, 190, 'outside', 'YouTube', ['video stills fetched at build', 'when not yet committed']),
    'cdn':      (630, 490, 'netlify', 'Netlify CDN', ['_site/ with _headers', 'and _redirects (/s/1-10)']),
    'visitor':  (930, 490, 'person', 'Visitor', ['static pages, nothing from', 'other sites until video play']),
    'domain':   (930, 640, 'outside', 'cairdecorrin.ie', ['DNS at Letshost;', 'see DOMAIN-SETUP.md']),
}
EDGES = [  # from, to, label
    ('editor', 'decap', 'writes'), ('editor', 'photos', 'chooses a photo'), ('photos', 'decap', 'clean copy'),
    ('decap', 'identity', 'login'), ('decap', 'gateway', 'save / publish'), ('gateway', 'repo', 'commits'),
    ('repo', 'check', 'pull request'), ('check', 'main', 'merge if passed'), ('main', 'build', 'every push'),
    ('youtube', 'build', 'still'), ('build', 'cdn', 'publish _site/'), ('cdn', 'visitor', 'HTTPS'),
    ('dev', 'preview', 'push build'), ('dev', 'main', 'release by pull request'), ('domain', 'visitor', 'address'),
]

def centre(n):
    x, y = NODES[n][:2]
    return x + BW / 2, y + BH / 2

def anchor(a, b):
    """Where an arrow from box a towards box b leaves a's edge."""
    (ax, ay), (bx, by) = centre(a), centre(b)
    dx, dy = bx - ax, by - ay
    if abs(dx) * BH > abs(dy) * BW:
        return ax + (BW / 2) * (1 if dx > 0 else -1), ay + dy * (BW / 2) / abs(dx)
    return ax + dx * (BH / 2) / abs(dy), ay + (BH / 2) * (1 if dy > 0 else -1)

def main():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
         'role="img" aria-labelledby="t d" font-family="Inter, Helvetica, Arial, sans-serif">',
         '<title id="t">How the Cáirde Corrin website works</title>',
         '<desc id="d">Editors write in Decap at /admin/, log in with Netlify Identity and save through Git '
         'Gateway to GitHub, where a check keeps them to content; publishing merges into main, Netlify builds '
         'the site with Eleventy and serves it to visitors. Developers release from the build branch.</desc>',
         '<style>.canvas{fill:#F3F5F7}.grid{fill:#D5DAE0}.wire{stroke:#7A8794;stroke-width:2;fill:none}'
         '.tag{fill:#FFFFFF;stroke:#B9C1CA}.tagt{fill:#3C4652;font-size:11px}'
         '@media (prefers-color-scheme: dark){.canvas{fill:#1B1F24}.grid{fill:#2C333B}.wire{stroke:#9AA6B2}'
         '.tag{fill:#262C33;stroke:#4A535D}.tagt{fill:#D9DEE3}}</style>',
         '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
         '<path d="M0 0L10 5L0 10z" fill="#7A8794"/></marker>'
         '<pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" class="grid"/></pattern></defs>',
         f'<rect class="canvas" width="{W}" height="{H}" rx="14"/><rect width="{W}" height="{H}" fill="url(#g)" rx="14"/>']
    for a, b, label in EDGES:
        (x1, y1), (x2, y2) = anchor(a, b), anchor(b, a)
        o.append(f'<path class="wire" d="M{x1:.0f} {y1:.0f} L{x2:.0f} {y2:.0f}" marker-end="url(#a)"/>')
        mx, my, tw = (x1 + x2) / 2, (y1 + y2) / 2, 6.2 * len(label) + 14
        o.append(f'<rect class="tag" x="{mx - tw / 2:.0f}" y="{my - 10:.0f}" width="{tw:.0f}" height="20" rx="10"/>'
                 f'<text class="tagt" x="{mx:.0f}" y="{my + 4:.0f}" text-anchor="middle">{html.escape(label)}</text>')
    for n, (x, y, kind, title, lines) in NODES.items():
        fill, stripe = KIND[kind]
        o.append(f'<g><rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="12" fill="{fill}" stroke="{stripe}" stroke-width="1.5"/>'
                 f'<rect x="{x}" y="{y}" width="8" height="{BH}" rx="4" fill="{stripe}"/>'
                 f'<text x="{x + 22}" y="{y + 30}" font-size="15" font-weight="600" fill="#1E242B">{html.escape(title)}</text>')
        for i, line in enumerate(lines):
            o.append(f'<text x="{x + 22}" y="{y + 54 + i * 18}" font-size="12" fill="#3C4652">{html.escape(line)}</text>')
        o.append('</g>')
    o.append('</svg>')
    open(OUT, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
    print('wrote', OUT)

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Validate the structured data (JSON-LD) on every built page against schema.org.

    npm run build && python3 tools/ldcheck.py

For every <script type="application/ld+json"> block in _site/ it checks that the JSON
parses, that every @type and property exists in the schema.org vocabulary, that each
property is one schema.org allows on that type, that a nested typed value is one the
property accepts, and that every {"@id": ...} reference is defined on some page of the
site. It also flags terms schema.org still marks as pending.

The vocabulary is downloaded once from schema.org into .cache/ (ignored by git).
"""
import glob, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, '_site')
VOCAB_URL = 'https://schema.org/version/latest/schemaorg-current-https.jsonld'
VOCAB = os.path.join(ROOT, '.cache', 'schemaorg-current-https.jsonld')
DATATYPES = {'Text', 'URL', 'Number', 'Integer', 'Float', 'Boolean', 'Date', 'DateTime', 'Time', 'DataType'}

def vocab():
    if not os.path.exists(VOCAB):
        os.makedirs(os.path.dirname(VOCAB), exist_ok=True)
        req = urllib.request.Request(VOCAB_URL, headers={'User-Agent': 'ldcheck/1.0'})
        open(VOCAB, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
    g = json.load(open(VOCAB, encoding='utf-8'))['@graph']
    name = lambda i: i.split(':', 1)[1] if ':' in i else i
    ids = lambda v: [name(x['@id']) for x in (v if isinstance(v, list) else [v])] if v else []
    classes, props, parents, pending = {}, {}, {}, set()
    for n in g:
        t = n['@type'] if isinstance(n['@type'], list) else [n['@type']]
        k = name(n['@id'])
        if 'pending' in json.dumps(n.get('schema:isPartOf', '')): pending.add(k)
        if 'rdfs:Class' in t:
            classes[k] = True; parents[k] = ids(n.get('rdfs:subClassOf'))
        if 'rdf:Property' in t:
            props[k] = (set(ids(n.get('schema:domainIncludes'))), set(ids(n.get('schema:rangeIncludes'))))
    def ancestors(c, seen=None):
        seen = seen or set()
        for p in parents.get(c, []):
            if p not in seen: seen.add(p); ancestors(p, seen)
        return seen | {c}
    return classes, props, ancestors, pending

def main():
    classes, props, ancestors, pending = vocab()
    defined, refs, errors, warnings, blocks = set(), [], [], [], 0
    def walk(node, page, path):
        if isinstance(node, list):
            for x in node: walk(x, page, path)
            return
        if not isinstance(node, dict): return
        if set(node) == {'@id'}: refs.append((node['@id'], page, path)); return
        if '@id' in node: defined.add(node['@id'])
        types = node.get('@type', [])
        types = types if isinstance(types, list) else [types]
        lineage = set()
        for t in types:
            if t not in classes: errors.append(f'{page}: {path}: unknown type {t}')
            else: lineage |= ancestors(t)
            if t in pending: warnings.append(f'{page}: {path}: {t} is a pending schema.org type')
        for k, v in node.items():
            if k.startswith('@'): continue
            if k not in props: errors.append(f'{page}: {path}.{k}: unknown property'); continue
            if k in pending: warnings.append(f'{page}: {path}.{k} is a pending schema.org property')
            dom, rng = props[k]
            if lineage and not (dom & lineage): errors.append(f'{page}: {path}.{k} is not a property of {"/".join(types)}')
            for x in (v if isinstance(v, list) else [v]):
                if isinstance(x, dict) and '@type' in x and rng:
                    xt = x['@type'] if isinstance(x['@type'], list) else [x['@type']]
                    if not any(ancestors(t) & rng for t in xt if t in classes) and not rng <= DATATYPES:
                        errors.append(f'{page}: {path}.{k} does not accept a {"/".join(xt)}')
            walk(v, page, f'{path}.{k}')
    pages = [p for p in sorted(glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True))
             if os.sep + 'admin' + os.sep not in p]
    for p in pages:
        rel = os.path.relpath(p, SITE)
        for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', open(p, encoding='utf-8').read(), re.S):
            blocks += 1
            try: d = json.loads(b)
            except ValueError as e: errors.append(f'{rel}: JSON does not parse: {e}'); continue
            if d.get('@context') != 'https://schema.org': errors.append(f'{rel}: @context is not https://schema.org')
            walk(d.get('@graph', d), rel, d.get('@type', 'graph'))
    for i, page, path in refs:
        if i not in defined: errors.append(f'{page}: {path} refers to {i}, which no page defines')
    print(f'{blocks} JSON-LD blocks on {len(pages)} pages, {len(defined)} distinct @ids')
    for w in sorted(set(warnings)): print('  note:', w)
    for e in errors: print('  ERROR:', e)
    print('  all valid' if not errors else f'\n{len(errors)} errors')
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env bash
# Rebuilds site/admin/vendor/ from npm at the pinned versions, so the news editor
# loads nothing from a CDN. Checks each tarball against its recorded SHA-256 first.
# Usage: tools/vendor_cms.sh   (from the repository root)
set -euo pipefail

DECAP=3.17.3
DECAP_SHA=c07631864c91520bdccf70a6a86efcf784025afd63419f17647f2f65a40ef3d4
WIDGET=2.0.3
WIDGET_SHA=600be7c4ac91c2f356243d06516eb6d3440c8dd9912ae25ea2547519d9e6b3ae

OUT=site/admin/vendor
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

(cd "$TMP" && npm pack --silent "decap-cms@$DECAP" "netlify-identity-widget@$WIDGET" >/dev/null)
echo "$DECAP_SHA  $TMP/decap-cms-$DECAP.tgz" | shasum -a 256 -c -
echo "$WIDGET_SHA  $TMP/netlify-identity-widget-$WIDGET.tgz" | shasum -a 256 -c -
mkdir -p "$TMP/d" "$TMP/w"
tar -xzf "$TMP/decap-cms-$DECAP.tgz" -C "$TMP/d"
tar -xzf "$TMP/netlify-identity-widget-$WIDGET.tgz" -C "$TMP/w"

# The main bundle, the chunks it loads on demand and its two wasm files. No source maps.
D="$OUT/decap-cms-$DECAP"; mkdir -p "$D"
cp "$TMP"/d/package/dist/decap-cms.js "$TMP"/d/package/dist/[0-9]*.decap-cms.js \
   "$TMP"/d/package/dist/*.wasm "$TMP"/d/package/dist/decap-cms.js.LICENSE.txt "$D/"
W="$OUT/netlify-identity-widget-$WIDGET"; mkdir -p "$W"
cp "$TMP"/w/package/build/netlify-identity-widget.js "$TMP"/w/package/LICENSE "$W/"
echo "Wrote $D ($(ls "$D" | wc -l | tr -d ' ') files) and $W"

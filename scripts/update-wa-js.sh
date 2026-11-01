#!/usr/bin/env bash
# Pull the latest WA-JS build from npm into extension/page/wppconnect-wa.js
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
( cd "$tmp" && npm pack @wppconnect/wa-js >/dev/null && tar xzf wppconnect-wa-js-*.tgz )
cp "$tmp/package/dist/wppconnect-wa.js" extension/page/wppconnect-wa.js
cp "$tmp/package/LICENSE" extension/page/WA-JS-LICENSE.txt
echo "WA-JS updated to $(node -p "require('$tmp/package/package.json').version"). Bump \"version\" in extension/manifest.json before packaging."
rm -rf "$tmp"

#!/usr/bin/env bash
# Build the ZIP to upload to the Chrome Web Store: dist/wa-reader-<version>.zip
# The "key" field (it pins the ID of the unpacked dev build) is removed: the store does not accept it.
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(node -p "require('./extension/manifest.json').version")
rm -rf build/extension && mkdir -p build dist
cp -r extension build/extension
node -e "const f='build/extension/manifest.json',m=require('./'+f);delete m.key;require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')"
rm -f "dist/wa-reader-$v.zip"
( cd build/extension && zip -qr "../../dist/wa-reader-$v.zip" . -x '.*' )
echo "dist/wa-reader-$v.zip"

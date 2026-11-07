#!/usr/bin/env bash
# Build the Chrome extension ZIPs:
#   dist/wa-reader-<version>.zip       – upload to the Chrome Web Store ("key" removed: the store does not accept it)
#   dist/wa-reader-test-<version>.zip  – for testing before the store update: unzip, chrome://extensions → Load unpacked.
#                                        Keeps "key", so its ID is always cphfcojbhpemojgolhcgngodbfodildd,
#                                        which the Claude Desktop extension accepts without any setting.
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(node -p "require('./extension/manifest.json').version")
rm -rf build/extension build/extension-test && mkdir -p build dist
cp -r extension build/extension
cp -r extension build/extension-test
node -e "const f='build/extension/manifest.json',m=require('./'+f);delete m.key;require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')"
rm -f "dist/wa-reader-$v.zip" "dist/wa-reader-test-$v.zip"
( cd build/extension && zip -qr "../../dist/wa-reader-$v.zip" . -x '.*' )
( cd build/extension-test && zip -qr "../../dist/wa-reader-test-$v.zip" . -x '.*' )
echo "dist/wa-reader-$v.zip"
echo "dist/wa-reader-test-$v.zip"

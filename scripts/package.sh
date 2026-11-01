#!/usr/bin/env bash
# Build the ZIP to upload to the Chrome Web Store: dist/wa-reader-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(node -p "require('./extension/manifest.json').version")
mkdir -p dist
rm -f "dist/wa-reader-$v.zip"
( cd extension && zip -qr "../dist/wa-reader-$v.zip" . -x '.*' )
echo "dist/wa-reader-$v.zip"

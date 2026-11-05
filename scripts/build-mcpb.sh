#!/usr/bin/env bash
# Build the Claude Desktop extension: dist/wa-reader.mcpb (also copied to docs/ for GitHub Pages)
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(node -p "require('./package.json').version")
rm -rf build/mcpb && mkdir -p build/mcpb/server dist
cp mcpb/manifest.json mcpb/icon.png LICENSE build/mcpb/
node -e "const f='build/mcpb/manifest.json',m=require('./'+f);m.version='$v';require('fs').writeFileSync(f,JSON.stringify(m,null,2))"
# one self-contained file: no node_modules inside the bundle
npx esbuild mcp/server.js --bundle --platform=node --format=esm --target=node18 \
  --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);" \
  --outfile=build/mcpb/server/index.js --log-level=warning
npx -y @anthropic-ai/mcpb@2.1.2 validate build/mcpb/manifest.json
npx -y @anthropic-ai/mcpb@2.1.2 pack build/mcpb dist/wa-reader.mcpb
cp dist/wa-reader.mcpb docs/wa-reader.mcpb
echo "dist/wa-reader.mcpb (v$v)"

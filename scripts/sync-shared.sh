#!/usr/bin/env bash
# shared/ is the source of truth; copy the modules into the extension and the Edge Function.
set -euo pipefail
cd "$(dirname "$0")/.."
cp shared/relay-crypto.js shared/realtime.js extension/lib/
cp shared/relay-crypto.js shared/realtime.js shared/tools.js supabase/functions/wa-mcp/
echo synced

#!/bin/zsh
# Pousse le pont Apps Script (copie data.js dedans) et redéploie sur la même URL.
set -e
cd "$(dirname "$0")"
cp data.js pont/data.js
cd pont
clasp push -f
DEP=$(clasp deployments 2>/dev/null | grep -E '^- AKfycb' | grep -v '@HEAD' | head -1 | awk '{print $2}')
if [ -n "$DEP" ]; then clasp deploy -i "$DEP" -d "v$(date +%Y%m%d-%H%M)"; else clasp deploy -d "v1"; fi

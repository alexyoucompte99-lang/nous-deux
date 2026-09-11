#!/bin/zsh
# Pousse le code du pont (copie data.js dedans) et publie une nouvelle version sur le déploiement web app existant (même URL /exec).
# appsscript.json DOIT garder sa section "webapp" : sans elle, `clasp deploy` transforme le déploiement en « Bibliothèque » et casse /exec.
set -e
cd "$(dirname "$0")"
DEPLOY_ID=$(sed -E 's#.*/s/([^/]+)/exec.*#\1#' .pont-url)
cp data.js pont/data.js
cd pont
grep -q '"webapp"' appsscript.json || { echo "appsscript.json sans section webapp : arrêt"; exit 1; }
clasp push -f
clasp deploy -i "$DEPLOY_ID" -d "${1:-maj $(date +%Y%m%d-%H%M)}"
cd ..
code=$(curl -sL -o /dev/null -w '%{http_code}' "$(cat .pont-url)?key=nous-3e7a91c4d2f85b60&what=push")
echo "Pont redéployé, test /exec : HTTP $code"

#!/bin/zsh
# Pousse le code du pont (copie data.js dedans). NE PAS utiliser `clasp deploy` : il transforme le déploiement en « Bibliothèque » et casse l'URL /exec.
# Pour publier une nouvelle version : éditeur Apps Script → Déployer → Gérer les déploiements → ✎ sur « Nous web app » → Version : Nouvelle version → Déployer (même URL).
set -e
cd "$(dirname "$0")"
cp data.js pont/data.js
cd pont
clasp push -f
echo "Code poussé. Publie la nouvelle version depuis l'éditeur (voir commentaire en tête de ce script)."

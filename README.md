# Nous

Appli privée d'Alex et Manon pour la distance : question du jour, « je pense à toi », photo du jour, compte à rebours, soirée ciné synchronisée, swipe d'envies, souhaits, coupons, quiz « qui connaît le mieux l'autre », défi de la semaine, devine ma réponse, roue de la vie, ligne de vie, anglais à deux (mot du jour, phrase, quiz express, XP), citation philosophique du jour avec fil d'échange, check-in hebdo, journal d'humeur, lettres différées, capsules temporelles, souvenirs, nombre numérologique du jour, Complice (chat IA privé).

- **Appli** : https://alexyoucompte99-lang.github.io/nous-deux/ (PWA : Safari → Partager → « Sur l'écran d'accueil »). Chacun choisit « Alex » ou « Manon » au premier lancement.
- **Données** : Google Sheet « Nous · données » (créé par le pont), onglet `Items`. Copie locale dans chaque téléphone, synchro toutes les 30 s et à chaque changement. Photos dans le dossier Drive « Nous ».
- **Pont Apps Script** : dossier `pont/`. Script : https://script.google.com/d/1XmUzq6Ls_jzKOyZoAeAwLCOMZOnr-LhE7975GHGwxBny4D7p1hPQB1t2/edit. Mise à jour : `./deploy-pont.sh` (copie data.js, push, redéploie sur la même URL).
- **Chat Complice** : historique uniquement dans le téléphone de chacun, jamais dans le Sheet.

## Mise en route (une fois)

1. **Autoriser le pont** : ouvrir le script (lien ci-dessus), choisir la fonction `autoriser` en haut, **Exécuter**, accepter les accès (Sheets, Drive, réseau, déclencheurs). Ça crée le Sheet et installe les rappels (question du jour 9h, lettres/capsules qui s'ouvrent, défi du lundi 9h30, check-in du dimanche 19h). Tant que ce n'est pas fait, l'appli marche en local mais ne synchronise pas (point rouge en haut à droite).
2. **Notifs** : chacun installe l'appli **ntfy** et s'abonne à son sujet, puis le colle dans ⚙︎ → « Mon sujet ntfy » → Enregistrer. Sujets proposés : Alex `nous-alex-9dafeb`, Manon `nous-manon-e89df3`.
3. **Complice** : ⚙︎ → coller une clé API Anthropic (console.anthropic.com). Une seule clé pour les deux, stockée dans le pont.
4. **Dates de naissance** : au premier lancement ou dans ⚙︎, pour le nombre du jour.

## Principe

Rien n'est dicté. L'appli ne rappelle jamais une attention et ne rassure pas artificiellement : tout ce qui compte vient de l'humain.

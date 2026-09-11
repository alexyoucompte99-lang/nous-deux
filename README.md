# Nous

Appli privée d'Alex et Manon pour la distance : question du jour, « je pense à toi », photo du jour, compte à rebours, soirée ciné synchronisée, swipe d'envies, souhaits, coupons (jamais d'argent), quiz « qui connaît le mieux l'autre », défi de la semaine, devine ma réponse, roue de la vie, ligne de vie, anglais à deux (mot du jour, phrase, quiz express, XP), citation philosophique du jour avec fil d'échange, check-in hebdo, journal d'humeur, lettres différées, capsules temporelles, boîte à idées, souvenirs, code de protection par profil, nombre numérologique du jour, Complice (espace IA privé pour prendre du recul).

- **Appli** : https://alexyoucompte99-lang.github.io/nous-deux/ (PWA : Safari → Partager → « Sur l'écran d'accueil »). Chacun choisit « Alex » ou « Manon » au premier lancement.
- **Données** : Google Sheet « Nous · données » (créé par le pont), onglet `Items`. Copie locale dans chaque téléphone, synchro toutes les 15 s quand l'appli est ouverte, à chaque réouverture, et tout de suite à la réception d'une notif. Photos dans le dossier Drive « Nous ».
- **Pont Apps Script** : dossier `pont/`. Script : https://script.google.com/d/1XmUzq6Ls_jzKOyZoAeAwLCOMZOnr-LhE7975GHGwxBny4D7p1hPQB1t2/edit. Mise à jour : `./deploy-pont.sh "ce que j'ai changé"` (copie data.js, push, nouvelle version sur la même URL /exec).
- **Chat Complice** : historique uniquement dans le téléphone de chacun, jamais dans le Sheet.

## Notifications

Web Push natif (aucune appli tierce) : l'un fait quelque chose, l'autre reçoit une notif de « Nous ». Sur iPhone il faut **ouvrir Nous depuis l'icône de l'écran d'accueil** (iOS 16.4+), puis ⚙︎ → Notifications → Activer, ou la carte 🔔 de l'accueil.

- Clés VAPID générées une fois par le pont (ScriptProperties `VAPID_D` / `VAPID_PUB`), abonnements dans `PUSH_SUBS` (4 téléphones max par personne, les abonnements morts sont retirés tout seuls).
- Chiffrement (P-256, HKDF, AES-128-GCM) écrit à la main dans `pont/Push.js` : Apps Script n'a ni WebCrypto ni librairie. Testé contre `node:crypto` et un vrai service push. **Piège** : l'analyseur d'Apps Script refuse les littéraux BigInt (`0n`), d'où les constantes `BigInt(0)`.
- Aucune notif automatique de l'appli (l'appli ne dicte rien). Seule exception : à 9 h, les lettres et capsules qui s'ouvrent ce jour-là (déclencheur `notifDue`).

## Pièges réseau (à garder en tête)

Les appels au pont passent par une redirection Google qui échoue régulièrement : la page de réponse revient parfois « Page introuvable » alors que l'action a bien été faite côté serveur, et Safari transforme parfois un POST en GET sans corps (il tombait alors sur `doGet`, qui répondait « ok » : c'est ce qui avait publié une photo sans image). Donc :

- le pont renvoie toujours `what` = la demande reçue, et l'appli **rejette** toute réponse qui ne correspond pas, puis réessaie ;
- tout est rejouable sans doublon côté pont (photos par `pid`, notifs par `nid`, données par `id` + horodatage) ;
- les photos partent en morceaux de 45 Ko, et `photo_done` répond la liste des morceaux manquants ;
- la colonne `srv` (heure du serveur) sert de repère de synchro : un élément arrivé en retard n'est plus jamais sauté par l'autre téléphone.

## Mise en route (une fois)

1. **Autoriser le pont** : ouvrir le script (lien ci-dessus), fonction `autoriser`, **Exécuter**, accepter les accès. Ça crée le Sheet, les clés VAPID et le rappel lettres/capsules.
2. **Notifications** : sur chaque téléphone, Nous ouverte depuis l'écran d'accueil → ⚙︎ → Notifications → Activer (bouton « M'envoyer une notif test » pour vérifier).
3. **Complice** : ⚙︎ → coller une clé API Anthropic (console.anthropic.com). Une seule clé pour les deux, stockée dans le pont.
4. **Dates de naissance** : au premier lancement ou dans ⚙︎, pour le nombre du jour.

## Principe

Rien n'est dicté. L'appli ne rappelle jamais une attention et ne rassure pas artificiellement : tout ce qui compte vient de l'humain.

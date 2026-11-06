# Gestion des plaintes des apprentis

Application web de saisie, de traitement et de suivi des plaintes des apprentis (projet I-COMPETE, ACFPE et SCI Capital).
Pages hébergées sur GitHub Pages, données dans un Google Sheet accessible par un script Google Apps Script.
Le dépôt ne contient aucune donnée : la page est vide tant que l'utilisateur ne s'est pas connecté avec son code.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page, numéro de version `APP_BUILD`, mise à jour automatique |
| `css/style.css` | Design |
| `js/config.js` | Adresse du script, référentiel des problèmes (`PB`), statuts, état de synchronisation |
| `js/donnees.js` | Apprentis, stockage local, contacts |
| `js/formulaire.js` | Saisie : état du formulaire, recherche d'un apprenti, rendu |
| `js/enregistrement.js` | Enregistrement d'une plainte |
| `js/registre.js` | Registre, filtres, export CSV |
| `js/tableau.js` | Tableau de bord et indicateurs |
| `js/traitement.js` | Traitement d'une plainte |
| `js/navigation.js` | Navigation, thème |
| `js/sync.js` | Connexion, synchronisation, administration des utilisateurs |
| `serveur/Code.gs` | Script serveur à coller dans Google Apps Script |
| `tests/charge.js` | Test de charge avec un serveur simulé |
| `tests/securite.js` | Tests de sécurité du navigateur (XSS, déconnexion, lignes en attente, CSV, mise à jour) |
| `tests/synchro.js` | Test de la synchronisation partielle |
| `tests/serveur.js` | Tests de `Code.gs` avec un Google Sheet simulé |

Les fichiers JavaScript sont des scripts classiques chargés dans cet ordre, qui partagent le même espace global. Il n'y a ni framework ni compilation.

## Fonctionnement

- Le navigateur envoie des requêtes POST (`text/plain`, JSON) à l'Apps Script : `login`, `list`, `upsert`, `addApprenti`, `users`, `saveUser`.
- Le code d'accès, les plaintes et les contacts sont gardés dans `sessionStorage` : tout disparaît à la fermeture de l'onglet et à la déconnexion. Seules les lignes pas encore envoyées sont gardées dans `localStorage`, liées à leur auteur (14 jours maximum), et ne sont renvoyées que sous son propre code.
- Rôles : Administrateur, Utilisateur, Lecture (consultation seule, refusée aussi côté serveur).
- Le serveur valide chaque ligne (identifiant, date, longueur des champs, horloge, auteur) et stocke les codes chiffrés (SHA-256 salé) après `chiffrerCodes()`.
- Les plaintes modifiées sont envoyées 600 ms après la modification, avec une nouvelle tentative si le réseau échoue. Toutes les 45 s, la page ne demande au serveur que les plaintes modifiées depuis sa dernière lecture (`since`). Une lecture complète a lieu à la connexion, toutes les 10 minutes, et dès que le nombre de plaintes du serveur ne correspond plus.
- La version la plus récente (horodatage `maj`) gagne en cas de conflit.
- Tous les calculs (indicateurs, répartitions, filtres) sont faits dans le navigateur.

## Tester

```
npm i playwright
node tests/charge.js 1500
node tests/securite.js
node tests/serveur.js
node tests/synchro.js 2>&1
```

Le test de charge simule le serveur, vérifie la connexion, le nombre de plaintes, les indicateurs du tableau de bord, l'absence d'erreur JavaScript, et mesure les temps d'affichage.

## Déployer une modification

1. Modifier les fichiers.
2. Changer le numéro `APP_BUILD` dans `index.html` et le paramètre `?v=` des balises `link` et `script`, pour que les navigateurs rechargent les fichiers.
3. Pousser sur la branche `main` : GitHub Pages publie en 1 à 2 minutes. Les pages ouvertes se rechargent seules, ou affichent un bandeau « Actualiser » si l'utilisateur est en train de saisir.

Le script serveur (`Code.gs`) se modifie séparément dans Google Apps Script, puis se redéploie en nouvelle version.


Historique : chaque création ou modification d'une plainte ajoute une ligne par champ modifié dans l'onglet `Historique` du Sheet (date du serveur, personne, avant, après). Un renvoi sans changement n'écrit rien. L'heure de modification (`maj`) est posée par le serveur.

Sauvegardes : une copie du Sheet chaque jour à 5h (14 conservées). `verifierSauvegarde()` compare la dernière copie au Sheet actuel. `restaurerPlaintes()` remet l'onglet Plaintes dans l'état de la dernière copie, après avoir fait une copie « Avant restauration ».

Après chaque changement de `serveur/Code.gs` : le coller dans Apps Script, puis Déployer > Gérer les déploiements > Nouvelle version. Une seule fois : `chiffrerCodes()` ; `installerSauvegarde()` à relancer après cette mise à jour (passage à une copie quotidienne).

## Lot 1 (codes courts, blocage, paquets)
- Codes : 10 caractères minimum. Un code plus court est accepté avec un avertissement jusqu'au 20/11/2026 (CODE_COURT_REFUSE_APRES dans Code.gs), refusé ensuite (réponse "faible").
- Faux codes : chaque échec est ralenti. À 30 échecs en 10 minutes, un e-mail d'alerte est envoyé au propriétaire du script (au plus un par heure). À 200 échecs en 1 heure, les codes jamais validés récemment sont bloqués (les sessions déjà validées continuent). Lancer une fois `autoriserAlertes()` pour autoriser l'envoi d'e-mails.
- Envoi : le site envoie les modifications par paquets de 200 lignes (réduits automatiquement si le serveur répond "lot"). Import CSV limité à 2000 lignes.

## Lot 2 (modifications simultanées)
- Le site envoie, avec chaque plainte, la version qu'il avait reçue (`base`). Si le serveur a une version différente (quelqu'un d'autre a modifié la plainte entre-temps), la modification est refusée, la version à jour est renvoyée avec le nom de l'auteur et l'heure (`conflits`), et l'agent voit un message jusqu'à ce qu'il clique « J'ai compris ».
- Si le contenu envoyé est identique à celui du serveur, il n'y a pas de conflit.
- Les anciens sites (sans `base`) continuent de marcher avec l'ancienne règle (comparaison des horloges).
- La date de modification serveur est strictement croissante pour une même plainte.

## Validation des ajouts (N3)
- Ajout d'apprenti : le serveur n'accepte qu'une liste, avec un numéro de 60 caractères au plus (sans caractère de contrôle, ne commençant pas par = + @ -). Chaque champ est plafonné à 200 caractères, la base à 20 000 lignes. Sinon réponse "invalide".
- Contacts : identifiant de même forme que celui des plaintes, téléphone 100 caractères, autre numéro 300, 500 contacts au plus par envoi. Les entrées mal formées sont ignorées.

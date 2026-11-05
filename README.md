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
| `tests/charge.js` | Test automatique avec un serveur simulé |

Les fichiers JavaScript sont des scripts classiques chargés dans cet ordre, qui partagent le même espace global. Il n'y a ni framework ni compilation.

## Fonctionnement

- Le navigateur envoie des requêtes POST (`text/plain`, JSON) à l'Apps Script : `login`, `list`, `upsert`, `addApprenti`, `users`, `saveUser`.
- Le code d'accès est gardé dans `sessionStorage` : une nouvelle session redemande le code.
- Les plaintes modifiées sont envoyées 600 ms après la modification, avec une nouvelle tentative si le réseau échoue. La page relit le serveur toutes les 45 s.
- La version la plus récente (horodatage `maj`) gagne en cas de conflit.
- Tous les calculs (indicateurs, répartitions, filtres) sont faits dans le navigateur.

## Tester

```
npm i playwright
node tests/charge.js 1500
```

Le test simule le serveur, vérifie la connexion, le nombre de plaintes, les indicateurs du tableau de bord, l'absence d'erreur JavaScript, et mesure les temps d'affichage.

## Déployer une modification

1. Modifier les fichiers.
2. Changer le numéro `APP_BUILD` dans `index.html` et le paramètre `?v=` des balises `link` et `script`, pour que les navigateurs rechargent les fichiers.
3. Pousser sur la branche `main` : GitHub Pages publie en 1 à 2 minutes. Les pages ouvertes se rechargent seules.

Le script serveur (`Code.gs`) se modifie séparément dans Google Apps Script, puis se redéploie en nouvelle version.

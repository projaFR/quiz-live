# Quiz Live — mode d'emploi pour Claude

Moteur de quiz en direct (façon Kahoot) : un grand écran présente, les téléphones répondent, classement animé.
Propriétaire : Thibaut (novice en programmation, travaille en « vibe coding ») : expliquer simplement, en français.
Publié sur GitHub Pages : https://projafr.github.io/quiz-live/ (catalogue) et https://projafr.github.io/quiz-live/<id>/

## Structure
- `engine/engine.js` : logique (présentateur, joueur, connexion PeerJS, chrono, points, classement, swipe, plein écran, clavier, resynchronisation, contrôle de version). Générique : aucun texte propre à un quiz.
- `engine/art.js` : outils de dessin SVG (`svg`, `sh`, `face`, `eyes`, `S`) + personnages génériques (`heart`, `broken`, `trophee`, `loupe`, `podium`, `eleve`) + `bin(couleur)` et `flagSvg(couleur)`.
- `engine/base.css` : styles ; couleurs et polices via variables (`--bg`, `--card`, `--ink`, `--yel`, `--pink`, `--green`, `--paper`, `--fd`, `--fb`…).
- `engine/vendor/` : qrcode-generator 1.4.4 et PeerJS 1.5.4 (embarqués, pas de CDN).
- `themes/<nom>.css` (variables) + `themes/<nom>.json` (police Google Fonts, `logoArt`, `goodArt`, `badArt`, `words` : tous les textes d'ambiance).
- `quizzes/<id>/quiz.json` : le contenu. `quizzes/<id>/art.js` : les personnages du quiz (`Object.assign(ART,{nom:()=>svg(...)})`, ou `ART.nom=()=>...`).
- `<id>/index.html` et `index.html` : GÉNÉRÉS par `tools/build.py`. Ne jamais les modifier à la main.

## Format de quiz.json
Champs principaux : `id`, `theme`, `title`, `titleHtml` (option, `<span>` = 2e couleur), `tagline`, `rulesNote` (affiché une fois sous le QR), `finishNote`, `winner` (titre du 1er sur son téléphone), `winnerLine` (`{nick}` remplacé), `podiumTitle`, `nickPlaceholder`, `gallery`, `avatars` (clés d'ART), `lobbyArt`, `words` (surcharge des textes du thème), `time` (secondes par défaut, 20).
- `icons` : `{clé:{color,label,sub,icon:'bin'|'flag'|<clé ART>}}` pour les questions à icônes.
- `swipe` : `{left:{label,stamp,color,icon},right:{…},ask}`. Surchargable par manche (`rounds[i].swipe`) ou par question (`swipe`).
- `rounds` : `[{title,text,art,tint,time?,swipe?}]` (manche n = index+1).
- `questions` : `{round, art, artArgs?, name, sub, bio, ask?, type, options?, answer, why, time?, double?}`
  - `type:"choice"` : `options` = 2 à 4 textes (≤ 75 car.), `answer` = index (0 = première).
  - `type:"icons"` : `options` = clés de `icons`, `answer` = clé.
  - `type:"swipe"` : `answer` = `"left"` ou `"right"` (pas d'options).
  - `type:"number"` (trouver un nombre) : `answer` = nombre, `unit` (option, ex. "%"), `tolerance` (option, défaut 0.5 = 50 % d'écart → 0 point). Points selon la proximité ; les 3 plus proches sont affichés.
  - `type:"order"` (classement) : `items` = 3 à 6 étiquettes DANS LE BON ORDRE (le moteur les mélange). Tout juste = points avec bonus de vitesse ; partiel = 600 × proportion bien placée.
  - `type:"poll"` (sondage) : `options` 2 à 4, pas de bonne réponse, pas de points, barres en direct ; passe directement à la question suivante.
  - `type:"cloud"` (nuage de mots) : réponse libre ≤ 25 caractères, nuage en direct, pas de points.
  - `ask` ≤ 120 caractères ; `why` = explication affichée à la révélation (obligatoire sauf poll et cloud).

## Règles de contenu (exigées par Thibaut)
- Vérifier chaque fait sur des sources fiables (web) avant de l'écrire ; adapter au contexte local quand c'est demandé.
- Mentionner le contexte (ex. « consignes du Grand Nancy ») une seule fois au début (`rulesNote`, intro de manche 1), pas à chaque question, sauf quand c'est pertinent.
- Une manche = un seul type de question. Les manches swipe mélangent gauche et droite, dans un ordre imprévisible.
- Varier la position de la bonne réponse dans les questions à choix.
- Pas de préfixe « Red flag : » dans `why` (le titre l'affiche déjà).

## Construire, tester, publier
1. `python3 tools/build.py` (vérifie le quiz et s'arrête sur la première erreur ; affiche la version).
2. Test complet : `cd tools && npm install` (une fois), puis `CHROME=/usr/bin/google-chrome python3 tools/test_live.py <id>` (serveur PeerJS local + 3 joueurs simulés ; captures /tmp/ql-*.png). Regarder les captures.
3. Commit + push sur `main` : GitHub Pages publie en 1 à 2 minutes. Rappeler à Thibaut de faire Ctrl+F5 sur le grand écran (cache jusqu'à 10 min) et de vérifier la version affichée dans la salle d'attente.

## Kahoot et Wooclap (dans les deux sens)
- Export : `build.py` produit aussi `<id>/kahoot.xlsx` (modèle d'import Kahoot : en-têtes ligne 8, colonnes B à H ; swipe → 2 réponses ; onglet « Explications »). Lien dans le catalogue. Kahoot n'importe ni les images ni les explications. Il signale les questions > 120 caractères.
- Export Wooclap : `<id>/wooclap.xlsx` au format du modèle d'import Wooclap (feuille « Questions » : `Type | Title | Correct | Choice…`). MCQ (Correct = numéro, à partir de 1), GuessNumber (Correct = nombre), Poll, OpenQuestion (← cloud), Sorting (choix dans le bon ordre). Kahoot n'exporte que les QCM (choice, icons, swipe). Les titres peuvent être longs (≤ 400 car.).
- Import : `python3 tools/import_quiz.py <fichier.xlsx> <id> "Titre"` (Kahoot ou Wooclap ; questions MCQ uniquement pour Wooclap) crée un brouillon `quizzes/<id>/quiz.json` (questions à choix, manches de 6, personnage générique `bulle`, explication minimale). Accepte le modèle Kahoot et, en principe, le rapport de résultats Kahoot (détection des en-têtes Question / Answer 1-4 / Correct) : si le rapport n'est pas reconnu, adapter `find_table` sur le vrai fichier. Ensuite enrichir : personnages, bios, explications vérifiées, manches et types variés.
- Besoin d'`openpyxl` (préinstallé dans l'environnement de Claude).

## À savoir
- Connexion : PeerJS cloud (0.peerjs.com) + STUN Google/Cloudflare + TURN PeerJS. Le wifi de la fac bloque les liaisons entre appareils : consigne « coupez le wifi, jouez en 4G/5G » affichée partout.
- L'identifiant de partie est `quizlive-<id>-<code>` : plusieurs quiz peuvent tourner en même temps.
- Ajouter un thème : copier `themes/rencontre.*`, changer variables, police et `words`, puis `"theme":"<nom>"` dans le quiz.
- L'ancien dépôt `projaFR/trash-match` contient la version d'origine de Trash Match (autonome) ; il reste en ligne.

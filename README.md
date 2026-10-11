# Planner violoncelle

Site statique (GitHub Pages) qui répartit le programme de la semaine en séances quotidiennes
(15 min minimum, extensible), avec bourdon, métronome, chronos, contrôle de justesse et suivi.

## Publication

1. Pousser ce dossier à la racine d'un dépôt.
2. *Settings → Pages* : branche `main`, dossier `/ (root)`.
3. Sur téléphone ou tablette : ajouter la page à l'écran d'accueil (elle fonctionne alors hors ligne,
   et le navigateur conserve mieux les données).

**À chaque nouvelle version** : incrémenter `V` dans `sw.js` (`cello-v3` → `cello-v4`), sinon les
appareils hors ligne gardent l'ancienne.

## Données

Tout est stocké dans le navigateur de l'appareil (`localStorage`, clé `cello-planner-v1`).
Rien n'est envoyé ailleurs. Sauvegarde et passage d'un appareil à l'autre : onglet *Semaine* →
*Exporter (JSON)* puis *Importer*. Le programme personnel n'a pas à être dans le dépôt.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | coquille de la page, charge les scripts dans l'ordre |
| `css/app.css` | styles (thème clair/sombre, impression en noir) |
| `js/util.js` | dates, échappement, notes |
| `js/store.js` | état, stockage, export/import, rappel de sauvegarde |
| `js/plan.js` | répartition de la semaine (`planWeek`) et composition d'une séance (`buildBlocks`) |
| `js/audio.js` | synthèse « corde frottée », bourdon, notes, métronome avec montée de tempo, diapason |
| `js/chrono.js` | chronos par bloc, séance guidée, écran maintenu allumé |
| `js/micro.js` | détection de hauteur (voix ou violoncelle), enregistrement et réécoute |
| `js/app.js` | onglets et rendu général |
| `js/today.js` | séance du jour, blocs, impression, fin de séance |
| `js/week.js`, `js/stats.js`, `js/prog.js` | onglets Semaine, Suivi, Programme |
| `js/wizard.js` | assistant « Préparer la semaine suivante » |
| `js/main.js` | démarrage |
| `tests/smoke.js` | test de bout en bout (Chromium) |

Les scripts sont des scripts classiques qui partagent la portée globale : l'ordre de chargement
dans `index.html` compte (`main.js` en dernier).

## Règles de planification

- Semaine du mercredi au mardi (cours le mardi).
- Chaque élément reçoit des séances de travail ciblé selon son *importance* (faible, normale, forte,
  prioritaire). Un jour manqué est reporté.
- Valider un bloc = le cocher (ou laisser finir son chrono en séance guidée). Un jour compte dès
  que le travail ciblé est coché. Le bilan (ça passe / ça coince, une note) est le dernier bloc.
- Nouvelle semaine : assistant qui demande, pour chaque élément, « on continue / nouveau contenu /
  terminé » ; rien n'est modifié avant validation.
- « Ça coince » ramène le même passage à la séance suivante de cet élément.
- Durée : 15 min de base (oreille 3, lecture chantée 4, travail ciblé 7, retour 1), puis par
  tranches de 5 min : 20 = révision d'un 2e élément, 25 = travail ciblé +5, 30 = jouer d'une traite, 35 = déchiffrage, 40 = intervalles chantés, 45 = 3e élément, 50 = enregistrement.
- Lecture chantée : sur le passage principal la première fois qu'il est joué, sinon sur la liste
  de *passages à lire* (onglet Programme).

## Lecture chantée

Onglet « Lecture chantée » : exercices sans instrument (lire, oreille, degrés), par niveau (1 à 4), en clé de fa, d'ut 4e ou de sol, dans un ton choisi ou aléatoire. Les extraits sont dans `js/chant-data.js` (notation ABC simplifiée, une mesure par élément, sans reprise) ; `js/engrave.js` lit, transpose et dessine la partition en SVG, sans bibliothèque. Les contours des clés et des altérations viennent de GNU FreeSerif (GPL avec exception police). Pour ajouter un extrait, copier une entrée de `CHANT` ; `npm test` vérifie que chaque extrait se grave dans les trois clés et les douze tons.

## Tests

```
npm install
npx playwright install chromium
npm test
```

## Ajouter une œuvre à la lecture chantée

Dans le mode « Lecture chantée », le volet « Ajouter une œuvre » accepte les fichiers MuseScore (`.mscz`, `.mscx`) et MusicXML (`.musicxml`, `.xml`, `.mxl`). Tu peux corriger le titre, le compositeur, le mode et le niveau, et vérifier l'aperçu avant d'ajouter. L'œuvre est gardée dans l'appareil (et dans l'export JSON) et entre dans le tirage comme les autres, dans tous les tons et toutes les clés.

Limites : seule la première voix de la partie choisie est lue (accords : la note la plus haute), les reprises ne sont pas dépliées, les changements de métrique en cours de pièce ne sont pas gérés, et les triolets sont approximatifs. Si un fichier MuseScore échoue, l'exporter en MusicXML (Fichier > Exporter) est la solution de secours. Les fichiers d'essai sont dans `tests/fix/`.

## Son et outils (v9)

Le timbre de violoncelle (notes de la lecture chantée, La de référence) est synthétisé avec un spectre riche, des résonances de caisse, un bruit d'archet discret, un vibrato qui s'installe sur les notes longues et une petite réverbération. L'accordeur ne joue plus de La (le diapason reste réglable). En portrait, les onglets restent collés sous le panneau d'outils. Le bourdon est une voix unique, exacte, sans battements parasites : tonique seule, avec la quinte pure (3:2) ou avec l'octave (le centre de la roulette passe de l'un à l'autre). Taper sur le nom d'un outil l'ouvre ou le ferme (et l'arrête). Dans « Travail ciblé », le menu « Morceau à travailler » permet de remplacer le choix automatique pour la journée.

## Gamme et arpège (v12)

Dans la phase « Oreille », la gamme ou l'arpège 1-3-5-8 est écrit sur une portée, dans la tonalité du morceau travaillé (majeur ou mineur mélodique, au choix). « Écouter » la joue avec surlignage des notes. « Contrôler mon chant » suit la voix au micro, note par note, à l'octave près : la note passe quand elle est tenue une demi-seconde à ± 25 cents, puis elle se colore (vert ± 15 cents, jaune proche, rouge passée avec « Passer cette note »). Un bilan s'affiche à la fin.

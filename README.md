# Dagda Companion

> Compagnon numérique pour _La Saga de Dagda_ de Fabien Olicard
> Digital companion for _La Saga de Dagda_ by Fabien Olicard

---

## Français

### Qu'est-ce que c'est ?

**Dagda Companion** est une application web gratuite et open-source qui accompagne les lectrices et lecteurs de **_La Saga de Dagda_**, une série de livres-jeux de l'auteur et mentaliste **Fabien Olicard**.

L'application ne contient aucun texte du livre. Elle sert uniquement d'aide de jeu : gérer votre fiche de personnage, suivre votre progression, et ne plus avoir à griffer votre précieux livre au crayon.

### Fonctionnalités

- **Création de partie** — choisissez votre mode de jeu (Narratif, Simplifié, Mortel), votre talent et tirez vos caractéristiques initiales
- **Fiche de personnage** — Points de vie, Chance, Dextérité, chapitre courant
- **Inventaire** — armes (avec bonus de dégâts), objets, boulons
- **Combat au tour par tour** — jets de dés animés, dépense de chance pour ajuster un dé, journal de combat
- **Sauvegardes** — jusqu'à 3 emplacements par partie, restauration possible
- **Journal horodaté** — toutes vos actions consignées chronologiquement
- **Notes libres** — pour capturer vos idées sans spoiler le livre
- **Export / Import JSON** — sauvegardez votre partie en dehors de l'app
- **Multilingue** — français et anglais, avec détection automatique
- **Installable** — fonctionne hors-ligne, s'ajoute à l'écran d'accueil (PWA)

### Utiliser l'application

L'application est disponible à l'adresse suivante :

**[https://thomassloboda.github.io/dagda-companion/](https://thomassloboda.github.io/dagda-companion/)**

Aucune installation requise. Aucun compte. Tout reste stocké localement sur votre appareil.

### À propos de la série

_La Saga de Dagda_ est une série de livres-jeux de **Fabien Olicard**, auteur et mentaliste français. Chaque tome est une aventure solo où vos choix déterminent votre destin. Pour en savoir plus ou acheter les livres, rendez-vous sur le site officiel de l'auteur.

---

## English

### What is this?

**Dagda Companion** is a free, open-source web app designed for readers of **_La Saga de Dagda_**, a series of solo adventure books by French author and mentalist **Fabien Olicard**.

The app contains no text from the books. It is purely a play aid — manage your character sheet, track your progress, and keep your book pencil-free.

### Features

- **Party creation** — choose your game mode (Narrative, Simplified, Mortal), your talent, and roll your starting stats
- **Character sheet** — hit points, luck, dexterity, current chapter
- **Inventory** — weapons (with damage bonuses), items, boulons (currency)
- **Turn-based combat** — animated dice rolls, spend luck to adjust a die, combat log
- **Save slots** — up to 3 saves per run, restorable at any time
- **Timestamped journal** — every action logged in chronological order
- **Free notes** — capture your thoughts without spoiling the book
- **Export / Import JSON** — back up your run outside the app
- **Multilingual** — French and English, with automatic language detection
- **Installable** — works offline, can be added to your home screen (PWA)

### Use the app

The app is available at:

**[https://thomassloboda.github.io/dagda-companion/](https://thomassloboda.github.io/dagda-companion/)**

No installation required. No account. Everything is stored locally on your device.

### About the series

_La Saga de Dagda_ is a solo adventure book series by **Fabien Olicard**, a French author and mentalist. Each volume is a standalone adventure where your choices shape your fate. To learn more or purchase the books, visit the author's official website.

---

## Stack technique / Technical stack

| Rôle / Role                        | Technologie                            |
| ---------------------------------- | -------------------------------------- |
| Framework UI                       | React 18 + TypeScript                  |
| Build                              | Vite                                   |
| Styles                             | Tailwind CSS + DaisyUI                 |
| Routing                            | React Router v6                        |
| State management                   | Zustand                                |
| Persistance locale / Local storage | IndexedDB via Dexie                    |
| Dés / Dice                         | react-dice-roll                        |
| Internationalisation               | i18next + react-i18next                |
| PWA                                | vite-plugin-pwa                        |
| Tests                              | Vitest                                 |
| Qualité / Quality                  | ESLint + Prettier + commitlint + Husky |
| CI/CD                              | GitHub Actions → GitHub Pages          |
| Versioning                         | release-it + conventional-changelog    |

L'architecture suit le pattern **hexagonal** (ports & adapters) : le domaine métier est pur TypeScript, sans dépendance sur React, IndexedDB ou tout autre détail d'infrastructure.

The architecture follows the **hexagonal** pattern (ports & adapters): the business domain is pure TypeScript, with no dependency on React, IndexedDB, or any infrastructure detail.

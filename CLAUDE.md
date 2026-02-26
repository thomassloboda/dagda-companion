# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Dagda** est une PWA mobile-first, offline-first pour gérer une partie de "La Saga de Dagda – Tome 1". L'app ne contient PAS le texte du livre. Elle gère : création de partie, stats, chapitre courant, journal horodaté, combats avec dés, sauvegardes (max 3), notes, export/import JSON. Conçue pour une synchro backend future via outbox d'événements.

## Stack obligatoire

| Rôle    | Lib                                                        |
| ------- | ---------------------------------------------------------- |
| Build   | Vite + React + TypeScript                                  |
| UI      | TailwindCSS + DaisyUI (obligatoire partout)                |
| Routing | react-router (`basename` = `import.meta.env.BASE_URL`)     |
| State   | Zustand (logique domaine hors UI)                          |
| Storage | IndexedDB via Dexie, pattern repository                    |
| Dés     | `react-dice-roll` (visualisation + animation)              |
| PWA     | vite-plugin-pwa, service worker, offline                   |
| i18n    | i18next + react-i18next + i18next-browser-languagedetector |
| Tests   | Vitest                                                     |
| Qualité | ESLint + Prettier + commitlint + husky                     |

## Commandes

```bash
npm install --legacy-peer-deps   # react-dice-roll peer dep sur React 16

npm run dev          # dev server
npm run build        # production build
npm run preview      # preview build

npm run lint         # ESLint
npm run format       # Prettier
npm run test         # tous les tests (Vitest)
npm run test:domain  # tests domaine uniquement (rapides, sans UI)

# Lancer un test unique
npx vitest run src/domain/<file>.test.ts
```

Hooks git (husky) :

- `pre-commit` : lint + `test:domain`
- `pre-push` : `test`

## Architecture hexagonale (règle stricte)

```
src/
  domain/       ← pur TS, zéro import externe (entités, VO, règles, événements)
  application/  ← use cases (CreateParty, RollStats, StartCombat, ApplyLuck,
                             CreateSave, RestoreSave, ExportParty, ImportParty,
                             FinishParty, DeathReset, …)
  ports/        ← interfaces TS (PartyRepositoryPort, RngPort, ClockPort,
                                 EventLogPort, OutboxPort, ExportPort,
                                 ImportPort, SyncPort)
  adapters/     ← implémentations (Dexie repo, RNG crypto, clock Date,
                                   export JSON, theme storage)
  ui/
    pages/      ← React pages, appellent UNIQUEMENT les use cases
    components/ ← composants réutilisables
    locales/    ← fr-FR/translation.json, en-US/translation.json
    stores/     ← Zustand (thème)
  i18n.ts       ← init i18next (inline resources, LanguageDetector)
  vite-env.d.ts ← types Vite (import.meta.env, __APP_VERSION__)
  shared/       ← types partagés, helpers sans logique métier
```

**Règle absolue** : `ui/` ne touche jamais IndexedDB ni la logique de combat directement.
Flux : `UI → UseCases → Ports → Adapters`
Le domain n'importe rien hors de lui-même.

## Modèle de données (types TS dans `domain/`)

Types obligatoires : `Party`, `Character`, `Inventory`, `Weapon`, `Item`, `Currency`, `SaveSlot`, `Note`, `TimelineEvent`, `OutboxEvent`, `PartySnapshot`.

Invariants :

- 3 saves max par partie
- `timeline` append-only
- `outbox` append-only (seul le statut `PENDING/SENT` est modifiable)
- UUID via `crypto.randomUUID()`

## Règles du jeu (à implémenter dans `domain/`)

**Modes** : `NARRATIVE | SIMPLIFIED | MORTAL`

**Talents** (enum anglais, labels i18n) :
`INSTINCT | HERBOLOGY | STEALTH | PERSUASION | OBSERVATION | SLEIGHT_OF_HAND | EMPATHY_PRACTICE`
Note : `Talent.STEALTH` a pour valeur `"DISCRETION"` (clé i18n `talents.DISCRETION`).

**Caractéristiques initiales** :

- `hpMax = (2d6) * 4` ; `hpCurrent = hpMax`
- `luck = 1d6`
- `dexterity = 7`

**Combat normal** (tour par tour) :

- Toucher : `2d6 <= DEX` → succès
- Dégâts : `1 + 1d6 + bonusArme`
- Ennemi attaque avec ses propres stats
- Chance : modifier un dé après jet (dans les deux sens), coût = `|delta|`, log `luck_spent`

**Mort** (mode MORTAL, `hpCurrent = 0`) :

- Reset : chapitre=1, `hpCurrent=hpMax`, inventaire/armes/monnaie vidés, chance conservée
- Log : `death_reset`

**Parties terminées / mortes** : lecture seule dans le dashboard (toutes les actions de mutation sont masquées).

## Dés virtuels (`react-dice-roll`)

- Tous les jets passent par `RngPort` (logique domaine), `react-dice-roll` assure uniquement la visualisation.
- Chaque écran avec dés expose un bouton **"Relancer"** :
  - **Wizard Stats** : relance illimitée avant création de partie.
  - **Combat** : bouton explicite "Relancer (en cas de souci)" + disclaimer + log `dice_rerolled` systématique (contexte, valeurs avant/après).
- Événement `dice_rerolled` : `{ context, diceFaces, valueBefore, valueAfter, reason? }`.

## i18n

Deux locales : `fr-FR` (défaut) et `en-US`. Détection automatique via `localStorage` (`i18nextLng`) puis `navigator`. Switcher dans la page Paramètres.

Les clés sont organisées par feature : `common`, `status`, `timeAgo`, `timeline`, `talents`, `home`, `dashboard`, `createParty`, `combat`, `settings`, `notFound`, `changelog`.

La version de l'app est injectée par Vite via `define: { __APP_VERSION__ }` (lu depuis `package.json`) et déclarée dans `vite-env.d.ts`.

## Thème

DaisyUI via `data-theme` sur `<html>`. Trois modes : `light`, `dark`, `auto` (suit `prefers-color-scheme`). Persisté en `localStorage` via adapter dédié.

## Déploiement (GitHub Pages)

- `base: "/dagda-companion/"` dans `vite.config.ts`
- `public/404.html` redirige les routes SPA vers `index.html`
- `index.html` contient un script qui restaure le chemin redirigé
- `.github/workflows/deploy.yml` : build → release GitHub (tag `v{version}-{sha}`) → déploiement sur `gh-pages`
- URL : `https://thomassloboda.github.io/dagda-companion/`

## Synchro backend future (sans réseau maintenant)

`SyncPort` défini mais non implémenté. Les use cases critiques alimentent une **outbox locale** (`OutboxEvent` avec statut `PENDING`).

## Commits (obligatoire)

Format Conventional Commits : `<type>(<scope>): <subject>`
Types : `feat fix chore docs test refactor build ci perf style`
Scopes : `pwa ui domain storage combat sync theme docs config deps`
Subject **tout en minuscules** (contrainte commitlint `subject-case: lower-case`).

## UX / accessibilité

- Gros boutons, usage à une main, interface bilingue fr-FR / en-US.
- Mobile-first, testable offline (SW + cache assets).
- Sections "Aide / Rappels règles" masquées (DaisyUI collapse) dans le wizard — règles uniquement, jamais de texte narratif du livre.

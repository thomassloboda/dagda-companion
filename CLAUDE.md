# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Dagda** est une PWA mobile-first, offline-first pour gérer une partie de "La Saga de Dagda – Tome 1". L'app ne contient PAS le texte du livre. Elle gère : création de partie, stats, chapitre courant, journal horodaté, combats avec dés, sauvegardes (max 3), notes, export/import JSON. Conçue pour une synchro backend future via outbox d'événements.

## Stack obligatoire

| Rôle | Lib |
|------|-----|
| Build | Vite + React + TypeScript |
| UI | TailwindCSS + DaisyUI (obligatoire partout) |
| Routing | react-router |
| State | Zustand (logique domaine hors UI) |
| Storage | IndexedDB via Dexie, pattern repository |
| Dés | `react-dice-roll` (visualisation + animation) |
| PWA | vite-plugin-pwa, service worker, offline |
| Tests | Vitest |
| Qualité | ESLint + Prettier + commitlint + husky |

## Commandes

```bash
npm install

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
  ui/           ← React pages/components, appelle UNIQUEMENT les use cases
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

**Talents** (enum anglais, labels FR en UI) :
`INSTINCT | HERBOLOGY | DISCRETION | PERSUASION | OBSERVATION | SLEIGHT_OF_HAND | EMPATHY_PRACTICE`

**Caractéristiques initiales** :
- `hpMax = (2d6) * 4` ; `hpCurrent = hpMax`
- `luck = 1d6`
- `dexterity = 7`

**Combat normal** (tour par tour) :
- Toucher : `2d6 <= DEX` → succès
- Dégâts : `1 + 1d6 + bonusArme`
- Ennemi attaque avec ses propres stats
- Chance : ajuster un dé après jet (augmenter uniquement), coût = delta, log `luck_spent`

**Mort** (mode MORTAL, `hpCurrent = 0`) :
- Reset : chapitre=1, `hpCurrent=hpMax`, inventaire/armes/monnaie vidés, chance conservée
- Log : `death_reset`

## Dés virtuels (`react-dice-roll`)

- Tous les jets passent par `RngPort` (logique domaine), `react-dice-roll` assure uniquement la visualisation.
- Chaque écran avec dés expose un bouton **"Relancer"** :
  - **Wizard Stats** : relance illimitée avant création de partie.
  - **Combat** : bouton explicite "Relancer (en cas de souci)" + disclaimer + log `dice_rerolled` systématique (contexte, valeurs avant/après).
- Événement `dice_rerolled` : `{ context, diceFaces, valueBefore, valueAfter, reason? }`.

## Thème

DaisyUI via `data-theme` sur `<html>`. Trois modes : `light`, `dark`, `auto` (suit `prefers-color-scheme`). Persisté en `localStorage` via adapter dédié.

## Synchro backend future (sans réseau maintenant)

`SyncPort` défini mais non implémenté. Les use cases critiques alimentent une **outbox locale** (`OutboxEvent` avec statut `PENDING`). Voir `docs/architecture.md` pour le flux outbox.

## Commits (obligatoire)

Format Conventional Commits : `<type>(<scope>): <subject>`
Types : `feat fix chore docs test refactor build ci perf style`
Scopes : `pwa ui domain storage combat sync theme docs`
Commits atomiques par tâche (T1..T14).

## Docs

- `docs/architecture.md` : diagrammes Mermaid (hexagonal, flux création partie, sauvegarde/restauration, combat + chance + relance dés, outbox/sync future).
- `CONTRIBUTING.md` : convention de commits + workflow.

## UX / accessibilité

- Gros boutons, usage à une main, textes en français.
- Mobile-first, testable offline (SW + cache assets).
- Sections "Aide / Rappels règles" masquées (DaisyUI collapse) dans le wizard — règles uniquement, jamais de texte narratif du livre.

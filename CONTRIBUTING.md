# Contribuer à Dagda

## Convention de commits (Conventional Commits)

Tous les commits doivent respecter le format :

```
<type>(<scope>): <subject>
```

### Types

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Refactoring sans changement fonctionnel |
| `test` | Ajout ou modification de tests |
| `docs` | Documentation uniquement |
| `chore` | Tâches de maintenance (deps, config…) |
| `build` | Configuration build/bundler |
| `ci` | CI/CD |
| `perf` | Optimisation de performance |
| `style` | Formatage, espaces (pas de logique) |

### Scopes

`pwa` `ui` `domain` `storage` `combat` `sync` `theme` `docs` `config` `deps`

### Exemples

```
feat(domain): add character death reset rule
fix(combat): correct luck cost calculation
test(domain): add tests for resolveHit edge cases
refactor(storage): extract base repository class
docs(docs): update architecture diagrams
```

## Hooks git (automatiques via Husky)

- **pre-commit** : ESLint + tests domaine (`npm run test:domain`) + lint-staged
- **pre-push** : tous les tests (`npm run test`)
- **commit-msg** : validation commitlint

## Workflow

```bash
# 1. Installer les dépendances
npm install

# 2. Développer
npm run dev

# 3. Vérifier
npm run lint
npm run test:domain  # rapide (domaine seul)
npm run test         # tous

# 4. Formatter
npm run format

# 5. Committer (commitlint validera le message)
git commit -m "feat(ui): add inventory screen"
```

## Architecture

Voir `docs/architecture.md` pour les diagrammes Mermaid.

Règle absolue : **UI → UseCases → Ports → Adapters**. Le domain (`src/domain/`) n'importe rien d'externe.

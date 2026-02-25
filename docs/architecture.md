# Architecture – Dagda PWA

## 1. Architecture Hexagonale

```mermaid
graph TB
    subgraph UI["UI (React)"]
        Pages["Pages / Components"]
        Stores["Zustand Stores"]
    end

    subgraph App["Application"]
        UC["Use Cases\n(CreateParty, Combat,\nSaves, Export…)"]
    end

    subgraph Domain["Domain (pur)"]
        Models["Models / Enums"]
        Rules["Rules\n(character, combat)"]
    end

    subgraph Ports["Ports (interfaces)"]
        PR["PartyRepositoryPort"]
        EL["EventLogPort"]
        OP["OutboxPort"]
        RNG["RngPort"]
        CLK["ClockPort"]
        EXP["ExportPort / ImportPort"]
        SYNC["SyncPort (future)"]
    end

    subgraph Adapters["Adapters (impl)"]
        DexieRepos["Dexie Repositories"]
        Crypto["CryptoRngAdapter"]
        DateClock["DateClockAdapter"]
        JsonExport["JsonExportAdapter"]
    end

    Pages -->|appelle| UC
    UC -->|orchestrate| Rules
    UC -->|via ports| PR & EL & OP & RNG & CLK & EXP
    PR & EL & OP -->|impl| DexieRepos
    RNG -->|impl| Crypto
    CLK -->|impl| DateClock
    EXP -->|impl| JsonExport
    DexieRepos -->|IndexedDB| Storage[("IndexedDB\n(Dexie)")]
    SYNC -.->|not impl| Backend[("Backend\n(future)")]
```

## 2. Flux création de partie (Wizard)

```mermaid
sequenceDiagram
    actor User
    participant Wizard as CreatePartyPage
    participant RNG as CryptoRngAdapter
    participant Domain as createCharacter()
    participant Repo as PartyRepository
    participant Log as EventLogRepository
    participant Outbox as OutboxRepository

    User->>Wizard: Remplit nom + mode + talent
    User->>Wizard: Lance les dés (bouton Relancer illimité)
    Wizard->>RNG: rollD6() × 3 (2d6 HP + 1d6 luck)
    RNG-->>Wizard: hpDice[2], luckDice
    User->>Wizard: Clique "Créer la partie"
    Wizard->>Domain: createCharacter(hpRoll, luckRoll, talent)
    Domain-->>Wizard: Character (hpMax=roll*4, dex=7)
    Wizard->>Repo: save(Party)
    Wizard->>Log: append(PARTY_CREATED)
    Wizard->>Outbox: append(PARTY_CREATED, PENDING)
    Wizard-->>User: navigate("/party/:id")
```

## 3. Flux sauvegarde / restauration

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant CreateSave as CreateSaveUseCase
    participant RestoreSave as RestoreSaveUseCase
    participant SaveRepo as SaveSlotRepository
    participant PartyRepo as PartyRepository
    participant Log as EventLogRepository

    Note over User,Log: Créer une sauvegarde

    User->>Dashboard: Clique "💾 Slot N"
    Dashboard->>CreateSave: execute(partyId, slot)
    CreateSave->>PartyRepo: findById()
    CreateSave->>SaveRepo: findByPartyId() — vérif max 3
    CreateSave->>SaveRepo: save(SaveSlot{snapshot})
    CreateSave->>Log: append(SAVE_CREATED ou SAVE_REPLACED)

    Note over User,Log: Restaurer (mode non-SIMPLIFIED)

    User->>Dashboard: Clique "Restaurer"
    Dashboard->>RestoreSave: execute(partyId, slotId)
    RestoreSave->>SaveRepo: findByPartyId()
    RestoreSave-->>RestoreSave: garde SIMPLIFIED (seule la plus récente)
    RestoreSave->>PartyRepo: save(snapshot.party)
    RestoreSave->>Log: append(SAVE_RESTORED)
```

## 4. Flux combat + chance + relance dés

```mermaid
sequenceDiagram
    actor User
    participant CombatPage
    participant RNG as CryptoRngAdapter
    participant Rules as combat rules
    participant HpUC as UpdateHpUseCase
    participant LuckUC as ApplyLuckUseCase
    participant Log as EventLogRepository
    participant Outbox as OutboxRepository

    User->>CombatPage: Clique "Attaquer"
    CombatPage->>RNG: roll2D6()
    RNG-->>CombatPage: [d1, d2]
    CombatPage->>Rules: resolveHit([d1,d2], DEX)

    alt Succès
        CombatPage->>RNG: rollD6()
        CombatPage->>Rules: resolveDamage(roll, weaponBonus)
        CombatPage->>Log: append(COMBAT_HIT)

        opt Utiliser la chance
            User->>CombatPage: Ajuster dé→valeur cible
            CombatPage->>Rules: applyLuckToDie(original, target, luck)
            CombatPage->>LuckUC: execute(partyId, cost)
            CombatPage->>Log: append(LUCK_SPENT)
        end
    else Échec
        CombatPage->>Log: append(COMBAT_MISS)
    end

    opt Relancer (bug visuel)
        User->>CombatPage: Clique "Relancer (en cas de souci)"
        CombatPage-->>User: Disclaimer + confirmation
        User->>CombatPage: Confirme
        CombatPage->>RNG: roll2D6()
        CombatPage->>Log: append(DICE_REROLLED, {before, after})
        CombatPage->>Outbox: append(DICE_REROLLED, PENDING)
    end

    User->>CombatPage: Clique "ennemi attaque"
    CombatPage->>RNG: roll2D6()
    CombatPage->>Rules: resolveHit([d1,d2], enemy.DEX)
    alt Ennemi touche
        CombatPage->>HpUC: execute(partyId, -damage)
        HpUC-->>HpUC: death reset si MORTAL + PV=0
    end
```

## 5. Flux Outbox / Sync future

```mermaid
flowchart LR
    UC[Use Cases\n- CreateParty\n- UpdateHp (death)\n- CreateSave\n- FinishParty\n- DiceRerolled]
    -->|append PENDING| OB[(Outbox\nIndexedDB)]

    OB -->|findPending| SYNC[SyncPort\n⚠️ non implémenté]
    SYNC -->|pushEvents| API[(Backend API\nfuture)]
    SYNC -->|updateStatus SENT| OB

    style SYNC stroke-dasharray: 5 5
    style API stroke-dasharray: 5 5
```

### Modèle OutboxEvent

```typescript
interface OutboxEvent {
  id: string;           // UUID
  partyId: string;
  type: TimelineEventType;
  payload: Record<string, unknown>;
  status: "PENDING" | "SENT";
  createdAt: string;    // ISO
  sentAt?: string;      // ISO, rempli par SyncAdapter
}
```

### Implémenter la synchro backend (guide)

1. Créer `src/adapters/HttpSyncAdapter.ts` implémentant `SyncPort`
2. Enregistrer dans `src/application/container.ts`
3. Créer un worker/hook `useSyncWorker` qui :
   - Appelle `outboxRepo.findPending()`
   - Appelle `syncAdapter.pushEvents(events)`
   - Met à jour les statuts à `SENT`
4. Le backend reçoit les événements et reconstruit l'état (event sourcing)

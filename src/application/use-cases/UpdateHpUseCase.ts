import type { PartyRepositoryPort, EventLogPort, OutboxPort, ClockPort } from "../../ports";
import { applyHpChange, isDead } from "../../domain/rules/character";
import { TimelineEventType, OutboxStatus, GameMode, PartyStatus } from "../../domain/models";

export interface UpdateHpResult {
  /** true si PV = 0 (quelle que soit le mode) */
  isDead: boolean;
  /** true uniquement en mode MORTAL quand PV = 0 → partie terminée définitivement */
  isMortalDeath: boolean;
}

export class UpdateHpUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly outbox: OutboxPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, delta: number): Promise<UpdateHpResult> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    const now = this.clock.now();

    const newChar = applyHpChange(party.character, delta);
    let updated = { ...party, character: newChar, updatedAt: now };

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.HP_CHANGED,
      label: `PV ${delta > 0 ? "+" : ""}${delta} (${newChar.hpCurrent}/${newChar.hpMax})`,
      payload: { delta, before: party.character.hpCurrent, after: newChar.hpCurrent },
      createdAt: now,
    });

    const dead = isDead(newChar);
    const isMortalDeath = dead && party.mode === GameMode.MORTAL;

    if (isMortalDeath) {
      // Mode MORTAL : fin de partie définitive, PV restent à 0
      updated = { ...updated, status: PartyStatus.DEAD };
      await this.eventLog.append({
        id: crypto.randomUUID(),
        partyId,
        type: TimelineEventType.DEATH_RESET,
        label: "☠️ Mort définitive — l'aventure se termine.",
        payload: {},
        createdAt: now,
      });
      await this.outbox.append({
        id: crypto.randomUUID(),
        partyId,
        type: TimelineEventType.DEATH_RESET,
        payload: { partyId },
        status: OutboxStatus.PENDING,
        createdAt: now,
      });
    }

    await this.partyRepo.save(updated);
    return { isDead: dead, isMortalDeath };
  }
}

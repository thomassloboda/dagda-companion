import type { PartyRepositoryPort, EventLogPort, OutboxPort, ClockPort } from "../../ports";
import { applyHpChange, isDead, applyDeathReset } from "../../domain/rules/character";
import { TimelineEventType, OutboxStatus, GameMode, PartyStatus } from "../../domain/models";

export class UpdateHpUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly outbox: OutboxPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, delta: number): Promise<void> {
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

    // Death in MORTAL mode
    if (isDead(newChar) && party.mode === GameMode.MORTAL) {
      const resetChar = applyDeathReset(newChar);
      updated = {
        ...updated,
        character: resetChar,
        currentChapter: 1,
        status: PartyStatus.ACTIVE,
      };
      await this.eventLog.append({
        id: crypto.randomUUID(),
        partyId,
        type: TimelineEventType.DEATH_RESET,
        label: "Mort — reset mortel (chapitre 1, PV max, inventaire vidé)",
        payload: { chapter: 1 },
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
  }
}

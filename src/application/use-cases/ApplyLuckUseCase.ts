import type { PartyRepositoryPort, EventLogPort, ClockPort } from "../../ports";
import { applyLuckCost } from "../../domain/rules/character";
import { TimelineEventType } from "../../domain/models";

export class ApplyLuckUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, luckCost: number): Promise<void> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    if (party.character.luck < luckCost) throw new Error("Chance insuffisante.");
    const now = this.clock.now();
    const newChar = applyLuckCost(party.character, luckCost);
    await this.partyRepo.save({ ...party, character: newChar, updatedAt: now });
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.LUCK_SPENT,
      label: `Chance dépensée : -${luckCost} (reste ${newChar.luck})`,
      payload: { cost: luckCost, remaining: newChar.luck },
      createdAt: now,
    });
  }
}

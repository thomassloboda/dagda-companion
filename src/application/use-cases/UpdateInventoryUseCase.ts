import type { PartyRepositoryPort, EventLogPort, ClockPort } from "../../ports";
import type { Inventory } from "../../domain/models";
import { TimelineEventType } from "../../domain/models";

export class UpdateInventoryUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, inventory: Inventory, label: string): Promise<void> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    const now = this.clock.now();
    await this.partyRepo.save({
      ...party,
      character: { ...party.character, inventory },
      updatedAt: now,
    });
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.INVENTORY_CHANGED,
      label,
      createdAt: now,
    });
  }
}

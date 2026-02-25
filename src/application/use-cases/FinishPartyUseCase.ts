import type { PartyRepositoryPort, EventLogPort, OutboxPort, ClockPort } from "../../ports";
import { TimelineEventType, OutboxStatus, PartyStatus } from "../../domain/models";

export class FinishPartyUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly outbox: OutboxPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string): Promise<void> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    const now = this.clock.now();
    await this.partyRepo.save({ ...party, status: PartyStatus.FINISHED, updatedAt: now });
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.PARTY_FINISHED,
      label: "Partie terminée",
      createdAt: now,
    });
    await this.outbox.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.PARTY_FINISHED,
      payload: { partyId },
      status: OutboxStatus.PENDING,
      createdAt: now,
    });
  }
}

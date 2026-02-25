import type { PartyRepositoryPort, EventLogPort, ClockPort } from "../../ports";
import { TimelineEventType } from "../../domain/models";

export class UpdateChapterUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, chapter: number): Promise<void> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    if (chapter === party.currentChapter) return;
    const now = this.clock.now();
    const updated = { ...party, currentChapter: chapter, updatedAt: now };
    await this.partyRepo.save(updated);
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.CHAPTER_SET,
      label: `§ ${party.currentChapter} → ${chapter}`,
      payload: { chapter, previous: party.currentChapter },
      createdAt: now,
    });
  }
}

import type {
  PartyRepositoryPort,
  NoteRepositoryPort,
  SaveSlotRepositoryPort,
  EventLogPort,
  ClockPort,
  ImportPort,
} from "../../ports";
import { TimelineEventType, PartyStatus } from "../../domain/models";
import type { Party } from "../../domain/models";

export class ImportPartyUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly noteRepo: NoteRepositoryPort,
    private readonly saveSlotRepo: SaveSlotRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
    private readonly importPort: ImportPort,
  ) {}

  async execute(jsonData: string): Promise<Party> {
    const snapshot = this.importPort.importParty(jsonData);
    const now = this.clock.now();

    // New ID to avoid collision
    const newId = crypto.randomUUID();
    const party: Party = {
      ...snapshot.party,
      id: newId,
      status: PartyStatus.ACTIVE,
      updatedAt: now,
    };

    await this.partyRepo.save(party);

    for (const note of snapshot.notes) {
      await this.noteRepo.save({ ...note, partyId: newId });
    }

    for (const slot of snapshot.saveSlots) {
      await this.saveSlotRepo.save({ ...slot, id: crypto.randomUUID(), partyId: newId });
    }

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId: newId,
      type: TimelineEventType.PARTY_CREATED,
      label: `Partie importée : "${party.name}"`,
      payload: { imported: true },
      createdAt: now,
    });

    return party;
  }
}

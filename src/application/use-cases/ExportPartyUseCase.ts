import type {
  PartyRepositoryPort,
  NoteRepositoryPort,
  SaveSlotRepositoryPort,
  ExportPort,
  EventLogPort,
  ClockPort,
} from "../../ports";
import { TimelineEventType } from "../../domain/models";

export interface ExportResult {
  json: string;
  summary: string;
}

export class ExportPartyUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly noteRepo: NoteRepositoryPort,
    private readonly saveSlotRepo: SaveSlotRepositoryPort,
    private readonly exportPort: ExportPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string): Promise<ExportResult> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    const notes = await this.noteRepo.findByPartyId(partyId);
    const saveSlots = await this.saveSlotRepo.findByPartyId(partyId);
    const snapshot = { party, notes, saveSlots };

    const json = this.exportPort.exportParty(snapshot);
    const summary = this.exportPort.exportSummary(snapshot);
    const now = this.clock.now();

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.PARTY_EXPORTED,
      label: "Partie exportée (JSON)",
      createdAt: now,
    });

    return { json, summary };
  }
}

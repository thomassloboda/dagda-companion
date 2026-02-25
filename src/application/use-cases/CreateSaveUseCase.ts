import type {
  PartyRepositoryPort,
  NoteRepositoryPort,
  SaveSlotRepositoryPort,
  EventLogPort,
  OutboxPort,
  ClockPort,
} from "../../ports";
import { TimelineEventType, OutboxStatus } from "../../domain/models";
import type { SaveSlot } from "../../domain/models";
import { MAX_SAVE_SLOTS } from "../../domain/rules/character";

export class CreateSaveUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly noteRepo: NoteRepositoryPort,
    private readonly saveSlotRepo: SaveSlotRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly outbox: OutboxPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, targetSlot: 1 | 2 | 3): Promise<SaveSlot> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);
    const notes = await this.noteRepo.findByPartyId(partyId);
    const slots = await this.saveSlotRepo.findByPartyId(partyId);
    const now = this.clock.now();

    const existing = slots.find((s) => s.slot === targetSlot);
    if (slots.length >= MAX_SAVE_SLOTS && !existing) {
      throw new Error("Maximum 3 sauvegardes atteint.");
    }

    const slot: SaveSlot = {
      id: existing?.id ?? crypto.randomUUID(),
      partyId,
      slot: targetSlot,
      snapshot: { party, notes, saveSlots: slots },
      createdAt: now,
    };

    await this.saveSlotRepo.save(slot);

    const eventType = existing
      ? TimelineEventType.SAVE_REPLACED
      : TimelineEventType.SAVE_CREATED;
    const label = existing
      ? `Sauvegarde slot ${targetSlot} remplacée`
      : `Sauvegarde créée (slot ${targetSlot})`;

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: eventType,
      label,
      payload: { slot: targetSlot },
      createdAt: now,
    });

    await this.outbox.append({
      id: crypto.randomUUID(),
      partyId,
      type: eventType,
      payload: { partyId, slot: targetSlot },
      status: OutboxStatus.PENDING,
      createdAt: now,
    });

    return slot;
  }
}

import type {
  PartyRepositoryPort,
  NoteRepositoryPort,
  SaveSlotRepositoryPort,
  EventLogPort,
  ClockPort,
} from "../../ports";
import { TimelineEventType } from "../../domain/models";
import { canRestoreAnySlot } from "../../domain/rules/character";
import type { Party } from "../../domain/models";

export class RestoreSaveUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly noteRepo: NoteRepositoryPort,
    private readonly saveSlotRepo: SaveSlotRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, slotId: string): Promise<Party> {
    const party = await this.partyRepo.findById(partyId);
    if (!party) throw new Error(`Partie ${partyId} introuvable.`);

    const slots = await this.saveSlotRepo.findByPartyId(partyId);
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) throw new Error(`Slot de sauvegarde ${slotId} introuvable.`);

    // Mode SIMPLIFIED: seule la sauvegarde la plus récente est restaurable
    if (!canRestoreAnySlot(party.mode)) {
      const latest = slots.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      if (latest?.id !== slotId) {
        throw new Error("Mode Simplifié : seule la sauvegarde la plus récente peut être restaurée.");
      }
    }

    const { snapshot } = slot;
    const now = this.clock.now();
    const restored = { ...snapshot.party, updatedAt: now };

    await this.partyRepo.save(restored);

    // restore notes
    for (const note of snapshot.notes) {
      await this.noteRepo.save(note);
    }

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.SAVE_RESTORED,
      label: `Sauvegarde slot ${slot.slot} restaurée`,
      payload: { slotId, slot: slot.slot },
      createdAt: now,
    });

    return restored;
  }
}

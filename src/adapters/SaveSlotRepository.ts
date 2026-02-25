import type { SaveSlotRepositoryPort } from "../ports";
import type { SaveSlot } from "../domain/models";
import { db } from "../infrastructure/db/database";

export class SaveSlotRepository implements SaveSlotRepositoryPort {
  async findByPartyId(partyId: string): Promise<SaveSlot[]> {
    return db.saveSlots.where("partyId").equals(partyId).toArray();
  }

  async save(slot: SaveSlot): Promise<void> {
    await db.saveSlots.put(slot);
  }

  async delete(id: string): Promise<void> {
    await db.saveSlots.delete(id);
  }
}

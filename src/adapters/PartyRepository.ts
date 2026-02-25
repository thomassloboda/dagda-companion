import type { PartyRepositoryPort } from "../ports";
import type { Party } from "../domain/models";
import { db } from "../infrastructure/db/database";

export class PartyRepository implements PartyRepositoryPort {
  async findAll(): Promise<Party[]> {
    return db.parties.orderBy("updatedAt").reverse().toArray();
  }

  async findById(id: string): Promise<Party | undefined> {
    return db.parties.get(id);
  }

  async save(party: Party): Promise<void> {
    await db.parties.put(party);
  }

  async delete(id: string): Promise<void> {
    await db.transaction("rw", [db.parties, db.notes, db.saveSlots, db.timeline, db.outbox], async () => {
      await db.parties.delete(id);
      await db.notes.where("partyId").equals(id).delete();
      await db.saveSlots.where("partyId").equals(id).delete();
      await db.timeline.where("partyId").equals(id).delete();
      await db.outbox.where("partyId").equals(id).delete();
    });
  }
}

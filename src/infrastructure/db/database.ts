import Dexie, { type Table } from "dexie";
import type { Party, Note, SaveSlot, TimelineEvent, OutboxEvent } from "../../domain/models";

export class DagdaDatabase extends Dexie {
  parties!: Table<Party, string>;
  notes!: Table<Note, string>;
  saveSlots!: Table<SaveSlot, string>;
  timeline!: Table<TimelineEvent, string>;
  outbox!: Table<OutboxEvent, string>;

  constructor() {
    super("dagda-db");
    this.version(1).stores({
      parties: "id, status, updatedAt",
      notes: "id, partyId, createdAt",
      saveSlots: "id, partyId, slot, createdAt",
      timeline: "id, partyId, type, createdAt",
      outbox: "id, partyId, status, createdAt",
    });
  }
}

export const db = new DagdaDatabase();

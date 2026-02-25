import type { NoteRepositoryPort } from "../ports";
import type { Note } from "../domain/models";
import { db } from "../infrastructure/db/database";

export class NoteRepository implements NoteRepositoryPort {
  async findByPartyId(partyId: string): Promise<Note[]> {
    return db.notes.where("partyId").equals(partyId).reverse().sortBy("createdAt");
  }

  async save(note: Note): Promise<void> {
    await db.notes.put(note);
  }
}

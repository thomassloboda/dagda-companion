import type { NoteRepositoryPort, EventLogPort, ClockPort } from "../../ports";
import { TimelineEventType } from "../../domain/models";
import type { Note } from "../../domain/models";

export class AddNoteUseCase {
  constructor(
    private readonly noteRepo: NoteRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, content: string): Promise<Note> {
    const now = this.clock.now();
    const note: Note = { id: crypto.randomUUID(), partyId, content, createdAt: now };
    await this.noteRepo.save(note);
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.NOTE_ADDED,
      label: `Note ajoutée : "${content.slice(0, 40)}${content.length > 40 ? "…" : ""}"`,
      payload: { noteId: note.id },
      createdAt: now,
    });
    return note;
  }
}

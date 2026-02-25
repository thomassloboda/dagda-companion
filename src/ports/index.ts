import {
  Party,
  Note,
  SaveSlot,
  TimelineEvent,
  OutboxEvent,
  OutboxStatus,
  PartySnapshot,
} from "../domain/models";

// ─── Storage ports ─────────────────────────────────────────────────────────────

export interface PartyRepositoryPort {
  findAll(): Promise<Party[]>;
  findById(id: string): Promise<Party | undefined>;
  save(party: Party): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface NoteRepositoryPort {
  findByPartyId(partyId: string): Promise<Note[]>;
  save(note: Note): Promise<void>;
}

export interface SaveSlotRepositoryPort {
  findByPartyId(partyId: string): Promise<SaveSlot[]>;
  save(slot: SaveSlot): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventLogPort {
  findByPartyId(partyId: string): Promise<TimelineEvent[]>;
  append(event: TimelineEvent): Promise<void>;
}

export interface OutboxPort {
  findPending(): Promise<OutboxEvent[]>;
  append(event: OutboxEvent): Promise<void>;
  updateStatus(id: string, status: OutboxStatus, sentAt?: string): Promise<void>;
}

// ─── Infrastructure ports ─────────────────────────────────────────────────────

export interface RngPort {
  rollD6(): number;
  roll2D6(): [number, number];
  rollNd6(n: number): number[];
}

export interface ClockPort {
  now(): string; // ISO date string
}

export interface ExportPort {
  exportParty(snapshot: PartySnapshot): string; // JSON string
  exportSummary(snapshot: PartySnapshot): string; // human-readable text
}

export interface ImportPort {
  importParty(data: string): PartySnapshot; // throws on invalid
}

// ─── Sync port (future — not implemented) ─────────────────────────────────────

export interface SyncPort {
  pushEvents(events: OutboxEvent[]): Promise<void>;
  pullParty(partyId: string): Promise<PartySnapshot | null>;
}

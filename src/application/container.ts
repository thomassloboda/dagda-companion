/**
 * Service Locator / DI Container
 * Instancie une fois tous les adapters et use cases.
 * La UI importe uniquement depuis ce fichier.
 */
import { PartyRepository } from "../adapters/PartyRepository";
import { NoteRepository } from "../adapters/NoteRepository";
import { SaveSlotRepository } from "../adapters/SaveSlotRepository";
import { EventLogRepository } from "../adapters/EventLogRepository";
import { OutboxRepository } from "../adapters/OutboxRepository";
import { CryptoRngAdapter } from "../adapters/CryptoRngAdapter";
import { DateClockAdapter } from "../adapters/DateClockAdapter";
import { JsonExportAdapter } from "../adapters/JsonExportAdapter";

import { CreatePartyUseCase } from "./use-cases/CreatePartyUseCase";
import { UpdateChapterUseCase } from "./use-cases/UpdateChapterUseCase";
import { UpdateHpUseCase } from "./use-cases/UpdateHpUseCase";
import { AddNoteUseCase } from "./use-cases/AddNoteUseCase";
import { AddCustomActionUseCase } from "./use-cases/AddCustomActionUseCase";
import { CreateSaveUseCase } from "./use-cases/CreateSaveUseCase";
import { RestoreSaveUseCase } from "./use-cases/RestoreSaveUseCase";
import { ExportPartyUseCase } from "./use-cases/ExportPartyUseCase";
import { ImportPartyUseCase } from "./use-cases/ImportPartyUseCase";
import { FinishPartyUseCase } from "./use-cases/FinishPartyUseCase";
import { ApplyLuckUseCase } from "./use-cases/ApplyLuckUseCase";
import { UpdateInventoryUseCase } from "./use-cases/UpdateInventoryUseCase";

// ─── Adapters ─────────────────────────────────────────────────────────────────

export const partyRepo = new PartyRepository();
export const noteRepo = new NoteRepository();
export const saveSlotRepo = new SaveSlotRepository();
export const eventLog = new EventLogRepository();
export const outboxRepo = new OutboxRepository();
export const rng = new CryptoRngAdapter();
export const clock = new DateClockAdapter();
export const jsonExport = new JsonExportAdapter();

// ─── Use Cases ────────────────────────────────────────────────────────────────

export const createParty = new CreatePartyUseCase(partyRepo, eventLog, outboxRepo, rng, clock);
export const updateChapter = new UpdateChapterUseCase(partyRepo, eventLog, clock);
export const updateHp = new UpdateHpUseCase(partyRepo, eventLog, outboxRepo, clock);
export const addNote = new AddNoteUseCase(noteRepo, eventLog, clock);
export const addCustomAction = new AddCustomActionUseCase(eventLog, clock);
export const createSave = new CreateSaveUseCase(partyRepo, noteRepo, saveSlotRepo, eventLog, outboxRepo, clock);
export const restoreSave = new RestoreSaveUseCase(partyRepo, noteRepo, saveSlotRepo, eventLog, clock);
export const exportParty = new ExportPartyUseCase(partyRepo, noteRepo, saveSlotRepo, jsonExport, eventLog, clock);
export const importParty = new ImportPartyUseCase(partyRepo, noteRepo, saveSlotRepo, eventLog, clock, jsonExport);
export const finishParty = new FinishPartyUseCase(partyRepo, eventLog, outboxRepo, clock);
export const applyLuck = new ApplyLuckUseCase(partyRepo, eventLog, clock);
export const updateInventory = new UpdateInventoryUseCase(partyRepo, eventLog, clock);

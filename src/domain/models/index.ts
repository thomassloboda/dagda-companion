// ─── Enums ────────────────────────────────────────────────────────────────────

export enum GameMode {
  NARRATIVE = "NARRATIVE",
  SIMPLIFIED = "SIMPLIFIED",
  MORTAL = "MORTAL",
}

export enum Talent {
  INSTINCT = "INSTINCT",
  HERBOLOGY = "HERBOLOGY",
  DISCRETION = "DISCRETION",
  PERSUASION = "PERSUASION",
  OBSERVATION = "OBSERVATION",
  SLEIGHT_OF_HAND = "SLEIGHT_OF_HAND",
  EMPATHY_PRACTICE = "EMPATHY_PRACTICE",
}

export const TALENT_LABELS: Record<Talent, string> = {
  [Talent.INSTINCT]: "Instinct",
  [Talent.HERBOLOGY]: "Herboristerie",
  [Talent.DISCRETION]: "Discrétion",
  [Talent.PERSUASION]: "Persuasion",
  [Talent.OBSERVATION]: "Observation",
  [Talent.SLEIGHT_OF_HAND]: "Tour de main",
  [Talent.EMPATHY_PRACTICE]: "Pratique de l'empathie",
};

export enum PartyStatus {
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
  DEAD = "DEAD",
}

export enum TimelineEventType {
  PARTY_CREATED = "party_created",
  CHAPTER_SET = "chapter_set",
  HP_CHANGED = "hp_changed",
  LUCK_SPENT = "luck_spent",
  LUCK_CHANGED = "luck_changed",
  NOTE_ADDED = "note_added",
  SAVE_CREATED = "save_created",
  SAVE_REPLACED = "save_replaced",
  SAVE_RESTORED = "save_restored",
  COMBAT_STARTED = "combat_started",
  COMBAT_HIT = "combat_hit",
  COMBAT_MISS = "combat_miss",
  COMBAT_ENEMY_HIT = "combat_enemy_hit",
  COMBAT_ENEMY_MISS = "combat_enemy_miss",
  COMBAT_VICTORY = "combat_victory",
  COMBAT_DEFEAT = "combat_defeat",
  DEATH_RESET = "death_reset",
  DICE_REROLLED = "dice_rerolled",
  PARTY_EXPORTED = "party_exported",
  PARTY_FINISHED = "party_finished",
  CUSTOM_ACTION = "custom_action",
  INVENTORY_CHANGED = "inventory_changed",
}

export enum OutboxStatus {
  PENDING = "PENDING",
  SENT = "SENT",
}

// ─── Core models ──────────────────────────────────────────────────────────────

export interface Weapon {
  id: string;
  name: string;
  bonus: number; // bonus dégâts
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  quantity: number;
  description?: string;
}

export interface Currency {
  boulons: number;
}

export interface Inventory {
  weapons: Weapon[];
  items: Item[];
  currency: Currency;
  /** id de l'arme active en combat (fallback sur la première si absent) */
  equippedWeaponId?: string;
}

export interface Character {
  name: string;
  talent: Talent;
  hpMax: number;
  hpCurrent: number;
  luck: number;
  dexterity: number;
  inventory: Inventory;
}

export interface Note {
  id: string;
  partyId: string;
  content: string;
  createdAt: string; // ISO
}

export interface TimelineEvent {
  id: string;
  partyId: string;
  type: TimelineEventType;
  label: string;
  payload?: Record<string, unknown>;
  createdAt: string; // ISO
}

export interface SaveSlot {
  id: string;
  partyId: string;
  slot: 1 | 2 | 3;
  snapshot: PartySnapshot;
  createdAt: string; // ISO
}

export interface Party {
  id: string;
  name: string;
  mode: GameMode;
  status: PartyStatus;
  currentChapter: number;
  character: Character;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface PartySnapshot {
  party: Party;
  notes: Note[];
  saveSlots: SaveSlot[];
}

export interface OutboxEvent {
  id: string;
  partyId: string;
  type: TimelineEventType;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  createdAt: string; // ISO
  sentAt?: string; // ISO
}

// ─── Combat models ────────────────────────────────────────────────────────────

export interface Enemy {
  id: string;
  name: string;
  hpMax: number;
  hpCurrent: number;
  dexterity: number;
  attackBonus: number;
}

export interface CombatState {
  partyId: string;
  enemies: Enemy[];
  currentTurn: number;
  log: CombatLogEntry[];
  status: "ongoing" | "victory" | "defeat";
}

export interface CombatLogEntry {
  turn: number;
  actor: "player" | string; // string = enemy id
  roll: number[];
  success: boolean;
  damage?: number;
  luckSpent?: number;
  label: string;
}

import { Character, GameMode, Talent, Inventory } from "../models";

export const INITIAL_DEXTERITY = 7;
export const MAX_SAVE_SLOTS = 3;

export function createInitialInventory(): Inventory {
  return {
    weapons: [],
    items: [],
    currency: { boulons: 0 },
  };
}

export function createCharacter(params: {
  name: string;
  talent: Talent;
  hpRoll: number; // 2d6 sum
  luckRoll: number; // 1d6
}): Character {
  const hpMax = params.hpRoll * 4;
  return {
    name: params.name,
    talent: params.talent,
    hpMax,
    hpCurrent: hpMax,
    luck: params.luckRoll,
    dexterity: INITIAL_DEXTERITY,
    inventory: createInitialInventory(),
  };
}

export function applyHpChange(character: Character, delta: number): Character {
  const hpCurrent = Math.max(0, Math.min(character.hpMax, character.hpCurrent + delta));
  return { ...character, hpCurrent };
}

export function applyLuckCost(character: Character, cost: number): Character {
  const luck = Math.max(0, character.luck - cost);
  return { ...character, luck };
}

export function isDead(character: Character): boolean {
  return character.hpCurrent <= 0;
}

/** Death reset: chapter 1, full HP, inventory wiped, luck kept */
export function applyDeathReset(character: Character): Character {
  return {
    ...character,
    hpCurrent: character.hpMax,
    inventory: createInitialInventory(),
  };
}

/** Check if mode allows simplified save restore */
export function canRestoreAnySlot(mode: GameMode): boolean {
  return mode !== GameMode.SIMPLIFIED;
}

import { Character, Enemy, CombatLogEntry } from "../models";

export const DICE_TO_HIT = 2; // 2d6
export const DICE_DAMAGE = 1; // 1d6
export const DAMAGE_BASE = 1;

export interface HitResult {
  rolls: number[];
  total: number;
  success: boolean;
}

export interface DamageResult {
  roll: number;
  total: number;
  weaponBonus: number;
}

/** 2d6 <= DEX → toucher */
export function resolveHit(rolls2d6: [number, number], dex: number): HitResult {
  const total = rolls2d6[0] + rolls2d6[1];
  return {
    rolls: rolls2d6,
    total,
    success: total <= dex,
  };
}

/** 1 + 1d6 + bonusArme */
export function resolveDamage(roll1d6: number, weaponBonus: number): DamageResult {
  return {
    roll: roll1d6,
    total: DAMAGE_BASE + roll1d6 + weaponBonus,
    weaponBonus,
  };
}

/** Luck: modifier un dé après jet dans n'importe quelle direction (coût = |delta|) */
export function applyLuckToDie(
  originalRoll: number,
  targetValue: number,
  availableLuck: number,
): { newRoll: number; luckCost: number } | null {
  if (targetValue === originalRoll) return null; // aucun changement
  const delta = Math.abs(targetValue - originalRoll);
  if (delta > availableLuck) return null; // pas assez de chance
  return { newRoll: targetValue, luckCost: delta };
}

export function buildPlayerHitEntry(
  turn: number,
  hit: HitResult,
  damage?: DamageResult,
  luckSpent?: number,
): CombatLogEntry {
  if (hit.success) {
    return {
      turn,
      actor: "player",
      roll: hit.rolls,
      success: true,
      damage: damage?.total,
      luckSpent,
      label: `Touché ! (${hit.rolls.join("+")}=${hit.total}) → ${damage?.total ?? 0} dégâts`,
    };
  }
  return {
    turn,
    actor: "player",
    roll: hit.rolls,
    success: false,
    luckSpent,
    label: `Raté (${hit.rolls.join("+")}=${hit.total} > DEX ${hit.total})`,
  };
}

export function buildEnemyHitEntry(
  turn: number,
  enemyId: string,
  hit: HitResult,
  damage?: DamageResult,
): CombatLogEntry {
  if (hit.success) {
    return {
      turn,
      actor: enemyId,
      roll: hit.rolls,
      success: true,
      damage: damage?.total,
      label: `Ennemi touche ! (${hit.rolls.join("+")}=${hit.total}) → ${damage?.total ?? 0} dégâts`,
    };
  }
  return {
    turn,
    actor: enemyId,
    roll: hit.rolls,
    success: false,
    label: `Ennemi rate (${hit.rolls.join("+")}=${hit.total})`,
  };
}

export function isVictory(enemies: Enemy[]): boolean {
  return enemies.every((e) => e.hpCurrent <= 0);
}

export function isDefeat(character: Character): boolean {
  return character.hpCurrent <= 0;
}

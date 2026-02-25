import { describe, it, expect } from "vitest";
import { resolveHit, resolveDamage, applyLuckToDie, isVictory } from "./combat";
import type { Enemy } from "../models";

describe("resolveHit", () => {
  it("succès si 2d6 <= DEX", () => {
    const result = resolveHit([2, 3], 7);
    expect(result.success).toBe(true);
    expect(result.total).toBe(5);
  });

  it("échec si 2d6 > DEX", () => {
    const result = resolveHit([4, 5], 7);
    expect(result.success).toBe(false);
    expect(result.total).toBe(9);
  });

  it("succès si 2d6 == DEX (limite)", () => {
    const result = resolveHit([3, 4], 7);
    expect(result.success).toBe(true);
  });
});

describe("resolveDamage", () => {
  it("sans arme : total = 1 + roll (base + dé)", () => {
    const result = resolveDamage(3, 0);
    expect(result.total).toBe(4); // 1 + 3 + 0
  });

  it("avec bonus arme +2 : total = 1 + roll + 2", () => {
    const result = resolveDamage(3, 2);
    expect(result.total).toBe(6); // 1 + 3 + 2
    expect(result.weaponBonus).toBe(2);
  });

  it("bonus arme +5 sur dé max (6) : total = 12", () => {
    const result = resolveDamage(6, 5);
    expect(result.total).toBe(12); // 1 + 6 + 5
  });

  it("minimum absolu sans arme : 1 + 1 + 0 = 2", () => {
    const result = resolveDamage(1, 0);
    expect(result.total).toBe(2);
  });

  it("le bonus est bien isolé dans weaponBonus", () => {
    const result = resolveDamage(4, 3);
    expect(result.roll).toBe(4);
    expect(result.weaponBonus).toBe(3);
    expect(result.total).toBe(8); // 1 + 4 + 3
  });
});

describe("applyLuckToDie", () => {
  it("retourne null si la valeur cible est identique", () => {
    expect(applyLuckToDie(5, 5, 10)).toBeNull();
  });

  it("retourne null si pas assez de chance", () => {
    expect(applyLuckToDie(2, 6, 1)).toBeNull();
  });

  it("applique une augmentation si assez de chance", () => {
    const result = applyLuckToDie(2, 5, 10);
    expect(result?.newRoll).toBe(5);
    expect(result?.luckCost).toBe(3);
  });

  it("applique une diminution si assez de chance", () => {
    const result = applyLuckToDie(5, 3, 10);
    expect(result?.newRoll).toBe(3);
    expect(result?.luckCost).toBe(2);
  });
});

describe("isVictory", () => {
  it("true si tous les ennemis à 0 PV", () => {
    const enemies: Enemy[] = [
      { id: "e1", name: "Loup", hpMax: 10, hpCurrent: 0, dexterity: 6, attackBonus: 0 },
    ];
    expect(isVictory(enemies)).toBe(true);
  });

  it("false si un ennemi a encore des PV", () => {
    const enemies: Enemy[] = [
      { id: "e1", name: "Loup", hpMax: 10, hpCurrent: 5, dexterity: 6, attackBonus: 0 },
    ];
    expect(isVictory(enemies)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { Talent } from "../models";
import {
  createCharacter,
  applyHpChange,
  applyLuckCost,
  isDead,
  applyDeathReset,
} from "./character";

describe("createCharacter", () => {
  it("calcule hpMax = hpRoll * 4", () => {
    const char = createCharacter({ name: "Test", talent: Talent.INSTINCT, hpRoll: 7, luckRoll: 4 });
    expect(char.hpMax).toBe(28);
    expect(char.hpCurrent).toBe(28);
  });

  it("assigne dextérité initiale à 7", () => {
    const char = createCharacter({ name: "Test", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    expect(char.dexterity).toBe(7);
  });

  it("assigne la chance = luckRoll", () => {
    const char = createCharacter({ name: "Test", talent: Talent.OBSERVATION, hpRoll: 6, luckRoll: 5 });
    expect(char.luck).toBe(5);
  });
});

describe("applyHpChange", () => {
  it("ne dépasse pas hpMax", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const result = applyHpChange(char, 999);
    expect(result.hpCurrent).toBe(char.hpMax);
  });

  it("ne descend pas sous 0", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const result = applyHpChange(char, -999);
    expect(result.hpCurrent).toBe(0);
  });
});

describe("isDead", () => {
  it("retourne true si hpCurrent = 0", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const dead = applyHpChange(char, -999);
    expect(isDead(dead)).toBe(true);
  });
});

describe("applyDeathReset", () => {
  it("restaure hpCurrent à hpMax", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const dead = applyHpChange(char, -999);
    const reset = applyDeathReset(dead);
    expect(reset.hpCurrent).toBe(reset.hpMax);
  });

  it("vide l'inventaire", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const reset = applyDeathReset(char);
    expect(reset.inventory.weapons).toHaveLength(0);
    expect(reset.inventory.items).toHaveLength(0);
  });

  it("conserve la chance", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 4 });
    const reset = applyDeathReset(char);
    expect(reset.luck).toBe(4);
  });
});

describe("applyLuckCost", () => {
  it("diminue la chance sans passer sous 0", () => {
    const char = createCharacter({ name: "T", talent: Talent.INSTINCT, hpRoll: 5, luckRoll: 3 });
    const result = applyLuckCost(char, 99);
    expect(result.luck).toBe(0);
  });
});

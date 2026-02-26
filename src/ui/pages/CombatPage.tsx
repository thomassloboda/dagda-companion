import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Party, Enemy, CombatLogEntry } from "../../domain/models";
import { TimelineEventType, OutboxStatus, PartyStatus, GameMode } from "../../domain/models";
import {
  partyRepo,
  rng,
  eventLog,
  outboxRepo,
  updateHp,
  applyLuck,
  clock,
} from "../../application/container";
import {
  resolveHit,
  resolveDamage,
  applyLuckToDie,
  isVictory,
  isDefeat,
} from "../../domain/rules/combat";
import { DiceRoller, type DiceRollerHandle } from "../components/dice/DiceRoller";

type CombatStatus = "setup" | "ongoing" | "victory" | "defeat" | "mortal_death";

interface RerollRecord {
  context: string;
  before: number;
  after: number;
}

function MortalDeathScreen({ partyName, onConfirm }: { partyName: string; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base-100 p-6 text-center">
      <div className="text-6xl">☠️</div>
      <h1 className="text-3xl font-bold text-error">{t("combat.mortalDeath.title")}</h1>
      <p className="max-w-xs text-base-content/70">{t("combat.mortalDeath.desc", { partyName })}</p>
      <button className="btn btn-error btn-lg w-full max-w-xs" onClick={onConfirm}>
        {t("combat.mortalDeath.homeBtn")}
      </button>
    </div>
  );
}

function RerollButton({ onReroll }: { onReroll: () => void }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <button className="btn btn-ghost btn-xs text-warning" onClick={() => setShow(true)}>
        {t("combat.reroll.btn")}
      </button>
      {show && (
        <div className="mt-1 rounded-lg border border-warning bg-warning/10 p-2 text-xs text-warning">
          {t("combat.reroll.warning")}
          <button
            className="btn btn-warning btn-xs ml-2"
            onClick={() => {
              onReroll();
              setShow(false);
            }}
          >
            {t("combat.reroll.confirmBtn")}
          </button>
          <button className="btn btn-ghost btn-xs ml-1" onClick={() => setShow(false)}>
            {t("combat.reroll.cancelBtn")}
          </button>
        </div>
      )}
    </div>
  );
}

export function CombatPage() {
  const { t } = useTranslation();
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup
  const [enemies, setEnemies] = useState<Enemy[]>([
    {
      id: crypto.randomUUID(),
      name: t("combat.setup.defaultEnemyName"),
      hpMax: 10,
      hpCurrent: 10,
      dexterity: 6,
      attackBonus: 0,
    },
  ]);
  const [status, setStatus] = useState<CombatStatus>("setup");
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);

  // Current rolls (for display)
  const [playerRolls, setPlayerRolls] = useState<[number, number]>([1, 1]);
  const [, setDamageRoll] = useState<number>(1);
  const [rerolls, setRerolls] = useState<RerollRecord[]>([]);

  const die1Ref = useRef<DiceRollerHandle>(null);
  const die2Ref = useRef<DiceRollerHandle>(null);

  const load = useCallback(async () => {
    if (!partyId) return;
    const p = await partyRepo.findById(partyId);
    if (!p) {
      navigate("/");
      return;
    }
    setParty(p);
    setLoading(false);
  }, [partyId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !party) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const char = party.character;
  const activeEnemies = enemies.filter((e) => e.hpCurrent > 0);

  // ── Setup helpers ──────────────────────────────────────────────────────────

  function addEnemy() {
    if (enemies.length >= 5) return;
    setEnemies((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: t("combat.setup.defaultEnemyNameN", { n: prev.length + 1 }),
        hpMax: 10,
        hpCurrent: 10,
        dexterity: 6,
        attackBonus: 0,
      },
    ]);
  }

  function removeEnemy(id: string) {
    setEnemies((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEnemy(id: string, patch: Partial<Enemy>) {
    setEnemies((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  // ── Combat start ───────────────────────────────────────────────────────────

  async function startCombat() {
    setBusy(true);
    const now = clock.now();
    await eventLog.append({
      id: crypto.randomUUID(),
      partyId: partyId!,
      type: TimelineEventType.COMBAT_STARTED,
      label: t("combat.log.started", { count: enemies.length }),
      payload: { enemies: enemies.map((e) => e.name) },
      createdAt: now,
    });
    setStatus("ongoing");
    setBusy(false);
  }

  // ── Player attack ──────────────────────────────────────────────────────────

  async function playerAttack(enemyId: string) {
    if (busy) return;
    setBusy(true);
    const rolls = rng.roll2D6();
    const hit = resolveHit(rolls, char.dexterity);
    die1Ref.current?.roll(rolls[0]);
    die2Ref.current?.roll(rolls[1]);
    setPlayerRolls(rolls);

    const now = clock.now();
    let logEntry: CombatLogEntry;

    if (hit.success) {
      const dr = rng.rollD6();
      setDamageRoll(dr);
      const inv = char.inventory;
      const weapon = inv.weapons.find((w) => w.id === inv.equippedWeaponId) ?? inv.weapons[0];
      const damage = resolveDamage(dr, weapon?.bonus ?? 0);
      const weaponLabel = weapon
        ? ` [${weapon.name}${weapon.bonus ? ` +${weapon.bonus}` : ""}]`
        : "";
      logEntry = {
        turn,
        actor: "player",
        roll: rolls,
        success: true,
        damage: damage.total,
        label: t("combat.log.playerHit", {
          turn,
          rolls: rolls.join("+"),
          total: hit.total,
          weapon: weaponLabel,
          damage: damage.total,
        }),
      };
      setEnemies((prev) =>
        prev.map((e) =>
          e.id === enemyId ? { ...e, hpCurrent: Math.max(0, e.hpCurrent - damage.total) } : e,
        ),
      );
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_HIT,
        label: logEntry.label,
        payload: { rolls, damage: damage.total, turn },
        createdAt: now,
      });
    } else {
      logEntry = {
        turn,
        actor: "player",
        roll: rolls,
        success: false,
        label: t("combat.log.playerMiss", {
          turn,
          rolls: rolls.join("+"),
          total: hit.total,
          dex: char.dexterity,
        }),
      };
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_MISS,
        label: logEntry.label,
        payload: { rolls, turn },
        createdAt: now,
      });
    }

    setCombatLog((prev) => [logEntry, ...prev]);
    await checkCombatEnd();
    setBusy(false);
  }

  // ── Enemy attack ───────────────────────────────────────────────────────────

  async function enemyAttack(enemy: Enemy) {
    if (busy) return;
    setBusy(true);
    const rolls = rng.roll2D6();
    const hit = resolveHit(rolls, enemy.dexterity);
    const now = clock.now();
    let logEntry: CombatLogEntry;

    if (hit.success) {
      const dr = rng.rollD6();
      const damage = resolveDamage(dr, enemy.attackBonus);
      logEntry = {
        turn,
        actor: enemy.id,
        roll: rolls,
        success: true,
        damage: damage.total,
        label: t("combat.log.enemyHit", {
          turn,
          name: enemy.name,
          rolls: rolls.join("+"),
          total: hit.total,
          damage: damage.total,
        }),
      };
      const hpResult = await updateHp.execute(partyId!, -damage.total);
      await load();
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_ENEMY_HIT,
        label: logEntry.label,
        payload: { rolls, damage: damage.total, turn },
        createdAt: now,
      });

      if (hpResult.isMortalDeath) {
        setCombatLog((prev) => [logEntry, ...prev]);
        setStatus("mortal_death");
        setBusy(false);
        return;
      }
    } else {
      logEntry = {
        turn,
        actor: enemy.id,
        roll: rolls,
        success: false,
        label: t("combat.log.enemyMiss", {
          turn,
          name: enemy.name,
          rolls: rolls.join("+"),
          total: hit.total,
        }),
      };
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_ENEMY_MISS,
        label: logEntry.label,
        payload: { rolls, turn },
        createdAt: now,
      });
    }

    setCombatLog((prev) => [logEntry, ...prev]);
    setTurn((tval) => tval + 1);
    await checkCombatEnd();
    setBusy(false);
  }

  // ── Luck on last roll ──────────────────────────────────────────────────────

  async function spendLuck(targetDieValue: number, dieIndex: 0 | 1) {
    const original = playerRolls[dieIndex];
    const result = applyLuckToDie(original, targetDieValue, char.luck);
    if (!result) return;
    await applyLuck.execute(partyId!, result.luckCost);
    const newRolls: [number, number] = [...playerRolls] as [number, number];
    newRolls[dieIndex] = result.newRoll;
    setPlayerRolls(newRolls);
    (dieIndex === 0 ? die1Ref : die2Ref).current?.roll(result.newRoll);
    await load();
  }

  // ── Reroll ─────────────────────────────────────────────────────────────────

  async function handleRerollPlayerAttack() {
    const before = playerRolls[0] + playerRolls[1];
    const rolls = rng.roll2D6();
    const after = rolls[0] + rolls[1];
    die1Ref.current?.roll(rolls[0]);
    die2Ref.current?.roll(rolls[1]);
    setPlayerRolls(rolls);
    setRerolls((prev) => [...prev, { context: "combat-player-attack", before, after }]);
    const now = clock.now();
    await eventLog.append({
      id: crypto.randomUUID(),
      partyId: partyId!,
      type: TimelineEventType.DICE_REROLLED,
      label: t("combat.log.rerollLog", { before, after }),
      payload: { context: "combat-player-attack", before, after },
      createdAt: now,
    });
    await outboxRepo.append({
      id: crypto.randomUUID(),
      partyId: partyId!,
      type: TimelineEventType.DICE_REROLLED,
      payload: { context: "combat-player-attack", before, after },
      status: OutboxStatus.PENDING,
      createdAt: now,
    });
  }

  // ── End checks ─────────────────────────────────────────────────────────────

  async function checkCombatEnd() {
    const updatedParty = await partyRepo.findById(partyId!);
    if (!updatedParty) return;
    const now = clock.now();
    if (isVictory(enemies)) {
      setStatus("victory");
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_VICTORY,
        label: t("combat.log.victory"),
        createdAt: now,
      });
    } else if (updatedParty.status === PartyStatus.DEAD) {
      // Handled inline in enemyAttack via isMortalDeath
    } else if (isDefeat(updatedParty.character)) {
      setStatus("defeat");
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: partyId!,
        type: TimelineEventType.COMBAT_DEFEAT,
        label: t("combat.log.defeat"),
        createdAt: now,
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("combat.title")}</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/party/${partyId}`)}>
          {t("combat.back")}
        </button>
      </div>

      {/* Player stats */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-1 p-3 text-sm">
          <div className="font-semibold">{char.name}</div>
          <div className="flex gap-4">
            <span>
              ❤️ {char.hpCurrent}/{char.hpMax}
            </span>
            <span>🍀 {char.luck}</span>
            <span>⚡ DEX {char.dexterity}</span>
          </div>
          <progress
            className="progress progress-success w-full"
            value={char.hpCurrent}
            max={char.hpMax}
          />
        </div>
      </div>

      {/* ── SETUP ── */}
      {status === "setup" && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">
            {t("combat.setup.enemiesTitle", { count: enemies.length })}
          </h2>
          {enemies.map((e, i) => (
            <div key={e.id} className="card bg-base-200">
              <div className="card-body gap-2 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="input input-sm input-bordered flex-1"
                    value={e.name}
                    onChange={(ev) => updateEnemy(e.id, { name: ev.target.value })}
                    placeholder={t("combat.setup.enemyNamePlaceholder")}
                  />
                  {i > 0 && (
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeEnemy(e.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    {t("combat.setup.hpMaxLabel")}
                    <input
                      type="number"
                      min={1}
                      className="input input-xs input-bordered w-16"
                      value={e.hpMax}
                      onChange={(ev) => {
                        const v = Number(ev.target.value);
                        updateEnemy(e.id, { hpMax: v, hpCurrent: v });
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    {t("combat.setup.dexLabel")}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="input input-xs input-bordered w-14"
                      value={e.dexterity}
                      onChange={(ev) => updateEnemy(e.id, { dexterity: Number(ev.target.value) })}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    {t("combat.setup.atkBonusLabel")}
                    <input
                      type="number"
                      min={0}
                      className="input input-xs input-bordered w-14"
                      value={e.attackBonus}
                      onChange={(ev) => updateEnemy(e.id, { attackBonus: Number(ev.target.value) })}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
          {enemies.length < 5 && (
            <button className="btn btn-outline btn-sm" onClick={addEnemy}>
              {t("combat.setup.addEnemyBtn")}
            </button>
          )}
          <button className="btn btn-error w-full" disabled={busy} onClick={startCombat}>
            {t("combat.setup.startBtn")}
          </button>
        </div>
      )}

      {/* ── ONGOING ── */}
      {status === "ongoing" && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-base-content/60">
            {t("combat.ongoing.turnInfo", { turn, count: activeEnemies.length })}
          </div>

          {/* Current dice display */}
          <div className="card bg-base-200">
            <div className="card-body gap-2 p-3">
              <div className="text-sm font-semibold">
                {t("combat.ongoing.lastRoll", {
                  d1: playerRolls[0],
                  d2: playerRolls[1],
                  total: playerRolls[0] + playerRolls[1],
                  dex: char.dexterity,
                })}
              </div>
              <div className="flex gap-3">
                <DiceRoller ref={die1Ref} defaultValue={playerRolls[0]} size={52} />
                <DiceRoller ref={die2Ref} defaultValue={playerRolls[1]} size={52} />
              </div>
              <RerollButton onReroll={handleRerollPlayerAttack} />
            </div>
          </div>

          {/* Enemies */}
          {activeEnemies.map((e) => (
            <div key={e.id} className="card bg-base-200 shadow">
              <div className="card-body gap-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-sm">
                    ❤️ {e.hpCurrent}/{e.hpMax}
                  </span>
                </div>
                <progress
                  className="progress progress-error w-full"
                  value={e.hpCurrent}
                  max={e.hpMax}
                />
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary btn-sm flex-1"
                    disabled={busy}
                    onClick={() => playerAttack(e.id)}
                  >
                    {t("combat.ongoing.attackBtn")}
                  </button>
                  <button
                    className="btn btn-warning btn-sm flex-1"
                    disabled={busy}
                    onClick={() => enemyAttack(e)}
                  >
                    {t("combat.ongoing.enemyAttackBtn", { name: e.name })}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => updateEnemy(e.id, { hpCurrent: Math.max(0, e.hpCurrent - 1) })}
                  >
                    {t("combat.ongoing.enemyHpMinus")}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      updateEnemy(e.id, { hpCurrent: Math.min(e.hpMax, e.hpCurrent + 1) })
                    }
                  >
                    {t("combat.ongoing.enemyHpPlus")}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Chance */}
          <div className="card bg-base-200">
            <div className="card-body gap-2 p-3">
              <div className="text-sm font-semibold">
                {t("combat.ongoing.luckSection", { luck: char.luck })}
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((val) => (
                  <button
                    key={val}
                    className="btn btn-outline btn-xs"
                    disabled={
                      busy || val === playerRolls[0] || char.luck < Math.abs(val - playerRolls[0])
                    }
                    onClick={() => spendLuck(val, 0)}
                  >
                    {t("combat.ongoing.diceTo", { val })}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── END : victoire / défaite normale ── */}
      {(status === "victory" || status === "defeat") && (
        <div className={`alert ${status === "victory" ? "alert-success" : "alert-error"} mb-4`}>
          <div>
            <div className="text-lg font-bold">
              {status === "victory" ? t("combat.result.victory") : t("combat.result.defeat")}
            </div>
            <div className="text-sm">
              {status === "defeat" &&
                party?.mode !== GameMode.MORTAL &&
                t("combat.result.restoreHint")}
              {rerolls.length > 0 &&
                ` ${t("combat.result.rerollCount", { count: rerolls.length })}`}
            </div>
          </div>
        </div>
      )}

      {/* ── END : mort mortelle ── */}
      {status === "mortal_death" && (
        <MortalDeathScreen partyName={party?.name ?? ""} onConfirm={() => navigate("/")} />
      )}

      {/* Combat log */}
      {combatLog.length > 0 && status !== "mortal_death" && (
        <div className="mt-4 flex max-h-48 flex-col gap-1 overflow-y-auto">
          <div className="text-xs font-semibold text-base-content/50">{t("combat.log.title")}</div>
          {combatLog.map((entry, i) => (
            <div
              key={i}
              className={`rounded px-2 py-1 text-xs ${entry.success ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}
            >
              {entry.label}
            </div>
          ))}
        </div>
      )}

      {(status === "victory" || status === "defeat") && (
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={() => navigate(`/party/${partyId}`)}
        >
          {t("combat.result.backBtn")}
        </button>
      )}
    </div>
  );
}

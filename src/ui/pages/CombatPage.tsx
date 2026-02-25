import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { resolveHit, resolveDamage, applyLuckToDie, isVictory, isDefeat } from "../../domain/rules/combat";

type CombatStatus = "setup" | "ongoing" | "victory" | "defeat" | "mortal_death";

interface RerollRecord {
  context: string;
  before: number;
  after: number;
}

function MortalDeathScreen({ partyName, onConfirm }: { partyName: string; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base-100 p-6 text-center">
      <div className="text-6xl">☠️</div>
      <h1 className="text-3xl font-bold text-error">Vous êtes mort.</h1>
      <p className="max-w-xs text-base-content/70">
        <span className="font-semibold">{partyName}</span> — L'aventure se termine ici.
        En mode Mortel, il n'y a pas de retour en arrière.
      </p>
      <button className="btn btn-error btn-lg w-full max-w-xs" onClick={onConfirm}>
        Retour à l'accueil
      </button>
    </div>
  );
}

function RerollButton({ onReroll }: { onReroll: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <button className="btn btn-ghost btn-xs text-warning" onClick={() => setShow(true)}>
        🔄 Relancer (en cas de souci)
      </button>
      {show && (
        <div className="mt-1 rounded-lg border border-warning bg-warning/10 p-2 text-xs text-warning">
          ⚠️ À utiliser seulement si le jet n'a pas été pris en compte / bug visuel.
          <button
            className="btn btn-warning btn-xs ml-2"
            onClick={() => { onReroll(); setShow(false); }}
          >
            Confirmer relance
          </button>
          <button className="btn btn-ghost btn-xs ml-1" onClick={() => setShow(false)}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

export function CombatPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup
  const [enemies, setEnemies] = useState<Enemy[]>([
    { id: crypto.randomUUID(), name: "Adversaire", hpMax: 10, hpCurrent: 10, dexterity: 6, attackBonus: 0 },
  ]);
  const [status, setStatus] = useState<CombatStatus>("setup");
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);

  // Current rolls (for display)
  const [playerRolls, setPlayerRolls] = useState<[number, number]>([1, 1]);
  const [_damageRoll, setDamageRoll] = useState<number>(1);
  const [rerolls, setRerolls] = useState<RerollRecord[]>([]);

  const load = useCallback(async () => {
    if (!partyId) return;
    const p = await partyRepo.findById(partyId);
    if (!p) { navigate("/"); return; }
    setParty(p);
    setLoading(false);
  }, [partyId, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading || !party) {
    return <div className="flex min-h-[60vh] items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>;
  }

  const char = party.character;
  const activeEnemies = enemies.filter((e) => e.hpCurrent > 0);

  // ── Setup helpers ──────────────────────────────────────────────────────────

  function addEnemy() {
    if (enemies.length >= 5) return;
    setEnemies((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: `Adversaire ${prev.length + 1}`, hpMax: 10, hpCurrent: 10, dexterity: 6, attackBonus: 0 },
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
      id: crypto.randomUUID(), partyId: partyId!,
      type: TimelineEventType.COMBAT_STARTED,
      label: `Combat démarré contre ${enemies.length} adversaire(s)`,
      payload: { enemies: enemies.map((e) => e.name) },
      createdAt: now,
    });
    // Narrative mode: ≤5 → auto victory
    if (enemies.length <= 5) {
      setStatus("ongoing");
    } else {
      setStatus("ongoing");
    }
    setBusy(false);
  }

  // ── Player attack ──────────────────────────────────────────────────────────

  async function playerAttack(enemyId: string) {
    if (busy) return;
    setBusy(true);
    const rolls = rng.roll2D6();
    const hit = resolveHit(rolls, char.dexterity);
    setPlayerRolls(rolls);

    const now = clock.now();
    let logEntry: CombatLogEntry;

    if (hit.success) {
      const dr = rng.rollD6();
      setDamageRoll(dr);
      const weapon = char.inventory.weapons[0];
      const damage = resolveDamage(dr, weapon?.bonus ?? 0);
      logEntry = {
        turn, actor: "player", roll: rolls, success: true,
        damage: damage.total,
        label: `Tour ${turn} — Joueur touche (${rolls.join("+")}=${hit.total}) → ${damage.total} dégâts`,
      };
      // Apply damage to enemy
      setEnemies((prev) =>
        prev.map((e) =>
          e.id === enemyId
            ? { ...e, hpCurrent: Math.max(0, e.hpCurrent - damage.total) }
            : e,
        ),
      );
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_HIT, label: logEntry.label, payload: { rolls, damage: damage.total, turn }, createdAt: now });
    } else {
      logEntry = {
        turn, actor: "player", roll: rolls, success: false,
        label: `Tour ${turn} — Joueur rate (${rolls.join("+")}=${hit.total} > DEX ${char.dexterity})`,
      };
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_MISS, label: logEntry.label, payload: { rolls, turn }, createdAt: now });
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
        turn, actor: enemy.id, roll: rolls, success: true, damage: damage.total,
        label: `Tour ${turn} — ${enemy.name} touche (${rolls.join("+")}=${hit.total}) → ${damage.total} dégâts`,
      };
      const hpResult = await updateHp.execute(partyId!, -damage.total);
      await load();
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_ENEMY_HIT, label: logEntry.label, payload: { rolls, damage: damage.total, turn }, createdAt: now });

      if (hpResult.isMortalDeath) {
        setCombatLog((prev) => [logEntry, ...prev]);
        setStatus("mortal_death");
        setBusy(false);
        return;
      }
    } else {
      logEntry = {
        turn, actor: enemy.id, roll: rolls, success: false,
        label: `Tour ${turn} — ${enemy.name} rate (${rolls.join("+")}=${hit.total})`,
      };
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_ENEMY_MISS, label: logEntry.label, payload: { rolls, turn }, createdAt: now });
    }

    setCombatLog((prev) => [logEntry, ...prev]);
    setTurn((t) => t + 1);
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
    await load();
  }

  // ── Reroll ─────────────────────────────────────────────────────────────────

  async function handleRerollPlayerAttack() {
    const before = playerRolls[0] + playerRolls[1];
    const rolls = rng.roll2D6();
    const after = rolls[0] + rolls[1];
    setPlayerRolls(rolls);
    setRerolls((prev) => [...prev, { context: "combat-player-attack", before, after }]);
    const now = clock.now();
    await eventLog.append({
      id: crypto.randomUUID(), partyId: partyId!,
      type: TimelineEventType.DICE_REROLLED,
      label: `Relance dé joueur (avant: ${before}, après: ${after})`,
      payload: { context: "combat-player-attack", before, after },
      createdAt: now,
    });
    await outboxRepo.append({
      id: crypto.randomUUID(), partyId: partyId!,
      type: TimelineEventType.DICE_REROLLED,
      payload: { context: "combat-player-attack", before, after },
      status: OutboxStatus.PENDING, createdAt: now,
    });
  }

  // ── End checks ─────────────────────────────────────────────────────────────

  async function checkCombatEnd() {
    const updatedParty = await partyRepo.findById(partyId!);
    if (!updatedParty) return;
    const now = clock.now();
    if (isVictory(enemies)) {
      setStatus("victory");
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_VICTORY, label: "Victoire !", createdAt: now });
    } else if (updatedParty.status === PartyStatus.DEAD) {
      // Handled inline in enemyAttack via isMortalDeath
    } else if (isDefeat(updatedParty.character)) {
      setStatus("defeat");
      await eventLog.append({ id: crypto.randomUUID(), partyId: partyId!, type: TimelineEventType.COMBAT_DEFEAT, label: "Défaite — PV à 0.", createdAt: now });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">⚔️ Combat</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/party/${partyId}`)}>← Retour</button>
      </div>

      {/* Player stats */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-1 p-3 text-sm">
          <div className="font-semibold">{char.name}</div>
          <div className="flex gap-4">
            <span>❤️ {char.hpCurrent}/{char.hpMax}</span>
            <span>🍀 {char.luck}</span>
            <span>⚡ DEX {char.dexterity}</span>
          </div>
          <progress className="progress progress-success w-full" value={char.hpCurrent} max={char.hpMax} />
        </div>
      </div>

      {/* ── SETUP ── */}
      {status === "setup" && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">Adversaires ({enemies.length}/5)</h2>
          {enemies.map((e, i) => (
            <div key={e.id} className="card bg-base-200">
              <div className="card-body gap-2 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="input input-bordered input-sm flex-1"
                    value={e.name}
                    onChange={(ev) => updateEnemy(e.id, { name: ev.target.value })}
                    placeholder="Nom"
                  />
                  {i > 0 && (
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => removeEnemy(e.id)}>✕</button>
                  )}
                </div>
                <div className="flex gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    PV max
                    <input type="number" min={1} className="input input-bordered input-xs w-16" value={e.hpMax}
                      onChange={(ev) => { const v = Number(ev.target.value); updateEnemy(e.id, { hpMax: v, hpCurrent: v }); }} />
                  </label>
                  <label className="flex items-center gap-1">
                    DEX
                    <input type="number" min={1} max={12} className="input input-bordered input-xs w-14" value={e.dexterity}
                      onChange={(ev) => updateEnemy(e.id, { dexterity: Number(ev.target.value) })} />
                  </label>
                  <label className="flex items-center gap-1">
                    Bonus ATK
                    <input type="number" min={0} className="input input-bordered input-xs w-14" value={e.attackBonus}
                      onChange={(ev) => updateEnemy(e.id, { attackBonus: Number(ev.target.value) })} />
                  </label>
                </div>
              </div>
            </div>
          ))}
          {enemies.length < 5 && (
            <button className="btn btn-outline btn-sm" onClick={addEnemy}>+ Ajouter adversaire</button>
          )}
          <button className="btn btn-error w-full" disabled={busy} onClick={startCombat}>
            ⚔️ Démarrer le combat
          </button>
        </div>
      )}

      {/* ── ONGOING ── */}
      {status === "ongoing" && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-base-content/60">Tour {turn} · {activeEnemies.length} adversaire(s) actif(s)</div>

          {/* Current dice display */}
          <div className="card bg-base-200">
            <div className="card-body gap-2 p-3">
              <div className="font-semibold text-sm">Votre dernier jet : {playerRolls[0]}+{playerRolls[1]}={playerRolls[0]+playerRolls[1]} (DEX {char.dexterity})</div>
              <div className="flex gap-2">
                {playerRolls.map((v, i) => (
                  <div key={i} className="flex h-10 w-10 items-center justify-center rounded border-2 border-base-300 bg-base-100 text-lg font-bold">{v}</div>
                ))}
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
                  <span className="text-sm">❤️ {e.hpCurrent}/{e.hpMax}</span>
                </div>
                <progress className="progress progress-error w-full" value={e.hpCurrent} max={e.hpMax} />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm flex-1" disabled={busy} onClick={() => playerAttack(e.id)}>
                    🗡️ Attaquer
                  </button>
                  <button className="btn btn-warning btn-sm flex-1" disabled={busy} onClick={() => enemyAttack(e)}>
                    🛡️ {e.name} attaque
                  </button>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-xs" onClick={() => updateEnemy(e.id, { hpCurrent: Math.max(0, e.hpCurrent - 1) })}>−1 PV ennemi</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => updateEnemy(e.id, { hpCurrent: Math.min(e.hpMax, e.hpCurrent + 1) })}>+1 PV ennemi</button>
                </div>
              </div>
            </div>
          ))}

          {/* Chance */}
          <div className="card bg-base-200">
            <div className="card-body gap-2 p-3">
              <div className="text-sm font-semibold">🍀 Utiliser la chance ({char.luck} restant)</div>
              <div className="flex gap-2 flex-wrap">
                {[1,2,3,4,5,6].map((val) => (
                  <button key={val} className="btn btn-outline btn-xs" disabled={busy || char.luck < Math.max(0, val - playerRolls[0])} onClick={() => spendLuck(val, 0)}>
                    Dé1→{val}
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
              {status === "victory" ? "🏆 Victoire !" : "💀 Défaite — PV à 0"}
            </div>
            <div className="text-sm">
              {status === "defeat" && party?.mode !== GameMode.MORTAL &&
                "Vous pouvez restaurer une sauvegarde depuis le tableau de bord."}
              {rerolls.length > 0 && ` ${rerolls.length} relance(s) effectuée(s).`}
            </div>
          </div>
        </div>
      )}

      {/* ── END : mort mortelle ── */}
      {status === "mortal_death" && (
        <MortalDeathScreen
          partyName={party?.name ?? ""}
          onConfirm={() => navigate("/")}
        />
      )}

      {/* Combat log */}
      {combatLog.length > 0 && status !== "mortal_death" && (
        <div className="mt-4 flex max-h-48 flex-col gap-1 overflow-y-auto">
          <div className="text-xs font-semibold text-base-content/50">Journal combat</div>
          {combatLog.map((entry, i) => (
            <div key={i} className={`rounded px-2 py-1 text-xs ${entry.success ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
              {entry.label}
            </div>
          ))}
        </div>
      )}

      {(status === "victory" || status === "defeat") && (
        <button className="btn btn-primary mt-4 w-full" onClick={() => navigate(`/party/${partyId}`)}>
          Retour au tableau de bord
        </button>
      )}
    </div>
  );
}

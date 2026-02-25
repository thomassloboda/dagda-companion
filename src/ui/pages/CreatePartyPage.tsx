import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GameMode, Talent, TALENT_LABELS } from "../../domain/models";
import { rng } from "../../application/container";
import type { CreatePartyInput } from "../../application/use-cases/CreatePartyUseCase";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step = "mode" | "talent" | "stats";

interface WizardState {
  partyName: string;
  mode: GameMode | null;
  talent: Talent | null;
  characterName: string;
  // stats rolls
  hpDice: [number, number]; // 2d6
  luckDice: number; // 1d6
}

// ─── Step helpers ──────────────────────────────────────────────────────────────

const MODE_OPTIONS = [
  {
    value: GameMode.NARRATIVE,
    label: "Narratif",
    desc: "Pas de combat. Idéal pour explorer l'histoire.",
  },
  {
    value: GameMode.SIMPLIFIED,
    label: "Simplifié",
    desc: "Combat simplifié, une seule sauvegarde restaurable.",
  },
  {
    value: GameMode.MORTAL,
    label: "Mortel",
    desc: "Si vous mourez, reset complet. Haut risque.",
  },
];

const STEPS: Step[] = ["mode", "talent", "stats"];

// ─── Component ─────────────────────────────────────────────────────────────────

export function CreatePartyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("mode");
  const [state, setState] = useState<WizardState>({
    partyName: "",
    mode: null,
    talent: null,
    characterName: "",
    hpDice: [rng.rollD6(), rng.rollD6()],
    luckDice: rng.rollD6(),
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIdx = STEPS.indexOf(step);
  const hpRoll = state.hpDice[0] + state.hpDice[1];
  const hpMax = hpRoll * 4;

  function rerollStats() {
    setState((s) => ({
      ...s,
      hpDice: [rng.rollD6(), rng.rollD6()],
      luckDice: rng.rollD6(),
    }));
  }

  function canNext(): boolean {
    if (step === "mode") return !!state.mode && state.partyName.trim().length > 0;
    if (step === "talent") return !!state.talent;
    if (step === "stats") return state.characterName.trim().length > 0;
    return false;
  }

  async function handleCreate() {
    if (!state.mode || !state.talent) return;
    setCreating(true);
    setError(null);
    try {
      const input: CreatePartyInput = {
        name: state.partyName.trim(),
        mode: state.mode,
        talent: state.talent,
        characterName: state.characterName.trim() || state.partyName.trim(),
      };
      // Override RNG with wizard rolls via a mock — use the pre-rolled values
      // We call createParty.execute but we need to provide our pre-rolled dice.
      // Since the use case calls rng internally, we'll re-roll but store wizard values separately.
      // For now, use the wizard rolls by directly calling domain logic.
      const { createCharacter } = await import("../../domain/rules/character");
      const { PartyStatus } = await import("../../domain/models");
      const character = createCharacter({
        name: input.characterName,
        talent: input.talent,
        hpRoll: hpRoll,
        luckRoll: state.luckDice,
      });
      const { partyRepo, eventLog, outboxRepo, clock } = await import(
        "../../application/container"
      );
      const { TimelineEventType, OutboxStatus } = await import("../../domain/models");
      const now = clock.now();
      const id = crypto.randomUUID();
      const party = {
        id,
        name: input.name,
        mode: input.mode,
        status: PartyStatus.ACTIVE,
        currentChapter: 1,
        character,
        createdAt: now,
        updatedAt: now,
      };
      await partyRepo.save(party);
      await eventLog.append({
        id: crypto.randomUUID(),
        partyId: id,
        type: TimelineEventType.PARTY_CREATED,
        label: `Partie "${input.name}" créée (mode ${input.mode})`,
        payload: { mode: input.mode, talent: input.talent, hpRoll, luckRoll: state.luckDice },
        createdAt: now,
      });
      await outboxRepo.append({
        id: crypto.randomUUID(),
        partyId: id,
        type: TimelineEventType.PARTY_CREATED,
        payload: { partyId: id, name: input.name, mode: input.mode },
        status: OutboxStatus.PENDING,
        createdAt: now,
      });
      navigate(`/party/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Progress */}
      <ul className="steps steps-horizontal mb-6 w-full text-xs">
        {["Mode", "Talent", "Stats"].map((label, i) => (
          <li key={label} className={`step ${i <= stepIdx ? "step-primary" : ""}`}>
            {label}
          </li>
        ))}
      </ul>

      {/* ── STEP 1: Mode ── */}
      {step === "mode" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Nom de la partie</h2>
          <input
            type="text"
            placeholder="Ex : Aventure de Riann"
            className="input input-bordered w-full"
            value={state.partyName}
            maxLength={40}
            onChange={(e) => setState((s) => ({ ...s, partyName: e.target.value }))}
          />

          <h2 className="text-xl font-bold">Mode de jeu</h2>
          <div className="flex flex-col gap-3">
            {MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`card cursor-pointer border-2 transition ${
                  state.mode === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-200"
                }`}
              >
                <div className="card-body flex-row items-start gap-3 p-4">
                  <input
                    type="radio"
                    name="mode"
                    className="radio radio-primary mt-1"
                    checked={state.mode === opt.value}
                    onChange={() => setState((s) => ({ ...s, mode: opt.value }))}
                  />
                  <div>
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-sm text-base-content/60">{opt.desc}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Aide modes */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">Aide – Modes de jeu</div>
            <div className="collapse-content text-sm text-base-content/70">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>Narratif</strong> : combat optionnel, sauvegardes libres.
                </li>
                <li>
                  <strong>Simplifié</strong> : combat allégé (≤5 adversaires → victoire auto).
                  Seule la sauvegarde la plus récente est restaurable.
                </li>
                <li>
                  <strong>Mortel</strong> : si PV = 0 → reset (ch.1, PV max, inventaire vidé,
                  chance conservée).
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Talent ── */}
      {step === "talent" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Choisissez votre talent</h2>
          <div className="flex flex-col gap-2">
            {Object.values(Talent).map((t) => (
              <label
                key={t}
                className={`card cursor-pointer border-2 transition ${
                  state.talent === t
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-200"
                }`}
              >
                <div className="card-body flex-row items-center gap-3 p-3">
                  <input
                    type="radio"
                    name="talent"
                    className="radio radio-primary"
                    checked={state.talent === t}
                    onChange={() => setState((s) => ({ ...s, talent: t }))}
                  />
                  <span className="font-medium">{TALENT_LABELS[t]}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Aide talents */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">Aide – Talents</div>
            <div className="collapse-content text-sm text-base-content/70">
              <p>Chaque talent offre un avantage narratif ou mécanique dans certaines situations :</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  <strong>Instinct</strong> : réactions rapides, éviter les pièges.
                </li>
                <li>
                  <strong>Herboristerie</strong> : préparer ou identifier des plantes/remèdes.
                </li>
                <li>
                  <strong>Discrétion</strong> : se faufiler sans être vu.
                </li>
                <li>
                  <strong>Persuasion</strong> : convaincre PNJ, négocier.
                </li>
                <li>
                  <strong>Observation</strong> : détecter détails cachés, indices.
                </li>
                <li>
                  <strong>Tour de main</strong> : manipuler objets avec dextérité.
                </li>
                <li>
                  <strong>Pratique de l'empathie</strong> : lire les émotions, créer du lien.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Stats ── */}
      {step === "stats" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Votre personnage</h2>
          <input
            type="text"
            placeholder="Nom du personnage"
            className="input input-bordered w-full"
            value={state.characterName}
            maxLength={40}
            onChange={(e) => setState((s) => ({ ...s, characterName: e.target.value }))}
          />

          <div className="card bg-base-200">
            <div className="card-body gap-3 p-4">
              <h3 className="font-semibold">Caractéristiques initiales</h3>

              <div className="flex items-center justify-between">
                <span className="text-sm">
                  PV max (2d6 × 4) :{" "}
                  <span className="font-bold text-success">
                    {state.hpDice[0]}+{state.hpDice[1]}={hpRoll} → {hpMax} PV
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Chance (1d6) :{" "}
                  <span className="font-bold text-warning">{state.luckDice}</span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Dextérité : <span className="font-bold">7</span>
                </span>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm w-full"
                onClick={rerollStats}
              >
                🎲 Relancer les dés
              </button>
            </div>
          </div>

          {/* Aide stats */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">Aide – Règles des caractéristiques</div>
            <div className="collapse-content text-sm text-base-content/70">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>PV max</strong> = somme de 2d6 × 4. Vous commencez avec tous vos PV.
                </li>
                <li>
                  <strong>Chance</strong> = 1d6. Permet d'ajuster un dé en combat (coût = delta).
                </li>
                <li>
                  <strong>Dextérité</strong> = 7 (fixe). Utilisée pour toucher en combat (2d6 ≤ DEX).
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {stepIdx > 0 && (
          <button
            className="btn btn-outline flex-1"
            onClick={() => setStep(STEPS[stepIdx - 1])}
          >
            ← Précédent
          </button>
        )}

        {step !== "stats" ? (
          <button
            className="btn btn-primary flex-1"
            disabled={!canNext()}
            onClick={() => setStep(STEPS[stepIdx + 1])}
          >
            Suivant →
          </button>
        ) : (
          <button
            className="btn btn-success flex-1"
            disabled={!canNext() || creating}
            onClick={handleCreate}
          >
            {creating ? <span className="loading loading-spinner" /> : "Créer la partie ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

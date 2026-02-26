import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameMode, Talent } from "../../domain/models";
import { rng } from "../../application/container";
import type { CreatePartyInput } from "../../application/use-cases/CreatePartyUseCase";
import { DiceRoller, type DiceRollerHandle } from "../components/dice/DiceRoller";

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

const MODE_VALUES = [GameMode.NARRATIVE, GameMode.SIMPLIFIED, GameMode.MORTAL] as const;
const STEPS: Step[] = ["mode", "talent", "stats"];

// ─── Component ─────────────────────────────────────────────────────────────────

export function CreatePartyPage() {
  const { t } = useTranslation();
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

  const hp1Ref = useRef<DiceRollerHandle>(null);
  const hp2Ref = useRef<DiceRollerHandle>(null);
  const luckRef = useRef<DiceRollerHandle>(null);

  const stepIdx = STEPS.indexOf(step);
  const hpRoll = state.hpDice[0] + state.hpDice[1];
  const hpMax = hpRoll * 4;

  function rerollStats() {
    const newHpDice: [number, number] = [rng.rollD6(), rng.rollD6()];
    const newLuckDice = rng.rollD6();
    hp1Ref.current?.roll(newHpDice[0]);
    hp2Ref.current?.roll(newHpDice[1]);
    luckRef.current?.roll(newLuckDice);
    setState((s) => ({ ...s, hpDice: newHpDice, luckDice: newLuckDice }));
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
      const { createCharacter } = await import("../../domain/rules/character");
      const { PartyStatus } = await import("../../domain/models");
      const character = createCharacter({
        name: input.characterName,
        talent: input.talent,
        hpRoll: hpRoll,
        luckRoll: state.luckDice,
      });
      const { partyRepo, eventLog, outboxRepo, clock } =
        await import("../../application/container");
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
        label: t("createParty.createdLabel", {
          name: input.name,
          mode: t(`createParty.modes.${input.mode}.label`),
        }),
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
        {(["mode", "talent", "stats"] as const).map((s, i) => (
          <li key={s} className={`step ${i <= stepIdx ? "step-primary" : ""}`}>
            {t(`createParty.steps.${s}`)}
          </li>
        ))}
      </ul>

      {/* ── STEP 1: Mode ── */}
      {step === "mode" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t("createParty.partyNameTitle")}</h2>
          <input
            type="text"
            placeholder={t("createParty.partyNamePlaceholder")}
            className="input input-bordered w-full"
            value={state.partyName}
            maxLength={40}
            onChange={(e) => setState((s) => ({ ...s, partyName: e.target.value }))}
          />

          <h2 className="text-xl font-bold">{t("createParty.gameModeTitle")}</h2>
          <div className="flex flex-col gap-3">
            {MODE_VALUES.map((value) => (
              <label
                key={value}
                className={`card cursor-pointer border-2 transition ${
                  state.mode === value
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-200"
                }`}
              >
                <div className="card-body flex-row items-start gap-3 p-4">
                  <input
                    type="radio"
                    name="mode"
                    className="radio-primary radio mt-1"
                    checked={state.mode === value}
                    onChange={() => setState((s) => ({ ...s, mode: value }))}
                  />
                  <div>
                    <div className="font-semibold">{t(`createParty.modes.${value}.label`)}</div>
                    <div className="text-sm text-base-content/60">
                      {t(`createParty.modes.${value}.desc`)}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Aide modes */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">{t("createParty.helpModes")}</div>
            <div className="collapse-content text-sm text-base-content/70">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>{t("createParty.modes.NARRATIVE.label")}</strong> :{" "}
                  {t("createParty.modeHelp.narrativeDesc")}
                </li>
                <li>
                  <strong>{t("createParty.modes.SIMPLIFIED.label")}</strong> :{" "}
                  {t("createParty.modeHelp.simplifiedDesc")}
                </li>
                <li>
                  <strong>{t("createParty.modes.MORTAL.label")}</strong> :{" "}
                  {t("createParty.modeHelp.mortalDesc")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Talent ── */}
      {step === "talent" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t("createParty.chooseTalent")}</h2>
          <div className="flex flex-col gap-2">
            {Object.values(Talent).map((talent) => (
              <label
                key={talent}
                className={`card cursor-pointer border-2 transition ${
                  state.talent === talent
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-200"
                }`}
              >
                <div className="card-body flex-row items-center gap-3 p-3">
                  <input
                    type="radio"
                    name="talent"
                    className="radio-primary radio"
                    checked={state.talent === talent}
                    onChange={() => setState((s) => ({ ...s, talent }))}
                  />
                  <span className="font-medium">{t(`talents.${talent}`)}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Aide talents */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">{t("createParty.helpTalents")}</div>
            <div className="collapse-content text-sm text-base-content/70">
              <p>{t("createParty.talentHelpIntro")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {Object.values(Talent).map((talent) => (
                  <li key={talent}>
                    <strong>{t(`talents.${talent}`)}</strong> :{" "}
                    {t(`createParty.talentHelp.${talent}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Stats ── */}
      {step === "stats" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t("createParty.characterTitle")}</h2>
          <input
            type="text"
            placeholder={t("createParty.characterNamePlaceholder")}
            className="input input-bordered w-full"
            value={state.characterName}
            maxLength={40}
            onChange={(e) => setState((s) => ({ ...s, characterName: e.target.value }))}
          />

          <div className="card bg-base-200">
            <div className="card-body gap-4 p-4">
              <h3 className="font-semibold">{t("createParty.initialStats")}</h3>

              {/* HP */}
              <div className="flex flex-col gap-1">
                <span className="text-sm text-base-content/70">{t("createParty.hpMaxLabel")}</span>
                <div className="flex items-center gap-3">
                  <DiceRoller ref={hp1Ref} defaultValue={state.hpDice[0]} size={52} />
                  <DiceRoller ref={hp2Ref} defaultValue={state.hpDice[1]} size={52} />
                  <span className="text-sm font-bold text-success">× 4 = {hpMax} HP</span>
                </div>
              </div>

              {/* Luck */}
              <div className="flex flex-col gap-1">
                <span className="text-sm text-base-content/70">{t("createParty.luckLabel")}</span>
                <DiceRoller ref={luckRef} defaultValue={state.luckDice} size={52} />
              </div>

              {/* Dexterity (fixed) */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-base-content/70">
                  {t("createParty.dexterityLabel")}
                </span>
                <span className="font-bold">7</span>
              </div>

              <button type="button" className="btn btn-outline btn-sm w-full" onClick={rerollStats}>
                {t("createParty.rerollBtn")}
              </button>
            </div>
          </div>

          {/* Aide stats */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium">{t("createParty.helpStats")}</div>
            <div className="collapse-content text-sm text-base-content/70">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>{t("createParty.hpMaxLabel").split(" (")[0]}</strong> ={" "}
                  {t("createParty.statsHelp.hpMax")}
                </li>
                <li>
                  <strong>{t("createParty.luckLabel").split(" (")[0]}</strong> ={" "}
                  {t("createParty.statsHelp.luck")}
                </li>
                <li>
                  <strong>{t("createParty.dexterityLabel")}</strong> ={" "}
                  {t("createParty.statsHelp.dexterity")}
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
          <button className="btn btn-outline flex-1" onClick={() => setStep(STEPS[stepIdx - 1])}>
            {t("createParty.prev")}
          </button>
        )}

        {step !== "stats" ? (
          <button
            className="btn btn-primary flex-1"
            disabled={!canNext()}
            onClick={() => setStep(STEPS[stepIdx + 1])}
          >
            {t("createParty.next")}
          </button>
        ) : (
          <button
            className="btn btn-success flex-1"
            disabled={!canNext() || creating}
            onClick={handleCreate}
          >
            {creating ? <span className="loading loading-spinner" /> : t("createParty.create")}
          </button>
        )}
      </div>
    </div>
  );
}

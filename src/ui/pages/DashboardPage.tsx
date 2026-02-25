import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Party, Note, SaveSlot, TimelineEvent } from "../../domain/models";
import { TimelineEventType, PartyStatus } from "../../domain/models";
import {
  partyRepo,
  noteRepo,
  saveSlotRepo,
  eventLog,
  updateChapter,
  updateHp,
  addNote,
  addCustomAction,
  createSave,
  restoreSave,
  finishParty,
  exportParty,
} from "../../application/container";
import { canRestoreAnySlot } from "../../domain/rules/character";

const TYPE_LABELS: Partial<Record<TimelineEventType, string>> = {
  [TimelineEventType.PARTY_CREATED]: "🎲 Création",
  [TimelineEventType.CHAPTER_SET]: "📖 Chapitre",
  [TimelineEventType.HP_CHANGED]: "❤️ PV",
  [TimelineEventType.LUCK_SPENT]: "🍀 Chance",
  [TimelineEventType.NOTE_ADDED]: "📝 Note",
  [TimelineEventType.SAVE_CREATED]: "💾 Sauvegarde",
  [TimelineEventType.SAVE_REPLACED]: "💾 Sauvegarde",
  [TimelineEventType.SAVE_RESTORED]: "🔄 Restauration",
  [TimelineEventType.COMBAT_VICTORY]: "⚔️ Victoire",
  [TimelineEventType.COMBAT_DEFEAT]: "💀 Défaite",
  [TimelineEventType.DEATH_RESET]: "☠️ Mort",
  [TimelineEventType.PARTY_EXPORTED]: "📤 Export",
  [TimelineEventType.PARTY_FINISHED]: "🏁 Terminée",
  [TimelineEventType.CUSTOM_ACTION]: "✏️ Action",
  [TimelineEventType.DICE_REROLLED]: "🎲 Relance",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();

  const [party, setParty] = useState<Party | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // modals / inputs
  const [noteInput, setNoteInput] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [pendingChapter, setPendingChapter] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"journal" | "notes" | "saves">("journal");

  const load = useCallback(async () => {
    if (!partyId) return;
    const [p, n, s, t] = await Promise.all([
      partyRepo.findById(partyId),
      noteRepo.findByPartyId(partyId),
      saveSlotRepo.findByPartyId(partyId),
      eventLog.findByPartyId(partyId),
    ]);
    if (!p) { navigate("/"); return; }
    setParty(p);
    setPendingChapter(p.currentChapter);
    setNotes(n);
    setSlots(s);
    setTimeline(t);
    setLoading(false);
  }, [partyId, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading || !party) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const char = party.character;
  const hpPct = Math.round((char.hpCurrent / char.hpMax) * 100);
  const hpColor = hpPct > 50 ? "progress-success" : hpPct > 25 ? "progress-warning" : "progress-error";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); await load(); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{party.name}</h1>
          <div className="text-sm text-base-content/60">
            {char.name} · {party.mode} · Ch. {party.currentChapter}
          </div>
        </div>
        <div className="flex gap-2">
          {party.status === PartyStatus.ACTIVE && (
            <Link to={`/party/${partyId}/combat`} className="btn btn-error btn-sm">
              ⚔️ Combat
            </Link>
          )}
          <Link to="/" className="btn btn-ghost btn-sm">←</Link>
        </div>
      </div>

      {/* Stats card */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-3 p-4">
          <div className="flex justify-between text-sm font-semibold">
            <span>PV {char.hpCurrent} / {char.hpMax}</span>
            <span>🍀 Chance : {char.luck}</span>
            <span>⚡ DEX : {char.dexterity}</span>
          </div>
          <progress className={`progress ${hpColor} w-full`} value={char.hpCurrent} max={char.hpMax} />

          {/* HP controls */}
          <div className="flex gap-2">
            <button className="btn btn-error btn-sm flex-1" disabled={busy} onClick={() => run(() => updateHp.execute(partyId!, -1))}>−1 PV</button>
            <button className="btn btn-success btn-sm flex-1" disabled={busy} onClick={() => run(() => updateHp.execute(partyId!, 1))}>+1 PV</button>
          </div>

          {/* Chapter */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline btn-xs"
                disabled={busy}
                onClick={() => setPendingChapter((v) => Math.max(1, v - 1))}
              >−</button>
              <input
                type="number"
                min={1}
                className="input input-bordered input-sm flex-1 text-center"
                value={pendingChapter}
                onChange={(e) => setPendingChapter(Math.max(1, Number(e.target.value) || 1))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pendingChapter !== party.currentChapter) {
                    run(() => updateChapter.execute(partyId!, pendingChapter));
                  }
                }}
              />
              <button
                className="btn btn-outline btn-xs"
                disabled={busy}
                onClick={() => setPendingChapter((v) => v + 1)}
              >+</button>
              <span className="text-sm text-base-content/60">§ {party.currentChapter}</span>
            </div>
            {pendingChapter !== party.currentChapter && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">
                  § {party.currentChapter} → {pendingChapter}
                </span>
                <button
                  className="btn btn-success btn-xs flex-1"
                  disabled={busy}
                  onClick={() => run(() => updateChapter.execute(partyId!, pendingChapter))}
                >
                  ✓ Valider
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setPendingChapter(party.currentChapter)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed mb-4">
        {(["journal", "notes", "saves"] as const).map((t) => (
          <button key={t} role="tab" className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
            {t === "journal" ? "Journal" : t === "notes" ? "Notes" : "Sauvegardes"}
          </button>
        ))}
      </div>

      {/* ── Journal ── */}
      {tab === "journal" && (
        <div className="flex flex-col gap-3">
          {/* Custom action */}
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              placeholder="Action libre…"
              value={customInput}
              maxLength={100}
              onChange={(e) => setCustomInput(e.target.value)}
            />
            <button
              className="btn btn-outline btn-sm"
              disabled={busy || !customInput.trim()}
              onClick={() => run(async () => { await addCustomAction.execute(partyId!, customInput.trim()); setCustomInput(""); })}
            >
              Ajouter
            </button>
          </div>

          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {timeline.length === 0 && <p className="text-center text-base-content/40">Aucune action.</p>}
            {timeline.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 rounded-lg bg-base-200 px-3 py-2 text-sm">
                <span className="shrink-0 text-base-content/40">{TYPE_LABELS[ev.type] ?? "·"}</span>
                <span className="flex-1">{ev.label}</span>
                <span className="shrink-0 text-xs text-base-content/30">{formatDate(ev.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {tab === "notes" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              placeholder="Nouvelle note…"
              value={noteInput}
              maxLength={200}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !noteInput.trim()}
              onClick={() => run(async () => { await addNote.execute(partyId!, noteInput.trim()); setNoteInput(""); })}
            >
              +
            </button>
          </div>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {notes.length === 0 && <p className="text-center text-base-content/40">Aucune note.</p>}
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-base-200 p-3 text-sm">
                <p>{n.content}</p>
                <p className="mt-1 text-xs text-base-content/30">{formatDate(n.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Saves ── */}
      {tab === "saves" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((slot) => (
              <button
                key={slot}
                className="btn btn-outline btn-sm flex-1"
                disabled={busy || party.status !== PartyStatus.ACTIVE}
                onClick={() => run(async () => { await createSave.execute(partyId!, slot); })}
              >
                💾 Slot {slot}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {slots.length === 0 && <p className="text-center text-base-content/40">Aucune sauvegarde.</p>}
            {[1, 2, 3].map((slotNum) => {
              const s = slots.find((x) => x.slot === slotNum);
              const latestSlot = slots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
              const canRestore = s && (!s || canRestoreAnySlot(party.mode) || latestSlot?.id === s.id);
              return (
                <div key={slotNum} className={`card bg-base-200 ${!s ? "opacity-40" : ""}`}>
                  <div className="card-body flex-row items-center justify-between p-3">
                    <div className="text-sm">
                      <span className="font-semibold">Slot {slotNum}</span>
                      {s && <span className="ml-2 text-base-content/50">{formatDate(s.createdAt)}</span>}
                      {!s && <span className="ml-2 text-base-content/30">Vide</span>}
                    </div>
                    {s && (
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={busy || !canRestore}
                        title={!canRestore ? "Mode Simplifié : seule la plus récente est restaurable" : ""}
                        onClick={() => run(async () => { await restoreSave.execute(partyId!, s.id); })}
                      >
                        Restaurer
                      </button>
                    )}
                  </div>
                  {!canRestore && s && (
                    <p className="px-3 pb-2 text-xs text-warning">Mode Simplifié : restauration désactivée pour ce slot.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export + Finish */}
          <div className="divider" />
          <button
            className="btn btn-outline btn-sm w-full"
            disabled={busy}
            onClick={() => run(async () => {
              const result = await exportParty.execute(partyId!);
              const blob = new Blob([result.json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `dagda-${party.name.replace(/\s+/g, "-")}.json`;
              a.click();
              URL.revokeObjectURL(url);
            })}
          >
            📤 Exporter JSON
          </button>
          {party.status === PartyStatus.ACTIVE && (
            <button
              className="btn btn-warning btn-sm w-full"
              disabled={busy}
              onClick={() => {
                if (confirm("Terminer la partie définitivement ?")) {
                  run(() => finishParty.execute(partyId!));
                }
              }}
            >
              🏁 Terminer la partie
            </button>
          )}
          {party.status === PartyStatus.FINISHED && (
            <div className="alert alert-info text-sm">Partie terminée. Exportez pour archiver.</div>
          )}
        </div>
      )}
    </div>
  );
}

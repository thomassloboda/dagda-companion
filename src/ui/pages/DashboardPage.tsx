import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Party, Note, SaveSlot, TimelineEvent, Weapon, Item } from "../../domain/models";
import { PartyStatus } from "../../domain/models";
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
  updateInventory,
  deleteParty,
} from "../../application/container";
import { canRestoreAnySlot } from "../../domain/rules/character";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
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
  const [tab, setTab] = useState<"journal" | "notes" | "saves" | "inventaire">("journal");

  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Inventory local form state ─────────────────────────────────────────────
  const [weaponForm, setWeaponForm] = useState({ name: "", bonus: 0, description: "" });
  const [itemForm, setItemForm] = useState({ name: "", quantity: 1, description: "" });
  const [currency, setCurrency] = useState({ boulons: 0 });

  const locale = i18n.resolvedLanguage ?? "fr-FR";

  const load = useCallback(async () => {
    if (!partyId) return;
    const [p, n, s, tl] = await Promise.all([
      partyRepo.findById(partyId),
      noteRepo.findByPartyId(partyId),
      saveSlotRepo.findByPartyId(partyId),
      eventLog.findByPartyId(partyId),
    ]);
    if (!p) {
      navigate("/");
      return;
    }
    setParty(p);
    setPendingChapter(p.currentChapter);
    setCurrency({ boulons: p.character.inventory.currency.boulons ?? 0 });
    setNotes(n);
    setSlots(s);
    setTimeline(tl);
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
  const hpPct = Math.round((char.hpCurrent / char.hpMax) * 100);
  const hpColor =
    hpPct > 50 ? "progress-success" : hpPct > 25 ? "progress-warning" : "progress-error";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const TAB_LABELS: Record<"journal" | "inventaire" | "notes" | "saves", string> = {
    journal: t("dashboard.tabs.journal"),
    inventaire: t("dashboard.tabs.inventory"),
    notes: t("dashboard.tabs.notes"),
    saves: t("dashboard.tabs.saves"),
  };

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
              {t("dashboard.combatBtn")}
            </Link>
          )}
          <Link to="/" className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        </div>
      </div>

      {/* Stats card */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-3 p-4">
          <div className="flex justify-between text-sm font-semibold">
            <span>{t("dashboard.hpDisplay", { current: char.hpCurrent, max: char.hpMax })}</span>
            <span>{t("dashboard.luck", { value: char.luck })}</span>
            <span>{t("dashboard.dex", { value: char.dexterity })}</span>
          </div>
          <progress
            className={`progress ${hpColor} w-full`}
            value={char.hpCurrent}
            max={char.hpMax}
          />

          {/* HP controls */}
          <div className="flex gap-2">
            <button
              className="btn btn-error btn-sm flex-1"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await updateHp.execute(partyId!, -1);
                })
              }
            >
              {t("dashboard.hpMinus")}
            </button>
            <button
              className="btn btn-success btn-sm flex-1"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await updateHp.execute(partyId!, 1);
                })
              }
            >
              {t("dashboard.hpPlus")}
            </button>
          </div>

          {/* Chapter */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline btn-xs"
                disabled={busy}
                onClick={() => setPendingChapter((v) => Math.max(1, v - 1))}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                className="input input-sm input-bordered flex-1 text-center"
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
              >
                +
              </button>
              <span className="text-sm text-base-content/60">
                {t("dashboard.chapterCurrent", { chapter: party.currentChapter })}
              </span>
            </div>
            {pendingChapter !== party.currentChapter && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">
                  {t("dashboard.chapterPending", {
                    from: party.currentChapter,
                    to: pendingChapter,
                  })}
                </span>
                <button
                  className="btn btn-success btn-xs flex-1"
                  disabled={busy}
                  onClick={() => run(() => updateChapter.execute(partyId!, pendingChapter))}
                >
                  {t("dashboard.chapterConfirm")}
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
      <div role="tablist" className="tabs-boxed tabs mb-4">
        {(["journal", "inventaire", "notes", "saves"] as const).map((tabKey) => (
          <button
            key={tabKey}
            role="tab"
            className={`tab text-xs ${tab === tabKey ? "tab-active" : ""}`}
            onClick={() => setTab(tabKey)}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ── Journal ── */}
      {tab === "journal" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-sm input-bordered flex-1"
              placeholder={t("dashboard.journal.placeholder")}
              value={customInput}
              maxLength={100}
              onChange={(e) => setCustomInput(e.target.value)}
            />
            <button
              className="btn btn-outline btn-sm"
              disabled={busy || !customInput.trim()}
              onClick={() =>
                run(async () => {
                  await addCustomAction.execute(partyId!, customInput.trim());
                  setCustomInput("");
                })
              }
            >
              {t("dashboard.journal.addBtn")}
            </button>
          </div>

          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {timeline.length === 0 && (
              <p className="text-center text-base-content/40">{t("dashboard.journal.empty")}</p>
            )}
            {timeline.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 rounded-lg bg-base-200 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-base-content/40">
                  {t(`timeline.${ev.type}`, { defaultValue: "·" })}
                </span>
                <span className="flex-1">{ev.label}</span>
                <span className="shrink-0 text-xs text-base-content/30">
                  {formatDate(ev.createdAt, locale)}
                </span>
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
              className="input input-sm input-bordered flex-1"
              placeholder={t("dashboard.notes.placeholder")}
              value={noteInput}
              maxLength={200}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !noteInput.trim()}
              onClick={() =>
                run(async () => {
                  await addNote.execute(partyId!, noteInput.trim());
                  setNoteInput("");
                })
              }
            >
              +
            </button>
          </div>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {notes.length === 0 && (
              <p className="text-center text-base-content/40">{t("dashboard.notes.empty")}</p>
            )}
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-base-200 p-3 text-sm">
                <p>{n.content}</p>
                <p className="mt-1 text-xs text-base-content/30">
                  {formatDate(n.createdAt, locale)}
                </p>
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
                onClick={() =>
                  run(async () => {
                    await createSave.execute(partyId!, slot);
                  })
                }
              >
                💾 Slot {slot}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {slots.length === 0 && (
              <p className="text-center text-base-content/40">{t("dashboard.saves.empty")}</p>
            )}
            {[1, 2, 3].map((slotNum) => {
              const s = slots.find((x) => x.slot === slotNum);
              const latestSlot = slots.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              )[0];
              const canRestore =
                s && (!s || canRestoreAnySlot(party.mode) || latestSlot?.id === s.id);
              return (
                <div key={slotNum} className={`card bg-base-200 ${!s ? "opacity-40" : ""}`}>
                  <div className="card-body flex-row items-center justify-between p-3">
                    <div className="text-sm">
                      <span className="font-semibold">Slot {slotNum}</span>
                      {s && (
                        <span className="ml-2 text-base-content/50">
                          {formatDate(s.createdAt, locale)}
                        </span>
                      )}
                      {!s && (
                        <span className="ml-2 text-base-content/30">
                          {t("dashboard.saves.slotEmpty")}
                        </span>
                      )}
                    </div>
                    {s && (
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={busy || !canRestore}
                        title={!canRestore ? t("dashboard.saves.simplifiedHint") : ""}
                        onClick={() =>
                          run(async () => {
                            await restoreSave.execute(partyId!, s.id);
                          })
                        }
                      >
                        {t("common.restore")}
                      </button>
                    )}
                  </div>
                  {!canRestore && s && (
                    <p className="px-3 pb-2 text-xs text-warning">
                      {t("dashboard.saves.simplifiedWarning")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export + Finish + Delete */}
          <div className="divider" />
          <button
            className="btn btn-outline btn-sm w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await exportParty.execute(partyId!);
                const blob = new Blob([result.json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `dagda-${party.name.replace(/\s+/g, "-")}.json`;
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            {t("dashboard.saves.exportBtn")}
          </button>

          {party.status === PartyStatus.ACTIVE && (
            <button
              className="btn btn-warning btn-sm w-full"
              disabled={busy}
              onClick={() => setConfirmFinish(true)}
            >
              {t("dashboard.saves.finishBtn")}
            </button>
          )}
          {party.status === PartyStatus.FINISHED && (
            <div className="alert alert-info text-sm">{t("dashboard.saves.finishedAlert")}</div>
          )}

          <button
            className="btn btn-ghost btn-sm w-full text-error"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            {t("dashboard.saves.deleteBtn")}
          </button>
        </div>
      )}

      {/* ── Inventaire ── */}
      {tab === "inventaire" &&
        (() => {
          const inv = party.character.inventory;

          async function saveInv(patch: Partial<typeof inv>, label: string) {
            await updateInventory.execute(partyId!, { ...inv, ...patch }, label);
            await load();
          }

          async function addWeapon() {
            if (!weaponForm.name.trim()) return;
            const weapon: Weapon = {
              id: crypto.randomUUID(),
              name: weaponForm.name.trim(),
              bonus: weaponForm.bonus,
              description: weaponForm.description.trim() || undefined,
            };
            const weapons = [...inv.weapons, weapon];
            await saveInv(
              { weapons, equippedWeaponId: inv.equippedWeaponId ?? weapon.id },
              t("dashboard.inventoryLog.weaponAdded", { name: weapon.name }),
            );
            setWeaponForm({ name: "", bonus: 0, description: "" });
          }

          async function removeWeapon(id: string) {
            const weapons = inv.weapons.filter((w) => w.id !== id);
            const equippedWeaponId =
              inv.equippedWeaponId === id ? weapons[0]?.id : inv.equippedWeaponId;
            await saveInv({ weapons, equippedWeaponId }, t("dashboard.inventoryLog.weaponRemoved"));
          }

          async function equipWeapon(id: string) {
            const name = inv.weapons.find((w) => w.id === id)?.name ?? "";
            await saveInv(
              { equippedWeaponId: id },
              t("dashboard.inventoryLog.weaponEquipped", { name }),
            );
          }

          async function addItem() {
            if (!itemForm.name.trim()) return;
            const item: Item = {
              id: crypto.randomUUID(),
              name: itemForm.name.trim(),
              quantity: Math.max(1, itemForm.quantity),
              description: itemForm.description.trim() || undefined,
            };
            await saveInv(
              { items: [...inv.items, item] },
              t("dashboard.inventoryLog.itemAdded", { name: item.name }),
            );
            setItemForm({ name: "", quantity: 1, description: "" });
          }

          async function changeItemQty(id: string, delta: number) {
            const items = inv.items
              .map((it) =>
                it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it,
              )
              .filter((it) => it.quantity > 0);
            const item = inv.items.find((it) => it.id === id);
            const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
            await saveInv(
              { items },
              t("dashboard.inventoryLog.itemQtyChanged", { delta: deltaStr, name: item?.name }),
            );
          }

          async function removeItem(id: string) {
            const item = inv.items.find((it) => it.id === id);
            await saveInv(
              { items: inv.items.filter((it) => it.id !== id) },
              t("dashboard.inventoryLog.itemRemoved", { name: item?.name }),
            );
          }

          async function saveCurrency() {
            await saveInv({ currency }, t("dashboard.inventoryLog.currencyUpdated"));
          }

          return (
            <div className="flex flex-col gap-5">
              {/* ── Armes ── */}
              <section>
                <h3 className="mb-2 font-semibold">{t("dashboard.inventory.weaponsTitle")}</h3>

                {inv.weapons.length === 0 && (
                  <p className="mb-2 text-sm text-base-content/40">
                    {t("dashboard.inventory.weaponsEmpty")}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {inv.weapons.map((w) => (
                    <div
                      key={w.id}
                      className={`card border-2 bg-base-200 transition ${
                        inv.equippedWeaponId === w.id ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <div className="card-body gap-1 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium">{w.name}</span>
                            {w.bonus !== 0 && (
                              <span className="ml-2 text-sm text-success">
                                {t("dashboard.inventory.weaponBonus", { bonus: w.bonus })}
                              </span>
                            )}
                            {inv.equippedWeaponId === w.id && (
                              <span className="badge badge-primary badge-sm ml-2">
                                {t("dashboard.inventory.weaponEquipped")}
                              </span>
                            )}
                            {w.description && (
                              <p className="mt-0.5 text-xs italic text-base-content/50">
                                {w.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {inv.equippedWeaponId !== w.id && (
                              <button
                                className="btn btn-ghost btn-xs"
                                disabled={busy}
                                title={t("dashboard.inventory.equipTooltip")}
                                onClick={() => run(() => equipWeapon(w.id))}
                              >
                                ✓
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              disabled={busy}
                              onClick={() => run(() => removeWeapon(w.id))}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border border-base-300 bg-base-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-base-content/60">
                    {t("dashboard.inventory.addWeaponTitle")}
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      className="input input-sm input-bordered w-full"
                      placeholder={t("dashboard.inventory.weaponNamePlaceholder")}
                      value={weaponForm.name}
                      maxLength={40}
                      onChange={(e) => setWeaponForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <label className="flex flex-1 items-center gap-1 text-sm">
                        {t("dashboard.inventory.weaponBonusLabel")}
                        <input
                          type="number"
                          className="input input-xs input-bordered w-16"
                          value={weaponForm.bonus}
                          onChange={(e) =>
                            setWeaponForm((f) => ({ ...f, bonus: Number(e.target.value) }))
                          }
                        />
                      </label>
                    </div>
                    <input
                      className="input input-sm input-bordered w-full"
                      placeholder={t("dashboard.inventory.weaponDescPlaceholder")}
                      value={weaponForm.description}
                      maxLength={80}
                      onChange={(e) =>
                        setWeaponForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                    <button
                      className="btn btn-primary btn-sm w-full"
                      disabled={busy || !weaponForm.name.trim()}
                      onClick={() => run(addWeapon)}
                    >
                      {t("common.addBtn")}
                    </button>
                  </div>
                </div>
              </section>

              <div className="divider my-0" />

              {/* ── Sac (items) ── */}
              <section>
                <h3 className="mb-2 font-semibold">{t("dashboard.inventory.bagTitle")}</h3>

                {inv.items.length === 0 && (
                  <p className="mb-2 text-sm text-base-content/40">
                    {t("dashboard.inventory.bagEmpty")}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {inv.items.map((it) => (
                    <div key={it.id} className="card bg-base-200">
                      <div className="card-body gap-1 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium">{it.name}</span>
                            {it.description && (
                              <p className="mt-0.5 text-xs italic text-base-content/50">
                                {it.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              className="btn btn-ghost btn-xs"
                              disabled={busy}
                              onClick={() => run(() => changeItemQty(it.id, -1))}
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">
                              {it.quantity}
                            </span>
                            <button
                              className="btn btn-ghost btn-xs"
                              disabled={busy}
                              onClick={() => run(() => changeItemQty(it.id, 1))}
                            >
                              +
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              disabled={busy}
                              onClick={() => run(() => removeItem(it.id))}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border border-base-300 bg-base-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-base-content/60">
                    {t("dashboard.inventory.addItemTitle")}
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      className="input input-sm input-bordered w-full"
                      placeholder={t("dashboard.inventory.itemNamePlaceholder")}
                      value={itemForm.name}
                      maxLength={40}
                      onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <label className="flex flex-1 items-center gap-1 text-sm">
                        {t("dashboard.inventory.itemQtyLabel")}
                        <input
                          type="number"
                          min={1}
                          className="input input-xs input-bordered w-16"
                          value={itemForm.quantity}
                          onChange={(e) =>
                            setItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                          }
                        />
                      </label>
                    </div>
                    <input
                      className="input input-sm input-bordered w-full"
                      placeholder={t("dashboard.inventory.itemDescPlaceholder")}
                      value={itemForm.description}
                      maxLength={80}
                      onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <button
                      className="btn btn-primary btn-sm w-full"
                      disabled={busy || !itemForm.name.trim()}
                      onClick={() => run(addItem)}
                    >
                      {t("common.addBtn")}
                    </button>
                  </div>
                </div>
              </section>

              <div className="divider my-0" />

              {/* ── Monnaie ── */}
              <section>
                <h3 className="mb-2 font-semibold">{t("dashboard.inventory.currencyTitle")}</h3>
                <label className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    className="input input-sm input-bordered w-32 text-center"
                    value={currency.boulons}
                    onChange={(e) => setCurrency({ boulons: Math.max(0, Number(e.target.value)) })}
                    onBlur={() => run(saveCurrency)}
                  />
                  <span className="text-sm text-base-content/60">
                    {t("dashboard.inventory.boulonsUnit")}
                  </span>
                </label>
              </section>
            </div>
          );
        })()}

      {/* ── Modal : Terminer la partie ── */}
      {confirmFinish && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">{t("dashboard.finishTitle")}</h3>
            <p className="py-3 text-sm text-base-content/70">
              {t("dashboard.finishBody", { name: party.name })}
            </p>
            <div className="modal-action gap-2">
              <button
                className="btn btn-ghost flex-1"
                disabled={busy}
                onClick={() => setConfirmFinish(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-warning flex-1"
                disabled={busy}
                onClick={() => {
                  setConfirmFinish(false);
                  run(() => finishParty.execute(partyId!));
                }}
              >
                {t("dashboard.finishBtn")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmFinish(false)} />
        </div>
      )}

      {/* ── Modal : Supprimer la partie ── */}
      {confirmDelete && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold text-error">{t("dashboard.deleteTitle")}</h3>
            <p className="py-3 text-sm">{t("dashboard.deleteBody", { name: party.name })}</p>
            <div className="modal-action gap-2">
              <button
                className="btn btn-ghost flex-1"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-error flex-1"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(false);
                  run(async () => {
                    await deleteParty.execute(partyId!);
                    navigate("/");
                  });
                }}
              >
                {t("dashboard.deleteBtn")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)} />
        </div>
      )}
    </div>
  );
}

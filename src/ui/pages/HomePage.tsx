import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { partyRepo, deleteParty } from "../../application/container";
import type { Party } from "../../domain/models";
import { PartyStatus } from "../../domain/models";

const STATUS_LABELS: Record<PartyStatus, string> = {
  [PartyStatus.ACTIVE]: "En cours",
  [PartyStatus.FINISHED]: "Terminée",
  [PartyStatus.DEAD]: "Morte",
};

const STATUS_BADGE: Record<PartyStatus, string> = {
  [PartyStatus.ACTIVE]: "badge-success",
  [PartyStatus.FINISHED]: "badge-info",
  [PartyStatus.DEAD]: "badge-error",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function HomePage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const data = await partyRepo.findAll();
    setParties(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await deleteParty.execute(toDelete.id);
    setToDelete(null);
    setDeleting(false);
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes parties</h1>
        <Link to="/party/new" className="btn btn-primary">
          + Nouvelle partie
        </Link>
      </div>

      {parties.length === 0 ? (
        <div className="card bg-base-200 text-center">
          <div className="card-body gap-4">
            <p className="text-base-content/60">Aucune partie. Commencez l'aventure !</p>
            <Link to="/party/new" className="btn btn-primary btn-lg w-full">
              Créer une partie
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {parties.map((p) => (
            <div
              key={p.id}
              className="card bg-base-200 shadow transition hover:shadow-md"
            >
              <div className="card-body gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  {/* Zone cliquable → dashboard */}
                  <button
                    className="flex flex-1 flex-col items-start gap-1 text-left"
                    onClick={() => navigate(`/party/${p.id}`)}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className={`badge ${STATUS_BADGE[p.status]} shrink-0`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <div className="text-sm text-base-content/60">
                      Ch. {p.currentChapter} · {p.mode} · {p.character.name}
                    </div>
                    <div className="text-xs text-base-content/40">{timeAgo(p.updatedAt)}</div>
                  </button>

                  {/* Bouton suppression */}
                  <button
                    className="btn btn-ghost btn-sm shrink-0 text-error"
                    title="Supprimer la partie"
                    onClick={(e) => { e.stopPropagation(); setToDelete(p); }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal confirmation suppression ── */}
      {toDelete && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold text-error">Supprimer la partie ?</h3>
            <p className="py-3 text-sm">
              <span className="font-semibold">« {toDelete.name} »</span> sera supprimée
              définitivement avec toutes ses sauvegardes, notes et journal.
              Cette action est irréversible.
            </p>
            <div className="modal-action gap-2">
              <button
                className="btn btn-ghost flex-1"
                disabled={deleting}
                onClick={() => setToDelete(null)}
              >
                Annuler
              </button>
              <button
                className="btn btn-error flex-1"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? <span className="loading loading-spinner loading-sm" /> : "Supprimer"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !deleting && setToDelete(null)} />
        </div>
      )}
    </div>
  );
}

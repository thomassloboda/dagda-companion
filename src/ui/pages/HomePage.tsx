import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { partyRepo } from "../../application/container";
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
  const navigate = useNavigate();

  useEffect(() => {
    partyRepo.findAll().then((data) => {
      setParties(data);
      setLoading(false);
    });
  }, []);

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
            <button
              key={p.id}
              className="card bg-base-200 text-left shadow transition hover:shadow-md active:scale-95"
              onClick={() => navigate(`/party/${p.id}`)}
            >
              <div className="card-body gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className={`badge ${STATUS_BADGE[p.status]} shrink-0`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div className="text-sm text-base-content/60">
                  Ch. {p.currentChapter} · {p.mode} · {p.character.name}
                </div>
                <div className="text-xs text-base-content/40">{timeAgo(p.updatedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

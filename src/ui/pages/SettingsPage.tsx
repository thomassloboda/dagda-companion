import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore, type ThemeChoice } from "../stores/themeStore";
import { importParty } from "../../application/container";

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "auto", label: "Automatique (OS)" },
];

export function SettingsPage() {
  const { choice, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const party = await importParty.execute(text);
      navigate(`/party/${party.id}`);
    } catch (err) {
      alert(`Erreur d'import : ${(err as Error).message}`);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-6 text-2xl font-bold">Paramètres</h1>

      {/* Thème */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">Thème</h2>
          <div className="flex flex-col gap-3">
            {THEME_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="theme"
                  className="radio radio-primary"
                  checked={choice === opt.value}
                  onChange={() => setTheme(opt.value)}
                />
                <span className="text-base">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Import */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-3">
          <h2 className="card-title text-lg">Importer une partie</h2>
          <p className="text-sm text-base-content/60">
            Chargez un fichier JSON exporté depuis une autre session.
          </p>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
            📂 Choisir un fichier JSON
          </button>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-base-content/40">Dagda – La Saga v0.1.0</div>
    </div>
  );
}

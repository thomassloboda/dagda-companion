import { useThemeStore, type ThemeChoice } from "../stores/themeStore";

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "auto", label: "Automatique (OS)" },
];

export function SettingsPage() {
  const { choice, setTheme } = useThemeStore();

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-6 text-2xl font-bold">Paramètres</h1>

      <div className="card bg-base-200 shadow">
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

      <div className="mt-4 text-center text-sm text-base-content/40">Dagda – La Saga v0.1.0</div>
    </div>
  );
}

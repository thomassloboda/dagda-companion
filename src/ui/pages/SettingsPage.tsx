import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useThemeStore, type ThemeChoice } from "../stores/themeStore";
import { importParty } from "../../application/container";

const THEME_KEYS: { value: ThemeChoice; labelKey: string }[] = [
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
  { value: "auto", labelKey: "settings.themeAuto" },
];

const LANG_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "fr-FR", labelKey: "settings.langFR" },
  { value: "en-US", labelKey: "settings.langEN" },
];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
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
      alert(t("settings.importError", { message: (err as Error).message }));
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-6 text-2xl font-bold">{t("settings.title")}</h1>

      {/* Thème */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">{t("settings.themeTitle")}</h2>
          <div className="flex flex-col gap-3">
            {THEME_KEYS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="theme"
                  className="radio-primary radio"
                  checked={choice === opt.value}
                  onChange={() => setTheme(opt.value)}
                />
                <span className="text-base">{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Langue */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">{t("settings.languageTitle")}</h2>
          <div className="flex flex-col gap-3">
            {LANG_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="language"
                  className="radio-primary radio"
                  checked={i18n.resolvedLanguage === opt.value}
                  onChange={() => void i18n.changeLanguage(opt.value)}
                />
                <span className="text-base">{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Import */}
      <div className="card mb-4 bg-base-200 shadow">
        <div className="card-body gap-3">
          <h2 className="card-title text-lg">{t("settings.importTitle")}</h2>
          <p className="text-sm text-base-content/60">{t("settings.importDesc")}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
            {t("settings.importBtn")}
          </button>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-base-content/40">{t("settings.footer")}</div>
    </div>
  );
}

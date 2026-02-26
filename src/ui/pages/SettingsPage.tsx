import { useRef, useState } from "react";
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

const CHANGELOG_VERSIONS = ["v0_4_0", "v0_3_0", "v0_2_0", "v0_1_0"] as const;

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { choice, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showChangelog, setShowChangelog] = useState(false);

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

      {/* Footer */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-base-content/40">
        <span>{t("settings.footer")}</span>
        <button
          className="underline transition hover:text-base-content/70"
          onClick={() => setShowChangelog(true)}
        >
          v{__APP_VERSION__}
        </button>
      </div>

      {/* Modal changelog */}
      {showChangelog && (
        <div className="modal modal-open">
          <div className="modal-box max-h-[80vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-bold">{t("changelog.title")}</h3>
            <div className="flex flex-col gap-6">
              {CHANGELOG_VERSIONS.map((key) => (
                <div key={key}>
                  <div className="mb-2 font-semibold text-primary">
                    {t(`changelog.${key}.label`)}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {(t(`changelog.${key}.items`, { returnObjects: true }) as string[]).map(
                      (item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 shrink-0 text-base-content/40">·</span>
                          <span>{item}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn btn-primary w-full" onClick={() => setShowChangelog(false)}>
                {t("changelog.closeBtn")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowChangelog(false)} />
        </div>
      )}
    </div>
  );
}

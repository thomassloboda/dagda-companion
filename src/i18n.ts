import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import frFR from "./ui/locales/fr-FR/translation.json";
import enUS from "./ui/locales/en-US/translation.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "fr-FR": { translation: frFR },
      "en-US": { translation: enUS },
    },
    fallbackLng: "fr-FR",
    supportedLngs: ["fr-FR", "en-US"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

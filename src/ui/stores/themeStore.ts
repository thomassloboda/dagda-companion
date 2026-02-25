import { create } from "zustand";

export type ThemeChoice = "light" | "dark" | "auto";

const STORAGE_KEY = "dagda-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadPersistedChoice(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  return "auto";
}

interface ThemeState {
  choice: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (choice: ThemeChoice) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const choice = loadPersistedChoice();
  const resolvedTheme = choice === "auto" ? getSystemTheme() : choice;

  // listen for OS change
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      set((state) => {
        if (state.choice !== "auto") return {};
        const next = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        return { resolvedTheme: next };
      });
    });

  return {
    choice,
    resolvedTheme,
    setTheme: (newChoice) => {
      localStorage.setItem(STORAGE_KEY, newChoice);
      const resolved = newChoice === "auto" ? getSystemTheme() : newChoice;
      document.documentElement.setAttribute("data-theme", resolved);
      set({ choice: newChoice, resolvedTheme: resolved });
    },
  };
});

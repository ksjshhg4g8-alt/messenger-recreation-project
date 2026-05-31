import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "dark" | "light" | "violet" | "ocean";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  emoji: string;
}

export const THEMES: ThemeOption[] = [
  { id: "dark", label: "Тёмная", emoji: "🌙" },
  { id: "light", label: "Светлая", emoji: "☀️" },
  { id: "violet", label: "Фиолетовая", emoji: "💜" },
  { id: "ocean", label: "Океан", emoji: "🌊" },
];

const STORAGE_KEY = "app_theme";

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light", "theme-violet", "theme-ocean");
  root.classList.add(`theme-${theme}`);
}

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved && THEMES.some((t) => t.id === saved) ? saved : "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: ThemeId) => setThemeState(t);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

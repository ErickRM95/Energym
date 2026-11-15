"use client";

import { useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

const storageKey = "energym-theme";

export function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const next = stored === "dark" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }, []);

  function choose(next: ThemeName) {
    setTheme(next);
    localStorage.setItem(storageKey, next);
    applyTheme(next);
  }

  return (
    <div>
      <p className="mb-2 px-1 text-xs text-muted-foreground">Apariencia</p>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="group" aria-label="Apariencia">
        {(["light", "dark"] as const).map((item) => {
          const selected = theme === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              className={`rounded-full px-3 py-1.5 text-sm ${selected ? "bg-primary font-medium text-primary-foreground" : "text-foreground"}`}
              onClick={() => choose(item)}
            >
              {item === "light" ? "Claro" : "Oscuro"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

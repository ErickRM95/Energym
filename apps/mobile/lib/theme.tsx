import { useColorScheme } from "nativewind";
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { appStorage } from "@/lib/supabase";

export type ThemeName = "light" | "dark";

const storageKey = "energym-theme";

export const palettes = {
  light: {
    canvas: "#f3f4ef",
    ink: "#161915",
    muted: "#5c655b",
    line: "#d7dacf",
    accent: "#3d5c0a",
    logo: "#161915",
    logoSub: "#5c655b",
  },
  dark: {
    canvas: "#101410",
    ink: "#f4f7f2",
    muted: "#c9d2c8",
    line: "#243024",
    accent: "#c6f135",
    logo: "#f4f7f2",
    logoSub: "#c9d2c8",
  },
} as const;

const ThemeContext = createContext<{ scheme: ThemeName; choose: (theme: ThemeName) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [scheme, setScheme] = useState<ThemeName>("dark");

  useLayoutEffect(() => {
    if (Platform.OS !== "web") {
      setColorScheme("dark");
      return;
    }
    const next = window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    setScheme(next);
    setColorScheme(next);
  }, [setColorScheme]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    void appStorage.getItem(storageKey).then((value) => {
      if (!active) return;
      const next = value === "light" ? "light" : "dark";
      setScheme(next);
      setColorScheme(next);
    });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  function choose(next: ThemeName) {
    setScheme(next);
    setColorScheme(next);
    if (Platform.OS === "web") window.localStorage.setItem(storageKey, next);
    else void appStorage.setItem(storageKey, next);
  }

  return <ThemeContext.Provider value={{ scheme, choose }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme necesita ThemeProvider");
  return { ...theme, colors: palettes[theme.scheme] };
}

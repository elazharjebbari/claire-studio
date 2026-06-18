"use client";

/**
 * Store UI global (préférences persistées) : thème clair/sombre, repli de la
 * sidebar, projet courant, ouverture de la command palette.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorTheme = "dark" | "light";

interface UiState {
  theme: ColorTheme;
  sidebarCollapsed: boolean;
  currentProjectSlug: string | null;
  commandPaletteOpen: boolean;
  density: "comfortable" | "compact";
  toggleTheme: () => void;
  setTheme: (t: ColorTheme) => void;
  toggleSidebar: () => void;
  setCurrentProject: (slug: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDensity: (d: "comfortable" | "compact") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      sidebarCollapsed: false,
      currentProjectSlug: null,
      commandPaletteOpen: false,
      density: "comfortable",
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCurrentProject: (currentProjectSlug) => set({ currentProjectSlug }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: "claire.ui",
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        currentProjectSlug: s.currentProjectSlug,
        density: s.density,
      }),
    },
  ),
);

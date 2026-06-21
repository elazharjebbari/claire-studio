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
  /** Réglette frontières-modèles (Feature A) : visibilité par modèle (absent/true = visible). */
  gutterModels: Record<string, boolean>;
  /** Réglette : afficher la teinte/abréviation de catégorie par segment (défaut off). */
  gutterShowCategory: boolean;
  /** Panneau Inspecteur (droite) ouvert/replié — gain d'espace (point f). */
  inspectorOpen: boolean;
  toggleTheme: () => void;
  setTheme: (t: ColorTheme) => void;
  toggleSidebar: () => void;
  setCurrentProject: (slug: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDensity: (d: "comfortable" | "compact") => void;
  toggleGutterModel: (id: string) => void;
  toggleGutterCategory: () => void;
  toggleInspector: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      sidebarCollapsed: false,
      currentProjectSlug: null,
      commandPaletteOpen: false,
      density: "comfortable",
      gutterModels: {},
      gutterShowCategory: false,
      inspectorOpen: true,
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCurrentProject: (currentProjectSlug) => set({ currentProjectSlug }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setDensity: (density) => set({ density }),
      // Réglette frontières-modèles : false ⇒ piste masquée ; absent/true ⇒ visible.
      toggleGutterModel: (id) =>
        set((s) => ({ gutterModels: { ...s.gutterModels, [id]: s.gutterModels[id] === false } })),
      toggleGutterCategory: () => set((s) => ({ gutterShowCategory: !s.gutterShowCategory })),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
    }),
    {
      name: "claire.ui",
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        currentProjectSlug: s.currentProjectSlug,
        density: s.density,
        gutterModels: s.gutterModels,
        gutterShowCategory: s.gutterShowCategory,
        inspectorOpen: s.inspectorOpen,
      }),
    },
  ),
);

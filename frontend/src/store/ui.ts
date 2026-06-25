"use client";

/**
 * Store UI global (préférences persistées) : thème clair/sombre, repli de la
 * sidebar, projet courant, ouverture de la command palette.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorTheme = "dark" | "light";

/**
 * Couche SHELL / POSTE (par navigateur) — ce qui dépend de l'écran. Les états « par compte »
 * (inspecteur/sidebar ouverts, overlays atelier, auto-pré-annotation) vivent désormais dans le
 * store de préférences PAR COMPTE (`store/prefs.ts`), synchronisé serveur.
 */
interface UiState {
  theme: ColorTheme;
  currentProjectSlug: string | null;
  commandPaletteOpen: boolean;
  density: "comfortable" | "compact";
  /** Réglette frontières-modèles (Feature A) : visibilité par modèle (absent/true = visible). */
  gutterModels: Record<string, boolean>;
  /** Réglette : afficher la teinte/abréviation de catégorie par segment (défaut off). */
  gutterShowCategory: boolean;
  /** Zoom du texte de lecture (1 = défaut). Borné [0.8, 1.6] (lisibilité). */
  readingZoom: number;
  /** Lignes élargies : utilise la largeur libérée (ex. inspecteur replié). */
  readingWide: boolean;
  toggleTheme: () => void;
  setTheme: (t: ColorTheme) => void;
  setCurrentProject: (slug: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDensity: (d: "comfortable" | "compact") => void;
  toggleGutterModel: (id: string) => void;
  toggleGutterCategory: () => void;
  setReadingZoom: (z: number) => void;
  toggleReadingWide: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      currentProjectSlug: null,
      commandPaletteOpen: false,
      density: "comfortable",
      gutterModels: {},
      gutterShowCategory: false,
      readingZoom: 1,
      readingWide: false,
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
      setCurrentProject: (currentProjectSlug) => set({ currentProjectSlug }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setDensity: (density) => set({ density }),
      // Réglette frontières-modèles (L7) : OPT-IN — masquée par défaut (densité réservée à la
      // demande / au mode Compare, pas dans le flux de lecture). true ⇒ piste affichée.
      toggleGutterModel: (id) =>
        set((s) => ({ gutterModels: { ...s.gutterModels, [id]: !s.gutterModels[id] } })),
      toggleGutterCategory: () => set((s) => ({ gutterShowCategory: !s.gutterShowCategory })),
      setReadingZoom: (z) => set({ readingZoom: Math.max(0.8, Math.min(1.6, z)) }),
      toggleReadingWide: () => set((s) => ({ readingWide: !s.readingWide })),
    }),
    {
      name: "claire.ui",
      partialize: (s) => ({
        theme: s.theme,
        currentProjectSlug: s.currentProjectSlug,
        density: s.density,
        gutterModels: s.gutterModels,
        gutterShowCategory: s.gutterShowCategory,
        readingZoom: s.readingZoom,
        readingWide: s.readingWide,
      }),
    },
  ),
);

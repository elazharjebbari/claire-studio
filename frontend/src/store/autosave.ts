"use client";

/**
 * État d'enregistrement automatique (chantier C). Store dédié et minimal : le hook
 * useAutosave le pilote, l'indicateur du workspace le lit. Isolé du store workspace
 * pour ne pas en alourdir le cycle init/reset.
 */

import { create } from "zustand";

export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

interface AutosaveState {
  saveState: SaveState;
  /** Horodatage du dernier enregistrement réussi (pour l'affichage relatif). */
  lastSavedAt: number | null;
  setSaveState: (s: SaveState) => void;
  markSaved: () => void;
}

export const useAutosaveStore = create<AutosaveState>((set) => ({
  saveState: "idle",
  lastSavedAt: null,
  setSaveState: (saveState) => set({ saveState }),
  markSaved: () => set({ saveState: "saved", lastSavedAt: Date.now() }),
}));

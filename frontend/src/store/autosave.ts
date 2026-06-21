"use client";

/**
 * État d'enregistrement automatique (chantier C). Store dédié et minimal : le hook
 * useAutosave le pilote, l'indicateur du workspace le lit. Isolé du store workspace
 * pour ne pas en alourdir le cycle init/reset.
 */

import { create } from "zustand";

/**
 * États d'enregistrement. `unauthorized` est TERMINAL (L0) : 401/403 = session
 * expirée ou annotation non possédée — on N'EFFECTUE PAS de réessai (sinon tempête
 * réseau, cf. bug 403). `error` reste réessayable (transitoire : 500/réseau).
 */
export type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "offline"
  | "retrying" // échec transitoire (5xx/réseau) → nouvelle tentative auto (backoff)
  | "error" // arrêté : abandon après MAX tentatives, ou erreur client (4xx) — réessai manuel
  | "unauthorized"; // terminal (401/403) : session expirée / lecture seule

interface AutosaveState {
  saveState: SaveState;
  /** Horodatage du dernier enregistrement réussi (pour l'affichage relatif). */
  lastSavedAt: number | null;
  /** Compteur incrémenté par « Réessayer » : le hook autosave réarme dessus. */
  manualRetry: number;
  setSaveState: (s: SaveState) => void;
  markSaved: () => void;
  triggerRetry: () => void;
}

export const useAutosaveStore = create<AutosaveState>((set) => ({
  saveState: "idle",
  lastSavedAt: null,
  manualRetry: 0,
  setSaveState: (saveState) => set({ saveState }),
  markSaved: () => set({ saveState: "saved", lastSavedAt: Date.now() }),
  triggerRetry: () =>
    set((s) => ({ manualRetry: s.manualRetry + 1, saveState: "saving" })),
}));

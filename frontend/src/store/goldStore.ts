"use client";

/**
 * Bus d'interaction de l'atelier GOLD : sélection + survol de phrase PARTAGÉS entre les
 * trois panneaux (sidebar ↔ lecture ↔ inspecteur). Store satellite minimal, isolé du
 * store d'annotation. Le contenu (phrases, votes) vient de react-query ; ce store ne
 * porte QUE l'état d'interaction + le filtre de navigation.
 */

import { create } from "zustand";

export type GoldFilter = "all" | "conflicts" | "undecided";

interface GoldUiState {
  /** external_id du document en cours (garde anti-fuite entre documents). */
  docKey: string | null;
  selectedIndex: number | null;
  hoverIndex: number | null;
  filter: GoldFilter;
  /** Y du curseur lors de la dernière validation (curseur collant). */
  parkY: number | null;

  init: (docKey: string) => void;
  select: (index: number | null) => void;
  hover: (index: number | null) => void;
  setFilter: (filter: GoldFilter) => void;
  setParkY: (y: number | null) => void;
}

export const useGoldStore = create<GoldUiState>((set, get) => ({
  docKey: null,
  selectedIndex: null,
  hoverIndex: null,
  filter: "all",
  parkY: null,

  init: (docKey) => {
    // Réinitialise la sélection/survol en changeant de document (pas de fuite).
    if (get().docKey === docKey) return;
    set({ docKey, selectedIndex: null, hoverIndex: null, filter: "all", parkY: null });
  },
  select: (selectedIndex) => set({ selectedIndex }),
  hover: (hoverIndex) => set({ hoverIndex }),
  setFilter: (filter) => set({ filter }),
  setParkY: (parkY) => set({ parkY }),
}));

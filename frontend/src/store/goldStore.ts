"use client";

/**
 * Bus d'interaction de l'atelier GOLD : sélection + survol de phrase PARTAGÉS entre les
 * trois panneaux (sidebar ↔ lecture ↔ inspecteur). Store satellite minimal, isolé du
 * store d'annotation. Le contenu (phrases, votes) vient de react-query ; ce store ne
 * porte QUE l'état d'interaction + le filtre de navigation.
 */

import { create } from "zustand";

import type { DisplayLang } from "@/lib/prefs/schema";

/** `todo` = la file de travail réelle (non décidées).
 *
 *  Le filtre par défaut reste `all` : on n'arbitre pas une clause hors-sol, l'arbitre doit
 *  lire le contrat autour d'elle. C'est la NAVIGATION (n/p, flèches de saut) qui vise la
 *  file de travail — le filtre `todo` reste disponible pour une revue en fin de parcours. */
export type GoldFilter = "all" | "conflicts" | "todo";

interface GoldUiState {
  /** external_id du document en cours (garde anti-fuite entre documents). */
  docKey: string | null;
  selectedIndex: number | null;
  hoverIndex: number | null;
  filter: GoldFilter;
  /** Y du curseur lors de la dernière validation (curseur collant). */
  parkY: number | null;
  /** Langue de lecture des clauses : VO / bilingue / FR. Synchronisée avec la
   *  préférence de compte `overlays.displayLang` — un arbitre qui lit en français
   *  dans l'atelier d'annotation retrouve le français ici, et réciproquement. */
  displayLang: DisplayLang;

  init: (docKey: string) => void;
  select: (index: number | null) => void;
  hover: (index: number | null) => void;
  setFilter: (filter: GoldFilter) => void;
  setParkY: (y: number | null) => void;
  setDisplayLang: (lang: DisplayLang) => void;
}

export const useGoldStore = create<GoldUiState>((set, get) => ({
  docKey: null,
  selectedIndex: null,
  hoverIndex: null,
  filter: "all",
  parkY: null,
  displayLang: "orig",

  init: (docKey) => {
    // Réinitialise la sélection/survol en changeant de document (pas de fuite).
    if (get().docKey === docKey) return;
    // La LANGUE n'est pas réinitialisée : c'est un réglage de lecture de l'arbitre,
    // pas un état d'interaction propre au document.
    set({ docKey, selectedIndex: null, hoverIndex: null, filter: "all", parkY: null });
  },
  select: (selectedIndex) => set({ selectedIndex }),
  hover: (hoverIndex) => set({ hoverIndex }),
  setFilter: (filter) => set({ filter }),
  setParkY: (parkY) => set({ parkY }),
  setDisplayLang: (displayLang) => set({ displayLang }),
}));

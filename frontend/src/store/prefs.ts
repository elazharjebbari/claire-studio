"use client";

/**
 * Préférences d'interface PAR COMPTE (couche « compte / comportement ») — store Zustand.
 *
 * Source de vérité serveur (User.ui_preferences via /me) + CACHE localStorage namespacé par
 * id de compte (`claire.prefs::<uid>`) pour une hydratation SYNCHRONE anti-flash et anti-fuite
 * inter-comptes (postes partagés). Couches DISJOINTES de la couche shell (useUiStore,
 * theme/zoom/largeurs) ⇒ aucune réconciliation. La synchro réseau (PATCH /me débouncé) et
 * l'hydratation au login vivent dans `lib/prefs/useUiPrefsSync`.
 *
 * `rev` est incrémenté à CHAQUE mutation locale issue d'un geste utilisateur (jamais sur
 * hydratation) → c'est le signal que la synchro débouncée observe. Les setters sont
 * IDEMPOTENTS (aucune mutation ni bump si la valeur ne change pas) → pas d'écho PATCH lors du
 * semis des overlays par `init()`.
 */

import { create } from "zustand";
import {
  UI_PREFS_DEFAULTS,
  migratePrefs,
  type DisplayLang,
  type UiPrefsOverlays,
  type UiPrefsPanels,
  type UiPrefsV1,
} from "@/lib/prefs/schema";

export type SyncStatus = "idle" | "saving" | "saved";

const KEY = (uid: string) => `claire.prefs::${uid}`;

function readCache(uid: string): UiPrefsV1 {
  if (typeof window === "undefined") return UI_PREFS_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY(uid));
    return raw ? migratePrefs(JSON.parse(raw)) : UI_PREFS_DEFAULTS;
  } catch {
    return UI_PREFS_DEFAULTS;
  }
}

function writeCache(uid: string | null, prefs: UiPrefsV1): void {
  if (!uid || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(uid), JSON.stringify(prefs));
  } catch {
    /* quota / mode privé : le serveur reste la source de vérité */
  }
}

/** Égalité structurelle stable (objets petits, clés construites dans un ordre constant). */
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

interface PrefsState {
  uid: string | null;
  prefs: UiPrefsV1;
  /** Compteur de mutations utilisateur (déclencheur de synchro). */
  rev: number;
  syncStatus: SyncStatus;

  /** Associe le store à un compte : hydrate depuis le cache localStorage (synchrone). */
  bindUser: (uid: string) => void;
  /** Applique les préférences SERVEUR (autoritaires) — sans bump `rev` (pas d'écho PATCH). */
  applyServer: (raw: unknown) => void;
  /** Purge le cache du compte (déconnexion). */
  unbind: () => void;

  setOverlays: (patch: Partial<UiPrefsOverlays>) => void;
  setGhostJudge: (judge: string, visible: boolean) => void;
  setPanel: (key: keyof UiPrefsPanels, value: boolean) => void;
  setPrefill: (patch: Partial<UiPrefsV1["prefill"]>) => void;
  reset: () => void;

  setSyncStatus: (s: SyncStatus) => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => {
  /** Applique un updater PUR aux prefs ; idempotent (no-op si inchangé) ; bump `rev`. */
  const mutate = (next: UiPrefsV1) => {
    const { prefs, uid } = get();
    if (eq(prefs, next)) return; // idempotent → pas d'écho ni de PATCH inutile
    writeCache(uid, next);
    set((s) => ({ prefs: next, rev: s.rev + 1 }));
  };

  return {
    uid: null,
    prefs: UI_PREFS_DEFAULTS,
    rev: 0,
    syncStatus: "idle",

    bindUser: (uid) => set({ uid, prefs: readCache(uid) }),

    applyServer: (raw) => {
      const merged = migratePrefs(raw);
      const { uid } = get();
      writeCache(uid, merged);
      // Pas de bump `rev` : c'est un PULL autoritaire, on ne re-PATCH pas ce qu'on vient de lire.
      set({ prefs: merged });
    },

    unbind: () => set({ uid: null, prefs: UI_PREFS_DEFAULTS, syncStatus: "idle" }),

    setOverlays: (patch) => {
      const { prefs } = get();
      mutate({ ...prefs, overlays: { ...prefs.overlays, ...patch } });
    },
    setGhostJudge: (judge, visible) => {
      const { prefs } = get();
      mutate({ ...prefs, ghostJudges: { ...prefs.ghostJudges, [judge]: visible } });
    },
    setPanel: (key, value) => {
      const { prefs } = get();
      mutate({ ...prefs, panels: { ...prefs.panels, [key]: value } });
    },
    setPrefill: (patch) => {
      const { prefs } = get();
      mutate({ ...prefs, prefill: { ...prefs.prefill, ...patch } });
    },
    reset: () => {
      const { uid } = get();
      writeCache(uid, UI_PREFS_DEFAULTS);
      set((s) => ({ prefs: UI_PREFS_DEFAULTS, rev: s.rev + 1 }));
    },

    setSyncStatus: (syncStatus) => set({ syncStatus }),
  };
});

/** Sélecteur utilitaire : la langue d'affichage typée. */
export const selectDisplayLang = (s: PrefsState): DisplayLang => s.prefs.overlays.displayLang;

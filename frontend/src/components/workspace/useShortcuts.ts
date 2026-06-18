"use client";

/**
 * Raccourcis clavier du workspace (navigation.md §3) :
 *   j/k  : phrase suivante / précédente
 *   B    : ouvrir la palette de thème pour la phrase focalisée (n'applique plus de
 *          thème par défaut — la création de clause est explicite, Q2)
 *   T    : ouvrir/cibler le sélecteur de thème (callback externe)
 *   C    : ouvrir un commentaire (callback externe)
 *   0–3  : certitude de la clause sélectionnée
 *   ⌘S   : snapshot (callback externe)
 * Désactivé quand le focus est dans un champ de saisie (sauf ⌘S).
 */

import { useEffect } from "react";
import { useWorkspaceStore, selectSelectedDraft } from "@/store/workspace";
import type { Certainty } from "@/types/contract";

export interface ShortcutCallbacks {
  onFocusTheme?: () => void;
  onComment?: () => void;
  onSnapshot?: () => void;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable || tag === "select";
}

export function useWorkspaceShortcuts(cb: ShortcutCallbacks = {}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const store = useWorkspaceStore.getState();
      const editable = isEditable(e.target);

      // ⌘S / Ctrl+S : snapshot, même en saisie.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        cb.onSnapshot?.();
        return;
      }
      if (editable || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          store.moveFocus(1);
          break;
        case "k":
          e.preventDefault();
          store.moveFocus(-1);
          break;
        case "b":
        case "B":
          // Q2 : `B` n'applique plus de thème par défaut. Il ouvre la palette de
          // thème (focus de l'input de recherche), même si la phrase n'a pas encore
          // de clause — la création reste explicite (sélection d'un thème).
          e.preventDefault();
          cb.onFocusTheme?.();
          break;
        case "t":
        case "T":
          e.preventDefault();
          cb.onFocusTheme?.();
          break;
        case "c":
        case "C":
          e.preventDefault();
          cb.onComment?.();
          break;
        case "0":
        case "1":
        case "2":
        case "3": {
          const selected = selectSelectedDraft(store);
          if (selected) {
            e.preventDefault();
            store.setCertainty(selected.localId, Number(e.key) as Certainty);
          }
          break;
        }
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cb]);
}

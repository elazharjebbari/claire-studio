"use client";

/**
 * Résolution du projet « courant » SANS valeur en dur (H2 — dé-rigidification).
 *
 * Ordre de résolution :
 *  1. projet mémorisé dans le store UI (dernier ouvert / choisi dans la TopBar) ;
 *  2. sinon le premier projet visible renvoyé par l'API ;
 *  3. sinon `undefined` — l'appelant doit dégrader proprement (nav générique,
 *     query désactivée), jamais retomber sur un slug figé comme « claudette-gold-v1 ».
 *
 * Rend l'app générique : elle fonctionne quel que soit le corpus/projet chargé,
 * y compris une base totalement différente de CLAUDETTE.
 */

import { useUiStore } from "@/store/ui";
import { useProjects } from "@/lib/api/hooks";

export function useCurrentProjectSlug(): string | undefined {
  const stored = useUiStore((s) => s.currentProjectSlug);
  const { data } = useProjects();
  return stored ?? data?.results?.[0]?.slug;
}

"use client";

/**
 * Bouton « Visite guidée » du workspace (driver.js) + auto-démarrage à la 1re visite.
 *
 * - Le bouton lance toujours la visite (import dynamique du module tour pour ne pas
 *   charger driver.js/son CSS tant que l'utilisateur ne le demande pas).
 * - Auto-démarrage UNIQUEMENT à la première visite (localStorage `claire.tourSeen`),
 *   non bloquant, et JAMAIS en mode mock (NEXT_PUBLIC_ENABLE_MOCKS === "true") afin
 *   de préserver les tests E2E Playwright.
 */

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/primitives";
import { MOCKS_ENABLED } from "@/lib/env";
import { useMe } from "@/lib/api/hooks";

// Versionné : incrémenter le suffixe quand la visite est refondue → les utilisateurs
// existants la revoient automatiquement UNE fois après la mise à jour.
// v2 (2026-06-22) : refonte N-way + blocs récents (minimap, sélection, nature, etc.).
const TOUR_SEEN_KEY = "claire.tourSeen.v2";

async function launchTour(): Promise<void> {
  const mod = await import("@/lib/tour/workspaceTour");
  mod.startWorkspaceTour();
}

export function WorkspaceTourButton() {
  const autoStarted = useRef(false);
  const { data: me } = useMe();
  // Compte invité (accès reviewer) : il vient LIRE des annotations, pas apprendre à annoter —
  // la visite ne s'ouvre pas d'elle-même, le bouton reste à disposition.
  const guest = !!me?.isGuest;

  useEffect(() => {
    // Auto-démarrage 1re visite : jamais en mode mock (E2E), jamais pour un invité, une fois.
    if (MOCKS_ENABLED || guest || autoStarted.current) return;
    autoStarted.current = true;
    let seen = false;
    try {
      seen = window.localStorage.getItem(TOUR_SEEN_KEY) === "true";
    } catch {
      /* localStorage indisponible → on ne force rien */
      return;
    }
    if (seen) return;
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, "true");
    } catch {
      /* ignore */
    }
    // Laisse le workspace se monter (panneaux, phrases) avant de cibler les éléments.
    const t = window.setTimeout(() => {
      void launchTour();
    }, 600);
    return () => window.clearTimeout(t);
  }, [guest]);

  return (
    <Button
      variant="ghost"
      data-testid="start-tour"
      aria-label="Lancer la visite guidée"
      title="Visite guidée"
      onClick={() => void launchTour()}
    >
      🧭 Visite guidée
    </Button>
  );
}

"use client";

/**
 * Synchronisation des préférences d'interface PAR COMPTE (couche compte) :
 *  - HYDRATATION au login : bindUser(cache) puis applyServer(/me.uiPreferences) (autoritaire) ;
 *  - SAUVEGARDE : à chaque mutation utilisateur (rev), PATCH /me débouncé (~800 ms) ;
 *  - STATUT saving/saved/idle pour l'indicateur du popover.
 *
 * Monté UNE fois sous l'AuthGate (providers) : /me n'est sondé qu'une fois authentifié.
 */

import { useEffect, useRef } from "react";
import { useMe } from "@/lib/api/hooks";
import { patchUiPreferences } from "@/lib/api/endpoints";
import { usePrefsStore } from "@/store/prefs";

const DEBOUNCE_MS = 800;

export function useUiPrefsSync(): void {
  const { data: me } = useMe();
  const bindUser = usePrefsStore((s) => s.bindUser);
  const applyServer = usePrefsStore((s) => s.applyServer);
  const setSyncStatus = usePrefsStore((s) => s.setSyncStatus);

  // Hydratation : cache local (synchrone, anti-flash) puis serveur (autoritaire).
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!me?.id) return;
    const uid = String(me.id);
    if (hydratedFor.current === uid) {
      // Même compte : on rafraîchit la couche serveur (ex. /me re-fetché) sans re-binder.
      applyServer(me.uiPreferences);
      return;
    }
    hydratedFor.current = uid;
    bindUser(uid);
    applyServer(me.uiPreferences);
  }, [me?.id, me?.uiPreferences, bindUser, applyServer]);

  // Sauvegarde débouncée : observe les CHANGEMENTS de `rev` (mutations utilisateur).
  // `scheduledRev` est mis à jour DÈS la planification — garde anti-ré-entrance : `setSyncStatus`
  // modifie l'état et re-déclenche `subscribe`, mais `rev` n'a pas bougé (seul `syncStatus` a
  // changé) → on sort aussitôt, pas de boucle. (Garder sur le rev « sauvegardé » rebouclerait
  // tant que le PATCH n'a pas résolu, figeant la page.)
  const scheduledRev = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!me?.id) return;
    const unsub = usePrefsStore.subscribe((state) => {
      if (state.rev === scheduledRev.current) return;
      scheduledRev.current = state.rev;
      if (timer.current) clearTimeout(timer.current);
      setSyncStatus("saving");
      const revAtSchedule = state.rev;
      const snapshot = state.prefs;
      timer.current = setTimeout(() => {
        patchUiPreferences(snapshot)
          .then(() => {
            setSyncStatus("saved");
            // Repli discret à « idle » si aucune nouvelle mutation depuis.
            setTimeout(() => {
              if (usePrefsStore.getState().rev === revAtSchedule) setSyncStatus("idle");
            }, 1500);
          })
          .catch(() => {
            // Échec réseau : le cache local reste autoritaire ; retry au prochain geste.
            setSyncStatus("idle");
          });
      }, DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [me?.id, setSyncStatus]);
}

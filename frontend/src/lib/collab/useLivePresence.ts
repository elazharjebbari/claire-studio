"use client";

/**
 * Présence des participants (chantier D) : temps réel WebSocket quand l'infra est
 * active (flag realtime_collaboration ON + NEXT_PUBLIC_WS_URL défini), sinon repli
 * sur la présence REST (polling). L'UI consomme la même forme dans les deux cas →
 * aucune régression du chemin solo.
 */

import { useEffect, useState } from "react";
import { useFeatureFlags, usePresence } from "@/lib/api/hooks";
import { createCollabClient, type CollabParticipant } from "@/lib/collab/collabClient";
import { tokenStore } from "@/lib/api/client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

export interface LivePresence {
  participants: CollabParticipant[];
  /** Vrai uniquement si un transport WebSocket est réellement connecté. */
  live: boolean;
}

export function useLivePresence(
  annotationId: string | null | undefined,
  enabled: boolean,
): LivePresence {
  const { data: flags } = useFeatureFlags();
  const wantRealtime =
    enabled &&
    Boolean(flags?.realtimeCollaboration) &&
    Boolean(WS_URL) &&
    Boolean(annotationId);

  const [livePeople, setLivePeople] = useState<CollabParticipant[] | null>(null);

  // Repli REST : actif tant qu'on n'est pas en temps réel connecté.
  const rest = usePresence(annotationId ?? undefined, enabled && !wantRealtime);

  useEffect(() => {
    if (!wantRealtime || !annotationId || !WS_URL) {
      setLivePeople(null);
      return;
    }
    const client = createCollabClient({
      annotationId,
      wsUrl: WS_URL,
      token: tokenStore.getAccess(),
    });
    const off = client.onPresence((p) => setLivePeople(p));
    void client.connect();
    return () => {
      off();
      client.disconnect();
    };
  }, [wantRealtime, annotationId]);

  if (wantRealtime && livePeople) {
    return { participants: livePeople, live: true };
  }
  return {
    participants: (rest.data?.results ?? []) as CollabParticipant[],
    live: false,
  };
}

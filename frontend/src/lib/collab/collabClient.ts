/**
 * collabClient (points 4b/7) — ADAPTATEUR de collaboration temps réel.
 *
 * Frontière d'abstraction : l'UI ne dépend QUE de cette interface, jamais directement
 * de Yjs/Channels. En production, l'implémentation `createWebSocketCollab` se branche
 * sur Django Channels (WS) + un Y.Doc (CRDT) — cf. dossier 06_realtime_collaboration.md.
 * Tant que l'infra ASGI n'est pas active, `createNoopCollab` fournit un repli inerte :
 * l'éditeur reste pleinement fonctionnel en mono-utilisateur (REST), sans WS.
 *
 * Aucune fuite de Yjs/transport dans les composants : on n'expose que présence +
 * diffusion de patches sémantiques + cycle de vie.
 */

export interface CollabParticipant {
  userId: string;
  name: string;
  color: string;
  focusSentence?: number | null;
}

export interface CollabClient {
  /** Rejoint la salle d'une annotation (ticket signé requis côté serveur). */
  connect(): Promise<void>;
  /** Quitte la salle et libère les ressources. */
  disconnect(): void;
  /** Publie le focus courant (curseur ambiant). */
  setFocus(sentenceIndex: number): void;
  /** Diffuse un patch sémantique (clause/champ). Idempotent via opId. */
  broadcast(op: { opId: string; verb: string; payload: unknown }): void;
  /** S'abonne aux changements de présence. Renvoie une fonction de désinscription. */
  onPresence(cb: (participants: CollabParticipant[]) => void): () => void;
  /** Vrai si un transport temps réel est réellement connecté. */
  readonly isLive: boolean;
}

/** Repli inerte : aucune connexion, aucune présence. Mono-utilisateur (REST). */
export function createNoopCollab(): CollabClient {
  return {
    isLive: false,
    async connect() {
      /* no-op : pas de WS configuré (mode dégradé) */
    },
    disconnect() {},
    setFocus() {},
    broadcast() {},
    onPresence() {
      return () => {};
    },
  };
}

/**
 * Fabrique l'implémentation WebSocket (Channels + Yjs). NON activée tant que
 * NEXT_PUBLIC_WS_URL n'est pas défini ET que l'infra ASGI ne tourne pas : on renvoie
 * alors le repli inerte. L'implémentation complète (y-websocket + awareness) est
 * décrite dans le dossier et se branchera ici sans changer l'UI.
 */
export function createCollabClient(opts: { annotationId: string; wsUrl?: string }): CollabClient {
  if (!opts.wsUrl) return createNoopCollab();
  // TODO(realtime) : brancher y-websocket + awareness sur `${opts.wsUrl}/annotations/${id}/`.
  // Conserve le repli tant que l'implémentation WS n'est pas livrée pour éviter toute
  // régression du chemin solo.
  return createNoopCollab();
}

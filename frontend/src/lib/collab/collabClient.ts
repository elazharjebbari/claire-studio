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
 * Implémentation WebSocket réelle (Django Channels — chantier D) : présence live par
 * annotation. Se connecte à `${wsUrl}/ws/presence/{annotationId}/?token=<access>`,
 * reçoit le roster diffusé (`{type:"presence", participants}`) et publie le focus.
 * Dégrade proprement : toute erreur laisse `isLive=false` sans casser le chemin solo
 * (l'appelant retombe sur la présence REST).
 */
export function createWebSocketCollab(opts: {
  annotationId: string;
  wsUrl: string;
  token?: string | null;
}): CollabClient {
  let ws: WebSocket | null = null;
  let live = false;
  let participants: CollabParticipant[] = [];
  const subscribers = new Set<(p: CollabParticipant[]) => void>();

  const emit = () => {
    for (const cb of subscribers) cb(participants);
  };

  return {
    get isLive() {
      return live;
    },
    connect() {
      return new Promise<void>((resolve) => {
        const base = opts.wsUrl.replace(/\/$/, "");
        const q = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
        try {
          ws = new WebSocket(`${base}/ws/presence/${opts.annotationId}/${q}`);
        } catch {
          resolve();
          return;
        }
        ws.onopen = () => {
          live = true;
          resolve();
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg.type === "presence") {
              participants = (msg.participants ?? []) as CollabParticipant[];
              emit();
            }
          } catch {
            /* message non-JSON ignoré */
          }
        };
        ws.onclose = () => {
          live = false;
        };
        ws.onerror = () => {
          live = false;
          resolve(); // ne bloque jamais : on dégrade en REST
        };
      });
    },
    disconnect() {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
      live = false;
    },
    setFocus(sentenceIndex: number) {
      if (ws && live) ws.send(JSON.stringify({ type: "focus", sentenceIndex }));
    },
    broadcast() {
      /* patches sémantiques : non requis pour la présence (annotations mono-propriétaire) */
    },
    onPresence(cb) {
      subscribers.add(cb);
      cb(participants);
      return () => subscribers.delete(cb);
    },
  };
}

/**
 * Fabrique le client : WebSocket réel si `wsUrl` fourni, sinon repli inerte
 * (mono-utilisateur REST). L'UI ne dépend que de l'interface CollabClient.
 */
export function createCollabClient(opts: {
  annotationId: string;
  wsUrl?: string;
  token?: string | null;
}): CollabClient {
  if (!opts.wsUrl) return createNoopCollab();
  return createWebSocketCollab({
    annotationId: opts.annotationId,
    wsUrl: opts.wsUrl,
    token: opts.token,
  });
}

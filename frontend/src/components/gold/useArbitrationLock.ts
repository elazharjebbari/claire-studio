"use client";

/**
 * Verrou d'arbitrage côté client : acquiert au montage, prolonge (heartbeat) toutes les
 * 20 s, libère au démontage et sur `beforeunload`. Le bail serveur (90 s) est le filet de
 * sécurité si la libération échoue. La DB reste la source de vérité ; on expose l'état
 * pour piloter le bandeau et le mode lecture seule.
 *
 * Robustesse (revue) : réponses asynchrones obsolètes IGNORÉES (démontage / changement de
 * document) ; libération BEST-EFFORT au démontage même si l'acquisition était en vol
 * (release est idempotent côté serveur) ; état remis à neuf au changement de document.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireGoldLock,
  heartbeatGoldLock,
  releaseGoldLock,
  stealGoldLock,
} from "@/lib/api/endpoints";
import { API_BASE, ApiError, tokenStore } from "@/lib/api/client";
import type { GoldLockState } from "@/lib/gold/types";

const HEARTBEAT_MS = 20_000;

const FREE: GoldLockState = { locked: false, lockedBy: null, heldByMe: false };

export interface ArbitrationLock {
  lock: GoldLockState;
  heldByMe: boolean;
  blockedByOther: boolean;
  acquiring: boolean;
  error: string | null;
  steal: () => void;
  reacquire: () => void;
}

export function useArbitrationLock(
  slug: string,
  externalId: string,
  opts: { enabled?: boolean; initial?: GoldLockState } = {},
): ArbitrationLock {
  const enabled = opts.enabled ?? true;
  const [lock, setLock] = useState<GoldLockState>(opts.initial ?? FREE);
  const [acquiring, setAcquiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heldRef = useRef(false);
  heldRef.current = !!lock.heldByMe;
  // Document courant (lu à la résolution d'une requête async pour rejeter les obsolètes).
  const docRef = useRef(externalId);
  docRef.current = externalId;
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Réponse encore pertinente ? (composant monté ET même document.) */
  const fresh = useCallback((forDoc: string) => aliveRef.current && docRef.current === forDoc, []);

  const doAcquire = useCallback(async () => {
    const forDoc = externalId;
    setAcquiring(true);
    setError(null);
    try {
      const next = await acquireGoldLock(slug, externalId);
      if (!fresh(forDoc)) return;
      setLock(next);
    } catch (e) {
      if (!fresh(forDoc)) return;
      if (e instanceof ApiError && e.status === 409) {
        setLock((prev) => ({ ...prev, heldByMe: false }));
        setError("Document en cours d'arbitrage par un autre arbitre.");
      } else if (e instanceof ApiError && e.status === 423) {
        setError("Projet gelé par un administrateur.");
      } else {
        setError("Impossible d'acquérir le verrou.");
      }
    } finally {
      if (fresh(forDoc)) setAcquiring(false);
    }
  }, [slug, externalId, fresh]);

  const steal = useCallback(async () => {
    const forDoc = externalId;
    try {
      const next = await stealGoldLock(slug, externalId);
      if (!fresh(forDoc)) return;
      setLock(next);
      setError(null);
    } catch {
      if (fresh(forDoc)) setError("Reprise impossible (réservée aux leads/admin).");
    }
  }, [slug, externalId, fresh]);

  // Acquisition au montage / changement de document ; libération à la sortie.
  useEffect(() => {
    if (!enabled) return;
    setLock(FREE); // pas d'état hérité du document précédent (anti-bandeau périmé)
    setError(null);
    void doAcquire();
    const lockSlug = slug;
    const lockDoc = externalId;
    return () => {
      // Best-effort : release est idempotent côté serveur (no-op si non détenu ;
      // 409 inoffensif si tenu par un autre). Couvre l'unmount pendant l'acquire en vol.
      void releaseGoldLock(lockSlug, lockDoc).catch(() => undefined);
    };
  }, [enabled, slug, externalId, doAcquire]);

  // Heartbeat — recréé à chaque (re)prise du verrou (re-phasage), arrêté sinon.
  useEffect(() => {
    if (!enabled || !lock.heldByMe) return;
    const forDoc = externalId;
    const id = setInterval(async () => {
      try {
        const next = await heartbeatGoldLock(slug, externalId);
        if (fresh(forDoc)) setLock(next);
      } catch {
        if (fresh(forDoc)) {
          setLock((prev) => ({ ...prev, heldByMe: false }));
          setError("Verrou d'arbitrage perdu (expiré ou repris).");
        }
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled, lock.heldByMe, slug, externalId, fresh]);

  // Libération best-effort à la fermeture de l'onglet (le bail expire sinon).
  useEffect(() => {
    if (!enabled) return;
    const releaseBeacon = () => {
      const access = tokenStore.getAccess();
      try {
        void fetch(`${API_BASE}/projects/${slug}/gold/${encodeURIComponent(externalId)}/lock/release`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: "{}",
        });
      } catch {
        /* le bail expirera de lui-même */
      }
    };
    window.addEventListener("beforeunload", releaseBeacon);
    return () => window.removeEventListener("beforeunload", releaseBeacon);
  }, [enabled, slug, externalId]);

  return {
    lock,
    heldByMe: !!lock.heldByMe,
    blockedByOther: !!lock.locked && !lock.heldByMe,
    acquiring,
    error,
    steal,
    reacquire: () => void doAcquire(),
  };
}

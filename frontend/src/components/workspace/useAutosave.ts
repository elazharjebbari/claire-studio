"use client";

/**
 * Auto-save des clauses (chantier C). Persiste en arrière-plan le brouillon local
 * (store workspace) vers le serveur, sans perte silencieuse :
 *  - DEBOUNCE des changements (regroupe les frappes) ;
 *  - écriture OPTIMISTE (le store reste la vérité UI ; la synchro suit) ;
 *  - diff incrémental par ancre (lib/autosave) → create/update/delete minimal ;
 *  - IDEMPOTENCE : les créations portent client_op_id = localId, donc un retry
 *    après coupure ne duplique pas (le backend retourne la clause existante) ;
 *  - reprise HORS-LIGNE (event `online`) ; convergence si des modifs arrivent
 *    pendant une synchro ; états exposés via le store autosave.
 */

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useAutosaveStore } from "@/store/autosave";
import { addClause, deleteClause, patchClause } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import {
  draftsToPersisted,
  isEmptyPlan,
  planClauseSync,
  type PersistedClause,
} from "@/lib/autosave";
import type { Clause } from "@/types/contract";

const DEBOUNCE_MS = 1200;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;

/** Classe une erreur de synchro : `auth` (401/403, terminal), `client` (autre 4xx,
 *  terminal — réessayer n'aide pas), `transient` (5xx / réseau — réessai borné). */
function classifyError(e: unknown): "auth" | "client" | "transient" {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return "auth";
    if (e.status >= 400 && e.status < 500) return "client";
    return "transient"; // 5xx
  }
  return "transient"; // réseau / erreur inconnue
}

/** Backoff exponentiel BORNÉ + jitter ±20 % pour la tentative n (≥ 1). */
function backoffDelay(attempt: number): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

function fromClause(c: Clause): PersistedClause {
  return {
    anchorIndex: c.anchorIndex,
    serverId: String(c.id),
    theme: c.theme,
    legalNature: c.legalNature ?? null,
    evidenceSpan: c.evidenceSpan ?? "",
    rationale: c.rationale ?? "",
    certainty: c.certainty ?? null,
    validated: c.validated ?? false,
    themes: c.themes,
    boundary: c.boundary,
    triageLevel: c.triageLevel ?? null,
  };
}

function upsert(arr: PersistedClause[], p: PersistedClause): void {
  const i = arr.findIndex((x) => x.anchorIndex === p.anchorIndex);
  if (i >= 0) arr[i] = p;
  else arr.push(p);
}

export function useAutosave(annotationId: string | null) {
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const storeAnnId = useWorkspaceStore((s) => s.annotationId);
  const markClean = useWorkspaceStore((s) => s.markClean);
  const setSaveState = useAutosaveStore((s) => s.setSaveState);
  const markSaved = useAutosaveStore((s) => s.markSaved);
  const manualRetry = useAutosaveStore((s) => s.manualRetry);

  const persistedRef = useRef<PersistedClause[]>([]);
  const initedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const runRef = useRef<() => void>(() => {});
  // Erreur TERMINALE (401/403 = auth, ou 4xx = client) : on cesse tout réessai AUTO
  // (réessai manuel possible). Réarmé à chaque changement d'annotation.
  const terminal = useRef(false);
  // Réessais transitoires (5xx / réseau) : compteur borné + backoff. Remis à 0 au succès
  // et au changement d'annotation.
  const attempts = useRef(0);

  // Snapshot de référence pris une fois le store chargé avec les clauses serveur de
  // CETTE annotation — sinon on partirait de [] et tout paraîtrait « à créer ».
  useEffect(() => {
    if (
      annotationId &&
      storeAnnId === annotationId &&
      initedFor.current !== annotationId
    ) {
      persistedRef.current = draftsToPersisted(
        useWorkspaceStore.getState().draftClauses,
      );
      initedFor.current = annotationId;
      terminal.current = false; // nouvelle annotation → on réarme l'autosave.
      attempts.current = 0;
    }
  }, [annotationId, storeAnnId, drafts]);

  // Planifie une exécution de la synchro après `delay` ms (un seul timer actif).
  const scheduleRun = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runRef.current(), delay);
  };

  // Routine de synchro recréée à chaque rendu (capture fraîche), appelée via ref.
  runRef.current = async () => {
    if (
      !annotationId ||
      initedFor.current !== annotationId ||
      syncing.current ||
      terminal.current
    )
      return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSaveState("offline");
      const onOnline = () => {
        window.removeEventListener("online", onOnline);
        runRef.current();
      };
      window.addEventListener("online", onOnline);
      return;
    }
    const plan = planClauseSync(
      useWorkspaceStore.getState().draftClauses,
      persistedRef.current,
    );
    if (isEmptyPlan(plan)) return;

    syncing.current = true;
    setSaveState("saving");
    let transientFailure = false;
    try {
      // MAJ INCRÉMENTALE de persistedRef après chaque op réussie : un échec
      // partiel ne fait pas rejouer les ops déjà appliquées (et l'idempotence
      // couvre une création « réussie côté serveur mais perdue côté client »).
      for (const d of plan.creates) {
        const created = await addClause(annotationId, {
          anchorIndex: d.anchorIndex,
          theme: d.theme,
          legalNature: d.legalNature,
          evidenceSpan: d.evidenceSpan,
          rationale: d.rationale,
          certainty: d.certainty,
          validated: d.validated ?? false,
          // Multi-label / frontière / niveau (triage) — envoyés seulement si présents.
          ...(d.themes ? { themes: d.themes } : {}),
          ...(d.boundary ? { boundary: d.boundary } : {}),
          ...(d.triageLevel ? { triageLevel: d.triageLevel } : {}),
          clientOpId: d.localId,
        });
        upsert(persistedRef.current, fromClause(created));
      }
      for (const u of plan.updates) {
        await patchClause(u.serverId, {
          theme: u.draft.theme,
          legalNature: u.draft.legalNature,
          evidenceSpan: u.draft.evidenceSpan,
          rationale: u.draft.rationale,
          certainty: u.draft.certainty,
          validated: u.draft.validated ?? false,
          ...(u.draft.themes ? { themes: u.draft.themes } : {}),
          ...(u.draft.boundary ? { boundary: u.draft.boundary } : {}),
          ...(u.draft.triageLevel ? { triageLevel: u.draft.triageLevel } : {}),
        });
        upsert(persistedRef.current, {
          anchorIndex: u.draft.anchorIndex,
          serverId: u.serverId,
          theme: u.draft.theme,
          legalNature: u.draft.legalNature ?? null,
          evidenceSpan: u.draft.evidenceSpan ?? "",
          rationale: u.draft.rationale ?? "",
          certainty: u.draft.certainty ?? null,
          validated: u.draft.validated ?? false,
          themes: u.draft.themes,
          boundary: u.draft.boundary,
          triageLevel: u.draft.triageLevel ?? null,
        });
      }
      for (const id of plan.deletes) {
        await deleteClause(id);
        const i = persistedRef.current.findIndex((p) => p.serverId === id);
        if (i >= 0) persistedRef.current.splice(i, 1);
      }
      markSaved();
      markClean();
      attempts.current = 0; // succès → réinitialise le backoff
    } catch (e) {
      const kind = classifyError(e);
      if (kind === "auth") {
        // 401/403 : terminal (session expirée / annotation non possédée).
        terminal.current = true;
        setSaveState("unauthorized");
      } else if (kind === "client") {
        // 4xx (payload invalide, conflit…) : réessayer n'aide pas → on arrête.
        terminal.current = true;
        setSaveState("error");
      } else {
        transientFailure = true; // 5xx / réseau → réessai borné ci-dessous
      }
    } finally {
      syncing.current = false;
    }

    if (terminal.current) return;

    if (transientFailure) {
      attempts.current += 1;
      if (attempts.current <= MAX_ATTEMPTS) {
        setSaveState("retrying");
        scheduleRun(backoffDelay(attempts.current));
      } else {
        // Abandon des réessais AUTO après MAX_ATTEMPTS : on cesse d'inonder le serveur.
        // Une nouvelle modification (debounce) ou « Réessayer » relancera une tentative.
        setSaveState("error");
      }
      return;
    }

    // Succès : convergence si des modifications sont arrivées pendant la synchro.
    const remaining = planClauseSync(
      useWorkspaceStore.getState().draftClauses,
      persistedRef.current,
    );
    if (!isEmptyPlan(remaining)) scheduleRun(DEBOUNCE_MS);
  };

  // Réessai MANUEL (bouton « Réessayer ») : réarme (compteur + terminal) et relance.
  useEffect(() => {
    if (manualRetry === 0) return; // pas de réessai au montage initial
    attempts.current = 0;
    terminal.current = false;
    runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualRetry]);

  // Débounce : programme une synchro à chaque changement de brouillon « à sauver ».
  useEffect(() => {
    if (!annotationId || initedFor.current !== annotationId || terminal.current) return;
    if (isEmptyPlan(planClauseSync(drafts, persistedRef.current))) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runRef.current(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [drafts, annotationId]);
}

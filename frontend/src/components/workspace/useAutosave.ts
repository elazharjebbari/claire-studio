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

function fromClause(c: Clause): PersistedClause {
  return {
    anchorIndex: c.anchorIndex,
    serverId: String(c.id),
    theme: c.theme,
    legalNature: c.legalNature ?? null,
    evidenceSpan: c.evidenceSpan ?? "",
    rationale: c.rationale ?? "",
    certainty: c.certainty ?? null,
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

  const persistedRef = useRef<PersistedClause[]>([]);
  const initedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const runRef = useRef<() => void>(() => {});
  // L0 — erreur TERMINALE (401/403) : on cesse tout réessai pour cette annotation
  // (évite la tempête réseau). Réarmé à chaque changement d'annotation.
  const terminal = useRef(false);

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
    }
  }, [annotationId, storeAnnId, drafts]);

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
        });
        upsert(persistedRef.current, {
          anchorIndex: u.draft.anchorIndex,
          serverId: u.serverId,
          theme: u.draft.theme,
          legalNature: u.draft.legalNature ?? null,
          evidenceSpan: u.draft.evidenceSpan ?? "",
          rationale: u.draft.rationale ?? "",
          certainty: u.draft.certainty ?? null,
        });
      }
      for (const id of plan.deletes) {
        await deleteClause(id);
        const i = persistedRef.current.findIndex((p) => p.serverId === id);
        if (i >= 0) persistedRef.current.splice(i, 1);
      }
      markSaved();
      markClean();
    } catch (e) {
      // L0 — 401/403 = TERMINAL : session expirée ou annotation non possédée. On
      // cesse tout réessai (sinon tempête réseau, cf. bug 403). 500/réseau restent
      // réessayables via la convergence ci-dessous.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        terminal.current = true;
        setSaveState("unauthorized");
      } else {
        setSaveState("error");
      }
    } finally {
      syncing.current = false;
      // Convergence : si des modifications sont arrivées pendant la synchro — sauf en
      // état terminal, où l'on ne replanifie jamais.
      if (!terminal.current) {
        const remaining = planClauseSync(
          useWorkspaceStore.getState().draftClauses,
          persistedRef.current,
        );
        if (!isEmptyPlan(remaining)) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => runRef.current(), DEBOUNCE_MS);
        }
      }
    }
  };

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

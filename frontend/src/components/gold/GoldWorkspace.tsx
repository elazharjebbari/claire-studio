"use client";

/**
 * Atelier de résolution GOLD — orchestrateur 3 panneaux (sidebar / lecture / inspecteur),
 * verrou d'arbitrage temps réel, décision avec curseur collant (la phrase suivante vient
 * sous le curseur), et auto-résolution des cas peu risqués. Conflit-first.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Gavel, Lock, Unlock, Sparkles, ChevronLeft, ArrowRight, HelpCircle, Clock, Send, RotateCcw, Users } from "lucide-react";
import { ResizablePanels } from "@/components/workspace/ResizablePanels";
import { Button } from "@/components/ui/primitives";
import { GoldHelpModal } from "./GoldHelpModal";
import { ApiError } from "@/lib/api/client";
import {
  useGoldDocument,
  useDecideGold,
  useAutoResolveGold,
  useFinalizeGold,
  useReopenGold,
  useMe,
  useProject,
} from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";
import { useUiStore } from "@/store/ui";
import { useGoldStore } from "@/store/goldStore";
import { nextUndecided } from "@/lib/gold/blocks";
import { useArbitrationLock } from "./useArbitrationLock";
import { GoldOutlinePanel } from "./GoldOutlinePanel";
import { GoldReadingPanel } from "./GoldReadingPanel";
import { GoldInspectorPanel } from "./GoldInspectorPanel";

export function GoldWorkspace({ slug, documentId }: { slug: string; documentId: string }) {
  const setProject = useUiStore((s) => s.setCurrentProject);
  const initStore = useGoldStore((s) => s.init);
  const select = useGoldStore((s) => s.select);
  const setParkY = useGoldStore((s) => s.setParkY);
  const selectedIndex = useGoldStore((s) => s.selectedIndex);

  useEffect(() => setProject(slug), [slug, setProject]);
  useEffect(() => initStore(documentId), [documentId, initStore]);

  const [helpOpen, setHelpOpen] = useState(false);
  const { data: detail, isLoading, error } = useGoldDocument(slug, documentId);
  const decide = useDecideGold(slug, documentId);
  const autoResolve = useAutoResolveGold(slug, documentId);
  const finalize = useFinalizeGold(slug, documentId);
  const reopen = useReopenGold(slug, documentId);
  const ready = detail?.readiness?.ready ?? false;
  const { data: me } = useMe();
  const { data: project } = useProject(slug);
  const isManager = isAdminRole(me?.role) || project?.myRole === "lead";
  const lock = useArbitrationLock(slug, documentId, { initial: detail?.lock, enabled: ready });

  const sentences = useMemo(() => detail?.sentences ?? [], [detail]);
  const selected = useMemo(
    () => sentences.find((s) => s.index === selectedIndex) ?? null,
    [sentences, selectedIndex],
  );

  // Sélectionne la 1ʳᵉ phrase à faire à l'ouverture, ou re-sélectionne si l'index courant
  // n'existe plus (retour cockpit→atelier, renumérotation après refetch).
  useEffect(() => {
    const head = sentences[0];
    if (!head) return;
    const exists = selectedIndex != null && sentences.some((s) => s.index === selectedIndex);
    if (!exists) {
      const first = nextUndecided(sentences, -1);
      select(first ?? head.index);
    }
  }, [sentences, selectedIndex, select]);

  const committingRef = useRef(false);
  const canDecide = ready && lock.heldByMe && !decide.isPending;

  async function commit(index: number, primary: string, secondaries: string[], clientY: number) {
    if (!primary || committingRef.current) return; // primary requis + anti-double-clic
    committingRef.current = true;
    // Curseur collant : avance optimiste vers la prochaine non décidée + parking sur clientY.
    const next = nextUndecided(sentences, index);
    setParkY(clientY);
    if (next != null) select(next);
    try {
      await decide.mutateAsync({ index, primary, secondaries });
    } catch (e) {
      // Échec (409 verrou repris, 423 gel, 400…) : annuler l'avance optimiste.
      setParkY(null);
      select(index);
      if (e instanceof ApiError && (e.status === 409 || e.status === 423)) {
        lock.reacquire(); // resynchronise l'état réel du verrou
      }
    } finally {
      committingRef.current = false;
    }
  }

  if (isLoading) return <div className="p-8 text-ink-muted">Chargement de l'atelier…</div>;
  if (error || !detail)
    return (
      <div className="p-8 text-danger" data-testid="gold-workspace-error">
        Impossible de charger ce document.
      </div>
    );

  const pct = Math.round((detail.pctResolved ?? 0) * 100);

  return (
    <div className="flex h-full flex-col" data-testid="gold-workspace">
      {/* Barre d'outils */}
      <div className="flex items-center gap-3 border-b border-line bg-panel px-3 py-2">
        <Link
          href={`/projects/${slug}/gold`}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
          data-testid="gold-back"
        >
          <ChevronLeft size={15} aria-hidden /> Cockpit
        </Link>
        <Gavel size={16} className="text-gold" aria-hidden />
        <span className="text-sm font-semibold text-ink">{detail.document.title}</span>
        <span className="font-mono text-[11px] text-ink-muted">{detail.document.externalId}</span>
        <span className="ml-2 font-mono text-[11px] text-ink-muted">{pct}% résolu</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="gold-help-open"
            aria-label="Comment fonctionne la résolution ?"
            title="Comment ça marche ?"
            onClick={() => setHelpOpen(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            <HelpCircle size={15} aria-hidden />
          </button>
          {ready && !detail.finalized && (
            <>
              <LockBanner lock={lock} isManager={isManager} />
              <Button
                variant="subtle"
                data-testid="gold-auto-resolve"
                disabled={!lock.heldByMe}
                loading={autoResolve.isPending}
                icon={<Sparkles size={14} />}
                onClick={() => autoResolve.mutate()}
                title="Auto-résoudre les accords absolus et cas peu risqués"
              >
                Auto-résoudre
              </Button>
              {detail.canFinalize && (
                <Button
                  variant="primary"
                  data-testid="gold-finalize"
                  loading={finalize.isPending}
                  icon={<Send size={14} />}
                  onClick={() => finalize.mutate()}
                  title="Soumettre la résolution (toutes les phrases sont décidées)"
                >
                  Soumettre la résolution
                </Button>
              )}
            </>
          )}
          {detail.finalized && isManager && (
            <Button
              variant="outline"
              data-testid="gold-reopen"
              loading={reopen.isPending}
              icon={<RotateCcw size={14} />}
              onClick={() => reopen.mutate()}
              title="Rouvrir la résolution (corrections)"
            >
              Rouvrir
            </Button>
          )}
        </div>
      </div>

      {/* Bandeau de statut : indisponible (annotations incomplètes) ou résolue (soumise). */}
      {!ready && (
        <div
          data-testid="gold-awaiting-banner"
          className="flex items-center gap-2 border-b border-line bg-warning/10 px-4 py-2 text-[13px] text-warning"
        >
          <Clock size={14} aria-hidden />
          <Users size={14} aria-hidden />
          Résolution indisponible : {detail.readiness.submitted}/{detail.readiness.expected} annotateurs
          ont soumis. La résolution des conflits ne sera possible qu'une fois toutes les annotations validées.
        </div>
      )}
      {detail.finalized && (
        <div
          data-testid="gold-resolved-banner"
          className="flex items-center gap-2 border-b border-line bg-success/10 px-4 py-2 text-[13px] text-success"
        >
          <Gavel size={14} aria-hidden /> Résolution soumise : le gold de ce document est figé.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ResizablePanels
          left={<GoldOutlinePanel sentences={sentences} />}
          center={
            <GoldReadingPanel
              sentences={sentences}
              canDecide={canDecide}
              onValidate={(index, clientY) => {
                const s = sentences.find((x) => x.index === index);
                if (s) commit(index, s.proposedPrimary || s.primary, s.proposedSecondaries, clientY);
              }}
            />
          }
          right={
            <GoldInspectorPanel
              sentence={selected}
              canDecide={canDecide}
              pending={decide.isPending}
              onDecide={(index, primary, secondaries, clientY) =>
                commit(index, primary, secondaries, clientY)
              }
            />
          }
        />
      </div>

      {helpOpen && <GoldHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function LockBanner({
  lock,
  isManager,
}: {
  lock: ReturnType<typeof useArbitrationLock>;
  isManager: boolean;
}) {
  if (lock.heldByMe) {
    return (
      <span
        data-testid="gold-lock-mine"
        className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
      >
        <Unlock size={12} aria-hidden /> Vous arbitrez
      </span>
    );
  }
  if (lock.blockedByOther) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          data-testid="gold-lock-other"
          className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
        >
          <Lock size={12} aria-hidden /> Arbitré par {lock.lock.lockedBy ?? "un autre"}
        </span>
        {isManager && (
          <Button variant="outline" data-testid="gold-lock-steal" onClick={lock.steal} title="Reprendre (lead/admin)">
            <ArrowRight size={13} aria-hidden /> Reprendre
          </Button>
        )}
      </span>
    );
  }
  return (
    <Button variant="outline" data-testid="gold-lock-acquire" onClick={lock.reacquire} disabled={lock.acquiring}>
      <Lock size={13} aria-hidden /> {lock.acquiring ? "…" : "Prendre la main"}
    </Button>
  );
}

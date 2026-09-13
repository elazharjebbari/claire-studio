"use client";

/**
 * Atelier de résolution GOLD — orchestrateur 3 panneaux (sidebar / lecture / inspecteur),
 * verrou d'arbitrage temps réel, décision avec curseur collant (la phrase suivante vient
 * sous le curseur), et auto-résolution des cas peu risqués. Conflit-first.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Gavel, Lock, Unlock, Sparkles, ChevronLeft, ArrowRight, HelpCircle, Clock, Send, RotateCcw, Users, AlertTriangle, Layers } from "lucide-react";
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
import { usePrefsStore } from "@/store/prefs";
import { LangSwitch } from "@/components/workspace/LangSwitch";
import { TaxonomySwitch } from "@/components/taxonomy/TaxonomySwitch";
import { CANONICAL_TAXONOMY, getTaxonomy } from "@/lib/taxonomy";
import { useDocumentTranslations } from "@/lib/api/hooks";
import { nextTodo, prevTodo, nextUndecided, outlineStats } from "@/lib/gold/blocks";
import { candidatePrimaries } from "./GoldInspectorPanel";
import { useGoldShortcuts } from "./useGoldShortcuts";
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
  const displayLang = useGoldStore((s) => s.displayLang);
  const setDisplayLang = useGoldStore((s) => s.setDisplayLang);
  const taxonomy = useGoldStore((s) => s.taxonomy);
  const setTaxonomy = useGoldStore((s) => s.setTaxonomy);

  useEffect(() => setProject(slug), [slug, setProject]);
  useEffect(() => initStore(documentId), [documentId, initStore]);

  const [helpOpen, setHelpOpen] = useState(false);
  // Dernier refus serveur, rendu à l'écran : les messages 409/423 sont rédigés côté
  // serveur (ils nomment le détenteur du verrou ou les annotateurs manquants) mais
  // n'étaient affichés nulle part — l'arbitre voyait seulement son curseur reculer.
  const [decideError, setDecideError] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
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

  // Langue de lecture : hydratée depuis la préférence de COMPTE à l'ouverture, puis
  // repersistée à chaque changement — l'arbitre retrouve sa langue d'une session à l'autre
  // et d'un atelier à l'autre (annotation ↔ résolution), sans réglage en double.
  const prefLang = usePrefsStore((s) => s.prefs.overlays.displayLang);
  const setOverlaysPref = usePrefsStore((s) => s.setOverlays);
  const hydratedLang = useRef(false);
  useEffect(() => {
    if (hydratedLang.current) return;
    hydratedLang.current = true;
    setDisplayLang(prefLang);
  }, [prefLang, setDisplayLang]);

  const { byIndex: translations } = useDocumentTranslations(
    detail?.document.id != null ? String(detail.document.id) : undefined,
  );

  const sentences = useMemo(
    // La traduction est jointe ICI (source unique) : les trois panneaux reçoivent une
    // phrase déjà porteuse de son texte français, aucun n'interroge l'API de son côté.
    () =>
      (detail?.sentences ?? []).map((s) => {
        const fr = translations.get(s.index);
        return fr ? { ...s, textFr: fr } : s;
      }),
    [detail, translations],
  );
  const missingNames = detail?.readiness?.missingUsernames ?? [];
  const hasTranslations = translations.size > 0;
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
  const stats = useMemo(() => outlineStats(sentences), [sentences]);

  // Raccourcis clavier (spec 02-raccourcis.csv) : n/p naviguent la file de travail,
  // 1..9 adoptent le k-ième candidat, Entrée adopte la proposition — jamais sur une
  // égalité, où la proposition n'est qu'un départage alphabétique.
  useGoldShortcuts({
    canDecide,
    onNext: () => {
      const target = nextTodo(sentences, selectedIndex ?? -1);
      if (target != null) {
        setParkY(null);
        select(target);
      }
    },
    onPrev: () => {
      const target = prevTodo(sentences, selectedIndex ?? sentences.length);
      if (target != null) {
        setParkY(null);
        select(target);
      }
    },
    onAdoptCandidate: (position) => {
      if (!selected) return;
      const code = candidatePrimaries(selected)[position];
      if (code) void commit(selected.index, code, selected.proposedSecondaries, 0);
    },
    onAcceptProposal: () => {
      // Refus explicite sur une égalité : adopter « la proposition » y écrirait un thème
      // choisi par ordre alphabétique (mesuré : 462/462 des cas manuels sont des égalités).
      if (!selected || selected.tie || !selected.proposedPrimary) return;
      void commit(selected.index, selected.proposedPrimary, selected.proposedSecondaries, 0);
    },
    onShowHelp: () => setHelpOpen(true),
  });

  async function commit(
    index: number,
    primary: string,
    secondaries: string[],
    clientY: number,
    comment?: string,
  ) {
    if (!primary || committingRef.current) return; // primary requis + anti-double-clic
    committingRef.current = true;
    // Curseur collant : avance optimiste vers la prochaine non décidée + parking sur clientY.
    // clientY = 0 (décision composée, hors rail) ⇒ pas de parking, centrage simple.
    const next = nextUndecided(sentences, index);
    setParkY(clientY > 0 ? clientY : null);
    if (next != null) select(next);
    try {
      await decide.mutateAsync({ index, primary, secondaries, comment });
      setDecideError(null);
    } catch (e) {
      // Échec (409 verrou repris, 423 gel, 400…) : annuler l'avance optimiste ET DIRE POURQUOI.
      setParkY(null);
      select(index);
      if (e instanceof ApiError) {
        const detail = (e.body as { detail?: string } | undefined)?.detail;
        setDecideError(detail || e.message || "Décision refusée par le serveur.");
        if (e.status === 409 || e.status === 423) {
          lock.reacquire(); // resynchronise l'état réel du verrou
        }
      } else {
        setDecideError("Décision non enregistrée (réseau indisponible).");
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
        {ready && !detail.finalized && (
          <span
            data-testid="gold-todo-counter"
            aria-live="polite"
            className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
          >
            {stats.pending} à trancher
            {stats.ties > 0 && ` · ${stats.ties} sans consensus`}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Bascule de langue : n'apparaît que si le document a une traduction —
              un contrôle inerte serait une promesse non tenue. */}
          {/* Grille de lecture des thèmes. La décision, elle, reste en T20 : voir le
              bandeau ci-dessous quand une projection est active. */}
          <TaxonomySwitch testIdPrefix="gold-taxonomy" value={taxonomy} onChange={setTaxonomy} />
          {hasTranslations && (
            <LangSwitch
              testIdPrefix="gold-lang"
              value={displayLang}
              onChange={(lang) => {
                setDisplayLang(lang);
                setOverlaysPref({ displayLang: lang });
              }}
            />
          )}
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
                  disabled={!lock.heldByMe}
                  loading={finalize.isPending}
                  icon={<Send size={14} />}
                  onClick={() => setConfirmFinalize(true)}
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
          className="flex flex-wrap items-center gap-2 border-b border-line bg-warning/10 px-4 py-2 text-[13px] text-warning"
        >
          <Clock size={14} aria-hidden />
          <Users size={14} aria-hidden />
          <span>
            Résolution indisponible : {detail.readiness.submitted}/{detail.readiness.expected} annotateurs
            ont soumis.
            {/* NOMMER les manquants : un compteur seul rend le blocage indiagnosticable. */}
            {missingNames.length > 0 && (
              <>
                {" "}En attente de <strong data-testid="gold-awaiting-missing">{missingNames.join(", ")}</strong>.
              </>
            )}
          </span>
          {isManager && (
            <Link
              href={`/projects/${slug}/gold/config`}
              data-testid="gold-awaiting-config-link"
              className="ml-auto rounded border border-warning/40 px-2 py-0.5 text-[12px] underline-offset-2 hover:underline"
            >
              Ajuster les participants attendus
            </Link>
          )}
        </div>
      )}
      {taxonomy !== CANONICAL_TAXONOMY && (
        <div
          data-testid="gold-taxonomy-banner"
          className="flex flex-wrap items-center gap-2 border-b border-line bg-info/10 px-4 py-2 text-[13px] text-info"
        >
          <Layers size={14} aria-hidden />
          <span>
            Lecture en <strong>{getTaxonomy(taxonomy).label}</strong> — les thèmes affichés sont
            des <strong>projections</strong> des annotations. Les décisions restent écrites en{" "}
            <strong>T20</strong>, la taxonomie annotée : rien n'est dupliqué ni altéré.
          </span>
        </div>
      )}
      {(decideError || lock.error) && (
        <div
          data-testid="gold-error-banner"
          role="alert"
          className="flex items-center gap-2 border-b border-line bg-danger/10 px-4 py-2 text-[13px] text-danger"
        >
          <AlertTriangle size={14} aria-hidden />
          <span>{decideError ?? lock.error}</span>
          {lock.error && !lock.heldByMe && (
            <button
              type="button"
              data-testid="gold-error-reacquire"
              onClick={() => lock.reacquire()}
              className="rounded border border-danger/40 px-2 py-0.5 text-[12px] hover:bg-danger/10"
            >
              Reprendre la main
            </button>
          )}
          <button
            type="button"
            aria-label="Masquer ce message"
            data-testid="gold-error-dismiss"
            onClick={() => setDecideError(null)}
            className="ml-auto text-[12px] underline-offset-2 hover:underline"
          >
            Masquer
          </button>
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
              displayLang={displayLang}
              taxonomy={taxonomy}
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
              displayLang={displayLang}
              taxonomy={taxonomy}
              canDecide={canDecide}
              pending={decide.isPending}
              onDecide={(index, primary, secondaries, clientY, comment) =>
                commit(index, primary, secondaries, clientY, comment)
              }
            />
          }
        />
      </div>

      {confirmFinalize && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gold-finalize-title"
          data-testid="gold-finalize-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-line bg-panel p-4 shadow-xl">
            <h2 id="gold-finalize-title" className="mb-2 text-sm font-semibold text-ink">
              Figer le gold de « {detail.document.title} » ?
            </h2>
            <p className="mb-3 text-[13px] text-ink-muted">
              {stats.decided} phrase(s) décidée(s) seront <strong>figées</strong> : plus aucune
              modification ne sera possible sans rouvrir la résolution (réservé aux leads).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="subtle" data-testid="gold-finalize-cancel" onClick={() => setConfirmFinalize(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                data-testid="gold-finalize-confirm-ok"
                loading={finalize.isPending}
                onClick={() => {
                  setConfirmFinalize(false);
                  finalize.mutate();
                }}
              >
                Figer le gold
              </Button>
            </div>
          </div>
        </div>
      )}

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

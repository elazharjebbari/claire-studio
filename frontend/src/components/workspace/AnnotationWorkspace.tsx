"use client";

/**
 * ★ AnnotationWorkspace — orchestrateur du cœur produit (F1, F2, F6, F9, F10, F12).
 * Assemble les 3 panneaux redimensionnables, branche le store sur les données
 * serveur (react-query) et active les raccourcis clavier.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Eye, Lock, LockOpen } from "lucide-react";
import {
  useAnnotation,
  useDocument,
  useProject,
  useScheme,
  useMe,
  useLockAnnotation,
  useUnlockAnnotation,
  usePreAnnotations,
} from "@/lib/api/hooks";
import { useWorkspaceStore } from "@/store/workspace";
import { useUiStore } from "@/store/ui";
import { usePrefsStore } from "@/store/prefs";
import { useAutosaveStore } from "@/store/autosave";
import { setRuntimeThemes } from "@/lib/tokens";
import { llmJudgeLabel } from "@/lib/llmJudges";
import { preClausesToPivot } from "@/lib/pivot";
import { ResizablePanels } from "./ResizablePanels";
import { TocPanel } from "./TocPanel";
import { DocumentPanel } from "./DocumentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { HistoryPanel } from "./HistoryPanel";
import { CommentsPanel } from "./CommentsPanel";
import { TriageQueue } from "./triage/TriageQueue";
import { TRIAGE_ENABLED } from "@/lib/env";
import { useWorkspaceShortcuts } from "./useShortcuts";
import { useAutosave } from "./useAutosave";

export function AnnotationWorkspace({ annotationId }: { annotationId: string }) {
  const {
    data: annotation,
    isLoading: loadingAnn,
    isError: errorAnn,
    refetch: refetchAnn,
  } = useAnnotation(annotationId);
  const {
    data: doc,
    isLoading: loadingDoc,
    isError: errorDoc,
    refetch: refetchDoc,
  } = useDocument(annotation?.documentId);
  // Schéma résolu via le projet (plus de slug en dur, H4) : l'app suit le schéma du
  // corpus chargé, quel qu'il soit.
  const { data: project } = useProject(annotation?.projectSlug);
  const { data: scheme } = useScheme(project?.schemeSlug);
  const { data: me } = useMe();
  // Désambiguïsation (plan §P7) : MA session (édition) vs annotation d'autrui (lecture).
  // SÛR PAR DÉFAUT : tant que l'identité (me) ou l'annotation n'est pas confirmée, on
  // considère que ce N'EST PAS ma session → lecture seule, donc aucune écriture sous
  // identité incertaine (évite les 403 d'autosave quand me n'est pas encore chargé).
  const isMine = !!me && !!annotation && String(annotation.annotatorId) === String(me.id);
  // Verrouillage : édition gelée. Deux niveaux — SESSION (soumission auto / verrou
  // manuel, réversible par l'annotateur) et PROJET (gel de campagne posé par un admin,
  // NON déverrouillable par l'annotateur). Le verrou effectif est l'union des deux.
  const sessionLocked = !!annotation?.locked;
  const projectLocked = !!project?.locked;
  const locked = sessionLocked || projectLocked;
  const lockAnn = useLockAnnotation(annotationId);
  const unlockAnn = useUnlockAnnotation(annotationId);
  const [unlockConfirm, setUnlockConfirm] = useState(false);
  // Avertissement à la tentative d'édition d'un document verrouillé : le bandeau
  // « pulse » brièvement pour signaler « déverrouillez pour modifier ».
  const [lockFlash, setLockFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeLock = useCallback(() => {
    setLockFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setLockFlash(false), 1100);
  }, []);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const init = useWorkspaceStore((s) => s.init);
  const reset = useWorkspaceStore((s) => s.reset);
  // Source de segmentation affichée (collaboration) : « human » = MA session
  // éditable ; un juge LLM = vue LECTURE (la collaboration aide, ne fait pas
  // référence) ; « compare » = superposition. Sert la bannière de contexte ci-dessous.
  const llmSource = useWorkspaceStore((s) => s.llmSource);
  const isJudgeView = isMine && llmSource !== "human" && llmSource !== "compare";
  // Overlays live (pour le PONT vers les prefs PAR COMPTE). `llmSource` n'est PAS ponté : il
  // double comme mode de consultation transitoire (vue-juge), on ne le persiste donc pas.
  const showUnfairness = useWorkspaceStore((s) => s.showUnfairness);
  const ghostJudges = useWorkspaceStore((s) => s.ghostJudges);
  const displayLang = useWorkspaceStore((s) => s.displayLang);
  const setCurrentProject = useUiStore((s) => s.setCurrentProject);
  // États de panneaux PAR COMPTE (store de prefs, synchronisé serveur) : inspecteur replié
  // (point f) + panneaux historique/commentaires/triage (auparavant éphémères par doc).
  const panels = usePrefsStore((s) => s.prefs.panels);
  const setPanel = usePrefsStore((s) => s.setPanel);
  const inspectorOpen = panels.inspectorOpen;
  const toggleInspector = useCallback(
    () => setPanel("inspectorOpen", !usePrefsStore.getState().prefs.panels.inspectorOpen),
    [setPanel],
  );
  // L1 — repli SYMÉTRIQUE du plan (état PAR COMPTE via prefs.panels.sidebarCollapsed).
  const sidebarCollapsed = panels.sidebarCollapsed;
  const toggleSidebar = useCallback(
    () => setPanel("sidebarCollapsed", !usePrefsStore.getState().prefs.panels.sidebarCollapsed),
    [setPanel],
  );
  const showHistory = panels.historyOpen;
  const showComments = panels.commentsOpen;
  const showTriage = panels.triageOpen;
  // Auto-pré-annotation PAR COMPTE + données de pré-annotation du document (pour l'effet).
  const autoPrefill = usePrefsStore((s) => s.prefs.prefill);
  const replacePrefill = useWorkspaceStore((s) => s.replacePrefill);
  const { data: preData } = usePreAnnotations(annotation?.projectSlug, annotation?.documentId);
  const autoPrefilledRef = useRef<string | null>(null);
  const [snapshotFn, setSnapshotFn] = useState<(() => void) | null>(null);
  const registerSnapshot = useCallback((fn: () => void) => setSnapshotFn(() => fn), []);

  // Nettoyage à la sortie du workspace UNIQUEMENT (démontage). Séparé de l'init pour
  // ne pas réinitialiser le store à chaque re-rendu/refetch.
  useEffect(() => () => reset(), [reset]);

  // (Ré)initialise le store local quand l'IDENTITÉ ou le MODE change : id d'annotation,
  // document, ou bascule lecture seule / verrouillage. PAS à chaque refetch de
  // l'annotation (sinon un PATCH globalCertainty / snapshot, qui invalide la requête,
  // ré-initialiserait le store et ÉCRASERAIT des éditions de clause locales non encore
  // persistées par l'autosave — perte de données). `init` pose tout l'état, donc pas
  // besoin d'un reset intermédiaire ; il relit les clauses serveur fraîches à chaque
  // re-init légitime (ouverture, déverrouillage).
  const annId = annotation?.id;
  const docId = doc?.id;
  const nSent = doc?.nSentences;
  useEffect(() => {
    if (!annotation || !doc) return;
    // Overlays SEMÉS depuis les prefs PAR COMPTE (lus à l'instant, hors dépendances pour ne
    // pas ré-initialiser à chaque toggle) → fin du « reconfigurer à chaque document ».
    const o = usePrefsStore.getState().prefs.overlays;
    const g = usePrefsStore.getState().prefs.ghostJudges;
    init({
      annotationId: annotation.id,
      nSentences: doc.nSentences,
      clauses: annotation.clauses,
      // R1 — lecture seule stricte sur l'annotation d'un AUTRE annotateur, OU si le
      // document est VERROUILLÉ (soumis / verrou manuel). Le déverrouillage (qui change
      // `locked`) ré-initialise et rend l'édition.
      readOnly: !isMine || locked,
      overlays: {
        showUnfairness: o.showUnfairness,
        displayLang: o.displayLang,
        llmSource: o.llmSource,
        ghostJudges: g,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annId, docId, nSent, isMine, locked, init]);

  // AUTO-PRÉ-ANNOTATION à l'ouverture (point produit) — effet SÉPARÉ d'init (hors de ses
  // dépendances) pour ne pas ré-initialiser. Gardé STRICTEMENT : ma session, non verrouillé,
  // activé + modèle armé, document VIERGE (annotation serveur sans clause → jamais
  // d'écrasement), modèle disponible pour ce doc. Drapeau anti-ré-exécution par annotationId.
  useEffect(() => {
    if (!annotation || !doc || !isMine || locked) return;
    if (!autoPrefill.enabled || !autoPrefill.judge) return;
    if ((annotation.clauses?.length ?? 0) !== 0) return; // document non vierge → on ne touche pas
    if (autoPrefilledRef.current === annotation.id) return;
    const pre = preData?.results.find((p) => p.judge === autoPrefill.judge);
    if (!pre) return; // pré-annotation du modèle absente pour ce doc → sauté silencieusement
    autoPrefilledRef.current = annotation.id;
    replacePrefill(preClausesToPivot(pre.clauses), autoPrefill.judge);
  }, [
    annId,
    docId,
    isMine,
    locked,
    autoPrefill.enabled,
    autoPrefill.judge,
    preData,
    annotation,
    doc,
    replacePrefill,
  ]);

  // PONT overlays atelier → prefs PAR COMPTE : persiste les toggles d'affichage (injustice,
  // langue, fantômes LLM) pour qu'ils suivent le compte. Idempotent côté store (no-op si
  // inchangé) → aucun écho lors du semis par init(). `llmSource` exclu (mode transitoire).
  const setOverlaysPref = usePrefsStore((s) => s.setOverlays);
  const setGhostJudgePref = usePrefsStore((s) => s.setGhostJudge);
  useEffect(() => {
    if (!isMine) return; // en lecture seule (annotation d'autrui), on ne persiste rien
    setOverlaysPref({ showUnfairness, displayLang });
  }, [isMine, showUnfairness, displayLang, setOverlaysPref]);
  useEffect(() => {
    if (!isMine) return;
    const cur = usePrefsStore.getState().prefs.ghostJudges;
    for (const [judge, visible] of Object.entries(ghostJudges)) {
      if (cur[judge] !== visible) setGhostJudgePref(judge, visible);
    }
  }, [isMine, ghostJudges, setGhostJudgePref]);

  // R4 — aligne le projet courant sur le document réellement ouvert (nav cohérente :
  // file de travail, breadcrumbs, sélecteur de la TopBar suivent ce projet).
  useEffect(() => {
    if (annotation?.projectSlug) setCurrentProject(annotation.projectSlug);
  }, [annotation?.projectSlug, setCurrentProject]);

  // Hydrate couleurs/labels de thèmes depuis le schéma API (H4) ; repli statique
  // (design-tokens.json) en mode démo ou si une couleur manque. Hydratation SYNCHRONE
  // (pendant le rendu), pas dans un effet : setRuntimeThemes mute un état module qui ne
  // déclenche pas de re-rendu — un effet laisserait le 1er rendu (après arrivée du
  // schéma) sur le repli statique, soit un flash de couleurs par défaut pour un corpus
  // tiers. Idempotent ; rebâti seulement quand l'identité du schéma change.
  const hydratedScheme = useRef<unknown>(undefined);
  if (hydratedScheme.current !== scheme) {
    setRuntimeThemes(scheme?.themes ?? null);
    hydratedScheme.current = scheme;
  }
  useEffect(() => () => setRuntimeThemes(null), []);

  // Auto-save : persiste les clauses en arrière-plan (chantier C), sans perte.
  // R1 — UNIQUEMENT sur MA session ET non verrouillée : un viewer (lecture seule)
  // ou un document verrouillé n'écrit jamais (évite tout 403/423 parasite).
  useAutosave(isMine && !locked ? annotation?.id ?? null : null);

  const themeFocusRef = useRef<(() => void) | null>(null);
  useWorkspaceShortcuts({
    onFocusTheme: () => themeFocusRef.current?.(),
    onComment: () => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="comment-input"]');
      el?.focus();
    },
    onSnapshot: () => snapshotFn?.(),
  });

  // Erreur de chargement : NE PAS rester bloqué sur un spinner (symptôme « l'écran
  // d'annotation ne s'ouvre pas »). On affiche un état actionnable (réessayer / retour).
  if (errorAnn || (annotation && errorDoc)) {
    return (
      <div
        data-testid="workspace-error"
        className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <p className="text-sm font-medium text-ink">Impossible d'ouvrir cette annotation.</p>
        <p className="max-w-md text-xs text-ink-muted">
          {errorAnn
            ? "La session d'annotation n'a pas pu être chargée."
            : "Le document associé n'a pas pu être chargé."}{" "}
          Vérifiez votre connexion, puis réessayez.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="workspace-error-retry"
            onClick={() => {
              refetchAnn();
              refetchDoc();
            }}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:brightness-110"
          >
            Réessayer
          </button>
          <Link
            href="/work"
            data-testid="workspace-error-back"
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:bg-panel-muted"
          >
            Retour à mes annotations
          </Link>
        </div>
      </div>
    );
  }

  if (loadingAnn || loadingDoc || !annotation || !doc) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        Chargement du workspace…
      </div>
    );
  }

  const themeCodes = scheme?.themes.map((t) => t.code) ?? [];
  const legalNatures = scheme?.legalNatures ?? [];

  return (
    <div className="flex h-full flex-col" data-testid="annotation-workspace">
      <WorkspaceToolbar
        annotationId={annotation.id}
        projectSlug={annotation.projectSlug}
        documentId={annotation.documentId}
        onSnapshotRef={registerSnapshot}
        onToggleHistory={() => setPanel("historyOpen", !showHistory)}
        onToggleComments={() => setPanel("commentsOpen", !showComments)}
        onToggleTriage={isMine ? () => setPanel("triageOpen", !showTriage) : undefined}
        locked={locked}
        onLock={
          isMine && !locked
            ? async () => {
                // Anti-perte : on s'assure que les dernières modifications sont
                // persistées AVANT de geler l'édition (le verrou coupe l'autosave).
                const flush = useAutosaveStore.getState().flush;
                if (flush) await flush();
                lockAnn.mutate();
              }
            : undefined
        }
        onRequestUnlock={
          // L'annotateur ne peut déverrouiller QUE sa session ; un verrou PROJET
          // (campagne gelée) n'est levable que par un admin.
          isMine && sessionLocked && !projectLocked ? () => setUnlockConfirm(true) : undefined
        }
        onUnlock={
          // Déverrouillage DIRECT depuis la modale de succès (le geste y est déjà
          // explicité). Indisponible si la campagne est gelée (verrou projet → admin).
          isMine && !projectLocked ? () => unlockAnn.mutate() : undefined
        }
        projectLocked={projectLocked}
      />
      {isMine && locked ? (
        // Bandeau de VERROUILLAGE (point 2) — persistant, élégant, avec déverrouillage.
        // « Pulse » à la tentative d'édition (nudgeLock) pour signaler la lecture seule.
        <div
          data-testid="lock-banner"
          className={
            "flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium text-ink transition-all " +
            (lockFlash
              ? "border-amber-400 bg-amber-400/25 ring-1 ring-inset ring-amber-400/60"
              : "border-line bg-slate-400/15")
          }
        >
          <Lock size={14} aria-hidden className={lockFlash ? "text-amber-300" : "text-slate-300"} />
          {projectLocked ? (
            // Verrou PROJET : campagne gelée par un admin — non déverrouillable ici.
            <span>
              <strong>Projet verrouillé par un administrateur</strong> — édition gelée pour
              toute la campagne.{" "}
              <span className={lockFlash ? "text-amber-200" : "text-ink-muted"}>
                Un administrateur doit lever le verrou pour reprendre l'annotation.
              </span>
            </span>
          ) : (
            <>
              <span>
                <strong>Document {annotation.status === "submitted" ? "soumis et " : ""}verrouillé</strong>{" "}
                — lecture seule.{" "}
                <span className={lockFlash ? "text-amber-200" : "text-ink-muted"}>
                  Déverrouillez pour {annotation.status === "submitted" ? "reprendre l'annotation" : "modifier"}.
                </span>
              </span>
              <button
                type="button"
                data-testid="lock-banner-unlock"
                onClick={() => setUnlockConfirm(true)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/20"
              >
                <LockOpen size={13} aria-hidden /> Déverrouiller
              </button>
            </>
          )}
        </div>
      ) : isMine ? (
        <div
          data-testid="session-banner"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-accent/10 px-3 text-xs font-medium text-ink"
        >
          <Pencil size={13} aria-hidden className="text-accent" /> Ma session — édition
        </div>
      ) : (
        <div
          data-testid="session-banner"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-warning/10 px-3 text-xs font-medium text-ink"
        >
          <Eye size={13} aria-hidden className="text-warning" /> Lecture seule — annotation
          d'un autre annotateur (non modifiable)
        </div>
      )}
      {isJudgeView && (
        <div
          data-testid="judge-view-banner"
          role="status"
          className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line bg-sky-400/10 px-3 text-xs font-medium text-ink"
        >
          <Eye size={13} aria-hidden className="text-sky-300" /> Vue lecture —
          segmentation {llmJudgeLabel(llmSource)} (aide ; ne fait pas référence). Repassez
          sur « Humain » pour éditer votre annotation.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div
          className="min-w-0 flex-1"
          // Avertissement à la tentative d'ÉDITION d'un document verrouillé : un clic
          // sur une vraie affordance d'édition du contenu fait « pulser » le bandeau.
          // On EXCLUT les contrôles de lecture/navigation (zoom, source LLM, versions,
          // frontières/niveaux…) et les commentaires (autorisés sur doc verrouillé) —
          // sinon le nudge se déclencherait à tort en simple consultation.
          onClickCapture={
            locked
              ? (e) => {
                  const t = e.target as HTMLElement;
                  const editTarget = t.closest(
                    '[data-testid^="theme-option-"],' +
                      '[data-testid="legal-nature"] button,' +
                      '[data-testid="certainty-picker"] button,' +
                      '[data-testid="inspector-validate"],' +
                      '[data-testid="delete-clause"],' +
                      '[data-testid="multilabel-editor"] button,' +
                      "#evidence,#rationale," +
                      "[data-quickaction-validate]",
                  );
                  if (editTarget) nudgeLock();
                }
              : undefined
          }
        >
        <ResizablePanels
          left={<TocPanel docTitle={doc.title} />}
          center={
            <DocumentPanel
              sentences={doc.sentences}
              referenceLabels={doc.referenceLabels}
              documentId={doc.id}
              projectSlug={annotation.projectSlug}
            />
          }
          right={
            <InspectorPanel
              annotationId={annotation.id}
              documentId={annotation.documentId}
              projectSlug={annotation.projectSlug}
              themeCodes={themeCodes}
              legalNatures={legalNatures}
              themeFocusRef={themeFocusRef}
            />
          }
          leftCollapsed={sidebarCollapsed}
          onExpandLeft={toggleSidebar}
          onCollapseLeft={toggleSidebar}
          rightCollapsed={!inspectorOpen}
          onExpandRight={toggleInspector}
          onCollapseRight={toggleInspector}
        />
        </div>
        {showComments && (
          <CommentsPanel
            annotationId={annotation.id}
            documentId={annotation.documentId}
            onClose={() => setPanel("commentsOpen", false)}
          />
        )}
        {showHistory && <HistoryPanel onClose={() => setPanel("historyOpen", false)} />}
        {TRIAGE_ENABLED && isMine && showTriage && (
          <TriageQueue
            annotationId={annotation.id}
            documentId={annotation.documentId}
            projectSlug={annotation.projectSlug}
            sentences={doc.sentences}
            onClose={() => setPanel("triageOpen", false)}
          />
        )}
      </div>

      {/* Confirmation de DÉVERROUILLAGE — geste conscient (rouvre un document soumis). */}
      {unlockConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setUnlockConfirm(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Déverrouiller le document"
            data-testid="unlock-dialog"
            className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
          >
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-ink">
              <LockOpen size={16} aria-hidden className="text-amber-300" /> Déverrouiller ce document ?
            </h2>
            <p className="mb-4 text-xs text-ink-muted">
              {annotation.status === "submitted"
                ? "Le document soumis sera rouvert en brouillon : vous pourrez le modifier. Pensez à le re-soumettre ensuite (une nouvelle version sera créée)."
                : "L'édition sera de nouveau possible."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="unlock-cancel"
                onClick={() => setUnlockConfirm(false)}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-panel-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="unlock-confirm"
                disabled={unlockAnn.isPending}
                onClick={() =>
                  unlockAnn.mutate(undefined, { onSettled: () => setUnlockConfirm(false) })
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                <LockOpen size={14} aria-hidden />
                {unlockAnn.isPending ? "Déverrouillage…" : "Déverrouiller"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

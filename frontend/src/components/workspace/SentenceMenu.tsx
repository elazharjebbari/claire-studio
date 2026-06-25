"use client";

/**
 * SentenceMenu (P3 + Q3) — popover d'annotation contextuelle d'une phrase, ouvert au
 * long-press (~450 ms) ou au clic-droit. Trois blocs :
 *  (a) Annoter… : ThemeMultiPicker (choisir/changer le thème). Choisir un thème CRÉE la
 *      clause à cet index (Q2 : pas de thème par défaut), ou la (ré)assigne si elle
 *      existe. Indices LLM DISCRETS dans la grille (judgeHints). CertaintyPicker.
 *  (b) Traduire cette phrase.
 *
 * Les propositions LLM détaillées NE sont PLUS dans ce menu (il redevient un geste rapide,
 * pas un mini-inspecteur) : elles vivent au survol, dans l'œil de frontière (BoundaryEvidence,
 * adoption N-way) et dans l'inspecteur (InspectorJudgeCompare).
 *
 * Positionné en `fixed` aux coordonnées du déclencheur, fermé au clic extérieur et
 * à Échap, navigable au clavier (focus piégé sur l'ouverture).
 */

import { useEffect } from "react";
import { Check, Eraser, Languages, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { RULES } from "@/lib/triage";
import { runAt, type Run } from "@/lib/runs";
import { ThemeMultiPicker } from "@/components/ui/ThemeMultiPicker";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import { useAnchoredPosition } from "./useAnchoredPosition";
import type { Certainty, ThemeTag } from "@/types/contract";

/** Détail d'un juge pour la phrase (ancre + thème + rationale + evidence). */
export interface JudgeDetail {
  /** Ancre (run.start) du juge couvrant la phrase — point d'arbitrage. */
  anchorIndex: number;
  /** Dernière phrase du segment du juge (run.end) — adoption sur TOUTE la frontière. */
  endIndex: number;
  theme: string;
  rationale: string | null;
  evidence: string | null;
  /** Nature juridique proposée par le juge (vocab LLM) — consultation, axe 2/3b. */
  legalNature: string | null;
}

/** Un juge LLM affiché dans le menu : id (claude/codex/mistral…), libellé, détail. */
export interface JudgeEntry {
  id: string;
  label: string;
  detail: JudgeDetail | null;
}

export interface SentenceMenuProps {
  sentenceIndex: number;
  /** Coordonnées (clientX/clientY) du déclencheur. */
  x: number;
  y: number;
  /** Runs des clauses humaines (pour retrouver la clause couvrant la phrase). */
  runs: Run[];
  /** Détails des juges LLM pour la phrase (Claude/Codex/Mistral…), dans l'ordre d'affichage. */
  judges?: JudgeEntry[];
  onClose: () => void;
}

export function SentenceMenu({
  sentenceIndex,
  x,
  y,
  runs,
  judges = [],
  onClose,
}: SentenceMenuProps) {
  const { ref, style: anchoredStyle } = useAnchoredPosition(x, y);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const setClauseThemes = useWorkspaceStore((s) => s.setClauseThemes);
  const removeBoundary = useWorkspaceStore((s) => s.removeBoundary);
  const selectClause = useWorkspaceStore((s) => s.selectClause);
  const setCertainty = useWorkspaceStore((s) => s.setCertainty);
  const setValidated = useWorkspaceStore((s) => s.setValidated);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);
  const translatedSentences = useWorkspaceStore((s) => s.translatedSentences);
  const displayLang = useWorkspaceStore((s) => s.displayLang);

  // En mode `both`, toutes les phrases montrent déjà le FR ; le toggle per-phrase
  // n'a alors d'effet visible qu'en mode `orig`.
  const isTranslated = displayLang === "both" || translatedSentences.includes(sentenceIndex);

  // Clause couvrant la phrase (par son run) → cible des actions thème/certitude.
  const coveringRun = runAt(runs, sentenceIndex);
  const coveringDraft = coveringRun?.localId
    ? drafts.find((d) => d.localId === coveringRun.localId)
    : undefined;

  // Clic extérieur + Échap → fermeture.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Focus initial sur le popover (a11y : navigation clavier dès l'ouverture).
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);

  // Ensemble multi-label courant (primaire + secondaires) de la clause couvrante.
  const currentSet: ThemeTag[] = coveringDraft
    ? coveringDraft.themes && coveringDraft.themes.length
      ? coveringDraft.themes
      : [{ label: coveringDraft.theme, role: "primary", support: 0 }]
    : [];

  const primaryCode = currentSet.find((t) => t.role === "primary")?.label ?? null;

  // Validation = geste dominant (confirmer la pré-annotation). Centralisé.
  function validateSentence() {
    if (coveringDraft) {
      setValidated(coveringDraft.localId, true);
      onClose();
    }
  }

  // Désannoter = retrait EXPLICITE de la clause (plus jamais via un re-clic accidentel).
  function clearClause() {
    if (coveringDraft) {
      removeBoundary(coveringDraft.anchorIndex);
      selectClause(null);
      onClose();
    }
  }

  // Clic sur un thème :
  //  - aucune clause → crée le principal ;
  //  - clic sur le PRINCIPAL courant → le CONFIRME (valide la phrase), ne le retire JAMAIS ;
  //  - clic sur un autre → ajoute/retire un secondaire (le principal reste).
  function onToggleTheme(code: string) {
    if (!coveringDraft) {
      setBoundary(sentenceIndex, code); // crée la clause avec ce primaire
      return;
    }
    if (code === primaryCode) {
      validateSentence(); // confirmer la recommandation (intuitif) — fini le retrait accidentel
      return;
    }
    const exists = currentSet.some((t) => t.label === code);
    const next: ThemeTag[] = exists
      ? currentSet.filter((t) => t.label !== code) // retire un SECONDAIRE
      : [...currentSet, { label: code, role: currentSet.length === 0 ? "primary" : "secondary" }];
    setClauseThemes(coveringDraft.localId, next);
  }

  // Promotion d'un secondaire en primaire (l'ancien primaire redevient secondaire).
  function onPromoteTheme(code: string) {
    if (!coveringDraft) return;
    setClauseThemes(
      coveringDraft.localId,
      currentSet.map((t) => ({ ...t, role: t.label === code ? "primary" : "secondary" })),
    );
  }

  // Indice LLM DISCRET : thème proposé par chaque juge présent (un thème/juge).
  const judgeHints: Record<string, string[]> = {};
  for (const j of judges) {
    const th = j.detail?.theme;
    if (th) (judgeHints[th] ??= []).push(j.label);
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Annoter la phrase ${sentenceIndex}`}
      tabIndex={-1}
      data-testid="sentence-menu"
      className="fixed z-50 max-h-[88vh] w-[26rem] max-w-[94vw] overflow-auto rounded-lg border border-line bg-elevated p-3 text-sm text-ink shadow-xl outline-none"
      style={anchoredStyle}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Phrase {sentenceIndex}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* ACTION PRINCIPALE — valider/confirmer la phrase, EN TÊTE et bien visible (la
          recommandation se confirme d'un geste évident, fini le bouton perdu en bas). */}
      {coveringDraft && (
        <div className="mb-2">
          {coveringDraft.validated ? (
            <button
              type="button"
              data-testid="menu-validate"
              aria-pressed
              onClick={() => setValidated(coveringDraft.localId, false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-success/60 bg-success/15 px-3 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/25"
            >
              <Check size={15} aria-hidden /> Phrase validée — cliquer pour dévalider
            </button>
          ) : (
            <button
              type="button"
              data-testid="menu-validate"
              aria-pressed={false}
              onClick={validateSentence}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg transition-colors hover:brightness-110"
            >
              <Check size={15} aria-hidden />
              {primaryCode ? `Valider : ${getThemeToken(primaryCode).label}` : "Valider cette phrase"}
            </button>
          )}
        </div>
      )}

      {/* Choisir / changer le thème. Le principal en surbrillance ; le confirmer = cliquer
          dessus (ou le bouton ci-dessus). Les autres clics gèrent les secondaires. */}
      <section className="flex flex-col gap-2 border-b border-line pb-3">
        <h3 className="text-[11px] font-semibold uppercase text-ink-muted">
          {coveringDraft
            ? "Thème — le principal est en surbrillance (le cliquer = valider)"
            : "Choisir un thème principal"}
        </h3>
        <ThemeMultiPicker
          selection={currentSet}
          refuges={RULES.refuges}
          judgeHints={judgeHints}
          describeOnHover
          onToggle={onToggleTheme}
          onPromote={onPromoteTheme}
        />
        <CertaintyPicker
          size="sm"
          value={coveringDraft?.certainty ?? null}
          onChange={(v: Certainty) => {
            if (coveringDraft) setCertainty(coveringDraft.localId, v);
          }}
        />
        {/* Retrait EXPLICITE (remplace le re-clic accidentel sur le principal). */}
        {coveringDraft && (
          <button
            type="button"
            data-testid="menu-desannoter"
            onClick={clearClause}
            className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Eraser size={13} aria-hidden /> Désannoter cette phrase
          </button>
        )}
      </section>

      {/* Les propositions LLM ne sont PLUS détaillées ici (le menu cessait d'être un geste
          rapide pour devenir un mini-inspecteur). Elles restent : (1) en indice DISCRET dans
          la grille de thèmes ci-dessus (judgeHints), (2) au survol (RationaleHover), (3) via
          l'ŒIL de frontière (BoundaryEvidence, adoption N-way) et (4) dans l'inspecteur
          (InspectorJudgeCompare → « Reprendre dans mon annotation »). */}

      {/* (c) Traduire / masquer la traduction de cette phrase (toggle, P9) */}
      <section className="pt-3">
        <button
          type="button"
          role="menuitem"
          data-testid="menu-translate"
          aria-pressed={isTranslated}
          onClick={() => {
            setTranslated(sentenceIndex, !isTranslated);
            onClose();
          }}
          className="inline-flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-left hover:bg-panel-muted"
        >
          <Languages size={14} aria-hidden />
          {isTranslated ? "Masquer la traduction" : "Traduire cette phrase"}
        </button>
      </section>
    </div>
  );
}

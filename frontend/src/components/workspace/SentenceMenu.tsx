"use client";

/**
 * SentenceMenu (P3) — popover d'annotation contextuelle d'une phrase, ouvert au
 * long-press (~450 ms) ou au clic-droit. Trois blocs :
 *  (a) Annoter : poser une frontière ici (si pas déjà ancre), mini-ThemePalette
 *      pour (ré)assigner le thème de la clause couvrant la phrase, CertaintyPicker.
 *  (b) LLM : thème proposé par Claude et par Codex pour CETTE phrase + indicateur
 *      d'accord (✓ identiques / ✗ + les deux thèmes), via judgeThemeAt(ghosts).
 *  (c) Traduire cette phrase.
 *
 * Positionné en `fixed` aux coordonnées du déclencheur, fermé au clic extérieur et
 * à Échap, navigable au clavier (focus piégé sur l'ouverture).
 */

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { judgeThemeAt, runAt, type Run } from "@/lib/runs";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import type { Certainty } from "@/types/contract";

export interface SentenceMenuProps {
  sentenceIndex: number;
  /** Coordonnées (clientX/clientY) du déclencheur. */
  x: number;
  y: number;
  /** Runs des clauses humaines (pour retrouver la clause couvrant la phrase). */
  runs: Run[];
  onClose: () => void;
}

export function SentenceMenu({ sentenceIndex, x, y, runs, onClose }: SentenceMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const ghosts = useWorkspaceStore((s) => s.ghostClauses);
  const nSentences = useWorkspaceStore((s) => s.nSentences);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const setCertainty = useWorkspaceStore((s) => s.setCertainty);
  const setTranslated = useWorkspaceStore((s) => s.setTranslated);

  const isAnchor = drafts.some((d) => d.anchorIndex === sentenceIndex);
  // Clause couvrant la phrase (par son run) → cible des actions thème/certitude.
  const coveringRun = runAt(runs, sentenceIndex);
  const coveringDraft = coveringRun?.localId
    ? drafts.find((d) => d.localId === coveringRun.localId)
    : undefined;

  const claudeTheme = judgeThemeAt(ghosts, "claude", sentenceIndex, nSentences);
  const codexTheme = judgeThemeAt(ghosts, "codex", sentenceIndex, nSentences);
  const bothPresent = claudeTheme != null && codexTheme != null;
  const agree = bothPresent && claudeTheme === codexTheme;

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
  }, []);

  // Borne la position pour rester dans le viewport (défensif).
  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 300);
  const top = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 9999) - 360);

  function handleSetTheme(code: string) {
    if (coveringDraft) {
      updateDraft(coveringDraft.localId, { theme: code });
    } else {
      // Pas de clause couvrante (préfixe neutre) → on pose une frontière ici avec ce thème.
      setBoundary(sentenceIndex, code);
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Annoter la phrase ${sentenceIndex}`}
      tabIndex={-1}
      data-testid="sentence-menu"
      className="fixed z-50 w-72 rounded-lg border border-line bg-elevated p-3 text-sm text-ink shadow-xl outline-none"
      style={{ left, top }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Phrase {sentenceIndex}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="rounded px-1 text-ink-muted hover:bg-panel-muted"
        >
          ✕
        </button>
      </div>

      {/* (a) Annoter */}
      <section className="flex flex-col gap-2 border-b border-line pb-3">
        <h3 className="text-[11px] font-semibold uppercase text-ink-muted">Annoter</h3>
        {!isAnchor && (
          <button
            type="button"
            role="menuitem"
            data-testid="menu-set-boundary"
            onClick={() => {
              setBoundary(sentenceIndex);
              onClose();
            }}
            className="rounded-md border border-line px-2 py-1 text-left hover:bg-panel-muted"
          >
            ▸ Poser une frontière ici
          </button>
        )}
        <div className="max-h-40 overflow-auto">
          <ThemePalette
            value={coveringDraft?.theme ?? null}
            onChange={handleSetTheme}
            autoFocus={false}
          />
        </div>
        <CertaintyPicker
          size="sm"
          value={coveringDraft?.certainty ?? null}
          onChange={(v: Certainty) => {
            if (coveringDraft) setCertainty(coveringDraft.localId, v);
          }}
        />
      </section>

      {/* (b) LLM — accord Claude / Codex */}
      <section className="flex flex-col gap-1 border-b border-line py-3" data-testid="menu-llm">
        <h3 className="text-[11px] font-semibold uppercase text-ink-muted">Propositions LLM</h3>
        <p className="flex items-center justify-between">
          <span className="text-ink-muted">Claude</span>
          <span className="font-medium">
            {claudeTheme ? getThemeToken(claudeTheme).label : "—"}
          </span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-ink-muted">Codex</span>
          <span className="font-medium">
            {codexTheme ? getThemeToken(codexTheme).label : "—"}
          </span>
        </p>
        {bothPresent ? (
          agree ? (
            <p data-testid="llm-agreement" className="text-emerald-400">
              ✓ Accord ({getThemeToken(claudeTheme!).label})
            </p>
          ) : (
            <p data-testid="llm-agreement" className="text-amber-400">
              ✗ Divergence : Claude {getThemeToken(claudeTheme!).label} · Codex{" "}
              {getThemeToken(codexTheme!).label}
            </p>
          )
        ) : (
          <p className="text-ink-muted">Pas de proposition pour cette phrase.</p>
        )}
      </section>

      {/* (c) Traduire cette phrase */}
      <section className="pt-3">
        <button
          type="button"
          role="menuitem"
          data-testid="menu-translate"
          onClick={() => {
            setTranslated(sentenceIndex, true);
            onClose();
          }}
          className="w-full rounded-md border border-line px-2 py-1 text-left hover:bg-panel-muted"
        >
          🌐 Traduire cette phrase
        </button>
      </section>
    </div>
  );
}

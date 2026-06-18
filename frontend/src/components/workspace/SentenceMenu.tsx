"use client";

/**
 * SentenceMenu (P3 + Q3) — popover d'annotation contextuelle d'une phrase, ouvert au
 * long-press (~450 ms) ou au clic-droit. Trois blocs :
 *  (a) Annoter… : ThemePalette (choisir/changer le thème). Choisir un thème CRÉE la
 *      clause à cet index (Q2 : pas de thème par défaut), ou la (ré)assigne si elle
 *      existe. CertaintyPicker pour la clause couvrante.
 *  (b) LLM : pour Claude et Codex, thème + rationale (tronqué + dépliable) + evidence,
 *      + indicateur d'accord ✓/✗ (data-testid menu-llm, llm-agreement,
 *      menu-llm-claude, menu-llm-codex).
 *  (c) Traduire cette phrase.
 *
 * Positionné en `fixed` aux coordonnées du déclencheur, fermé au clic extérieur et
 * à Échap, navigable au clavier (focus piégé sur l'ouverture).
 */

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { runAt, type Run } from "@/lib/runs";
import { ThemePalette } from "@/components/ui/ThemePalette";
import { CertaintyPicker } from "@/components/ui/CertaintyPicker";
import type { Certainty } from "@/types/contract";

/** Détail d'un juge pour la phrase (thème + rationale + evidence). */
export interface JudgeDetail {
  theme: string;
  rationale: string | null;
  evidence: string | null;
}

export interface SentenceMenuProps {
  sentenceIndex: number;
  /** Coordonnées (clientX/clientY) du déclencheur. */
  x: number;
  y: number;
  /** Runs des clauses humaines (pour retrouver la clause couvrant la phrase). */
  runs: Run[];
  /** Détail Claude pour la phrase (thème/rationale/evidence), null si absent. */
  claudeDetail?: JudgeDetail | null;
  /** Détail Codex pour la phrase, null si absent. */
  codexDetail?: JudgeDetail | null;
  onClose: () => void;
}

export function SentenceMenu({
  sentenceIndex,
  x,
  y,
  runs,
  claudeDetail,
  codexDetail,
  onClose,
}: SentenceMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drafts = useWorkspaceStore((s) => s.draftClauses);
  const setBoundary = useWorkspaceStore((s) => s.setBoundary);
  const updateDraft = useWorkspaceStore((s) => s.updateDraft);
  const setCertainty = useWorkspaceStore((s) => s.setCertainty);
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

  const claudeTheme = claudeDetail?.theme ?? null;
  const codexTheme = codexDetail?.theme ?? null;
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

      {/* (a) Annoter… — choisir un thème CRÉE/réassigne la clause (Q2, thème requis) */}
      <section className="flex flex-col gap-2 border-b border-line pb-3">
        <h3 className="text-[11px] font-semibold uppercase text-ink-muted">
          Annoter… {coveringDraft ? "(changer le thème)" : "(choisir un thème)"}
        </h3>
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

      {/* (b) LLM — propositions Claude / Codex enrichies (thème + rationale + evidence) */}
      <section className="flex flex-col gap-2 border-b border-line py-3" data-testid="menu-llm">
        <h3 className="text-[11px] font-semibold uppercase text-ink-muted">Propositions LLM</h3>
        {bothPresent ? (
          agree ? (
            <p data-testid="llm-agreement" className="text-xs font-medium text-emerald-400">
              ✓ Accord — {getThemeToken(claudeTheme!).label}
            </p>
          ) : (
            <p data-testid="llm-agreement" className="text-xs font-medium text-amber-400">
              ✗ Divergence
            </p>
          )
        ) : (
          <p data-testid="llm-agreement" className="text-xs text-ink-muted">
            {claudeTheme || codexTheme
              ? "Un seul juge couvre cette phrase."
              : "Pas de proposition pour cette phrase."}
          </p>
        )}
        <JudgeBlock judge="claude" detail={claudeDetail ?? null} testid="menu-llm-claude" />
        <JudgeBlock judge="codex" detail={codexDetail ?? null} testid="menu-llm-codex" />
      </section>

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
          className="w-full rounded-md border border-line px-2 py-1 text-left hover:bg-panel-muted"
        >
          {isTranslated ? "🙈 Masquer la traduction" : "🌐 Traduire cette phrase"}
        </button>
      </section>
    </div>
  );
}

/** Bloc d'un juge : thème (puce colorée) + rationale (tronqué + dépliable) + evidence. */
function JudgeBlock({
  judge,
  detail,
  testid,
}: {
  judge: "claude" | "codex";
  detail: JudgeDetail | null;
  testid: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = judge === "claude" ? "Claude" : "Codex";
  const token = detail ? getThemeToken(detail.theme) : null;
  const rationale = detail?.rationale ?? "";
  const isLong = rationale.length > 90;
  const shown = !isLong || expanded ? rationale : `${rationale.slice(0, 90)}…`;

  return (
    <div
      data-testid={testid}
      className="rounded-md border border-line bg-panel-muted/40 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink-muted">{name}</span>
        {token ? (
          <span className="flex items-center gap-1 font-medium text-ink">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: token.color }}
            />
            {token.label}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
      {detail && rationale && (
        <p className="mt-1 text-ink-muted">
          {shown}{" "}
          {isLong && (
            <button
              type="button"
              data-testid={`${testid}-toggle`}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="text-accent hover:underline"
            >
              {expanded ? "réduire" : "déplier"}
            </button>
          )}
        </p>
      )}
      {detail?.evidence && (
        <p className="mt-1 border-l-2 border-line pl-2 italic text-ink-muted">
          « {detail.evidence} »
        </p>
      )}
    </div>
  );
}

"use client";

/**
 * LlmSourceSwitch (Q3) — contrôle segmenté de la source de segmentation affichée
 * dans le DocumentPanel :
 *  - `human`   → annotation humaine (édition, actuel)
 *  - <juge>    → segmentation d'un juge LLM en lecture seule (Claude/Codex/Mistral…)
 *  - `compare` → superposition de l'accord par phrase entre les juges
 *
 * Les juges LLM sont générés depuis LLM_JUDGES (source unique) : ajouter un modèle
 * = une entrée dans LLM_JUDGES, aucune modif ici.
 *
 * Accessible : `role="radiogroup"` + `role="radio"`, navigable au clavier (flèches
 * ←/→ ; roving tabindex). Couleurs en accent non-textuel, contrastes AA.
 */

import { useRef } from "react";
import { useWorkspaceStore, type LlmSource } from "@/store/workspace";
import { LLM_JUDGES } from "@/lib/llmJudges";
import { cn } from "@/lib/cn";

const OPTIONS: { value: LlmSource; label: string; testid: string }[] = [
  { value: "human", label: "Humain", testid: "llm-human" },
  ...LLM_JUDGES.map((j) => ({
    value: j.id as LlmSource,
    label: j.label,
    testid: `llm-${j.id}`,
  })),
  { value: "compare", label: "Comparer", testid: "llm-compare" },
];

export function LlmSourceSwitch() {
  const llmSource = useWorkspaceStore((s) => s.llmSource);
  const setLlmSource = useWorkspaceStore((s) => s.setLlmSource);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + dir + OPTIONS.length) % OPTIONS.length;
    setLlmSource(OPTIONS[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Source de segmentation"
      data-testid="llm-source-switch"
      className="inline-flex items-center rounded-md border border-line bg-panel-muted/40 p-0.5"
    >
      {OPTIONS.map((opt, idx) => {
        const active = llmSource === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-testid={opt.testid}
            onClick={() => setLlmSource(opt.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-accent/15 text-ink shadow-sm ring-1 ring-accent/40"
                : "text-ink-muted hover:bg-panel-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

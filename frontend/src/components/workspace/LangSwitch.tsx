"use client";

/**
 * LangSwitch (P10) — switch segmenté 3 états du mode d'affichage de langue :
 *  - `orig`  → VO (texte original seul)
 *  - `both`  → Bilingue (VO + ligne FR sous chaque phrase)
 *  - `fr`    → FR (texte traduit, repli VO si absent)
 *
 * Contrôle segmenté accessible : `role="radiogroup"` + `role="radio"`, navigable au
 * clavier (flèches ←/→ pour changer d'option, l'option active porte `tabIndex=0`,
 * les autres `tabIndex=-1` — pattern roving tabindex). L'unité d'interaction du
 * document reste l'index de phrase quel que soit le mode (cf. DocumentPanel).
 *
 * PRÉSENTATIONNEL : l'état est fourni par l'appelant (`value`/`onChange`), afin que
 * l'atelier d'annotation ET l'atelier de résolution GOLD partagent le MÊME contrôle
 * sans que le second ait à dépendre du store du premier (les deux stores sont isolés
 * par conception). `testIdPrefix` évite toute collision si les deux coexistaient.
 */

import { useRef } from "react";
import { cn } from "@/lib/cn";
import type { DisplayLang } from "@/lib/prefs/schema";

type Lang = DisplayLang;

const OPTIONS: { value: Lang; label: string; suffix: string }[] = [
  { value: "orig", label: "VO", suffix: "orig" },
  { value: "both", label: "Bilingue", suffix: "both" },
  { value: "fr", label: "FR", suffix: "fr" },
];

export interface LangSwitchProps {
  value: Lang;
  onChange: (value: Lang) => void;
  /** Préfixe des `data-testid` (défaut : `lang`, comportement historique). */
  testIdPrefix?: string;
}

export function LangSwitch({ value, onChange, testIdPrefix = "lang" }: LangSwitchProps) {
  const displayLang = value;
  const setDisplayLang = onChange;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + dir + OPTIONS.length) % OPTIONS.length;
    setDisplayLang(OPTIONS[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Mode d'affichage de langue"
      data-testid={`${testIdPrefix}-switch`}
      className="inline-flex items-center rounded-md border border-line bg-panel-muted/40 p-0.5"
    >
      {OPTIONS.map((opt, idx) => {
        const active = displayLang === opt.value;
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
            data-testid={`${testIdPrefix}-${opt.suffix}`}
            onClick={() => setDisplayLang(opt.value)}
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

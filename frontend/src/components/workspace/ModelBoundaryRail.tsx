"use client";

/**
 * Réglette des frontières par modèle (Feature A).
 *
 * `ModelBoundaryStrip` est une bande COMPACTE rendue à droite de CHAQUE ligne de
 * phrase (alignement natif, sans mesure pixel) : une fine colonne par modèle (Claude,
 * Codex, demain Mistral…). On lit d'un coup d'œil OÙ chaque modèle place ses frontières
 * (marqueur en début de segment) et, en option, la catégorie (teinte + abréviation).
 * Lecture seule : cliquer une cellule recentre la phrase (jamais d'édition).
 *
 * `ModelBoundaryLegend` expose les toggles (par modèle + catégorie) dans la barre
 * d'outils du document. Préférences persistées (store UI, clé `claire.ui`).
 *
 * Données DÉRIVÉES des runs LLM existants (`segmentsFromRuns`) — aucun nouvel endpoint.
 */

import { getThemeToken, abbrevThemeCode } from "@/lib/tokens";
import type { GutterSegment } from "@/lib/runs";
import { useUiStore } from "@/store/ui";

/** Une piste = un modèle + ses segments + sa présence sur le document. */
export interface GutterModel {
  id: string;
  label: string;
  initial: string;
  segments: GutterSegment[];
  hasData: boolean;
  identityColor?: string;
}

function segAt(segments: GutterSegment[], i: number): GutterSegment | undefined {
  return segments.find((s) => i >= s.startSentence && i <= s.endSentence);
}

/**
 * Bande de frontières-modèles pour UNE phrase. À placer dans une ligne `relative`
 * (elle se positionne en absolu à droite, pleine hauteur de la ligne).
 */
export function ModelBoundaryStrip({
  sentenceIndex,
  models,
  showCategory,
  onJump,
  conflictStart,
}: {
  sentenceIndex: number;
  models: GutterModel[];
  showCategory: boolean;
  onJump: (i: number) => void;
  /** Si la phrase est dans une zone de CONFLIT inter-modèles : index de sa 1re phrase. */
  conflictStart?: number;
}) {
  if (models.length === 0 && conflictStart == null) return null;
  return (
    <div
      data-testid={`model-gutter-row-${sentenceIndex}`}
      className="pointer-events-auto absolute bottom-0 right-1 top-0 flex items-stretch gap-px"
    >
      {/* Colonne CONFLIT (D6c) : ambre, clickable → 1re phrase de la zone de conflit. */}
      {conflictStart != null && (
        <button
          type="button"
          data-testid={`gutter-conflict-${sentenceIndex}`}
          title={`Conflit entre modèles — aller à la 1re phrase du conflit (${conflictStart})`}
          aria-label={`Conflit entre modèles, début phrase ${conflictStart}`}
          onClick={() => onJump(conflictStart)}
          className="relative w-2.5 cursor-pointer rounded-[1px]"
          style={{ backgroundColor: "rgb(var(--sem-warning) / 0.25)" }}
        >
          {conflictStart === sentenceIndex && (
            <span
              aria-hidden
              data-testid={`gutter-conflict-start-${sentenceIndex}`}
              className="absolute inset-x-0 top-0 h-[3px] rounded-t-[1px]"
              style={{ backgroundColor: "rgb(var(--sem-warning))" }}
            />
          )}
        </button>
      )}
      {models.map((m) => {
        const seg = m.hasData ? segAt(m.segments, sentenceIndex) : undefined;
        const isStart = seg != null && seg.startSentence === sentenceIndex;
        const isEnd = seg != null && seg.endSentence === sentenceIndex;
        const token = seg ? getThemeToken(seg.themeCode) : null;
        const tint = token?.color;
        const title = seg
          ? `${m.label} · ${token?.label ?? seg.themeCode} · phrases ${seg.startSentence}–${seg.endSentence}`
          : `${m.label} · —`;
        // Refonte gutter (axe 6) : la cellule est rendue comme un SEGMENT CONTINU.
        // - teinte du thème TOUJOURS visible (début ~35 %, milieu/fin ~20 %) → on
        //   distingue les segments même sans le toggle « Catégories » ;
        // - arrondi seulement en HAUT du début et en BAS de la fin → barre continue ;
        // - RUPTURE nette : trait + ombre intérieure au sommet d'un nouveau segment.
        return (
          <button
            key={m.id}
            type="button"
            data-testid={`gutter-cell-${m.id}-${sentenceIndex}`}
            data-boundary={isStart ? "1" : undefined}
            disabled={!seg}
            title={title}
            aria-label={title}
            onClick={() => seg && onJump(seg.startSentence)}
            className={
              "relative w-2.5 transition-colors " +
              (seg ? "cursor-pointer" : "cursor-default opacity-20") +
              (isStart ? " rounded-t-[2px]" : "") +
              (isEnd ? " rounded-b-[2px]" : "")
            }
            style={{
              backgroundColor: seg
                ? tint
                  ? `${tint}${isStart ? "59" : "33"}`
                  : "rgb(var(--surface-border))"
                : "transparent",
              // Rupture visible : liseré sombre au sommet d'un début de segment
              // (sauf tout en haut du document).
              boxShadow:
                isStart && sentenceIndex > 0 ? "inset 0 2px 0 0 rgba(0,0,0,0.35)" : undefined,
            }}
          >
            {/* Marqueur de FRONTIÈRE : tick coloré (teinte du thème) en début de segment. */}
            {isStart && (
              <span
                aria-hidden
                data-testid={`gutter-boundary-${m.id}-${sentenceIndex}`}
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  backgroundColor:
                    tint ?? m.identityColor ?? "rgb(var(--surface-accent))",
                }}
              />
            )}
            {/* Abréviation de catégorie (si activée) au début de segment. */}
            {showCategory && isStart && token && (
              <span className="block pt-[3px] text-center font-mono text-[7px] leading-none text-ink-muted">
                {abbrevThemeCode(seg!.themeCode)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Légende + toggles de la réglette (barre d'outils du document). Affiche une puce
 * cliquable par modèle (activer/masquer) + un toggle « Catégories ». Une piste sans
 * données est grisée (absence ≠ masquage).
 */
export function ModelBoundaryLegend({ models }: { models: GutterModel[] }) {
  const gutterModels = useUiStore((s) => s.gutterModels);
  const showCategory = useUiStore((s) => s.gutterShowCategory);
  const toggleModel = useUiStore((s) => s.toggleGutterModel);
  const toggleCategory = useUiStore((s) => s.toggleGutterCategory);

  if (models.length === 0) return null;

  return (
    <div
      data-testid="model-gutter-legend"
      className="flex items-center gap-1.5 text-[11px] text-ink-muted"
      aria-label="Réglette des frontières par modèle"
    >
      <span className="text-ink-muted">Modèles&nbsp;:</span>
      {models.map((m) => {
        const visible = gutterModels[m.id] !== false;
        return (
          <button
            key={m.id}
            type="button"
            data-testid={`gutter-toggle-${m.id}`}
            aria-pressed={visible}
            disabled={!m.hasData}
            onClick={() => toggleModel(m.id)}
            title={
              m.hasData
                ? `${m.label} — ${visible ? "masquer" : "afficher"} la piste`
                : `${m.label} — aucune donnée sur ce document`
            }
            className={
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
              (visible && m.hasData
                ? "border-accent/50 bg-accent/10 text-ink"
                : "border-line text-ink-muted hover:bg-panel-muted")
            }
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: m.identityColor ?? "rgb(var(--surface-accent))" }}
            />
            {m.label}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="gutter-toggle-category"
        aria-pressed={showCategory}
        onClick={toggleCategory}
        title="Afficher/masquer la catégorie par segment"
        className={
          "ml-1 rounded border px-1.5 py-0.5 font-medium transition-colors " +
          (showCategory
            ? "border-accent/50 bg-accent/10 text-ink"
            : "border-line text-ink-muted hover:bg-panel-muted")
        }
      >
        Catégories
      </button>
    </div>
  );
}

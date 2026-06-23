"use client";

/**
 * MultiLabelEditor — édition multi-label d'une clause depuis l'inspecteur (dossier UX
 * docs/pactiva/dossier-ux-decision-multilabel). Permet, MÊME HORS C3 :
 *   - de basculer Mono ↔ Multi (toggle 🏷, réversible : repasser en Mono retire les
 *     secondaires ; undo/redo global en filet) ;
 *   - de voir les thèmes secondaires (chips POINTILLÉS, « + », retirables) ;
 *   - d'AJOUTER un secondaire via la palette de thèmes (refuges et primaire exclus).
 * Hiérarchie : le primaire reste le chip plein de l'en-tête ; ici on gère les secondaires.
 */

import { useState } from "react";
import { Plus, Tags, X } from "lucide-react";

import { useWorkspaceStore, type DraftClause } from "@/store/workspace";
import { getThemeToken, THEMES } from "@/lib/tokens";
import { RULES } from "@/lib/triage";
import type { ThemeTag } from "@/types/contract";
import { ThemePalette } from "@/components/ui/ThemePalette";

const REFUGES = new Set(RULES.refuges);

function currentSet(draft: DraftClause): ThemeTag[] {
  if (draft.themes && draft.themes.length) return draft.themes;
  return [{ label: draft.theme, role: "primary", support: 0 }];
}

export function MultiLabelEditor({
  draft,
  themeCodes,
}: {
  draft: DraftClause;
  /** Codes de thèmes proposables en secondaire. Repli sur le référentiel global (THEMES)
   *  quand l'appelant n'a pas le schéma sous la main (ex. menu clic-droit). */
  themeCodes?: string[];
}) {
  const codes = themeCodes ?? THEMES.map((t) => t.code);
  const setClauseThemes = useWorkspaceStore((s) => s.setClauseThemes);
  const readOnly = useWorkspaceStore((s) => s.readOnly);
  const [picking, setPicking] = useState(false);

  const set = currentSet(draft);
  const primary = set.find((t) => t.role === "primary") ?? set[0]!;
  const secondaries = set.filter((t) => t.role === "secondary");
  const hasMulti = secondaries.length > 0;
  const expanded = hasMulti || picking;

  const addSecondary = (code: string) => {
    setClauseThemes(draft.localId, [...set, { label: code, role: "secondary", support: 0 }]);
    setPicking(false);
  };
  const removeSecondary = (code: string) =>
    setClauseThemes(draft.localId, set.filter((t) => t.label !== code));
  const toggle = () => {
    if (readOnly) return;
    if (hasMulti) {
      // Multi → Mono : retire les secondaires (réversible via undo).
      setClauseThemes(draft.localId, [{ label: primary.label, role: "primary", support: primary.support }]);
      setPicking(false);
    } else {
      setPicking((p) => !p); // Mono → ouvre la sélection d'un 1ᵉʳ secondaire
    }
  };

  // Palette des secondaires possibles : ni le primaire, ni un refuge, ni un secondaire déjà posé.
  const available = codes.filter(
    (c) => c !== primary.label && !REFUGES.has(c) && !secondaries.some((s) => s.label === c),
  );

  return (
    <div data-testid="multilabel-editor" className="rounded-md border border-line p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Thèmes</span>
        <button
          type="button"
          data-testid="multilabel-toggle"
          role="switch"
          aria-checked={hasMulti}
          aria-label={hasMulti ? "Multi-label activé" : "Multi-label désactivé"}
          disabled={readOnly}
          onClick={toggle}
          title={hasMulti ? "Repasser en mono (retire les secondaires)" : "Activer le multi-label"}
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors " +
            (expanded
              ? "border-[#64B5F6]/60 text-[#64B5F6]"
              : "border-line text-ink-muted hover:bg-panel-muted")
          }
          style={expanded ? { backgroundColor: "rgb(100 181 246 / 0.12)" } : undefined}
        >
          <Tags size={12} aria-hidden />
          {expanded ? "Multi-label" : "Mono"}
        </button>
      </div>

      {/* Chips secondaires (pointillés, retirables) */}
      {secondaries.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5" data-testid="secondary-chips">
          {secondaries.map((t) => {
            const tok = getThemeToken(t.label);
            return (
              <span
                key={t.label}
                data-testid={`secondary-chip-${t.label}`}
                className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-ink"
                style={{ borderColor: tok.color, opacity: 0.95 }}
                title={`Secondaire : ${tok.label}`}
              >
                <Plus size={11} aria-hidden style={{ color: tok.color }} />
                {tok.label}
                {!readOnly && (
                  <button
                    type="button"
                    data-testid={`remove-secondary-${t.label}`}
                    aria-label={`Retirer le thème secondaire ${tok.label}`}
                    onClick={() => removeSecondary(t.label)}
                    className="ml-0.5 inline-flex rounded text-ink-muted hover:text-red-400"
                  >
                    <X size={12} aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Ajout d'un secondaire (hors C3 : disponible sur toute clause) */}
      {expanded && !readOnly && (
        <div data-testid="secondary-picker">
          {picking || secondaries.length === 0 ? (
            available.length > 0 ? (
              <ThemePalette
                value={null}
                themeCodes={available}
                layout="grid"
                describeOnHover
                onChange={addSecondary}
              />
            ) : (
              <p className="text-[11px] text-ink-muted">Aucun thème secondaire disponible.</p>
            )
          ) : (
            <button
              type="button"
              data-testid="add-secondary"
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-1 text-[11px] text-ink-muted hover:bg-panel-muted"
            >
              <Plus size={12} aria-hidden /> thème secondaire
            </button>
          )}
        </div>
      )}
    </div>
  );
}

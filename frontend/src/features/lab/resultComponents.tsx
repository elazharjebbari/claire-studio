"use client";

/**
 * Composants transverses des vues de résultats (docs/pactiva-lab-resultats/04 §2) —
 * le « contrat de page » : introduction → verdict avec IC → preuve → détails.
 *
 * Règle éditoriale portée par le code : un chiffre ne s'affiche jamais nu — IC intégré
 * quand il existe, dispersion à côté de la moyenne, définition à portée de main.
 */

import type { ReactNode } from "react";
import { BookOpen, Info } from "lucide-react";

import { Panel } from "@/components/ui/primitives";
import { Disclosure } from "@/components/ui/Disclosure";
import { usePrefsStore } from "@/store/prefs";

import type { PairedTestResult } from "./api";
import { introFor } from "./content/experimentIntros";
import { metricDefinition } from "./content/metricGlossary";
import {
  deltaContainsZero,
  fmtCi,
  fmtDispersion,
  fmtMetric,
  fmtPValue,
  fmtSigned,
} from "./resultFormat";
import type { MetricCi } from "./types";

/** Rend les emphases `**gras**` des contenus éditoriaux (source unique : dossier 05). */
export function renderEmphasis(text: string): ReactNode {
  const parts = text.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Introduction d'expérience — ouverte par défaut (la pédagogie d'abord), état replié
 * mémorisé PAR COMPTE (couche prefs serveur, pas localStorage direct).
 */
export function ExperimentIntro({ preset }: { preset: string | null | undefined }) {
  const collapsed = usePrefsStore((s) => s.prefs.panels.labIntroCollapsed);
  const setPanel = usePrefsStore((s) => s.setPanel);
  const intro = introFor(preset);
  return (
    <Disclosure
      summary="À propos de cette expérience"
      icon={<BookOpen className="h-3.5 w-3.5" aria-hidden />}
      defaultOpen={!collapsed}
      onToggle={(open) => setPanel("labIntroCollapsed", !open)}
      testId="experiment-intro"
    >
      <div className="space-y-2 text-xs text-ink-muted">
        <p>
          <span className="font-medium uppercase tracking-wide">Ce que teste cette expérience.</span>{" "}
          {renderEmphasis(intro.teste)}
        </p>
        <p>
          <span className="font-medium uppercase tracking-wide">Rôle dans la publication.</span>{" "}
          {renderEmphasis(intro.role)}
        </p>
        <div>
          <span className="font-medium uppercase tracking-wide">Comment lire cette page.</span>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {intro.lire.map((line, i) => (
              <li key={i}>{renderEmphasis(line)}</li>
            ))}
          </ul>
        </div>
      </div>
    </Disclosure>
  );
}

/**
 * Le verdict — LA réponse à la question décisionnelle de l'expérience, en tête de page.
 * Jamais de verdict sans IC : si la preuve se dégrade (test indisponible), la phrase
 * le dit — c'est l'appelant qui compose le texte, ce composant garantit la présentation.
 */
export function VerdictPanel({ children }: { children: ReactNode }) {
  return (
    <Panel
      className="border-accent/40 bg-accent/5 p-4 text-sm text-ink"
      data-testid="verdict-panel"
    >
      {children}
    </Panel>
  );
}

/**
 * Cellule de métrique enrichie : valeur + IC intégré + dispersion + définition.
 * La définition est portée par une icône Info (`aria-label` complet — pas un tooltip
 * maison, pas une infobulle inaccessible).
 */
export function MetricCell({
  label,
  value,
  ci,
  dispersion,
  definitionKey,
  hint,
  digits = 3,
  testId,
}: {
  label: string;
  value: number | null | undefined;
  ci?: MetricCi | null;
  dispersion?: number | null;
  definitionKey?: string;
  hint?: string;
  digits?: number;
  testId?: string;
}) {
  const definition = definitionKey ? metricDefinition(definitionKey) : undefined;
  const ciText = fmtCi(ci, digits);
  const dispersionText = fmtDispersion(dispersion, digits);
  return (
    <div data-testid={testId}>
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-ink-muted">
        {label}
        {definition && (
          <Info
            className="h-3 w-3 shrink-0"
            role="img"
            aria-label={definition}
            data-testid={testId ? `${testId}-definition` : undefined}
          >
            <title>{definition}</title>
          </Info>
        )}
      </dt>
      <dd className="text-lg font-semibold text-ink">
        {fmtMetric(value, digits)}
        {ciText && (
          <span className="ml-1 text-xs font-normal text-ink-muted">{ciText}</span>
        )}
        {dispersionText && (
          <span className="ml-1 text-xs font-normal text-ink-muted">{dispersionText}</span>
        )}
      </dd>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * Bande de plafond humain — une RÉFÉRENCE avec son incertitude, jamais une barre
 * comparable (formulations verrouillées, dossier 05 §4).
 */
export function CeilingBand({
  value,
  ci,
  metric,
  note,
  label = "Plafond humain approximé",
}: {
  value: number | null | undefined;
  ci?: MetricCi | null;
  metric?: string;
  note?: string;
  label?: string;
}) {
  if (value == null) return null;
  const ciText = fmtCi(ci);
  return (
    <div
      className="rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted"
      data-testid="ceiling-band"
    >
      <span className="font-medium text-ink">
        {label} : {fmtMetric(value)}
      </span>
      {ciText && <span className="ml-1">{ciText}</span>}
      {metric && <span className="ml-1">({metric})</span>}
      {note && <p className="mt-1">{note}</p>}
    </div>
  );
}

/**
 * Note de significativité — Δ, IC, p en toutes lettres avec le test nommé ; jamais
 * d'étoiles seules. En mode indisponible, la raison s'affiche : un test absent n'est
 * jamais silencieux (le repli descriptif est un ÉTAT, pas un oubli).
 */
export function SignificanceNote({
  result,
  unavailableReason,
}: {
  result: PairedTestResult | null;
  unavailableReason?: string | null;
}) {
  if (!result) {
    if (!unavailableReason) return null;
    return (
      <p className="text-xs text-ink-muted" data-testid="significance-unavailable">
        Comparaison descriptive — test apparié indisponible : {unavailableReason}
      </p>
    );
  }
  const containsZero = deltaContainsZero(result);
  return (
    <div className="space-y-1 text-xs" data-testid="significance-note">
      <p className="text-ink">
        Δ ({result.labelA} − {result.labelB}) = {fmtSigned(result.delta)}, IC{" "}
        {Math.round((result.confidence ?? 0.95) * 100)} %{" "}
        {fmtCi({ low: result.low, high: result.high }) ?? "—"},{" "}
        {fmtPValue(result.pValue, result.nPermutations)}{" "}
        <span className="text-ink-muted">
          (bootstrap apparié + permutation par document, n = {result.nDocuments} documents)
        </span>
      </p>
      {containsZero === true && (
        <p className="text-ink-muted" data-testid="significance-no-difference">
          L&apos;intervalle du Δ contient 0 : aucune différence démontrée à cet effectif.
        </p>
      )}
    </div>
  );
}

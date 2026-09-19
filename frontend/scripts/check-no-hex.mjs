#!/usr/bin/env node
/**
 * Garde « zéro couleur en dur » (Lot 0 de la refonte atelier).
 *
 * Interdit, dans un PÉRIMÈTRE NETTOYÉ, toute couleur hex (#RRGGBB) en dur et toute classe
 * Tailwind de palette brute (amber-400, emerald-500, red-400…). La couleur doit passer par
 * les tokens sémantiques (success/warning/danger/info, surfaces) ou les tokens MÉTIER
 * (thèmes via getThemeToken, niveaux via TRIAGE_LEVEL_META). Seules sources d'hex autorisées :
 * design-tokens.json, globals.css, lib/tokens.ts (helpers de conversion).
 *
 * Le périmètre GARDÉ grandit au fil des lots (chaque lot structurant migre ses fichiers puis
 * les ajoute ici). Lancer : `npm run check:colors`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Périmètre verrouillé (fichiers déjà tokenisés — toute régression échoue la garde).
const GUARDED = [
  "src/components/ui/primitives.tsx",
  "src/components/ui/ClauseChip.tsx",
  "src/components/ui/Disclosure.tsx",
  "src/lib/themeIcons.ts",
  "src/components/workspace/SentenceMenu.tsx",
  "src/components/workspace/TocPanel.tsx",
  "src/components/workspace/triage/TriageLevelInfo.tsx",
  "src/components/workspace/triage/SuggestionCard.tsx",
  "src/components/workspace/InspectorPanel.tsx",
  "src/components/workspace/WorkspaceToolbar.tsx",
  "src/components/workspace/DocumentPanel.tsx",
  "src/components/workspace/ComparePanel.tsx",
  "src/components/workspace/ModelBoundaryRail.tsx",
  "src/components/workspace/BoundaryEvidence.tsx",
  "src/components/gold/GoldReadingPanel.tsx",
  // Lab — vues de résultats (lot L6 de docs/pactiva-lab-resultats/ : l'audit avait
  // montré que le Lab respectait la convention SANS filet — verrouillé désormais).
  "src/features/lab/RunList.tsx",
  "src/features/lab/RunResults.tsx",
  "src/features/lab/ExperimentResults.tsx",
  "src/features/lab/resultComponents.tsx",
  "src/features/lab/resultViews.tsx",
  "src/features/lab/sweepCharts.tsx",
  "src/features/lab/LabHelpModal.tsx",
  "src/features/lab/ActiveRunIndicator.tsx",
  "src/features/lab/ComputeTargetBadge.tsx",
  "src/features/lab/charts.tsx",
  // Page reviewer (docs/pactiva-reviewer-demo) — publique, thème clair, jetons seulement.
  "src/app/page.tsx",
  "src/features/demo/DemoPanel.tsx",
  "src/features/demo/ResultsViewer.tsx",
  "src/features/demo/ThemeChip.tsx",
  "src/features/demo/ReleaseSections.tsx",
  "src/features/demo/logic.ts",
  "src/lib/taxonomy/labels.en.ts",
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_CLASS =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/;

/** Neutralise commentaires de ligne et de bloc SANS décaler les numéros de ligne
 * (les blocs sont remplacés par autant de retours à la ligne qu'ils en contenaient). */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

let violations = 0;
for (const rel of GUARDED) {
  const abs = resolve(process.cwd(), rel);
  let code;
  try {
    code = strip(readFileSync(abs, "utf8"));
  } catch {
    console.error(`! introuvable: ${rel}`);
    violations++;
    continue;
  }
  code.split("\n").forEach((line, i) => {
    const hex = HEX.exec(line);
    const raw = RAW_CLASS.exec(line);
    if (hex) {
      console.error(`✗ ${rel}:${i + 1} hex en dur « ${hex[0]} » → utiliser un token`);
      violations++;
    }
    if (raw) {
      console.error(`✗ ${rel}:${i + 1} classe brute « ${raw[0]} » → success/warning/danger/info`);
      violations++;
    }
  });
}

if (violations > 0) {
  console.error(`\n✗ check:colors — ${violations} couleur(s) en dur dans le périmètre gardé.`);
  process.exit(1);
}
console.log(`✓ check:colors — ${GUARDED.length} fichiers gardés, zéro couleur en dur.`);

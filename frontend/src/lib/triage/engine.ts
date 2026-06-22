/**
 * Moteur de triage — fonction PURE appliquant nativement le protocole C1–C5.
 *
 * `triageEngine(themeVotes, boundaryVotes, rules, opts?)` route une phrase, à partir des
 * votes de K juges (thème + is_block_start), vers un niveau C1–C5 et une proposition
 * (mono/multi/open) avec frontière dure/molle et une explication déterministe.
 *
 * Arbre (cf. docs/.../moteur/07-moteur-regles.md), généralisé K≥2 et ORDRE-INDÉPENDANT :
 *   unanime  → C1 (frontière dure) | C2 (frontière molle)
 *   majorité → couple cluster (tous dissidents) → C3 ; majorité-refuge → C5 ;
 *              tous dissidents refuges (majorité précise) → C2 override ; sinon → C4
 *   éclaté   → couple cluster (sans refuge) → C3 ; sinon → C5
 *
 * Note frontière : le moteur PUR n'a pas le texte ; le déclencheur structurel
 * (numérotation/titre) qui promeut une frontière 2/3 en « dure » est fourni par la couche
 * appelante via `opts.structuralHardTrigger` (défaut faux).
 */

import type {
  BoundaryVotes,
  ProposedLabel,
  Rules,
  ThemeVotes,
  TriageExplanation,
  TriageResult,
} from "./types";

export interface TriageOptions {
  /** Promotion d'une frontière majoritaire en « dure » (numérotation/titre détecté en amont). */
  structuralHardTrigger?: boolean;
}

function tally(themes: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of themes) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function isRefuge(theme: string, rules: Rules): boolean {
  return rules.refuges.includes(theme);
}

function priorityIndex(theme: string, rules: Rules): number {
  const i = rules.priority.indexOf(theme);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Thèmes distincts triés de façon STABLE et indépendante de l'ordre des juges :
 * support décroissant, puis index de priorité croissant (déterministe).
 */
function rankStable(counts: Map<string, number>, rules: Rules): { label: string; support: number }[] {
  return [...counts.entries()]
    .map(([label, support]) => ({ label, support }))
    .sort((a, b) => b.support - a.support || priorityIndex(a.label, rules) - priorityIndex(b.label, rules));
}

function clusterOf(a: string, b: string, rules: Rules): boolean {
  return rules.clusters.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Trouve un couple de cluster parmi des thèmes distincts (hors refuge). */
function findClusterPair(themes: string[], rules: Rules): [string, string] | null {
  const uniq = [...new Set(themes)].filter((t) => !isRefuge(t, rules));
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      if (clusterOf(uniq[i]!, uniq[j]!, rules)) return [uniq[i]!, uniq[j]!];
    }
  }
  return null;
}

/**
 * Choix du primaire d'un couple : (1) préséance, (2) majorité de votes, (3) priorité.
 * Retourne [primary, secondary] + la règle qui a tranché (pour l'explication).
 */
function choosePrimary(
  a: string,
  b: string,
  counts: Map<string, number>,
  rules: Rules,
): { primary: string; secondary: string; rule: string } {
  for (const p of rules.precedence) {
    if (p.over === a && p.under === b) return { primary: a, secondary: b, rule: `préséance ${a}>${b}` };
    if (p.over === b && p.under === a) return { primary: b, secondary: a, rule: `préséance ${b}>${a}` };
  }
  const ca = counts.get(a) ?? 0;
  const cb = counts.get(b) ?? 0;
  if (ca !== cb) {
    return ca > cb
      ? { primary: a, secondary: b, rule: "majorité de votes" }
      : { primary: b, secondary: a, rule: "majorité de votes" };
  }
  return priorityIndex(a, rules) <= priorityIndex(b, rules)
    ? { primary: a, secondary: b, rule: "liste de priorité" }
    : { primary: b, secondary: a, rule: "liste de priorité" };
}

function votesView(themeVotes: ThemeVotes): string {
  return Object.entries(themeVotes)
    .map(([j, t]) => `${j}:${t}`)
    .join(" · ");
}

function mono(label: string, support: number): ProposedLabel[] {
  return [{ label, role: "primary", support }];
}

/** Triage d'une phrase. `null` si < minJudges (carte masquée). */
export function triageEngine(
  themeVotes: ThemeVotes,
  boundaryVotes: BoundaryVotes,
  rules: Rules,
  opts: TriageOptions = {},
): TriageResult | null {
  // Normalisation défensive (idempotente sur les codes canoniques).
  const norm: ThemeVotes = {};
  for (const [j, t] of Object.entries(themeVotes)) norm[j] = rules.themeAliases[t] ?? t;

  const judges = Object.keys(norm);
  const total = judges.length;
  if (total < rules.thresholds.minJudges) return null;

  const themes = judges.map((j) => norm[j]!);
  const counts = tally(themes);
  const ranked = rankStable(counts, rules); // stable, ordre-indépendant
  const top = ranked[0]!;

  // Frontière : support = nb de is_block_start true ; dure si unanime OU trigger structurel.
  const bSupport = judges.filter((j) => boundaryVotes[j] === true).length;
  const boundary = {
    type: bSupport === total || opts.structuralHardTrigger ? ("hard" as const) : ("soft" as const),
    support: bSupport,
  };

  const ctx = votesView(themeVotes);
  const candidates = ranked.map((x) => x.label); // déterministe
  const kappa = (t: string) => rules.reliabilityKappa[t];
  const build = (
    r: Omit<TriageResult, "candidates" | "rulesVersion" | "explanation"> & { explanation: TriageExplanation },
  ): TriageResult => ({ ...r, candidates, rulesVersion: rules.version });

  // ── Cas 1 : thème UNANIME ─────────────────────────────────────────────────
  if (top.support === total) {
    const label = top.label;
    if (boundary.type === "hard") {
      return build({
        level: "C1",
        action: "batch_accept",
        labelMode: "mono",
        disagreementType: "accord",
        labels: mono(label, total),
        boundary,
        needsHuman: false,
        explanation: {
          context: ctx,
          decision: `${label} · frontière dure (${total}/${total})`,
          logic: "accord unanime sur le thème et la frontière → acceptation par lot.",
        },
      });
    }
    return build({
      level: "C2",
      action: "confirm",
      labelMode: "mono",
      disagreementType: "accord",
      labels: mono(label, total),
      boundary,
      needsHuman: true,
      explanation: {
        context: ctx,
        decision: `${label} · frontière molle (${bSupport}/${total})`,
        logic: "thème unanime mais frontière en majorité : confirmer (fusion/scission possible).",
      },
    });
  }

  const hasMajority = top.support * 2 > total;

  if (hasMajority) {
    const maj = top.label;
    const nonMaj = ranked.filter((x) => x.label !== maj);
    const dissidentTop = nonMaj[0]?.label ?? maj;

    // 1. Couple de cluster (règle substantielle) : cherché sur TOUS les non-majoritaires,
    //    ordre-indépendant ; le cluster PRIME sur l'override anti-refuge.
    const partner = nonMaj.find(
      (x) => !isRefuge(maj, rules) && !isRefuge(x.label, rules) && clusterOf(maj, x.label, rules),
    );
    if (partner) {
      const { primary, secondary, rule } = choosePrimary(maj, partner.label, counts, rules);
      return build({
        level: "C3",
        action: "validate_set",
        labelMode: "multi",
        disagreementType: "cluster_multilabel",
        labels: [
          { label: primary, role: "primary", support: counts.get(primary) ?? 0 },
          { label: secondary, role: "secondary", support: counts.get(secondary) ?? 0 },
        ],
        boundary,
        needsHuman: true,
        explanation: {
          context: ctx,
          decision: `multi : ${primary} (primaire) + ${secondary} (secondaire)`,
          logic: `couple de cluster ${maj}↔${partner.label} = chevauchement juridique réel ; primaire par ${rule}.`,
        },
      });
    }

    // 2. Majorité-refuge : un consensus qui n'est qu'un refuge (κ très bas) n'est PAS une
    //    majorité fiable à « vérifier » (C4 = « hors refuge ») → arbitrage.
    if (isRefuge(maj, rules)) {
      const k = kappa(maj);
      return build({
        level: "C5",
        action: "arbitrate",
        labelMode: "open",
        disagreementType: "eclate",
        labels: [],
        boundary,
        needsHuman: true,
        explanation: {
          context: ctx,
          decision: "aucune présélection",
          logic: `la majorité est un refuge (${maj}${k != null ? `, κ=${k}` : ""}), peu fiable → arbitrage humain plutôt qu'acceptation.`,
        },
      });
    }

    // 3. Override anti-refuge : majorité PRÉCISE et TOUS les dissidents sont des refuges
    //    → on impose le précis (réversible). (K=3 : l'unique dissident refuge.)
    if (nonMaj.length > 0 && nonMaj.every((x) => isRefuge(x.label, rules))) {
      const k = kappa(dissidentTop);
      return build({
        level: "C2",
        action: "confirm",
        labelMode: "mono",
        disagreementType: "accord",
        labels: mono(maj, top.support),
        boundary,
        override: { kind: "refuge_to_precis", from: dissidentTop, to: maj },
        needsHuman: true,
        explanation: {
          context: ctx,
          decision: `${maj}`,
          logic: `override anti-refuge : ${dissidentTop} est un refuge${
            k != null ? ` (κ=${k})` : ""
          } → on impose le précis ${maj}. Réversible (valeur d'origine conservée).`,
        },
      });
    }

    // 4. Majorité précise, dissident précis non-clusterisé → vérifier.
    return build({
      level: "C4",
      action: "verify",
      labelMode: "mono",
      disagreementType: "majorite_autre",
      labels: mono(maj, top.support),
      boundary,
      needsHuman: true,
      explanation: {
        context: ctx,
        decision: `${maj} (majorité ${top.support}/${total})`,
        logic: `majorité hors refuge/cluster : vérifier le candidat minoritaire ${dissidentTop} avant d'accepter.`,
      },
    });
  }

  // ── Cas 3 : ÉCLATÉ (pas de majorité stricte) ─────────────────────────────
  const pair = findClusterPair(themes, rules);
  if (pair) {
    const { primary, secondary, rule } = choosePrimary(pair[0], pair[1], counts, rules);
    return build({
      level: "C3",
      action: "validate_set",
      labelMode: "multi",
      disagreementType: "cluster_multilabel",
      labels: [
        { label: primary, role: "primary", support: counts.get(primary) ?? 0 },
        { label: secondary, role: "secondary", support: counts.get(secondary) ?? 0 },
      ],
      boundary,
      needsHuman: true,
      explanation: {
        context: ctx,
        decision: `multi : ${primary} (primaire) + ${secondary} (secondaire)`,
        logic: `votes éclatés mais couple de cluster ${pair[0]}↔${pair[1]} présent → multi-label ; primaire par ${rule}.`,
      },
    });
  }

  return build({
    level: "C5",
    action: "arbitrate",
    labelMode: "open",
    disagreementType: "eclate",
    labels: [],
    boundary,
    needsHuman: true,
    explanation: {
      context: ctx,
      decision: "aucune présélection",
      logic: "votes éclatés (refuge/bruit) : votre jugement fait foi ; choisir 1, créer un multi, ou marquer indécidable.",
    },
  });
}

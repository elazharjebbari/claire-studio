"use client";

/**
 * Panneaux ad-hoc des tâches de mesure et de graphe (M1/M2/G2) — chaque volet ouvre
 * sur la DÉCISION de l'expérience (docs/pactiva-experiences-papiers/01) :
 *   E1 « le multi-label coûte » avec le seuil 0,667 matérialisé · E2 la matrice
 *   annotateurs × juges · E3 les frontières reconstruites · E4 la divergence aux juges ·
 *   E5 la cascade · G2 le tableau des scorers avec contrôles négatifs SÉPARÉS des
 *   détecteurs, et la référence supervisée étiquetée comme telle.
 * Aucun chiffre calculé ici : tout vient de `run.metrics` (results.json du runner).
 */

import { Panel } from "@/components/ui/primitives";
import { Disclosure } from "@/components/ui/Disclosure";

import { metricDefinition } from "./content/metricGlossary";
import type { RunDetail } from "./types";

function pct(value: number | null | undefined, digits = 1): string {
  return value == null ? "—" : `${(value * 100).toFixed(digits)} %`;
}

function numOrDash(value: number | null | undefined, digits = 3): string {
  return value == null ? "—" : value.toFixed(digits);
}

/* ------------------------------------------------------------------------- */
/* M1 — mesures d'accord                                                     */
/* ------------------------------------------------------------------------- */

export function AgreementPanels({ run }: { run: RunDetail }) {
  const volets = run.metrics?.agreement;
  if (!volets) return null;
  const global = volets.global ?? {};
  return (
    <div className="space-y-4" data-testid="agreement-panels">
      <Panel className="p-4" data-testid="agreement-e1">
        <h3 className="text-sm font-semibold text-ink">
          E1 — Le coût du multi-label (différence appariée)
        </h3>
        <p className="mt-1 text-xs text-ink-muted">{metricDefinition("alphaDiff")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="uppercase tracking-wide text-ink-muted">α-MASI</p>
            <p className="font-mono text-ink">
              {numOrDash(global.alphaMasi)}{" "}
              <span className="text-ink-muted">
                [{numOrDash(global.ciMasi?.low)}, {numOrDash(global.ciMasi?.high)}]
              </span>
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-ink-muted">α nominal</p>
            <p className="font-mono text-ink">
              {numOrDash(global.alphaNominal)}{" "}
              <span className="text-ink-muted">
                [{numOrDash(global.ciNominal?.low)}, {numOrDash(global.ciNominal?.high)}]
              </span>
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-ink-muted">Δ (coût)</p>
            <p className="font-mono text-ink" data-testid="agreement-diff">
              {numOrDash(global.diff)}{" "}
              <span className="text-ink-muted">
                [{numOrDash(global.diffLow)}, {numOrDash(global.diffHigh)}]
              </span>
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-ink-muted">stabilité du signe</p>
            <p className="font-mono text-ink">
              {global.pDirection == null
                ? "—"
                : `${pct(1 - (global.pDirection ?? 0))} des tirages Δ > 0`}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {global.nUnits ?? "—"} unités multi-annotées · {global.nDocuments ?? "—"}{" "}
          documents — IC par rééchantillonnage de documents (jamais de phrases).
          Seuils : α ≥ 0,667 acceptable · ≥ 0,8 fiable.
        </p>
      </Panel>

      {(volets.perTheme?.length ?? 0) > 0 && (
        <Panel className="overflow-hidden" data-testid="agreement-per-theme">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Accord par thème</h3>
            <p className="text-xs text-ink-muted">
              α binaire (présence/absence) et Gwet AC1 — {metricDefinition("gwetAc1")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="px-3 py-1 text-left">Thème</th>
                  <th scope="col" className="px-3 py-1 text-right">Support</th>
                  <th scope="col" className="px-3 py-1 text-right">α binaire</th>
                  <th scope="col" className="px-3 py-1 text-right">Gwet AC1</th>
                  <th scope="col" className="px-3 py-1 text-right">Accord observé</th>
                </tr>
              </thead>
              <tbody>
                {[...(volets.perTheme ?? [])]
                  .sort((a, b) => b.support - a.support)
                  .map((row) => (
                    <tr key={row.theme} className="border-t border-line">
                      <td className="px-3 py-1 font-mono text-ink">{row.theme}</td>
                      <td className="px-3 py-1 text-right font-mono text-ink">{row.support}</td>
                      <td className="px-3 py-1 text-right font-mono text-ink">
                        {numOrDash(row.alphaBinary)}
                      </td>
                      <td className="px-3 py-1 text-right font-mono text-ink">
                        {numOrDash(row.gwetAc1)}
                      </td>
                      <td className="px-3 py-1 text-right font-mono text-ink">
                        {pct(row.observedAgreement)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-ink-muted">
            Un κ/α sur un support de quelques phrases n&apos;est pas interprétable seul —
            c&apos;est le rôle du Gwet AC1 en garde-fou de prévalence.
          </p>
        </Panel>
      )}

      {volets.matrix && volets.matrix.raters.length > 0 && (
        <Panel className="overflow-hidden" data-testid="agreement-matrix">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">
              E2 — Matrice annotateurs × juges (accord sur le thème primaire)
            </h3>
            <p className="text-xs text-ink-muted">
              La lecture attendue : humain↔humain ≫ humain↔LLM — le « mur du κ » est une
              limite des modèles, pas de la tâche.
            </p>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="px-2 py-1 text-left">—</th>
                  {volets.matrix.raters.map((name, i) => (
                    <th key={name} scope="col" className="px-2 py-1 text-right">
                      <span className={volets.matrix!.kinds[i] === "judge" ? "text-accent" : ""}>
                        {name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {volets.matrix.raters.map((name, i) => (
                  <tr key={name} className="border-t border-line">
                    <td className="px-2 py-1 text-ink">
                      <span className={volets.matrix!.kinds[i] === "judge" ? "text-accent" : ""}>
                        {name}
                      </span>
                    </td>
                    {volets.matrix!.raters.map((other, j) => (
                      <td key={other} className="px-2 py-1 text-right font-mono text-ink">
                        {i === j ? "·" : pct(volets.matrix!.agreement[i]?.[j], 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 text-xs text-ink-muted">
            En <span className="text-accent">couleur</span> : les juges LLM. Accord brut
            sur le thème primaire (les juges ne produisent qu&apos;un thème par phrase —
            limite déclarée). κ par paire dans le détail ci-dessous.
          </p>
        </Panel>
      )}

      {(volets.boundaries?.pairs?.length ?? 0) > 0 && (
        <Panel className="p-4" data-testid="agreement-boundaries">
          <h3 className="text-sm font-semibold text-ink">
            E3 — Frontières reconstruites (le vrai point dur)
          </h3>
          <p className="mt-1 text-xs text-ink-muted">{metricDefinition("boundaryJaccard")}</p>
          <div className="mt-3 space-y-2">
            {volets.boundaries!.pairs.map((pair) => (
              <div key={`${pair.a}-${pair.b}`} className="text-xs">
                <p className="text-ink">
                  {pair.a} ↔ {pair.b} —{" "}
                  <span className="font-mono">Jaccard moyen {numOrDash(pair.jaccardMean)}</span>
                </p>
                <p className="text-ink-muted">
                  {pair.documents
                    .map((d) => `${d.document} ${d.jaccard.toFixed(2)}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(volets.divergence?.annotators?.length ?? 0) > 0 && (
        <Panel className="p-4" data-testid="agreement-divergence">
          <h3 className="text-sm font-semibold text-ink">
            E4 (aperçu) — La post-édition n&apos;est pas une ratification
          </h3>
          <p className="mt-1 text-xs text-ink-muted">{volets.divergence!.note}</p>
          <div className="mt-3 space-y-2">
            {volets.divergence!.annotators.map((row) => (
              <div key={row.annotator} className="text-xs">
                <p className="text-ink">
                  {row.annotator} — juge le plus proche{" "}
                  <span className="font-mono">{row.closestJudge}</span>, divergence{" "}
                  <span className="font-mono">{pct(row.closestDivergence)}</span>
                </p>
                <p className="text-ink-muted">
                  {row.byJudge
                    .map((j) => `${j.judge} ${pct(j.divergencePrimary, 0)}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(volets.pairs?.length ?? 0) > 0 && (
        <Disclosure summary="Détail par paire d'annotateurs" testId="agreement-pairs">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="px-2 py-1 text-left">Paire</th>
                <th scope="col" className="px-2 py-1 text-right">κ</th>
                <th scope="col" className="px-2 py-1 text-right">Accord brut</th>
                <th scope="col" className="px-2 py-1 text-right">Jaccard des jeux</th>
                <th scope="col" className="px-2 py-1 text-right">Unités</th>
                <th scope="col" className="px-2 py-1 text-right">Docs</th>
              </tr>
            </thead>
            <tbody>
              {volets.pairs!.map((pair) => (
                <tr key={`${pair.a}-${pair.b}`} className="border-t border-line">
                  <td className="px-2 py-1 text-ink">{pair.a} ↔ {pair.b}</td>
                  <td className="px-2 py-1 text-right font-mono text-ink">
                    {numOrDash(pair.kappa)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-ink">
                    {pct(pair.rawAgreement)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-ink">
                    {numOrDash(pair.jaccardMean)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-ink">{pair.nUnits}</td>
                  <td className="px-2 py-1 text-right font-mono text-ink">{pair.nDocuments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">
            Toujours lire les κ PAR PAIRE — jamais un κ global seul (charge très inégale
            entre annotateurs, menace de validité déclarée des papiers).
          </p>
        </Disclosure>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* M2 — cascade gold                                                         */
/* ------------------------------------------------------------------------- */

const TIER_LABELS: Record<string, string> = {
  auto_1click: "unanime (auto 1-clic)",
  auto: "majorité ≥ 2/3 (auto)",
  manual: "divergence (comité)",
};

export function CascadePanels({ run }: { run: RunDetail }) {
  const volets = run.metrics?.gold;
  if (!volets) return null;
  const arbitration = volets.arbitration;
  const finalized = volets.finalizedDocuments ?? [];
  return (
    <div className="space-y-4" data-testid="cascade-panels">
      <Panel className="p-4" data-testid="cascade-tiers">
        <h3 className="text-sm font-semibold text-ink">E5 — Où va l&apos;effort humain ?</h3>
        <div className="mt-3 space-y-2">
          {(volets.tiers ?? []).map((tier) => (
            <div key={tier.tier} className="flex items-center gap-2 text-xs">
              <span className="w-44 shrink-0 text-ink">{TIER_LABELS[tier.tier] ?? tier.tier}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(tier.share ?? 0) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-ink">
                {pct(tier.share)} ({tier.count})
              </span>
            </div>
          ))}
        </div>
        {arbitration && (
          <p className="mt-3 text-xs text-ink-muted" data-testid="cascade-arbitration">
            Arbitrage : {arbitration.manualDecided}/{arbitration.manualTotal} conflits
            tranchés — l&apos;arbitre a <span className="text-ink">contredit la pluralité
            des votes {arbitration.changed} fois</span>, l&apos;a confirmée{" "}
            {arbitration.confirmed} fois ({arbitration.noPlurality} cas sans pluralité).
          </p>
        )}
        <p className="mt-2 text-xs text-warning" data-testid="cascade-finalized">
          {finalized.length === 0
            ? "Aucune résolution finalisée — chiffres d'APERÇU ; les chiffres définitifs d'E5 exigent des résolutions finalisées (plan V2)."
            : `Documents finalisés : ${finalized.join(", ")}.`}
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* G2 — co-occurrence                                                        */
/* ------------------------------------------------------------------------- */

const KIND_LABELS: Record<string, string> = {
  unsupervised: "Détecteurs non supervisés",
  control: "Contrôles négatifs",
  supervised_reference: "Référence supervisée (borne haute — PAS un détecteur)",
};

const SCORER_LABELS: Record<string, string> = {
  rarity: "rareté de combinaison",
  npmi_min: "NPMI min (paire la plus atypique)",
  lof: "LOF (multi-hot)",
  iforest: "IsolationForest (multi-hot)",
  ocsvm: "OCSVM (multi-hot)",
  cardinality: "cardinalité (nombre de thèmes)",
  combo_identity: "identité de combinaison — P(abusif | combo)",
};

export function CooccurrencePanels({ run }: { run: RunDetail }) {
  const volets = run.metrics?.cooccurrence;
  if (!volets) return null;
  const structure = volets.structure ?? {};
  const groups: Array<[string, NonNullable<typeof volets.scorers>]> = (
    ["unsupervised", "control", "supervised_reference"] as const
  )
    .map((kind): [string, NonNullable<typeof volets.scorers>] => [
      kind,
      (volets.scorers ?? []).filter((s) => s.kind === kind),
    ])
    .filter(([, rows]) => rows.length > 0);

  return (
    <div className="space-y-4" data-testid="cooccurrence-panels">
      <Panel className="p-4" data-testid="cooccurrence-structure">
        <h3 className="text-sm font-semibold text-ink">L&apos;hypergraphe construit</h3>
        <p className="mt-1 text-xs text-ink-muted">
          {structure.nSentences ?? "—"} phrases → {structure.nSegments ?? "—"} segments
          (compression ×{structure.compression?.toFixed(2) ?? "—"}) ·{" "}
          {structure.nCombinations ?? "—"} combinaisons de thèmes distinctes dont{" "}
          {structure.nHapax ?? "—"} vues une seule fois · taux multi-thèmes{" "}
          {pct(structure.multiThemeRate)} · taux de base d&apos;abusivité{" "}
          {pct(structure.baseRate)}. Unité : {volets.unit ?? "segment"}
          {volets.source === "votes"
            ? ` · source : votes bruts (${volets.nLayers ?? "—"} couches annotateur — aperçu pré-gold)`
            : ""}
          {volets.deontic === "rule_based" ? " · couche déontique (proxy à règles)" : ""}
          {volets.labelNoise ? ` · bruit d'étiquettes ${pct(volets.labelNoise, 0)}` : ""}.
        </p>
        {(volets.skippedScorers?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-warning" data-testid="cooccurrence-skipped">
            Scorers sautés (environnement sans sklearn) :{" "}
            {volets.skippedScorers!.join(", ")}.
          </p>
        )}
        {volets.note && <p className="mt-2 text-xs text-warning">{volets.note}</p>}
      </Panel>

      <Panel className="overflow-hidden" data-testid="cooccurrence-scorers">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">
            Le tableau 5 — détection contre les labels CLAUDETTE
          </h3>
          <p className="text-xs text-ink-muted">
            {metricDefinition("aucPr")} CV par document sur les plis figés du dataset.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="px-3 py-1 text-left">Scorer</th>
                <th scope="col" className="px-3 py-1 text-right">AUC-PR</th>
                <th scope="col" className="px-3 py-1 text-right">IC 95 %</th>
                <th scope="col" className="px-3 py-1 text-right">ROC-AUC</th>
                <th scope="col" className="px-3 py-1 text-right">P@20 (lift)</th>
                <th scope="col" className="px-3 py-1 text-right">P@50 (lift)</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([kind, rows]) => (
                <>
                  <tr key={kind} className="border-t border-line bg-panel-muted">
                    <td colSpan={6} className="px-3 py-1 font-medium text-ink">
                      {KIND_LABELS[kind]}
                    </td>
                  </tr>
                  {rows.map((row) => {
                    const p20 = row.precisionAt.find((p) => p.k === 20);
                    const p50 = row.precisionAt.find((p) => p.k === 50);
                    return (
                      <tr
                        key={row.scorer}
                        className="border-t border-line"
                        data-testid={`scorer-${row.scorer}`}
                      >
                        <td className="px-3 py-1 text-ink">
                          {SCORER_LABELS[row.scorer] ?? row.scorer}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-ink">
                          {numOrDash(row.aucPr)}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-ink-muted">
                          [{numOrDash(row.aucPrCi?.low)}, {numOrDash(row.aucPrCi?.high)}]
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-ink">
                          {numOrDash(row.rocAuc)}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-ink">
                          {p20 ? `${pct(p20.precision, 0)} (${p20.lift?.toFixed(1) ?? "—"}×)` : "—"}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-ink">
                          {p50 ? `${pct(p50.precision, 0)} (${p50.lift?.toFixed(1) ?? "—"}×)` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-xs text-ink-muted">
          Un détecteur ne vaut que s&apos;il bat les contrôles négatifs ; la référence
          supervisée borne ce que l&apos;identité de combinaison peut donner —{" "}
          {metricDefinition("comboIdentity")}
        </p>
      </Panel>

      {(volets.combinations?.top?.length ?? 0) > 0 && (
        <Panel className="overflow-hidden" data-testid="cooccurrence-combinations">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">
              Les combinaisons les plus prédictives (descriptif, tout corpus)
            </h3>
            <p className="text-xs text-ink-muted">
              Table d&apos;illustration SANS validation croisée — la mesure de
              généralisation est le tableau des scorers ci-dessus. Support minimal :{" "}
              {volets.combinations!.minSupport}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="px-3 py-1 text-left">Combinaison</th>
                  <th scope="col" className="px-3 py-1 text-right">Support</th>
                  <th scope="col" className="px-3 py-1 text-right">% abusives</th>
                  <th scope="col" className="px-3 py-1 text-right">Lift</th>
                </tr>
              </thead>
              <tbody>
                {volets.combinations!.top.slice(0, 12).map((row) => (
                  <tr key={row.themes.join("+")} className="border-t border-line">
                    <td className="px-3 py-1 font-mono text-ink">{row.themes.join(" + ")}</td>
                    <td className="px-3 py-1 text-right font-mono text-ink">{row.support}</td>
                    <td className="px-3 py-1 text-right font-mono text-ink">
                      {pct(row.unfairRate)}
                    </td>
                    <td className="px-3 py-1 text-right font-mono text-ink">
                      {row.lift?.toFixed(1) ?? "—"}×
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {(volets.perCategory?.length ?? 0) > 0 && (
        <Disclosure summary="Où le signal porte — par catégorie CLAUDETTE" testId="cooccurrence-per-category">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="px-2 py-1 text-left">Catégorie</th>
                <th scope="col" className="px-2 py-1 text-right">Positifs</th>
                <th scope="col" className="px-2 py-1 text-left">AUC-PR par scorer</th>
              </tr>
            </thead>
            <tbody>
              {volets.perCategory!.map((row) => (
                <tr key={row.category} className="border-t border-line">
                  <td className="px-2 py-1 font-mono text-ink">{row.category}</td>
                  <td className="px-2 py-1 text-right font-mono text-ink">{row.nPositive}</td>
                  <td className="px-2 py-1 text-ink-muted">
                    {row.aucPrByScorer
                      .map((s) => `${s.scorer} ${s.aucPr.toFixed(2)}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Disclosure>
      )}
    </div>
  );
}

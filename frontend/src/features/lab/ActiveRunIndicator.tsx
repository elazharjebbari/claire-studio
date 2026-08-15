"use client";

/**
 * Indicateur persistant visible depuis les 3 onglets du Lab (pas seulement
 * « Expériences ») — audit UI/UX du 15 août 2026 : avant ce composant, un run Grid'5000
 * de plusieurs heures démarré puis oublié ne signalait jamais sa fin nulle part hors de
 * l'onglet Expériences resté ouvert. Bon marché à maintenir : le worker Pactiva Lab est
 * strictement séquentiel (`worker.py::claim_next_run`, `select_for_update` sur un seul
 * run à la fois) — jamais plus d'UN run actif sur toute la plateforme, donc rien à
 * agréger ni paginer.
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { listRuns } from "./api";
import { ACTIVE, elapsedLabel } from "./runStatus";

export function ActiveRunIndicator({ slug }: { slug: string }) {
  // Dette connue (revue adversariale du 15 août 2026, sévérité basse par les deux
  // réviseurs) : sur l'onglet « Expériences », ce sondage et celui de `RunList`
  // (`setInterval` toutes les 5 s, non migré vers react-query) interrogent tous deux
  // `listRuns(slug)` sans cache partagé — un doublon d'appel réseau, jamais un doublon
  // d'affichage. Pas corrigé ici : ça demanderait de migrer le sondage de `RunList`
  // vers `useQuery` pour partager la même `queryKey`, un changement plus risqué que
  // ce lot ne le justifie (ce composant reste, lui, un `useQuery` isolé).
  const { data: runs } = useQuery({
    queryKey: ["lab", "active-runs", slug],
    queryFn: () => listRuns(slug),
    // Le composant reste monté sur les 3 onglets tant que le Lab est ouvert : sondage
    // rapide quand quelque chose tourne (transition perçue comme réactive), très espacé
    // sinon — un run lancé depuis un autre onglet/une autre session doit finir par
    // apparaître ici sans jamais coûter cher en l'absence de tout run actif.
    refetchInterval: (query) => {
      const active = (query.state.data ?? []).some((r) => ACTIVE.includes(r.status));
      return active ? 10_000 : 60_000;
    },
  });

  const active = (runs ?? []).filter((r) => ACTIVE.includes(r.status));
  if (active.length === 0) return null;

  const run = active[0]!;
  const since = elapsedLabel(run.startedAt ?? run.createdAt, Date.now());

  return (
    <Link
      href={`/projects/${slug}/lab/runs/${run.id}`}
      className="ml-auto mb-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs text-accent hover:brightness-110"
      data-testid="active-run-indicator"
      title={since ? `${run.experimentName} — depuis ${since}` : run.experimentName}
    >
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      {active.length === 1 ? "1 run actif" : `${active.length} runs actifs`}
    </Link>
  );
}

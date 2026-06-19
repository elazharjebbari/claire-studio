"use client";

/** Détail public d'un projet publié (chantier F) — agrégats lecture seule. */

import Link from "next/link";
import { usePublicProject } from "@/lib/api/hooks";
import { Panel } from "@/components/ui/primitives";
import { getThemeToken } from "@/lib/tokens";

export default function PublicProjectDetailPage({ params }: { params: { slug: string } }) {
  const { data, isLoading, isError } = usePublicProject(params.slug);

  const maxCount = data
    ? Math.max(1, ...data.themeDistribution.map((t) => t.count))
    : 1;

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/public" className="text-sm text-ink-muted hover:text-ink">
          ← Projets publiés
        </Link>
        <Link href="/login" className="text-sm text-ink-muted hover:text-ink">
          Se connecter
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-6">
        {isLoading && <p className="text-sm text-ink-muted">Chargement…</p>}
        {isError && (
          <p data-testid="public-not-found" className="text-sm text-red-400">
            Projet introuvable ou non publié.
          </p>
        )}
        {data && (
          <div data-testid="public-project-detail">
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <p className="mt-1 text-xs text-ink-muted">corpus : {data.corpusSlug}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label="Documents" value={`${data.kpi.documentsAnnotated} / ${data.kpi.documentsTotal}`} hint="annotés" />
              <Kpi label="Annotateurs" value={String(data.kpi.annotators)} />
              <Kpi
                label="Certitude moyenne"
                value={data.kpi.meanCertainty != null ? data.kpi.meanCertainty.toFixed(2) : "—"}
                hint="échelle 0–3"
              />
              <Kpi
                label="Accord inter-annotateurs (κ)"
                value={data.kpi.kappa != null ? data.kpi.kappa.toFixed(2) : "—"}
              />
            </div>

            <h2 className="mt-8 font-semibold text-ink">Distribution des thèmes</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {data.themeDistribution.map((t) => {
                const token = getThemeToken(t.theme);
                return (
                  <li key={t.theme} className="flex items-center gap-2 text-sm">
                    <span className="w-44 shrink-0 truncate text-ink-muted">{token.label}</span>
                    <span
                      className="h-3 rounded"
                      style={{ width: `${(t.count / maxCount) * 100}%`, backgroundColor: token.color, minWidth: 6 }}
                      aria-hidden
                    />
                    <span className="text-ink-muted">{t.count}</span>
                  </li>
                );
              })}
              {data.themeDistribution.length === 0 && (
                <li className="text-sm text-ink-muted">Aucune clause annotée.</li>
              )}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </Panel>
  );
}

"use client";

import { useState } from "react";
import { useProjects } from "@/lib/api/hooks";
import { setProjectVisibility } from "@/lib/api/endpoints";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { StatusPill, Button } from "@/components/ui/primitives";
import type { Project } from "@/types/contract";

export default function AdminProjects() {
  const { data, refetch } = useProjects();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(p: Project) {
    setBusy(p.slug);
    try {
      await setProjectVisibility(
        p.slug,
        p.visibility === "public" ? "private" : "public",
      );
      await refetch();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminScaffold
      title="Campagnes"
      description="Corpus + LabelScheme + membres. Publication des résultats en lecture seule publique."
      columns={["Nom", "Corpus", "Schéma", "Statut", "Publication"]}
      rows={(data?.results ?? []).map((p) => [
        p.name,
        p.corpusSlug,
        p.schemeSlug,
        <StatusPill key="s" status={p.status} />,
        <span key="v" className="flex items-center gap-2">
          <span
            data-testid={`visibility-${p.slug}`}
            className={
              "rounded px-1.5 py-0.5 text-[11px] font-medium " +
              (p.visibility === "public"
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-panel-muted text-ink-muted")
            }
          >
            {p.visibility === "public" ? "Public" : "Privé"}
          </span>
          <Button
            variant="outline"
            data-testid={`toggle-visibility-${p.slug}`}
            disabled={busy === p.slug}
            onClick={() => toggle(p)}
          >
            {p.visibility === "public" ? "Dépublier" : "Publier"}
          </Button>
        </span>,
      ])}
    />
  );
}

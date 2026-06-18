"use client";

import { useProjects } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { StatusPill } from "@/components/ui/primitives";

export default function AdminProjects() {
  const { data } = useProjects();
  return (
    <AdminScaffold
      title="Campagnes"
      description="Corpus + LabelScheme + membres + assignations."
      columns={["Nom", "Corpus", "Schéma", "Statut"]}
      rows={(data?.results ?? []).map((p) => [
        p.name,
        p.corpusSlug,
        p.schemeSlug,
        <StatusPill key="s" status={p.status} />,
      ])}
    />
  );
}

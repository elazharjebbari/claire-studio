"use client";

import { useProjectPreAnnotations } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

export default function AdminPreannotations() {
  // Projet courant — plus de slug en dur (H2). TODO chantier G : sélecteur de projet.
  const projectSlug = useCurrentProjectSlug();
  const { data } = useProjectPreAnnotations(projectSlug);
  return (
    <AdminScaffold
      title="Pré-annotations LLM"
      description="Import & mapping claude/codex vers le pivot (F2). v9.2 / v9.4 normalisés."
      columns={["Juge", "Schéma", "Clauses", "Mappé", "Importé"]}
      rows={(data?.results ?? []).map((p) => [
        <Badge key="j">{p.judge}</Badge>,
        <code key="s">{p.schemaVersion}</code>,
        p.clauses.length,
        p.mapped ? "✓" : "—",
        new Date(p.importedAt).toLocaleDateString("fr-FR"),
      ])}
    />
  );
}

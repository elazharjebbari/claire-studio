"use client";

import { usePreAnnotations } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

export default function AdminPreannotations() {
  const { data } = usePreAnnotations("claudette-gold-v1", "doc-fitbit");
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

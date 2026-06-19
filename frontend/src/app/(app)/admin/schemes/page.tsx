"use client";

import { useProject, useScheme } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { Badge } from "@/components/ui/primitives";

export default function AdminSchemes() {
  // Schéma du projet courant — plus de slug en dur (H2). TODO chantier G : liste
  // de tous les schémas (sélecteur) via un hook useSchemes().
  const projectSlug = useCurrentProjectSlug();
  const { data: project } = useProject(projectSlug);
  const { data: scheme } = useScheme(project?.schemeSlug);
  return (
    <AdminScaffold
      title="Schémas d'annotation"
      description="Vocabulaire fermé versionné (F11). Le clone crée une nouvelle version."
      columns={["Thème", "Code", "Ordre"]}
      actions={
        scheme ? (
          <Badge>
            {scheme.name} · v{scheme.version} {scheme.isActive ? "(actif)" : ""}
          </Badge>
        ) : null
      }
      rows={(scheme?.themes ?? []).map((t) => [
        <ClauseChip key="c" themeCode={t.code} size="sm" />,
        <code key="code">{t.code}</code>,
        t.order,
      ])}
    />
  );
}

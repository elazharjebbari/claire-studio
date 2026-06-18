"use client";

import { useScheme } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { ClauseChip } from "@/components/ui/ClauseChip";
import { Badge } from "@/components/ui/primitives";

export default function AdminSchemes() {
  const { data: scheme } = useScheme("claire-themes-v1");
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

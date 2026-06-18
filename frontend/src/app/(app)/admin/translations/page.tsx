"use client";

import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

/** Traductions file-based (F8) — squelette structuré (déclaration de dossiers). */
export default function AdminTranslations() {
  const rows = [
    ["CLAUDETTE FR", "fr", "/data/translations/claudette_fr", "file-based", "synced"],
  ];
  return (
    <AdminScaffold
      title="Traductions"
      description="Déclaration de dossiers de traductions et mapping file-based (F8)."
      columns={["Nom", "Langue", "Dossier", "Stratégie", "Statut"]}
      rows={rows.map((r) => [
        r[0],
        <Badge key="l">{r[1]}</Badge>,
        <code key="f">{r[2]}</code>,
        r[3],
        r[4],
      ])}
    />
  );
}

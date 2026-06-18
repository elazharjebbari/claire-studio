"use client";

import { useCorpora } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

export default function AdminCorpora() {
  const { data } = useCorpora();
  return (
    <AdminScaffold
      title="Corpus & documents"
      description="Jeux de données (F11). Import CLAUDETTE par défaut (F12)."
      columns={["Nom", "Slug", "Langue", "Docs", "Licence"]}
      rows={(data?.results ?? []).map((c) => [
        c.name,
        <code key="s">{c.slug}</code>,
        c.defaultLanguage,
        <Badge key="d">{c.documentCount ?? "—"}</Badge>,
        c.license,
      ])}
    />
  );
}

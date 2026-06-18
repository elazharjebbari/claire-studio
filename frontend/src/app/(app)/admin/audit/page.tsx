"use client";

import { useActivity } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";

export default function AdminAudit() {
  const { data } = useActivity();
  return (
    <AdminScaffold
      title="Journal d'audit"
      description="Trace globale des événements (F4)."
      columns={["Acteur", "Action", "Cible", "Date"]}
      rows={(data?.results ?? []).map((ev) => [
        ev.actorName ?? ev.actorId,
        ev.verb.replace(/_/g, " "),
        `${ev.targetType}:${ev.targetId}`,
        new Date(ev.createdAt).toLocaleString("fr-FR"),
      ])}
    />
  );
}

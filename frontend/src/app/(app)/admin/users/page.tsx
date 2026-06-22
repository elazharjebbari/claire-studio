"use client";

/**
 * Utilisateurs & rôles (admin). Données RÉELLES uniquement — plus aucune ligne
 * fictive codée en dur (ex-« Bruno »). La gestion fine des rôles se fait
 * par campagne (Console admin → Campagnes → Membres), où l'on ajoute/retire des
 * membres et fixe leur rôle (annotator / reviewer / lead).
 */

import Link from "next/link";
import { useMe } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

export default function AdminUsers() {
  const { data: me } = useMe();
  const rows = me
    ? [[me.displayName || me.username, me.email, me.role]]
    : [];
  return (
    <div className="space-y-3">
      <AdminScaffold
        title="Utilisateurs & rôles"
        columns={["Nom", "Email", "Rôle"]}
        rows={rows.map((r) => [r[0], r[1], <Badge key="r">{r[2]}</Badge>])}
      />
      <p className="rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
        Les rôles s'attribuent <strong className="text-ink">par campagne</strong> : ouvrez{" "}
        <Link href="/admin/projects" className="text-accent hover:underline">
          Console admin → Campagnes → Membres
        </Link>{" "}
        pour ajouter un annotateur / reviewer / lead et voir l'équipe réelle d'un projet.
      </p>
    </div>
  );
}

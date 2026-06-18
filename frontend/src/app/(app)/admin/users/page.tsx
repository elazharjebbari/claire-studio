"use client";

import { useMe } from "@/lib/api/hooks";
import { AdminScaffold } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/primitives";

export default function AdminUsers() {
  const { data: me } = useMe();
  const rows = [
    [me?.displayName ?? "Alice", me?.email ?? "alice@loria.fr", me?.role ?? "admin"],
    ["Bruno (reviewer)", "bruno@loria.fr", "reviewer"],
  ];
  return (
    <AdminScaffold
      title="Utilisateurs & rôles"
      columns={["Nom", "Email", "Rôle"]}
      rows={rows.map((r) => [r[0], r[1], <Badge key="r">{r[2]}</Badge>])}
    />
  );
}

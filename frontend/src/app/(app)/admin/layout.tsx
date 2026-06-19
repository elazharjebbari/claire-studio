import { AdminGuard } from "@/components/auth/AdminGuard";

/**
 * Layout de la console d'administration (chantier G) — sépare nettement l'espace
 * admin de l'espace annotateur : toutes les routes /admin/* sont gardées par rôle
 * (admin/owner) en plus de l'authentification héritée du layout (app).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}

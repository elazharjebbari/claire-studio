import type { UserRole } from "@/types/contract";

/**
 * Rôles disposant des droits d'administration sur toute la solution (chantier G).
 * Source de vérité unique partagée par la garde de route et la navigation, alignée
 * sur le backend (`User.is_admin_role` : admin/owner/superuser).
 */
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

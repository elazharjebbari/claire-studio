import { AppShell } from "@/components/shell/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";

/** Layout des routes applicatives (chrome complet). /login et le workspace ont leurs propres layouts. */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

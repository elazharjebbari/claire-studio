import { AppShell } from "@/components/shell/AppShell";

/** Layout des routes applicatives (chrome complet). /login et le workspace ont leurs propres layouts. */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

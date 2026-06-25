/** Touche clavier stylée (`<kbd>`), tokenisée. Utilisée par l'aide aux raccourcis (L9). */
import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.4rem] items-center justify-center rounded border border-line bg-panel-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-sm",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

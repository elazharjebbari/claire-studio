import { cn } from "@/lib/cn";

interface LogoProps {
  /** Hauteur du symbole en px. */
  size?: number;
  /** Afficher le wordmark « Pactiva » à droite du symbole. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Logo Pactiva — source unique côté app (header, footer, login, atelier).
 * Les traits du symbole et le wordmark héritent de `currentColor` (navy sur fond
 * clair, clair sur fond sombre) ; le rhombus doré est fixe. Définir la couleur via
 * `className` (ex. `text-brand-navy-500` en clair, `text-ink` en sombre).
 */
export function Logo({ size = 22, withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        height={size}
        viewBox="20 16 64 68"
        fill="none"
        aria-hidden
        focusable="false"
        className="shrink-0"
      >
        {/* Traits convergeant vers le losange sans se refermer en pointe (cf. réf PNG). */}
        <path d="M28 24 73 48M28 76 73 52" stroke="currentColor" strokeWidth={2.2} />
        <path d="M69 50 74 46 79 50 74 54Z" fill="#BA7517" />
      </svg>
      {withWordmark && (
        <span
          className="font-display font-light leading-none tracking-[0.16em]"
          style={{ fontSize: size * 0.86 }}
        >
          Pactiva
        </span>
      )}
      {!withWordmark && <span className="sr-only">Pactiva</span>}
    </span>
  );
}

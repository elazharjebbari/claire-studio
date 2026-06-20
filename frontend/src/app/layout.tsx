import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Inter → UI/corps (--font-inter) ; Outfit → display/titres/wordmark (--font-outfit).
// Composées en --font-sans / --font-display dans globals.css.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pactiva — intelligence contractuelle", template: "%s · Pactiva" },
  description:
    "Plateforme européenne d'intelligence contractuelle : multilingue nativement, croisement multi-documents, déployable chez vous. Pensée pour les ETI.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`dark ${inter.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

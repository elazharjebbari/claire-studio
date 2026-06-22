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
      <head>
        {/*
          Anti-FOUC (a11y/charte) : applique le thème PERSISTÉ avant le premier paint.
          Le défaut est sombre (classe `dark` ci-dessus) ; si l'utilisateur a choisi
          « clair » (store zustand `claire.ui`), on bascule la classe AVANT le rendu —
          sinon un flash sombre précédait l'application du thème en useEffect.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('claire.ui');var t=s&&JSON.parse(s).state&&JSON.parse(s).state.theme;if(t==='light'){var r=document.documentElement;r.classList.remove('dark');r.classList.add('light');r.style.colorScheme='light';}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

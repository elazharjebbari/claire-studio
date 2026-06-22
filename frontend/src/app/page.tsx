/**
 * Page d'accueil publique de pactiva.legal — présente l'ambition de Pactiva
 * (intelligence contractuelle souveraine pour les ETI européennes) et ses modules.
 * Le système d'annotation n'est QU'UN module parmi d'autres ; on y accède via un
 * onglet dédié, l'authentification n'intervenant qu'au moment de l'accès.
 * Route racine publique, sans authentification, thème clair institutionnel forcé.
 * Page statique (aucun hook client).
 */

import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const PILLARS: Array<{ title: string; body: string }> = [
  {
    title: "Multilingue nativement",
    body: "Parce qu'un contrat européen ne s'arrête pas à une seule langue : français, allemand, anglais, polonais — analysés ensemble.",
  },
  {
    title: "Croisement multi-documents",
    body: "Parce que le risque non plus ne tient pas dans un seul fichier : Pactiva confronte contrat-cadre, avenants et annexes simultanément.",
  },
  {
    title: "Déployable chez vous",
    body: "Sur votre propre infrastructure. Zéro donnée contractuelle qui sort de chez vous — souveraineté de bout en bout.",
  },
];

// Les systèmes de la plateforme. L'annotation est l'un d'eux (disponible) ;
// les autres jalonnent la feuille de route. L'accès au système d'annotation est
// protégé par authentification (déclenchée seulement à l'accès).
const MODULES: Array<{ title: string; body: string; status: "available" | "soon"; href?: string }> = [
  {
    title: "Système d'annotation",
    body: "Annotation collaborative de clauses : segmentation, thèmes, certitude, accord inter-annotateurs, versions et overlay d'injustice CLAUDETTE.",
    status: "available",
    href: "/home",
  },
  {
    title: "Analyse de risque multi-documents",
    body: "Croisement automatique contrat-cadre, avenants et annexes pour révéler les risques qui vivent dans la tension entre documents.",
    status: "soon",
  },
  {
    title: "Veille & alertes contractuelles",
    body: "Alertes lisibles, sourcées et actionnables — multilingues — pour les juristes et les directions achats.",
    status: "soon",
  },
];

// Adresse de contact publique. Pilotée par l'env (variable de build Next),
// défaut = la boîte mail de contact Pactiva. Voir aussi le .env e-mail du backend.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@pactiva.legal";

export default function HomePage() {
  return (
    <main className="theme-light min-h-screen bg-bg text-ink">
      {/* En-tête public */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Pactiva — accueil" className="text-brand-navy-500">
          <Logo size={26} />
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/public" data-testid="welcome-public" className="text-ink-muted hover:text-ink">
            Projets publiés
          </Link>
          <Link href="/home" data-testid="welcome-annotation" className="text-ink-muted hover:text-ink">
            Système d'annotation
          </Link>
          <Link href="/login" data-testid="welcome-login" className="text-ink-muted hover:text-ink">
            Se connecter
          </Link>
          <Link
            href="/signup"
            data-testid="welcome-signup"
            className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg hover:brightness-110"
          >
            Créer un compte
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-14 pt-10 text-center sm:pt-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-muted">
          Intelligence contractuelle souveraine
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-light leading-tight tracking-tight text-ink sm:text-5xl">
          Le risque contractuel ne vit pas dans un seul fichier.
          <span className="text-accent"> Pactiva le révèle.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">
          Vos contrats sont signés en français, en allemand, en anglais, en polonais — et
          analysés langue par langue, document par document. Le risque réel, lui, vit dans
          la tension entre eux. Pactiva l'analyse comme un tout.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="#modules"
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-fg hover:brightness-110"
          >
            Découvrir la plateforme
          </Link>
          <Link
            href="/public"
            className="rounded-md border border-line px-5 py-2.5 font-medium text-ink hover:bg-panel-muted"
          >
            Voir les projets publiés
          </Link>
        </div>
      </section>

      {/* Le problème */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-display text-2xl font-normal text-ink sm:text-3xl">
            Les entreprises européennes ratent des risques. Voici pourquoi.
          </h2>
          <div className="mt-6 space-y-4 text-ink-muted">
            <p>
              Le risque contractuel réel vit rarement dans un seul document. Il vit dans la
              tension entre un contrat-cadre signé il y a deux ans, un avenant négocié en
              allemand, et une annexe technique que personne n'a relue depuis.
            </p>
            <p>
              L'IA juridique a longtemps cherché à analyser des documents un à un, dans une
              seule langue, sur un seul périmètre. C'est utile — mais insuffisant pour une
              entreprise qui opère en Europe.
            </p>
            <p>
              Les outils capables de traiter cela existent, mais coûtent{" "}
              <span className="font-medium text-ink">10 000 € par mois</span> et sont conçus
              pour les grands groupes et cabinets d'élite. Pas pour une ETI de 500 personnes
              avec trois juristes et un portefeuille fournisseurs sur six pays.
            </p>
            <p className="font-medium text-ink">
              Pactiva est construit pour les ETI européennes.
            </p>
          </div>
        </div>
      </section>

      {/* La réponse — deux niveaux */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-display text-2xl font-normal text-ink sm:text-3xl">
          Une plateforme d'intelligence contractuelle en deux niveaux
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-xl border border-line bg-panel p-6">
            <h3 className="font-display text-lg font-medium text-ink">Un backend auditable</h3>
            <p className="mt-3 text-ink-muted">
              Les meilleurs modèles open-weight européens (Mistral, EuroLLM), entraînés sur
              des datasets juridiques publics de référence — CUAD, LEDGAR, ContractNLI. Une
              architecture qui s'améliore en continu et reste auditable.
            </p>
          </article>
          <article className="rounded-xl border border-line bg-panel p-6">
            <h3 className="font-display text-lg font-medium text-ink">
              Un frontend pour les décideurs
            </h3>
            <p className="mt-3 text-ink-muted">
              Conçu pour les juristes et les directions achats : des alertes lisibles, des
              explications sourcées, des recommandations actionnables — sans aucun prérequis
              technique.
            </p>
          </article>
        </div>
      </section>

      {/* Trois piliers */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.title}>
                <div className="h-1 w-10 rounded-full bg-gold" aria-hidden />
                <h3 className="mt-4 font-display text-lg font-medium text-ink">{p.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules de la plateforme — l'annotation est l'un d'eux */}
      <section id="modules" className="scroll-mt-6 border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="font-display text-2xl font-normal text-ink sm:text-3xl">
            La plateforme, module par module
          </h2>
          <p className="mt-3 max-w-2xl text-ink-muted">
            Pactiva se construit comme un ensemble de systèmes complémentaires. Le système
            d'annotation est disponible dès aujourd'hui ; l'accès demande simplement un compte.
          </p>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {MODULES.map((m) => (
              <article
                key={m.title}
                className="flex flex-col rounded-xl border border-line bg-panel p-6"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      m.status === "available"
                        ? "rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                        : "rounded-full bg-panel-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted"
                    }
                  >
                    {m.status === "available" ? "Disponible" : "À venir"}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-medium text-ink">{m.title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-muted">{m.body}</p>
                {m.status === "available" && m.href ? (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {/* Mention explicite : le système d'annotation exige une connexion. */}
                    <span
                      data-testid="annotation-login-required"
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted"
                    >
                      <Lock size={12} aria-hidden /> Connexion requise — accès réservé aux annotateurs
                    </span>
                    <Link
                      href={m.href}
                      data-testid="module-annotation"
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      Se connecter et accéder →
                    </Link>
                  </div>
                ) : (
                  <span className="mt-4 text-sm text-ink-muted">Bientôt disponible</span>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-2xl font-light text-ink sm:text-3xl">
            Donnez à vos juristes la vision d'ensemble.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">
            Multilingue, multi-documents, déployable chez vous. L'intelligence contractuelle
            enfin accessible aux ETI.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-accent px-6 py-3 font-medium text-accent-fg hover:brightness-110"
            >
              Créer un compte
            </Link>
            <Link
              href="/home"
              className="rounded-md border border-line px-6 py-3 font-medium text-ink hover:bg-panel-muted"
            >
              Accéder au système d'annotation
            </Link>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            Une question ? Écrivez-nous à{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              data-testid="contact-email"
              className="font-medium text-accent hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 sm:flex-row sm:justify-between">
          <div className="text-brand-navy-500">
            <Logo size={22} />
            <p className="mt-2 text-xs text-ink-muted">
              Intelligence contractuelle souveraine pour les ETI européennes.
            </p>
            <p className="text-xs text-ink-muted">
              Une solution développée en collaboration avec des docteurs en droit.
            </p>
            <p className="mt-2 text-xs">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-ink-muted hover:text-ink"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-4 text-sm text-ink-muted">
            <Link href="/public" className="hover:text-ink">
              Projets publiés
            </Link>
            <Link href="/home" className="hover:text-ink">
              Système d'annotation
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
              Contact
            </a>
            <Link href="/login" className="hover:text-ink">
              Se connecter
            </Link>
          </nav>
        </div>
        <p className="pb-8 text-center text-xs text-ink-muted">© 2026 Pactiva</p>
      </footer>
    </main>
  );
}

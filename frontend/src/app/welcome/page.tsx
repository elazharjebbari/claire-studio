/**
 * Landing publique (chantier E) — explique la valeur et le fonctionnement de
 * CLAIRE Studio, puis invite à se connecter / créer un compte. Route publique
 * (hors (app), sans authentification). Page statique (aucun hook client).
 */

import Link from "next/link";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "1 · Segmentez",
    body: "Découpez chaque contrat en clauses et posez les frontières — au clic ou au clavier.",
  },
  {
    title: "2 · Thématisez",
    body: "Attribuez un thème (vocabulaire fermé, couleurs) et notez votre certitude 0–3.",
  },
  {
    title: "3 · Arbitrez",
    body: "Comparez les propositions des LLM (Claude/Codex), adoptez-les ou tranchez vous-même.",
  },
];

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: "L'humain décide",
    body: "Votre annotation démarre vide : le LLM ne fait que proposer, vous validez au fur et à mesure.",
  },
  {
    title: "Injustice CLAUDETTE",
    body: "Surimpression des catégories d'injustice (UNFAIR-ToS) pour repérer les clauses sensibles.",
  },
  {
    title: "Collaboration & versions",
    body: "Historique immuable, divergences, commentaires et IAA entre annotateurs.",
  },
  {
    title: "Multi-corpus",
    body: "Générique : branchez votre propre corpus et votre schéma d'annotation, pas seulement CLAUDETTE.",
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      {/* Barre publique */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold">
          CLAIRE<span className="text-accent"> Studio</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/public" data-testid="welcome-public" className="text-ink-muted hover:text-ink">
            Projets publiés
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
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          L'atelier d'annotation des clauses contractuelles
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
          CLAIRE Studio aide les juristes et chercheurs à annoter des conditions
          d'utilisation : segmentation en clauses, thèmes, certitude, et appui sur les
          pré-annotations LLM et l'overlay d'injustice CLAUDETTE — l'humain garde la
          décision finale.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:brightness-110"
          >
            Commencer
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-line px-4 py-2 font-medium hover:bg-panel-muted"
          >
            J'ai déjà un compte
          </Link>
        </div>
      </section>

      {/* Fonctionnement */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Atouts */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-semibold text-ink">{f.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-muted">
        CLAIRE Studio — LORIA / Université de Lorraine · partenaire Batt &amp; Associés
      </footer>
    </main>
  );
}

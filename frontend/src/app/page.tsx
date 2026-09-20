/**
 * Reviewer page of pactiva.legal (English, light institutional theme) — the companion page of the
 * JURIX 2026 short paper "A Thematic Layer for CLAUDETTE" (docs/pactiva-reviewer-demo).
 *
 * Server component: the static sections read `public/downloads/RELEASE.json` at build time
 * (generated, never typed by hand); the only client part is the classifier panel, which talks to
 * the public demo API (AllowAny). The former French institutional page lives at `/presentation`.
 */

import Link from "next/link";
import { ExternalLink, LogIn, ScrollText } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Disclosure } from "@/components/ui/Disclosure";
import { DemoPanel } from "@/features/demo/DemoPanel";
import { Codebook, DownloadsGrid, KeyFigures, Protocol, type Release } from "@/features/demo/ReleaseSections";
import releaseJson from "../../public/downloads/RELEASE.json";

const release = releaseJson as unknown as Release;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@pactiva.legal";
const GITHUB_URL = "https://github.com/elazharjebbari/claire-studio";

export const metadata = {
  title: "A Thematic Layer for CLAUDETTE",
  description:
    "Companion page for reviewers: the thematic layer with its individual votes, the frozen gold standard, the LLM judges and their prompts, the frozen taxonomies, and a fine-tuned Legal-BERT you can run on your own text.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-12">
      <h2 id={`${id}-title`} className="font-display text-2xl font-light tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ReviewerPage() {
  const judgeIds = release.judges.map((j) => j.id);
  return (
    <main className="theme-light min-h-screen bg-bg text-ink">
      <a href="#try" className="skip-link">
        Skip to the classifier
      </a>
      <header className="sticky top-0 z-10 border-b border-line/60 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" aria-label="Pactiva — home" className="text-brand-navy-500">
            <Logo size={26} />
          </Link>
          <nav aria-label="Sections" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href="#try" className="text-ink-muted hover:text-ink">Try the classifier</a>
            <a href="#data" className="text-ink-muted hover:text-ink">Data</a>
            <a href="#figures" className="text-ink-muted hover:text-ink">Key figures</a>
            <a href="#protocol" className="text-ink-muted hover:text-ink">Protocol</a>
            <a href="#platform" className="text-ink-muted hover:text-ink">Platform</a>
            <Link href="/login" data-testid="welcome-login" className="text-ink-muted hover:text-ink">
              Sign in
            </Link>
            <Link href="/presentation" data-testid="welcome-presentation" className="text-ink-muted hover:text-ink" lang="fr">
              Français
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-10 pt-12 text-center sm:pt-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-muted">JURIX 2026 · companion page for reviewers</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-light leading-tight tracking-tight text-ink sm:text-5xl">
          A Thematic Layer for CLAUDETTE
        </h1>
        <p className="mx-auto mt-3 max-w-2xl font-display text-xl text-accent">
          Separating the cost of multi-label annotation from the effect of taxonomy granularity
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">
          The CLAUDETTE / UNFAIR-ToS corpus records whether a sentence is unfair, never what the clause is about. This page gives reviewers
          everything the paper releases: the thematic layer with its individual votes, the frozen gold standard, the four LLM judges and their
          exact prompts, the frozen taxonomies, the codebook and the protocol — and a fine-tuned Legal-BERT you can run on your own text.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href="#try" data-testid="hero-try" className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-fg hover:brightness-110">
            Try the classifier
          </a>
          <a href="#data" className="rounded-md border border-line bg-panel px-5 py-2.5 font-medium text-ink hover:bg-panel-muted">
            Download the data
          </a>
          <Link href="/login" data-testid="welcome-signup" className="rounded-md border border-line bg-panel px-5 py-2.5 font-medium text-ink hover:bg-panel-muted">
            Open the annotation platform
          </Link>
        </div>
        <p className="mt-8 font-mono text-[12px] text-ink-muted" data-testid="hero-fingerprint">
          Dataset fingerprint {release.datasetFingerprint.slice(0, 16)} · {release.counts.documents} contracts · {release.counts.sentences.toLocaleString("en-GB")} sentences ·{" "}
          {release.counts.annotators} trained annotators · {release.counts.judges.length} LLM judges
        </p>
      </section>

      <div className="h-px bg-gold/60" aria-hidden />

      <Section id="try" title="Try the classifier">
        <p className="mb-5 max-w-3xl text-sm text-ink-muted">
          Legal-BERT fine-tuned with the paper&apos;s recipe on the 33 design contracts (11-theme taxonomy, ±1 sentence of context, 8 epochs, seed
          42). The 17 contracts offered below were never seen during training. Your text is processed once and not stored.
        </p>
        <DemoPanel judgeIds={judgeIds} />
      </Section>

      <div className="h-px bg-line" aria-hidden />

      <Section id="data" title="What we release">
        <DownloadsGrid release={release} />
      </Section>

      <div className="h-px bg-line" aria-hidden />

      <Section id="figures" title="Key figures">
        <KeyFigures release={release} />
      </Section>

      <div className="h-px bg-line" aria-hidden />

      <Section id="protocol" title="Protocol and codebook">
        <div className="flex flex-col gap-3">
          <Disclosure summary="Protocol" testId="protocol" defaultOpen>
            <Protocol />
          </Disclosure>
          <div id="codebook" className="scroll-mt-20">
            <Disclosure summary="Codebook — the 20 themes and the 11-theme consolidation" testId="codebook">
              <Codebook />
            </Disclosure>
          </div>
        </div>
      </Section>

      <div className="h-px bg-line" aria-hidden />

      <Section id="platform" title="The annotation platform">
        <p className="max-w-3xl text-sm text-ink-muted">
          Pactiva is the platform the layer was produced, arbitrated and exported with. Public projects are open to everyone; the annotation
          workshop, the gold arbitration cockpit and the experiment lab require an account.
        </p>
        <div className="mt-4 max-w-3xl rounded-lg border border-line bg-panel p-4 text-sm" data-testid="reviewer-access">
          <p className="font-medium text-ink">Reviewer access</p>
          <p className="mt-1 text-ink-muted">
            A shared reviewer account gives read access to the 150 annotation sessions of the campaign (frozen, with annotators shown as
            A1–A3), the human–judge comparison views and the concordance figures, plus a sandbox project on the same 50 contracts where you
            can annotate yourself; your sessions stay yours and never enter the released layer. The credentials are provided with the
            submission; they can also be requested by e-mail.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/public" data-testid="welcome-public" className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2 text-sm font-medium text-ink hover:bg-panel-muted">
            <ScrollText size={16} aria-hidden /> Public projects
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2 text-sm font-medium text-ink hover:bg-panel-muted">
            <LogIn size={16} aria-hidden /> Sign in
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2 text-sm font-medium text-ink hover:bg-panel-muted">
            <ExternalLink size={16} aria-hidden /> Source on GitHub
          </a>
        </div>
      </Section>

      <footer className="border-t border-line bg-panel-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-[13px] text-ink-muted">
          <p>
            <strong className="text-ink">Cite:</strong> El Azhar Jebbari A., Lamirel J.-C., Boulaich F. Z., Ouali F. <em>A Thematic Layer for CLAUDETTE: Separating the Cost of
            Multi-Label Annotation from the Effect of Taxonomy Granularity.</em> JURIX 2026 (short paper, under review). A companion long paper,{" "}
            <em>Executing the Grey List</em>, builds on this layer.
          </p>
          <p>
            Annotation layer, prompts, taxonomies and code: released under an open licence upon publication. CLAUDETTE sentences remain under their
            own licence and are shown here for consultation only.
          </p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} data-testid="contact-email" className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            · LORIA, Université de Lorraine, CNRS, Inria ·{" "}
            <Link href="/presentation" className="text-accent hover:underline" lang="fr">
              Présentation de Pactiva (français)
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
